import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEMO_POSKOS } from '../src/data/demoPoskos.js';
import { buildNakesProfile, buildRelawanProfile, validateNakesInput, validateRelawanInput, validDocumentId } from '../src/lib/accountProvisioningDomain.js';

const relawan = { name: '  Rina  ', email: '  rina@example.org  ', initialPassword: 'secret6',
  poskoName: DEMO_POSKOS[0].name, poskoLat: DEMO_POSKOS[0].lat, poskoLng: DEMO_POSKOS[0].lng };
const nakes = { name: ' Dini ', email: 'dini@example.org', initialPassword: 'secret6' };

describe('separate Admin provisioning domains', () => {
  it('keeps public Login and AuthContext free of account registration', () => {
    const auth = readFileSync(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8');
    const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    const login = readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
    expect(auth).not.toMatch(/createUserWithEmailAndPassword|\bregister\b/);
    expect(routes).not.toContain('/register');
    expect(routes).not.toContain('accounts"');
    expect(login).not.toMatch(/Daftar Sekarang|\/register/);
  });
  it('normalizes Relawan fields while retaining password content', () => {
    expect(validateRelawanInput({ ...relawan, initialPassword: ' secret6 ' })).toMatchObject({
      name: 'Rina', email: 'rina@example.org', initialPassword: ' secret6 ', poskoName: DEMO_POSKOS[0].name,
    });
  });
  it('accepts Nakes with or without a valid-looking hospital ID', () => {
    expect(validateNakesInput(nakes)).not.toHaveProperty('organizationId');
    expect(validateNakesInput({ ...nakes, organizationId: 'hospital-1' }).organizationId).toBe('hospital-1');
  });
  it.each([
    [validateRelawanInput, { ...relawan, name: '  ' }],
    [validateRelawanInput, { ...relawan, email: 'bad' }],
    [validateRelawanInput, { ...relawan, initialPassword: '12345' }],
    [validateRelawanInput, { ...relawan, poskoName: '' }],
    [validateRelawanInput, { ...relawan, poskoName: 'Unknown' }],
    [validateRelawanInput, { ...relawan, poskoLat: 0 }],
    [validateRelawanInput, { ...relawan, poskoLng: 181 }],
    [validateNakesInput, { ...nakes, name: '' }],
    [validateNakesInput, { ...nakes, email: '' }],
    [validateNakesInput, { ...nakes, initialPassword: '' }],
    [validateNakesInput, { ...nakes, organizationId: 'bad/id' }],
    [validateNakesInput, { ...nakes, organizationId: '  ' }],
  ])('rejects invalid role-specific input %#', (validate, input) => expect(() => validate(input)).toThrow());
  it('does not accept a caller-supplied role', () => {
    for (const role of ['admin', 'nakes', 'relawan', 'unknown']) {
      expect(() => validateRelawanInput({ ...relawan, role })).toThrow();
      expect(() => validateNakesInput({ ...nakes, role })).toThrow();
    }
  });
  it('builds a fixed Relawan profile without a password', () => {
    expect(buildRelawanProfile(relawan, 'uid-1', 'now', 'canonical@example.org')).toEqual({
      uid: 'uid-1', email: 'canonical@example.org', name: 'Rina', role: 'relawan',
      poskoName: DEMO_POSKOS[0].name, poskoLat: DEMO_POSKOS[0].lat, poskoLng: DEMO_POSKOS[0].lng, createdAt: 'now',
    });
  });
  it('builds a fixed Nakes profile with optional membership, no hospital copy, and no password', () => {
    expect(buildNakesProfile(nakes, 'uid-2', 'now')).toEqual({ uid: 'uid-2', email: 'dini@example.org', name: 'Dini', role: 'nakes', createdAt: 'now' });
    expect(buildNakesProfile({ ...nakes, organizationId: 'hospital-1' }, 'uid-2', 'now')).toEqual({
      uid: 'uid-2', email: 'dini@example.org', name: 'Dini', role: 'nakes', organizationId: 'hospital-1', createdAt: 'now',
    });
  });
  it('rejects malformed document IDs', () => {
    expect(validDocumentId('hospital-1')).toBe(true);
    for (const value of ['', '.', '..', ' bad ', 'a/b', '__reserved__']) expect(validDocumentId(value)).toBe(false);
  });
});
