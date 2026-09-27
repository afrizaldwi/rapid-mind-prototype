import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  local: null,
  cloud: new Map(),
  auth: { currentUser: { uid: 'relawan-1' } },
  writes: [],
  failNextWrite: false,
  failNextCanonicalRead: false,
  failNextDuplicateRead: false,
  cloudReads: 0,
}));

vi.mock('../src/lib/firebase.js', () => ({ db: {}, auth: state.auth }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }),
  doc: (_db, name, id) => ({ name, id }),
  query: (collectionRef, ...filters) => ({ collectionRef, filters }),
  where: (field, operator, value) => ({ field, operator, value }),
  getDocFromServer: async (reference) => {
    state.cloudReads++;
    if (state.failNextCanonicalRead) {
      state.failNextCanonicalRead = false;
      throw new Error('canonical lookup failed');
    }
    return {
      id: reference.id,
      exists: () => state.cloud.has(reference.id),
      data: () => state.cloud.get(reference.id),
    };
  },
  getDocsFromServer: async (queryRef) => {
    state.cloudReads++;
    if (state.failNextDuplicateRead) {
      state.failNextDuplicateRead = false;
      throw new Error('duplicate lookup failed');
    }
    return {
      docs: [...state.cloud.entries()]
        .filter(([, data]) => data.nik === queryRef.filters[0].value)
        .map(([id, data]) => ({ id, data: () => data })),
    };
  },
  serverTimestamp: () => ({ serverTimestampMarker: true }),
  runTransaction: async (_db, callback) => {
    let pending = null;
    const transaction = {
      get: async (reference) => ({ exists: () => state.cloud.has(reference.id) }),
      set: (reference, data) => { pending = { reference, data }; },
    };
    const result = await callback(transaction);
    if (pending) {
      if (state.failNextWrite) {
        state.failNextWrite = false;
        throw new Error('write failed');
      }
      state.cloud.set(pending.reference.id, pending.data);
      state.writes.push(pending);
    }
    return result;
  },
}));

vi.mock('../src/lib/db.js', () => ({
  default: {
    patients: {
      where: () => ({ equals: () => ({ first: async () => state.local }) }),
      get: async (id) => state.local?.id === id ? state.local : null,
      update: async (_id, patch) => Object.assign(state.local, patch),
      add: async (record) => { state.local = { ...record, id: 1 }; return 1; },
    },
    patientConflicts: {
      where: () => ({ equals: () => ({
        first: async () => null,
        and: () => ({ first: async () => null, toArray: async () => [] }),
      }) }),
      add: async () => {},
    },
    transaction: async (...args) => args.at(-1)(),
  },
}));

import { pushPatientToFirestore } from '../src/lib/patients.js';

const nik = '3201234567890001';
const pendingPatient = (overrides = {}) => ({
  id: 1, nik, nama: 'Siti', usia: 34, jenisKelamin: 'P', poskoName: 'Posko A',
  registeredAt: '2026-09-27T10:00:00.000Z', lastPhase: 'akut',
  pfaCompleted: false, syncStatus: 'pending', ...overrides,
});

beforeEach(() => {
  state.local = pendingPatient();
  state.cloud.clear();
  state.writes.length = 0;
  state.failNextWrite = false;
  state.failNextCanonicalRead = false;
  state.failNextDuplicateRead = false;
  state.cloudReads = 0;
  state.auth.currentUser = { uid: 'relawan-1' };
});

describe('historical patient uploader attribution', () => {
  it('persists authenticated registeredBy before first canonical cloud create', async () => {
    const result = await pushPatientToFirestore(nik);
    expect(state.local.registeredBy).toBe('relawan-1');
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].reference.id).toBe(nik);
    expect(state.writes[0].data.registeredBy).toBe('relawan-1');
    expect(result.patient.syncStatus).toBe('synced');
  });

  it('keeps attribution across a failed write and refuses a different login', async () => {
    state.failNextWrite = true;
    await expect(pushPatientToFirestore(nik)).rejects.toThrow('write failed');
    expect(state.local.registeredBy).toBe('relawan-1');
    state.auth.currentUser = { uid: 'relawan-2' };
    await expect(pushPatientToFirestore(nik)).rejects.toThrow('terikat ke akun Relawan lain');
    expect(state.writes).toHaveLength(0);
    state.auth.currentUser = { uid: 'relawan-1' };
    await pushPatientToFirestore(nik);
    expect(state.writes).toHaveLength(1);
  });

  it.each([
    ['canonical lookup', 'failNextCanonicalRead', 'canonical lookup failed'],
    ['duplicate lookup', 'failNextDuplicateRead', 'duplicate lookup failed'],
  ])('keeps attribution when the pre-create %s fails', async (_name, failureFlag, errorMessage) => {
    state[failureFlag] = true;
    await expect(pushPatientToFirestore(nik)).rejects.toThrow(errorMessage);
    expect(state.local.registeredBy).toBe('relawan-1');
    expect(state.writes).toHaveLength(0);

    const readsAfterFailure = state.cloudReads;
    state.auth.currentUser = { uid: 'relawan-2' };
    await expect(pushPatientToFirestore(nik)).rejects.toThrow('terikat ke akun Relawan lain');
    expect(state.cloudReads).toBe(readsAfterFailure);
    expect(state.writes).toHaveLength(0);

    state.auth.currentUser = { uid: 'relawan-1' };
    await pushPatientToFirestore(nik);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].data.registeredBy).toBe('relawan-1');
  });

  it('does not overwrite an already attributed modern patient', async () => {
    state.local = pendingPatient({ registeredBy: 'relawan-1' });
    state.auth.currentUser = { uid: 'relawan-2' };
    await expect(pushPatientToFirestore(nik)).rejects.toThrow('terikat ke akun Relawan lain');
    expect(state.writes).toHaveLength(0);
  });
});
