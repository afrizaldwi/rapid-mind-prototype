import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEMO_POSKOS } from '../src/data/demoPoskos.js';
import { canonicalPosko, parsePoskoResource, resourceQuantitiesSchema } from '../src/schemas/poskoResource.js';

const mocks = vi.hoisted(() => ({ onSnapshot: vi.fn(), runTransaction: vi.fn(),
  auth: { currentUser: { uid: 'admin-1' } }, stamp: { sentinel: 'server' } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }), doc: (_db, name, id) => ({ name, id }),
  onSnapshot: mocks.onSnapshot, runTransaction: mocks.runTransaction,
  serverTimestamp: () => mocks.stamp,
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth, db: {} }));
import { projectPoskoResources, savePoskoResource, watchPoskoResources } from '../src/lib/poskoResources.js';
import { assignmentPatch } from '../src/lib/relawanManagement.js';

const timestamp = { seconds: 1790640000, nanoseconds: 0,
  toDate: () => new Date('2026-09-29T00:00:00Z') };
const valid = (posko = DEMO_POSKOS[0]) => ({ schemaVersion: 'posko-resource-allocation-v1',
  poskoId: posko.id, poskoName: posko.name, medicinePackages: 0, medicalKits: 3,
  createdAt: timestamp, createdBy: 'admin-1', updatedAt: timestamp, updatedBy: 'admin-1' });
const item = (id, data) => ({ id, data: () => data });

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  mocks.auth.currentUser = { uid: 'admin-1' };
  vi.clearAllMocks();
});

describe('Posko catalog and resource schema', () => {
  it('has stable unique IDs and unchanged names/coordinates', () => {
    expect(DEMO_POSKOS).toEqual([
      { id: 'posko-utama-kota', name: 'Posko Utama - Kota', lat: -6.2088, lng: 106.8456 },
      { id: 'posko-barat-tangerang', name: 'Posko Barat - Tangerang', lat: -6.1781, lng: 106.6319 },
      { id: 'posko-timur-bekasi', name: 'Posko Timur - Bekasi', lat: -6.2383, lng: 106.9756 },
      { id: 'posko-selatan-depok', name: 'Posko Selatan - Depok', lat: -6.4025, lng: 106.7942 },
      { id: 'posko-utara-tangerang-selatan', name: 'Posko Utara - Tangerang Selatan', lat: -6.2894, lng: 106.7108 },
    ]);
    expect(new Set(DEMO_POSKOS.map((posko) => posko.id)).size).toBe(5);
    expect(new Set(DEMO_POSKOS.map((posko) => posko.name)).size).toBe(5);
    expect(Object.keys(assignmentPatch(DEMO_POSKOS[0].name)).sort()).toEqual(['poskoLat', 'poskoLng', 'poskoName']);
  });
  it('accepts zero and positive integers and rejects invalid identity, values, and extra fields', () => {
    expect(parsePoskoResource(DEMO_POSKOS[0].id, valid())).toEqual(valid());
    expect(resourceQuantitiesSchema.safeParse({ medicinePackages: 0, medicalKits: 7 }).success).toBe(true);
    for (const bad of [{ medicinePackages: -1 }, { medicalKits: 1.5 }, { medicinePackages: '4' }]) {
      expect(parsePoskoResource(DEMO_POSKOS[0].id, { ...valid(), ...bad })).toBeNull();
    }
    expect(parsePoskoResource('other', valid())).toBeNull();
    expect(parsePoskoResource('unknown', { ...valid(), poskoId: 'unknown' })).toBeNull();
    expect(parsePoskoResource(DEMO_POSKOS[0].id, { ...valid(), poskoName: DEMO_POSKOS[1].name })).toBeNull();
    expect(parsePoskoResource(DEMO_POSKOS[0].id, { ...valid(), extra: 1 })).toBeNull();
    expect(parsePoskoResource(DEMO_POSKOS[0].id, { ...valid(), createdAt: null })).toBeNull();
    expect(canonicalPosko('unknown')).toBeNull();
  });
});

describe('resource listener and writes', () => {
  it('orders canonical records, isolates malformed documents, and leaves missing absent', () => {
    const projected = projectPoskoResources([item(DEMO_POSKOS[2].id, valid(DEMO_POSKOS[2])),
      item('unknown', { ...valid(), poskoId: 'unknown' }), item(DEMO_POSKOS[1].id, { ...valid(DEMO_POSKOS[1]), extra: 1 }),
      item(DEMO_POSKOS[0].id, valid())]);
    expect(projected.resources.map((record) => record.poskoId)).toEqual([DEMO_POSKOS[0].id, DEMO_POSKOS[2].id]);
    expect(projected.rejected).toBe(2);
    expect(projected.invalidIds).toEqual([DEMO_POSKOS[1].id]);
    expect(projectPoskoResources([]).resources).toEqual([]);
  });
  it('propagates metadata with metadata changes enabled', () => {
    mocks.onSnapshot.mockImplementationOnce((_query, _options, callback) => {
      callback({ docs: [item(DEMO_POSKOS[0].id, valid())], metadata: { fromCache: true, hasPendingWrites: true } });
      return () => {};
    });
    const onData = vi.fn(); watchPoskoResources(onData, vi.fn());
    expect(mocks.onSnapshot.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
    expect(onData).toHaveBeenCalledWith(expect.objectContaining({ fromCache: true, pending: true, rejected: 0 }));
  });
  it('creates on canonical path with server audit and reads Admin session', async () => {
    const set = vi.fn(); const get = vi.fn().mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => false });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get, set }));
    await savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 0, medicalKits: 4 });
    expect(get.mock.calls[0][0]).toEqual({ name: 'users', id: 'admin-1' });
    expect(get.mock.calls[1][0]).toEqual({ name: 'poskoResources', id: DEMO_POSKOS[0].id });
    expect(set).toHaveBeenCalledWith({ name: 'poskoResources', id: DEMO_POSKOS[0].id },
      expect.objectContaining({ ...resourceQuantitiesSchema.parse({ medicinePackages: 0, medicalKits: 4 }),
        poskoId: DEMO_POSKOS[0].id, poskoName: DEMO_POSKOS[0].name,
        createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: mocks.stamp, updatedAt: mocks.stamp }));
  });
  it('updates only quantities and update audit; rejects malformed existing record', async () => {
    const update = vi.fn();
    const get = vi.fn().mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => valid() });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get, update }));
    await savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 2, medicalKits: 0 });
    expect(update).toHaveBeenCalledWith({ name: 'poskoResources', id: DEMO_POSKOS[0].id },
      { medicinePackages: 2, medicalKits: 0, updatedAt: mocks.stamp, updatedBy: 'admin-1' });
    const badGet = vi.fn().mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ ...valid(), extra: true }) });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get: badGet, update }));
    await expect(savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 2, medicalKits: 0 })).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('rejects offline, missing/non-Admin session, unknown Posko, and invalid inputs before mutation', async () => {
    await expect(savePoskoResource('unknown', { medicinePackages: 1, medicalKits: 1 })).rejects.toThrow();
    await expect(savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: '1', medicalKits: 1 })).rejects.toThrow();
    vi.stubGlobal('navigator', { onLine: false });
    await expect(savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 1, medicalKits: 1 })).rejects.toThrow();
    vi.stubGlobal('navigator', { onLine: true });
    mocks.auth.currentUser = null;
    await expect(savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 1, medicalKits: 1 })).rejects.toThrow();
    mocks.auth.currentUser = { uid: 'admin-1' };
    const get = vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ role: 'relawan' }) });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get, set: vi.fn() }));
    await expect(savePoskoResource(DEMO_POSKOS[0].id, { medicinePackages: 1, medicalKits: 1 })).rejects.toThrow();
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('resource Rules source contract', () => {
  it('declares strict Admin-only collection and immutable update fields', () => {
    const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    expect(rules).toContain('match /poskoResources/{poskoId}');
    expect(rules).toContain('allow get, list: if isAdmin();');
    expect(rules).toContain("data.schemaVersion == 'posko-resource-allocation-v1'");
    expect(rules).toContain("data.medicinePackages is int && data.medicinePackages >= 0");
    expect(rules).toContain("data.medicalKits is int && data.medicalKits >= 0");
    expect(rules).toContain("'medicinePackages', 'medicalKits', 'updatedAt', 'updatedBy'");
  });
});
