import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_POSKOS } from '../src/data/demoPoskos.js';

const mocks = vi.hoisted(() => ({
  primaryAuth: { currentUser: { uid: 'admin-uid' } },
  secondaryAuth: { currentUser: null },
  createUser: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn(), setDoc: vi.fn(),
  getDocFromServer: vi.fn(), setPersistence: vi.fn(),
}));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: (_config, name) => ({ name }) }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: mocks.createUser, deleteUser: mocks.deleteUser,
  getAuth: () => mocks.secondaryAuth, initializeAuth: () => mocks.secondaryAuth,
  inMemoryPersistence: 'memory', setPersistence: mocks.setPersistence, signOut: mocks.signOut,
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collection, uid) => ({ collection, uid }),
  getDocFromServer: mocks.getDocFromServer, setDoc: mocks.setDoc,
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.primaryAuth, db: { primary: true }, firebaseConfig: { projectId: 'demo' } }));

import { createNakesAccount, createRelawanAccount } from '../src/lib/accountProvisioning.js';

const input = { name: 'Rina', email: 'rina@example.org', initialPassword: 'secret6',
  poskoName: DEMO_POSKOS[0].name, poskoLat: DEMO_POSKOS[0].lat, poskoLng: DEMO_POSKOS[0].lng };
const nakesInput = { name: 'Dr Bima', email: 'bima@example.org', initialPassword: 'secret6',
  organizationId: 'rs-demo' };
const hospital = {
  schemaVersion: 'healthcare-organization-v1',
  name: 'RS Demo',
  type: 'hospital',
  operationalStatus: 'active',
  t0ReferralEligible: true,
  address: 'Jalan Demo',
  createdAt: { toDate: () => new Date('2026-09-28T00:00:00.000Z') },
  createdBy: 'admin-uid',
  updatedAt: { toDate: () => new Date('2026-09-28T00:00:00.000Z') },
  updatedBy: 'admin-uid',
};

describe('isolated prototype Auth provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.primaryAuth.currentUser = { uid: 'admin-uid' };
    mocks.secondaryAuth.currentUser = null;
    mocks.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => ({ role: 'admin' }) });
    mocks.createUser.mockResolvedValue({ user: { uid: 'new-uid', email: 'rina@example.org' } });
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });
  it('creates with secondary Auth, writes through primary Firestore, and retains Admin', async () => {
    const result = await createRelawanAccount(input);
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.secondaryAuth, 'memory');
    expect(mocks.createUser).toHaveBeenCalledWith(mocks.secondaryAuth, input.email, input.initialPassword);
    expect(mocks.setDoc).toHaveBeenCalledWith({ collection: 'users', uid: 'new-uid' }, expect.objectContaining({ role: 'relawan', uid: 'new-uid' }));
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.secondaryAuth);
    expect(mocks.primaryAuth.currentUser.uid).toBe('admin-uid');
    expect(result).not.toHaveProperty('initialPassword');
  });
  it('deletes a newly created Auth user when profile write fails', async () => {
    mocks.setDoc.mockRejectedValue(new Error('write failed'));
    await expect(createRelawanAccount(input)).rejects.toThrow('Akun Auth baru telah dibatalkan');
    expect(mocks.deleteUser).toHaveBeenCalledWith({ uid: 'new-uid', email: 'rina@example.org' });
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.secondaryAuth);
  });
  it('reports an Auth rollback failure without exposing the password', async () => {
    mocks.setDoc.mockRejectedValue(new Error('write failed'));
    mocks.deleteUser.mockRejectedValue(new Error('delete failed'));
    await expect(createRelawanAccount(input)).rejects.toThrow('mungkin masih ada');
  });
  it.each(['relawan', 'nakes'])('rejects a primary %s profile before secondary Auth creation', async (role) => {
    mocks.getDocFromServer.mockResolvedValue({ exists: () => true, data: () => ({ role }) });
    await expect(createRelawanAccount(input)).rejects.toThrow('Hanya Admin dapat membuat akun.');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it('creates a Nakes profile with organization membership after resolving the hospital', async () => {
    mocks.getDocFromServer
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => hospital });
    mocks.createUser.mockResolvedValue({ user: { uid: 'nakes-uid', email: 'bima@example.org' } });

    const result = await createNakesAccount(nakesInput);
    const profile = mocks.setDoc.mock.calls[0][1];

    expect(mocks.getDocFromServer).toHaveBeenNthCalledWith(2, { collection: 'healthcareOrganizations', uid: 'rs-demo' });
    expect(mocks.getDocFromServer.mock.invocationCallOrder[1]).toBeLessThan(mocks.createUser.mock.invocationCallOrder[0]);
    expect(mocks.createUser).toHaveBeenCalledWith(mocks.secondaryAuth, nakesInput.email, nakesInput.initialPassword);
    expect(mocks.setDoc).toHaveBeenCalledWith({ collection: 'users', uid: 'nakes-uid' }, expect.objectContaining({
      uid: 'nakes-uid',
      role: 'nakes',
      organizationId: 'rs-demo',
    }));
    expect(profile).not.toHaveProperty('initialPassword');
    expect(profile).not.toHaveProperty('type');
    expect(profile).not.toHaveProperty('operationalStatus');
    expect(profile).not.toHaveProperty('t0ReferralEligible');
    expect(profile).not.toHaveProperty('address');
    expect(result).toEqual({ uid: 'nakes-uid', email: 'bima@example.org', role: 'nakes', organizationId: 'rs-demo' });
    expect(result).not.toHaveProperty('initialPassword');
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.secondaryAuth);
    expect(mocks.primaryAuth.currentUser.uid).toBe('admin-uid');
  });
  it.each([
    ['missing', { exists: () => false, data: () => undefined }],
    ['invalid', { exists: () => true, data: () => ({ ...hospital, type: 'clinic' }) }],
  ])('rejects a %s hospital before secondary Auth creation', async (_case, organizationSnapshot) => {
    mocks.getDocFromServer
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'admin' }) })
      .mockResolvedValueOnce(organizationSnapshot);
    await expect(createNakesAccount(nakesInput)).rejects.toThrow('Rumah sakit tidak tersedia atau datanya tidak valid.');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});
