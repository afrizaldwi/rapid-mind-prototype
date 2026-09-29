import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_POSKOS } from '../src/data/demoPoskos.js';

const mocks = vi.hoisted(() => ({
  onSnapshot: vi.fn(), runTransaction: vi.fn(),
  auth: { currentUser: { uid: 'admin-1' } },
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ name }), doc: (_db, name, id) => ({ name, id }),
  query: (base, constraint) => ({ base, constraint }), where: (...args) => args,
  onSnapshot: mocks.onSnapshot, runTransaction: mocks.runTransaction,
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth, db: {} }));

import { assignmentPatch, operationalRosterIsCurrent, projectRelawan, projectRelawanRoster, reassignRelawan, rosterIsCurrent, watchRelawan } from '../src/lib/relawanManagement.js';

const profile = (uid, name, role = 'relawan') => ({ uid, name, email: `${uid}@example.org`, role,
  poskoName: DEMO_POSKOS[0].name, poskoLat: DEMO_POSKOS[0].lat, poskoLng: DEMO_POSKOS[0].lng,
  createdAt: '2026-09-28' });
const item = (id, data) => ({ id, data: () => data });

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
});

describe('Relawan roster domain', () => {
  it('projects valid identity and assignment without exposing other fields', () => {
    expect(projectRelawan('r1', profile('r1', 'Ayu'))).toEqual({
      uid: 'r1', name: 'Ayu', email: 'r1@example.org',
      poskoName: DEMO_POSKOS[0].name, poskoLat: DEMO_POSKOS[0].lat, poskoLng: DEMO_POSKOS[0].lng,
    });
  });
  it('orders names and isolates non-Relawan and malformed profiles', () => {
    const roster = projectRelawanRoster([
      item('r2', profile('r2', 'Zara')), item('n1', profile('n1', 'Nakes', 'nakes')),
      item('r3', { ...profile('r3', 'Bad'), poskoLat: 'wrong' }),
      item('r1', profile('r1', 'Ayu')), item('a1', profile('a1', 'Admin', 'admin')),
    ]);
    expect(roster.relawan.map((value) => value.uid)).toEqual(['r1', 'r2']);
    expect(roster.rejected).toBe(3);
    expect(projectRelawan('different', profile('r1', 'Ayu'))).toBeNull();
  });
  it('requires server confirmation, no pending write, and online browser', () => {
    expect(rosterIsCurrent({ fromCache: false, pending: false }, true)).toBe(true);
    expect(rosterIsCurrent({ fromCache: true, pending: false }, true)).toBe(false);
    expect(rosterIsCurrent({ fromCache: false, pending: true }, true)).toBe(false);
    expect(rosterIsCurrent({ fromCache: false, pending: false }, false)).toBe(false);
  });
  it('does not expose an operational roster count until the listener is ready and server-confirmed', () => {
    const ready = { status: 'ready', data: { relawan: [], fromCache: false, pending: false } };
    expect(operationalRosterIsCurrent(ready, true)).toBe(true);
    expect(operationalRosterIsCurrent({ ...ready, status: 'loading' }, true)).toBe(false);
    expect(operationalRosterIsCurrent({ ...ready, status: 'error' }, true)).toBe(false);
    expect(operationalRosterIsCurrent({ ...ready, data: { ...ready.data, fromCache: true } }, true)).toBe(false);
    expect(operationalRosterIsCurrent({ ...ready, data: { ...ready.data, pending: true } }, true)).toBe(false);
    expect(operationalRosterIsCurrent(ready, false)).toBe(false);
  });
  it('subscribes only to role-constrained profiles and passes metadata', () => {
    mocks.onSnapshot.mockImplementationOnce((_query, _options, callback) => {
      callback({ docs: [item('r1', profile('r1', 'Ayu'))], metadata: { fromCache: true, hasPendingWrites: false } });
      return () => {};
    });
    const onData = vi.fn();
    watchRelawan(onData, vi.fn());
    expect(mocks.onSnapshot.mock.calls.at(-1)[0].constraint).toEqual(['role', '==', 'relawan']);
    expect(mocks.onSnapshot.mock.calls.at(-1)[1]).toEqual({ includeMetadataChanges: true });
    expect(onData).toHaveBeenCalledWith(expect.objectContaining({ fromCache: true, pending: false, rejected: 0 }));
  });
});

describe('Relawan assignment', () => {
  it('uses exact known Posko coordinates in a three-field patch', () => {
    expect(assignmentPatch(DEMO_POSKOS[1].name)).toEqual({
      poskoName: DEMO_POSKOS[1].name, poskoLat: DEMO_POSKOS[1].lat, poskoLng: DEMO_POSKOS[1].lng,
    });
    expect(Object.keys(assignmentPatch(DEMO_POSKOS[1].name)).sort()).toEqual(['poskoLat', 'poskoLng', 'poskoName']);
    expect(() => assignmentPatch('Fabricated Posko')).toThrow();
    expect(() => assignmentPatch({ poskoName: DEMO_POSKOS[0].name, role: 'admin' })).toThrow();
  });
  it('reads Admin and current Relawan in a transaction and writes only assignment', async () => {
    const update = vi.fn();
    const get = vi.fn().mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => profile('r1', 'Ayu') });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get, update }));
    await reassignRelawan('r1', DEMO_POSKOS[1].name);
    expect(update).toHaveBeenCalledWith({ name: 'users', id: 'r1' }, assignmentPatch(DEMO_POSKOS[1].name));
    expect(update.mock.calls[0][1]).not.toHaveProperty('uid');
    expect(update.mock.calls[0][1]).not.toHaveProperty('role');
  });
  it('rejects changed role without writing', async () => {
    const update = vi.fn();
    const get = vi.fn().mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'nakes' }) });
    mocks.runTransaction.mockImplementationOnce((_db, action) => action({ get, update }));
    await expect(reassignRelawan('r1', DEMO_POSKOS[1].name)).rejects.toThrow('Profil Relawan');
    expect(update).not.toHaveBeenCalled();
  });
});
