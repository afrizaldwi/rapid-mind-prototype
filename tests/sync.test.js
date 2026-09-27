import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const rows = new Map();
  let nextLocalId = 1;
  let nextCloudId = 1;
  const cases = {
    get: vi.fn(async (id) => rows.get(id)),
    add: vi.fn(async (row) => {
      const id = nextLocalId++;
      rows.set(id, { ...row, localId: id });
      return id;
    }),
    update: vi.fn(async (id, patch) => Object.assign(rows.get(id), patch)),
    where: vi.fn(() => ({
      equals: () => ({
        toArray: async () =>
          [...rows.values()].filter((row) => row.synced === 0),
        count: async () =>
          [...rows.values()].filter((row) => row.synced === 0).length,
      }),
    })),
  };
  return {
    rows,
    cases,
    reset: () => {
      rows.clear();
      nextLocalId = 1;
      nextCloudId = 1;
    },
    nextCloudId: () => `new-cloud-${nextCloudId++}`,
    setDoc: vi.fn(async () => {}),
    findLocalPatientByNik: vi.fn(),
    findCloudPatientByNik: vi.fn(),
    pushPatientToFirestore: vi.fn(),
    syncPendingPatients: vi.fn(),
    syncPendingEmergencies: vi.fn(),
    emergencyPending: 0,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: (_db, name) => ({ name }),
  doc: (parent, name, id) =>
    id === undefined
      ? { id: state.nextCloudId(), collection: parent.name }
      : { id, collection: name },
  setDoc: state.setDoc,
  Timestamp: { fromDate: (date) => ({ iso: date.toISOString() }) },
}));
vi.mock("../src/lib/firebase.js", () => ({ db: {}, auth: { currentUser: { uid: "relawan-123" } } }));
vi.mock("../src/lib/db.js", () => ({
  default: {
    cases: state.cases,
    patients: {
      where: () => ({
        equals: () => ({ count: async () => 0, toArray: async () => [] }),
      }),
    },
    patientConflicts: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
    },
    emergencies: {
      where: () => ({ equals: () => ({ count: async () => state.emergencyPending }) }),
    },
    transaction: async (_mode, _table, action) => action(),
  },
}));
vi.mock("../src/lib/emergencies.js", () => ({
  syncPendingEmergencies: state.syncPendingEmergencies,
}));
vi.mock("../src/lib/patients.js", () => ({
  findLocalPatientByNik: state.findLocalPatientByNik,
  findCloudPatientByNik: state.findCloudPatientByNik,
  pushPatientToFirestore: state.pushPatientToFirestore,
  syncPendingPatients: state.syncPendingPatients,
}));

import {
  pushCaseToFirestore,
  getSyncCounts,
  isSyncComplete,
  saveCaseLocally,
  syncPendingCases,
  syncPendingData,
} from "../src/lib/sync.js";
import { auth } from "../src/lib/firebase.js";
import { buildSrq20CaseRecord } from "../src/lib/longitudinalAssessment.js";
import { SRQ20_PROTOCOL } from "../src/protocols/srq20Protocol.js";
import { RISK_FUNCTION_PROTOCOL } from "../src/protocols/riskFunctionProtocol.js";

const nik = "3201234567890001";
const pfa = (overrides = {}) => ({
  recordType: "pfa",
  protocolVersion: "demo-v1",
  patientNik: nik,
  relawanId: "relawan-123",
  relawanName: "Rina",
  phase: "akut",
  responses: { "look-1": true },
  timestamp: "2026-09-26T00:00:00.000Z",
  ...overrides,
});
const pending = (record = pfa()) => {
  const localCase = {
    ...record,
    localId: state.rows.size + 1,
    synced: 0,
    firestoreId: record.firestoreId ?? null,
  };
  state.rows.set(localCase.localId, localCase);
  return localCase;
};
const payload = () => state.setDoc.mock.calls[0][1];

beforeEach(() => {
  auth.currentUser = { uid: "relawan-123" };
  state.reset();
  state.emergencyPending = 0;
  vi.clearAllMocks();
  state.findLocalPatientByNik.mockResolvedValue({ nik, syncStatus: "synced" });
  state.findCloudPatientByNik.mockResolvedValue(null);
  state.pushPatientToFirestore.mockResolvedValue({
    patient: { nik, syncStatus: "synced" },
  });
  state.syncPendingPatients.mockResolvedValue({ synced: 0, failed: 0 });
  state.syncPendingEmergencies.mockResolvedValue({ synced: 0, failed: 0 });
});

describe("local case save boundary", () => {
  it("stores a valid typed case as pending with a timestamp and no cloud ID", async () => {
    const localId = await saveCaseLocally(pfa());
    expect(state.cases.add).toHaveBeenCalledOnce();
    expect(state.rows.get(localId)).toMatchObject({
      recordType: "pfa",
      synced: 0,
      firestoreId: null,
    });
    expect(Number.isNaN(Date.parse(state.rows.get(localId).timestamp))).toBe(
      false,
    );
  });

  it("rejects malformed PFA before writing the local store", async () => {
    await expect(saveCaseLocally(pfa({ zona: "hijau" }))).rejects.toThrow();
    expect(state.cases.add).not.toHaveBeenCalled();
  });
});

describe("patient-first case cloud write", () => {
  it("uploads a linked case with an already synced patient without resyncing the patient", async () => {
    const localCase = pending();
    await pushCaseToFirestore(localCase);
    expect(state.pushPatientToFirestore).not.toHaveBeenCalled();
    expect(state.setDoc).toHaveBeenCalledOnce();
    expect(state.rows.get(localCase.localId).synced).toBe(1);
  });

  it("syncs a pending patient before writing its linked case", async () => {
    state.findLocalPatientByNik.mockResolvedValue({
      nik,
      syncStatus: "pending",
    });
    const localCase = pending();
    await pushCaseToFirestore(localCase);
    expect(state.pushPatientToFirestore).toHaveBeenCalledWith(nik);
    expect(
      state.pushPatientToFirestore.mock.invocationCallOrder[0],
    ).toBeLessThan(state.setDoc.mock.invocationCallOrder[0]);
    expect(state.rows.get(localCase.localId).synced).toBe(1);
  });

  it("leaves the case pending when patient sync throws or returns an unsafe state", async () => {
    state.findLocalPatientByNik.mockResolvedValue({
      nik,
      syncStatus: "pending",
    });
    state.pushPatientToFirestore.mockRejectedValueOnce(new Error("offline"));
    const first = pending();
    await expect(pushCaseToFirestore(first)).rejects.toThrow();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(first.synced).toBe(0);

    state.pushPatientToFirestore.mockResolvedValueOnce({
      patient: { nik, syncStatus: "conflict" },
    });
    const second = pending();
    await expect(pushCaseToFirestore(second)).rejects.toThrow();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(second.synced).toBe(0);
  });

  it("blocks the case when local patient lookup throws a conflict", async () => {
    state.findLocalPatientByNik.mockRejectedValueOnce(
      new Error("patient conflict"),
    );

    const localCase = pending();

    await expect(pushCaseToFirestore(localCase)).rejects.toThrow();

    expect(state.pushPatientToFirestore).not.toHaveBeenCalled();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(localCase.synced).toBe(0);
  });

  it("blocks a linked case when the local patient is conflicted", async () => {
    state.findLocalPatientByNik.mockResolvedValue({
      nik,
      syncStatus: "conflict",
    });
    const localCase = pending();
    await expect(pushCaseToFirestore(localCase)).rejects.toThrow();
    expect(state.pushPatientToFirestore).not.toHaveBeenCalled();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(localCase.synced).toBe(0);
  });

  it("requires a unique cloud confirmation when the local patient is missing", async () => {
    state.findLocalPatientByNik.mockResolvedValue(null);
    state.findCloudPatientByNik.mockResolvedValueOnce({
      documentId: nik,
      patient: { nik },
    });
    const confirmed = pending();
    await pushCaseToFirestore(confirmed);
    expect(state.setDoc).toHaveBeenCalledOnce();

    state.setDoc.mockClear();
    const absent = pending();
    await expect(pushCaseToFirestore(absent)).rejects.toThrow();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(absent.synced).toBe(0);

    state.findCloudPatientByNik.mockRejectedValueOnce(
      new Error("server unavailable"),
    );
    const unreachable = pending();
    await expect(pushCaseToFirestore(unreachable)).rejects.toThrow();
    expect(state.setDoc).not.toHaveBeenCalled();
    expect(unreachable.synced).toBe(0);
  });

  it("uploads old legacy triage without a patient link", async () => {
    pending({ zona: "kuning", timestamp: "2026-09-26T00:00:00.000Z" });
    await syncPendingCases();
    expect(state.findLocalPatientByNik).not.toHaveBeenCalled();
    expect(payload()).toMatchObject({ zona: "kuning", triageResult: "KUNING", uploadedBy: "relawan-123" });
    expect(payload()).not.toHaveProperty("recordType");
  });

  it("keeps historical uploader attribution after failure and denies a different login", async () => {
    const localCase = pending({ zona: "hijau", timestamp: "2026-09-26T00:00:00.000Z" });
    state.setDoc.mockRejectedValueOnce(new Error("write failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(pushCaseToFirestore(localCase)).rejects.toThrow("write failed");
    } finally {
      log.mockRestore();
    }
    expect(localCase.uploadedBy).toBe("relawan-123");
    const allocatedId = localCase.firestoreId;
    auth.currentUser = { uid: "other-relawan" };
    await expect(pushCaseToFirestore(localCase)).rejects.toThrow("terikat ke Relawan lain");
    expect(state.setDoc).toHaveBeenCalledOnce();
    auth.currentUser = { uid: "relawan-123" };
    await pushCaseToFirestore(localCase);
    expect(state.setDoc.mock.calls.map(([reference]) => reference.id)).toEqual([allocatedId, allocatedId]);
    expect(state.setDoc.mock.calls[1][1]).toEqual(state.setDoc.mock.calls[0][1]);
  });
});

describe("case serialization and retry", () => {
  it("saves and uploads a completed typed SRQ case without legacy fields or fabricated location", async () => {
    const assessment = {
      relawanId: "relawan-123",
      patient: { nik, nama: "Siti", usia: 34, jenisKelamin: "P", poskoName: "Posko Utama - Kota" },
      phase: "lanjutan", previousHistory: [], isNewPatient: false,
      startedAt: "2026-09-27T10:00:00.000Z",
    };
    const progress = {
      relawanId: assessment.relawanId, patientNik: nik, assessmentStartedAt: assessment.startedAt,
      srqProtocolVersion: SRQ20_PROTOCOL.version,
      riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
      inputMode: "nonverbal", currentStep: "risk-function",
      srqResponses: Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) => [id, index < 6])),
      riskFactors: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false])),
      functionalImpairment: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false])),
    };
    const record = buildSrq20CaseRecord(progress, assessment, { uid: assessment.relawanId }, { name: "Rina" });
    const localId = await saveCaseLocally(record);
    expect(state.rows.get(localId)).toMatchObject({ recordType: "srq20", synced: 0, firestoreId: null });

    await pushCaseToFirestore(state.rows.get(localId));
    expect(payload()).toMatchObject({
      recordType: "srq20", phase: "lanjutan", protocolVersion: SRQ20_PROTOCOL.version,
      responses: progress.srqResponses, inputMode: "nonverbal", srq20Score: 6, baseTier: "T2",
      riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
      riskFactors: progress.riskFactors, functionalImpairment: progress.functionalImpairment,
      classificationVersion: "classification-prototype-v1", tier: "T2",
    });
    for (const field of ["zona", "triageResult", "location", "poskoName", "riskFactorScore"]) {
      expect(payload()).not.toHaveProperty(field);
    }
  });

  it("keeps typed PFA fields and omits zones and fabricated location", async () => {
    await pushCaseToFirestore(pending());
    expect(payload()).toMatchObject({
      recordType: "pfa",
      protocolVersion: "demo-v1",
      patientNik: nik,
      phase: "akut",
      responses: { "look-1": true },
      relawanName: "Rina",
      timestamp: { iso: "2026-09-26T00:00:00.000Z" },
      createdAt: { iso: "2026-09-26T00:00:00.000Z" },
    });
    expect(payload()).not.toHaveProperty("zona");
    expect(payload()).not.toHaveProperty("triageResult");
    expect(payload()).not.toHaveProperty("location");
  });

  it.each([
    [
      "direct coordinates",
      { lat: -6.2, lng: 106.8 },
      { lat: -6.2, lng: 106.8 },
    ],
    [
      "posko coordinates",
      { poskoLat: -6.3, poskoLng: 106.9 },
      { lat: -6.3, lng: 106.9 },
    ],
    ["numeric zero", { lat: 0, lng: 0 }, { lat: 0, lng: 0 }],
  ])("serializes valid %s", async (_name, coordinates, expected) => {
    await pushCaseToFirestore(pending(pfa(coordinates)));
    expect(payload().location).toEqual(expected);
  });

  it.each([
    ["partial pair", { lat: -6.2 }],
    ["out of range", { lat: 91, lng: 106.8 }],
    ["nonnumeric coordinate", { lat: "-6.2", lng: 106.8 }],
  ])("omits location for %s", async (_name, coordinates) => {
    await pushCaseToFirestore(pending(pfa(coordinates)));
    expect(payload()).not.toHaveProperty("location");
  });

  it("reuses an existing Firestore ID and skips an already synced case", async () => {
    const localCase = pending(pfa({ firestoreId: "existing-firestore-id" }));
    await pushCaseToFirestore(localCase);
    expect(state.setDoc.mock.calls[0][0]).toMatchObject({
      collection: "cases",
      id: "existing-firestore-id",
    });
    expect(localCase.firestoreId).toBe("existing-firestore-id");
    await pushCaseToFirestore(localCase);
    expect(state.setDoc).toHaveBeenCalledOnce();
  });

  it("keeps the allocated Firestore ID after a failed write and reuses it on retry", async () => {
    const localCase = pending();
    state.setDoc.mockRejectedValueOnce(new Error("write failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(pushCaseToFirestore(localCase)).rejects.toThrow(
        "write failed",
      );
    } finally {
      log.mockRestore();
    }
    const allocatedId = localCase.firestoreId;
    expect(allocatedId).toBeTruthy();
    expect(localCase.synced).toBe(0);

    await pushCaseToFirestore(localCase);
    expect(state.setDoc.mock.calls.map(([reference]) => reference.id)).toEqual([
      allocatedId,
      allocatedId,
    ]);
    expect(localCase.synced).toBe(1);
  });
});

describe("batch sync", () => {
  it("runs patient, emergency, then case batches", async () => {
    pending();
    await syncPendingData();
    expect(state.syncPendingPatients.mock.invocationCallOrder[0]).toBeLessThan(
      state.syncPendingEmergencies.mock.invocationCallOrder[0],
    );
    expect(state.syncPendingEmergencies.mock.invocationCallOrder[0]).toBeLessThan(
      state.setDoc.mock.invocationCallOrder[0],
    );
  });

  it("still attempts emergencies after a patient batch failure", async () => {
    state.syncPendingPatients.mockRejectedValueOnce(new Error('patient directory unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await syncPendingData();
      expect(result.patients.failed).toBe(1);
      expect(state.syncPendingEmergencies).toHaveBeenCalledOnce();
      expect(result.emergencies).toEqual({ synced: 0, failed: 0 });
      expect(isSyncComplete(result, result.remaining)).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  it("does not let a patient conflict suppress emergency sync or linked-case gating", async () => {
    state.syncPendingPatients.mockResolvedValueOnce({ synced: 0, failed: 0, conflicts: 1 });
    state.syncPendingEmergencies.mockResolvedValueOnce({ synced: 1, failed: 0 });
    state.findLocalPatientByNik.mockRejectedValueOnce(new Error('patient conflict'));
    pending();
    const result = await syncPendingData();
    expect(result.emergencies.synced).toBe(1);
    expect(result.cases.failed).toBe(1);
    expect(state.setDoc).not.toHaveBeenCalled();
  });

  it("includes emergency rows in pending totals and completion status", async () => {
    state.emergencyPending = 2;
    const counts = await getSyncCounts();
    expect(counts).toEqual({ patients: 0, cases: 0, emergencies: 2, pending: 2, conflicts: 0 });
    const result = await syncPendingData();
    expect(result.remaining).toEqual(counts);
    expect(isSyncComplete(result, counts)).toBe(false);
    expect(isSyncComplete({ ...result, emergencies: { synced: 0, failed: 1 } },
      { ...counts, emergencies: 0, pending: 0 })).toBe(false);
    expect(isSyncComplete(result, { ...counts, emergencies: 0, pending: 0 })).toBe(true);
  });
});
