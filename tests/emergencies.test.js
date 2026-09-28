import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const rows = new Map();
  const cloud = new Map();
  let nextId = 1;
  let nextCloudId = 1;
  const emergencies = {
    add: vi.fn(async (row) => {
      const id = nextId++;
      rows.set(id, { ...row, id });
      return id;
    }),
    get: vi.fn(async (id) => rows.get(id)),
    update: vi.fn(async (id, patch) => Object.assign(rows.get(id), patch)),
    where: vi.fn(() => ({ equals: () => ({
      toArray: async () => [...rows.values()].filter((row) => row.synced === 0),
    }) })),
  };
  return {
    rows,
    cloud,
    emergencies,
    setDoc: vi.fn(async (reference, payload, options) => {
      const previous = cloud.get(reference.id) || {};
      cloud.set(reference.id, options?.merge ? { ...previous, ...payload } : { ...payload });
    }),
    allocations: vi.fn(() => `emergency-cloud-${nextCloudId++}`),
    reset: () => { rows.clear(); cloud.clear(); nextId = 1; nextCloudId = 1; },
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }),
  doc: (parent, name, id) => id === undefined
    ? { id: state.allocations(), collection: parent.name }
    : { id, collection: name },
  setDoc: state.setDoc,
  Timestamp: { fromDate: (date) => ({ iso: date.toISOString() }) },
}));
vi.mock('../src/lib/firebase.js', () => ({ db: {} }));
vi.mock('../src/lib/db.js', () => ({ default: {
  emergencies: state.emergencies,
  transaction: async (_mode, _table, action) => action(),
} }));

import { RED_FLAG_PROTOCOL } from '../src/protocols/redFlagProtocol.js';
import { emergencyEventSchema, localEmergencySchema } from '../src/schemas/emergencyRecord.js';
import {
  buildEmergencyRecord, pushEmergencyToFirestore, saveEmergency,
  saveEmergencyLocally, serializeEmergencyForFirestore, syncPendingEmergencies,
} from '../src/lib/emergencies.js';

const nik = '3201234567890001';
const user = { uid: 'relawan-123' };
const profile = { role: 'relawan', name: 'Rina', poskoName: 'Posko Barat', poskoLat: -6.2, poskoLng: 106.8 };
const assessment = { relawanId: user.uid, patient: { nik, nama: 'Siti' } };
const gate = 'redflag.immediate_harm';
const input = (overrides = {}) => ({ user, userProfile: profile, assessment, gates: [gate], ...overrides });
const event = (overrides = {}) => buildEmergencyRecord(input(overrides));

beforeEach(() => {
  state.reset();
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('provisional Red Flag contract', () => {
  it('has exactly three stable indicators and accepts a linked T0-Suspect event', () => {
    expect(RED_FLAG_PROTOCOL.version).toBe('redflag-prototype-v1');
    expect(RED_FLAG_PROTOCOL.indicators.map((item) => item.id)).toEqual([
      'redflag.immediate_harm', 'redflag.severe_mental_state', 'redflag.acute_medical',
    ]);
    expect(event()).toMatchObject({ patientNik: nik, patientName: 'Siti', relawanId: user.uid,
      gates: [gate], status: 't0-suspect', protocolVersion: RED_FLAG_PROTOCOL.version });
  });

  it('rejects zero, unknown, or duplicate gates and malformed version or status', () => {
    for (const gates of [[], ['redflag.unknown'], [gate, gate]]) {
      expect(() => event({ gates })).toThrow();
    }
    expect(emergencyEventSchema.safeParse({ ...event(), protocolVersion: 'old' }).success).toBe(false);
    expect(emergencyEventSchema.safeParse({ ...event(), status: 't0-confirmed' }).success).toBe(false);
    expect(emergencyEventSchema.safeParse({ ...event(), timestamp: 'not-a-date' }).success).toBe(false);
  });

  it('allows no patient but only links an assessment owned by the current Relawan', () => {
    expect(event({ assessment: null })).not.toHaveProperty('patientNik');
    expect(event({ assessment: { ...assessment, relawanId: 'another-relawan' } })).not.toHaveProperty('patientNik');
    expect(event()).toHaveProperty('patientNik', nik);
    expect(() => event({ assessment: { relawanId: user.uid, patient: { nik: 'invalid' } } })).toThrow();
  });

  it('uses only meaningful profile metadata and a valid coordinate pair, including zero', () => {
    expect(event()).toMatchObject({ poskoName: 'Posko Barat', lat: -6.2, lng: 106.8 });
    expect(event({ userProfile: { role: 'relawan', poskoLat: 0, poskoLng: 0 } })).toMatchObject({ lat: 0, lng: 0 });
    expect(event({ userProfile: { role: 'relawan', poskoName: '  ' } })).not.toHaveProperty('poskoName');
    for (const coordinates of [
      { poskoLat: -6.2 }, { poskoLat: '-6.2', poskoLng: 106.8 },
      { poskoLat: 91, poskoLng: 106.8 }, { poskoLat: -6.2, poskoLng: Infinity },
    ]) {
      const record = event({ userProfile: { role: 'relawan', ...coordinates } });
      expect(record).not.toHaveProperty('lat');
      expect(record).not.toHaveProperty('lng');
    }
    for (const bad of [{ lat: -6.2 }, { lat: '-6.2', lng: 106.8 }, { lat: 91, lng: 106.8 }]) {
      expect(emergencyEventSchema.safeParse({ ...event({ userProfile: { role: 'relawan' } }), ...bad }).success).toBe(false);
    }
  });

  it('trims optional notes and rejects extra future-only fields', () => {
    expect(event({ note: '  Perlu bantuan  ' }).note).toBe('Perlu bantuan');
    expect(event({ note: '   ' })).not.toHaveProperty('note');
    expect(emergencyEventSchema.safeParse({ ...event(), confirmedAt: 'later' }).success).toBe(false);
  });
});

describe('local-first emergency persistence and cloud retry', () => {
  it('writes a validated local row as pending before cloud upload', async () => {
    const { id, upload } = await saveEmergency(input());
    expect(state.rows.get(id)).toMatchObject({ synced: 0 });
    expect(await upload).toEqual({ synced: true });
    expect(state.emergencies.add.mock.invocationCallOrder[0]).toBeLessThan(state.setDoc.mock.invocationCallOrder[0]);
    expect(state.rows.get(id).synced).toBe(1);
    expect(state.rows.get(id).firestoreId).toEqual(expect.any(String));
    expect(state.setDoc).toHaveBeenCalledWith(expect.objectContaining({ id: state.rows.get(id).firestoreId }),
      expect.any(Object), { merge: true });
  });

  it('rejects invalid events and a failed IndexedDB insert without attempting cloud upload', async () => {
    await expect(saveEmergencyLocally({ ...event(), gates: [] })).rejects.toThrow();
    expect(state.emergencies.add).not.toHaveBeenCalled();
    state.emergencies.add.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    await expect(saveEmergency(input())).rejects.toThrow('IndexedDB unavailable');
    expect(state.setDoc).not.toHaveBeenCalled();
  });

  it('persists offline without allocating or writing a Firestore document', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { id, upload } = await saveEmergency(input({ assessment: null }));
    expect(await upload).toEqual({ synced: false });
    expect(state.rows.get(id)).toMatchObject({ synced: 0, firestoreId: null });
    expect(state.rows.get(id)).not.toHaveProperty('patientNik');
    expect(state.allocations).not.toHaveBeenCalled();
    expect(state.setDoc).not.toHaveBeenCalled();
  });

  it('keeps a failed online upload pending and retries the exact same cloud ID', async () => {
    state.setDoc.mockRejectedValueOnce(new Error('network failure'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { id, upload } = await saveEmergency(input());
      expect(await upload).toEqual({ synced: false });
      const firestoreId = state.rows.get(id).firestoreId;
      expect(state.rows.get(id).synced).toBe(0);
      expect((await syncPendingEmergencies())).toEqual({ synced: 1, failed: 0 });
      expect(state.setDoc.mock.calls.map(([reference]) => reference.id)).toEqual([firestoreId, firestoreId]);
      expect(state.allocations).toHaveBeenCalledOnce();
      expect(state.rows.get(id).synced).toBe(1);
    } finally {
      log.mockRestore();
    }
  });

  it('reuses the cloud ID after setDoc succeeds but local synced update fails', async () => {
    const id = await saveEmergencyLocally(event());
    state.emergencies.update.mockImplementationOnce(async (rowId, patch) => Object.assign(state.rows.get(rowId), patch));
    state.emergencies.update.mockRejectedValueOnce(new Error('local mark failed'));
    await expect(pushEmergencyToFirestore(id)).rejects.toThrow('local mark failed');
    const firestoreId = state.rows.get(id).firestoreId;
    expect(state.rows.get(id).synced).toBe(0);
    state.cloud.set(firestoreId, { ...state.cloud.get(firestoreId),
      validation: { outcome: 't0-confirmed' }, referral: { status: 'waiting-dispatch' },
      independentCloudMetadata: 'preserve me' });
    const beforeRetry = structuredClone(state.cloud.get(firestoreId));
    await pushEmergencyToFirestore(id);
    expect(state.setDoc.mock.calls.map(([reference]) => reference.id)).toEqual([firestoreId, firestoreId]);
    expect(state.allocations).toHaveBeenCalledOnce();
    expect(state.cloud.get(firestoreId).independentCloudMetadata).toBe('preserve me');
    expect(state.cloud.get(firestoreId)).toEqual(beforeRetry);
    expect(state.cloud.size).toBe(1);
  });

  it('keeps a changed origin pending when a field-level policy rejects its retry', async () => {
    const id = await saveEmergencyLocally(event());
    state.emergencies.update.mockImplementationOnce(async (rowId, patch) => Object.assign(state.rows.get(rowId), patch));
    state.emergencies.update.mockRejectedValueOnce(new Error('local mark failed'));
    await expect(pushEmergencyToFirestore(id)).rejects.toThrow('local mark failed');
    const firestoreId = state.rows.get(id).firestoreId;
    const original = state.cloud.get(firestoreId);
    state.rows.get(id).note = 'changed after creation';
    state.setDoc.mockImplementationOnce(async (_reference, payload) => {
      if (Object.entries(payload).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key]))) {
        throw new Error('permission-denied');
      }
    });
    await expect(pushEmergencyToFirestore(id)).rejects.toThrow('permission-denied');
    expect(state.rows.get(id).synced).toBe(0);
    expect(state.cloud.get(firestoreId)).toEqual(original);
  });

  it('serializes only event fields and Firestore timestamps', async () => {
    const id = await saveEmergencyLocally(event({ note: '  Catatan  ' }));
    const local = state.rows.get(id);
    const cloud = serializeEmergencyForFirestore(local);
    expect(localEmergencySchema.safeParse(local).success).toBe(true);
    expect(cloud).toMatchObject({ gates: [gate], note: 'Catatan', status: 't0-suspect',
      timestamp: { iso: local.timestamp }, createdAt: { iso: local.timestamp } });
    for (const key of ['id', 'synced', 'firestoreId', 'tier', 'confirmedAt']) {
      expect(cloud).not.toHaveProperty(key);
    }
  });

  it('coalesces concurrent uploads of one row', async () => {
    const id = await saveEmergencyLocally(event());
    const [first, second] = await Promise.all([pushEmergencyToFirestore(id), pushEmergencyToFirestore(id)]);
    expect(first).toBe(second);
    expect(state.setDoc).toHaveBeenCalledOnce();
    expect(state.allocations).toHaveBeenCalledOnce();
  });
});
