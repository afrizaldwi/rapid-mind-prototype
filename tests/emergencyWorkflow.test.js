import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const documents = new Map();
  const versions = new Map();
  const auth = { currentUser: { uid: 'nakes-1' } };
  return { documents, versions, auth, beforeCommit: null, writes: [], timestamp: null };
});

vi.mock('../src/lib/firebase.js', () => ({ db: {}, auth: state.auth }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  const resolveTimestamps = (value) => {
    if (value?.serverTimestampMarker) return state.timestamp;
    if (Array.isArray(value)) return value.map(resolveTimestamps);
    if (value && typeof value === 'object' && !(value instanceof actual.Timestamp)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTimestamps(item)]));
    }
    return value;
  };
  return {
    ...actual,
    doc: (_db, _collection, id) => ({ id }),
    serverTimestamp: () => ({ serverTimestampMarker: true }),
    runTransaction: async (_db, callback) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        let readVersion = null;
        let patch = null;
        const transaction = {
          get: async (reference) => {
            readVersion = state.versions.get(reference.id) ?? 0;
            return {
              id: reference.id,
              exists: () => state.documents.has(reference.id),
              data: () => state.documents.get(reference.id),
            };
          },
          update: (reference, update) => {
            patch = { id: reference.id, update };
          },
        };
        const result = await callback(transaction);
        if (state.beforeCommit) await state.beforeCommit();
        if (patch && state.versions.get(patch.id) !== readVersion) continue;
        if (patch) {
          state.documents.set(patch.id, {
            ...state.documents.get(patch.id),
            ...resolveTimestamps(patch.update),
          });
          state.versions.set(patch.id, readVersion + 1);
          state.writes.push(patch.update);
        }
        return result;
      }
      throw new Error('transaction retry limit');
    },
  };
});

import { Timestamp } from 'firebase/firestore';
import { advanceReferral, decideEmergency } from '../src/lib/emergencyWorkflow.js';

const gate = 'redflag.immediate_harm';
const origin = (overrides = {}) => ({
  protocolVersion: 'redflag-prototype-v1', status: 't0-suspect',
  relawanId: 'relawan-1', gates: [gate],
  timestamp: Timestamp.fromDate(new Date('2026-09-27T11:00:00.000Z')),
  ...overrides,
});

function put(id, data) {
  state.documents.set(id, data);
  state.versions.set(id, 0);
}

function confirmed() {
  const timestamp = state.timestamp;
  return {
    ...origin(),
    validation: {
      version: 'secondary-validation-prototype-v1', outcome: 't0-confirmed',
      reviewerId: 'nakes-1', decidedAt: timestamp,
    },
    referral: {
      version: 'referral-prototype-v1', status: 'waiting-dispatch',
      createdAt: timestamp, createdBy: 'nakes-1',
      updatedAt: timestamp, updatedBy: 'nakes-1',
    },
  };
}

beforeEach(() => {
  state.documents.clear();
  state.versions.clear();
  state.writes.length = 0;
  state.beforeCommit = null;
  state.auth.currentUser = { uid: 'nakes-1' };
  state.timestamp = Timestamp.fromDate(new Date('2026-09-27T12:00:00.000Z'));
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('transactional secondary validation', () => {
  it('atomically confirms T0, initializes referral, and leaves origin unchanged', async () => {
    const initial = origin({ patientNik: '3201234567890001' });
    put('em-1', initial);
    expect(await decideEmergency('em-1', {
      outcome: 't0-confirmed', clinicalNote: '  verified  ',
    })).toEqual({ id: 'em-1', outcome: 't0-confirmed' });
    const saved = state.documents.get('em-1');
    expect(saved.validation).toMatchObject({
      outcome: 't0-confirmed', reviewerId: 'nakes-1', clinicalNote: 'verified',
      decidedAt: state.timestamp,
    });
    expect(saved.validation).not.toHaveProperty('reviewerName');
    expect(saved.referral).toMatchObject({
      status: 'waiting-dispatch', createdAt: state.timestamp, updatedAt: state.timestamp,
      createdBy: 'nakes-1', updatedBy: 'nakes-1',
    });
    expect({ ...saved, validation: undefined, referral: undefined }).toMatchObject(initial);
    expect(state.writes).toHaveLength(1);
    expect(Object.keys(state.writes[0]).sort()).toEqual(['referral', 'validation']);
  });

  it.each(['T1', 'T2'])('writes final downgrade %s without transport state', async (tier) => {
    put('em-1', origin());
    await decideEmergency('em-1', { outcome: 'downgraded', downgradedTo: tier });
    expect(state.documents.get('em-1').validation).toMatchObject({
      outcome: 'downgraded', downgradedTo: tier, reviewerId: 'nakes-1',
    });
    expect(state.documents.get('em-1')).not.toHaveProperty('referral');
  });

  it('rejects an existing final decision and untrusted reviewer input', async () => {
    put('em-1', confirmed());
    await expect(decideEmergency('em-1', { outcome: 'downgraded', downgradedTo: 'T1' }))
      .rejects.toMatchObject({ code: 'already-decided' });
    await expect(decideEmergency('em-1', { outcome: 't0-confirmed', reviewerId: 'other' }))
      .rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });

  it('lets the first committed decision win a transaction retry race', async () => {
    put('em-1', origin());
    let arrivals = 0;
    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    state.beforeCommit = async () => {
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
    };
    const first = decideEmergency('em-1', { outcome: 't0-confirmed' });
    state.auth.currentUser = { uid: 'nakes-2' };
    const second = decideEmergency('em-1', { outcome: 'downgraded', downgradedTo: 'T1' });
    const outcomes = await Promise.allSettled([first, second]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')[0].reason)
      .toMatchObject({ code: 'already-decided' });
    expect(state.writes).toHaveLength(1);
  });

  it('fails closed on malformed origin/workflow and offline access', async () => {
    put('bad-origin', origin({ status: 't0-confirmed' }));
    put('bad-workflow', origin({ validation: { outcome: 'unknown' } }));
    await expect(decideEmergency('bad-origin', { outcome: 't0-confirmed' }))
      .rejects.toMatchObject({ code: 'invalid-origin' });
    await expect(decideEmergency('bad-workflow', { outcome: 't0-confirmed' }))
      .rejects.toMatchObject({ code: 'malformed-workflow' });
    vi.stubGlobal('navigator', { onLine: false });
    await expect(decideEmergency('bad-origin', { outcome: 't0-confirmed' }))
      .rejects.toMatchObject({ code: 'offline' });
  });
});

describe('transactional referral advancement', () => {
  it('advances only the immediate next state and preserves creation fields', async () => {
    put('em-1', confirmed());
    for (const [expected, next] of [
      ['waiting-dispatch', 'en-route-to-location'],
      ['en-route-to-location', 'arrived-at-posko'],
      ['arrived-at-posko', 'en-route-to-hospital'],
      ['en-route-to-hospital', 'completed'],
    ]) {
      await expect(advanceReferral('em-1', expected, next)).resolves.toEqual({ id: 'em-1', status: next });
    }
    const saved = state.documents.get('em-1');
    expect(saved.referral).toMatchObject({ status: 'completed', createdAt: state.timestamp,
      createdBy: 'nakes-1', updatedBy: 'nakes-1' });
    expect(state.writes).toHaveLength(4);
  });

  it('rejects skipped, backwards, completed, and stale transitions', async () => {
    put('em-1', confirmed());
    await expect(advanceReferral('em-1', 'waiting-dispatch', 'arrived-at-posko'))
      .rejects.toMatchObject({ code: 'invalid-transition' });
    await advanceReferral('em-1', 'waiting-dispatch', 'en-route-to-location');
    await expect(advanceReferral('em-1', 'waiting-dispatch', 'en-route-to-location'))
      .rejects.toMatchObject({ code: 'stale-transition' });
    await expect(advanceReferral('em-1', 'en-route-to-location', 'waiting-dispatch'))
      .rejects.toMatchObject({ code: 'invalid-transition' });
    put('done', { ...confirmed(), referral: { ...confirmed().referral, status: 'completed' } });
    await expect(advanceReferral('done', 'completed', 'waiting-dispatch'))
      .rejects.toMatchObject({ code: 'invalid-transition' });
  });

  it('does not advance a downgraded or malformed workflow', async () => {
    put('downgraded', origin({ validation: {
      version: 'secondary-validation-prototype-v1', outcome: 'downgraded',
      downgradedTo: 'T2', reviewerId: 'nakes-1', decidedAt: state.timestamp,
    } }));
    await expect(advanceReferral('downgraded', 'waiting-dispatch', 'en-route-to-location'))
      .rejects.toMatchObject({ code: 'no-referral' });
    put('malformed', { ...confirmed(), referral: { ...confirmed().referral, version: 'wrong' } });
    await expect(advanceReferral('malformed', 'waiting-dispatch', 'en-route-to-location'))
      .rejects.toMatchObject({ code: 'malformed-workflow' });
  });
});
