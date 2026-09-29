import { describe, expect, it } from 'vitest';
import { healthcareOrganizationInputSchema, organizationInputFromForm, membershipStatus, nakesMembershipPatch } from '../src/schemas/healthcareOrganization.js';

const hospital = { schemaVersion: 'healthcare-organization-v1', name: 'Demo Hospital', type: 'hospital', operationalStatus: 'active', t0ReferralEligible: true };
const valid = (changes) => healthcareOrganizationInputSchema.safeParse({ ...hospital, ...changes }).success;

describe('healthcare organization v1', () => {
  it('accepts active/inactive and independently eligible/ineligible hospitals', () => {
    for (const operationalStatus of ['active', 'inactive']) for (const t0ReferralEligible of [true, false]) {
      expect(valid({ operationalStatus, t0ReferralEligible })).toBe(true);
    }
  });
  it('rejects blank names, versions, types and status outside the contract', () => {
    expect(valid({ name: '  ' })).toBe(false);
    expect(valid({ schemaVersion: 'v2' })).toBe(false);
    expect(valid({ type: 'psc119' })).toBe(false);
    expect(valid({ operationalStatus: 'unknown' })).toBe(false);
  });
  it('accepts no coordinates and exact valid pairs including zero', () => {
    expect(valid({})).toBe(true);
    expect(valid({ lat: 0, lng: 0 })).toBe(true);
    expect(valid({ lat: -90, lng: 180 })).toBe(true);
  });
  it('rejects partial, non-numeric, non-finite and out-of-range coordinates', () => {
    for (const changes of [{ lat: 1 }, { lng: 1 }, { lat: '0', lng: 0 }, { lat: Infinity, lng: 0 }, { lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 }]) {
      expect(valid(changes)).toBe(false);
    }
  });
  it('form conversion never adds fallback coordinates or turns a blank half-pair into zero', () => {
    const form = { name: 'Demo Hospital', address: '', lat: '', lng: '', operationalStatus: 'active', t0ReferralEligible: false };
    expect(organizationInputFromForm(form)).not.toHaveProperty('lat');
    expect(organizationInputFromForm({ ...form, lat: '0', lng: '0' })).toMatchObject({ lat: 0, lng: 0 });
    expect(() => organizationInputFromForm({ ...form, lat: '0' })).toThrow();
  });
});

describe('single Nakes membership helper', () => {
  it('returns a minimal patch and leaves identity and role untouched', () => {
    const profile = { uid: 'nakes-1', email: 'demo@example.test', role: 'nakes' };
    expect(nakesMembershipPatch(profile, 'hospital-1')).toEqual({ organizationId: 'hospital-1' });
    expect(profile).toEqual({ uid: 'nakes-1', email: 'demo@example.test', role: 'nakes' });
    expect(membershipStatus({ ...profile, organizationId: 'hospital-1' })).toBe('hospital-1');
    expect(membershipStatus(profile)).toBeNull();
    expect(nakesMembershipPatch(profile, null)).toBeNull();
  });
  it('rejects blank IDs and cannot assign Relawan or Admin', () => {
    expect(() => nakesMembershipPatch({ role: 'nakes' }, ' ')).toThrow();
    expect(() => nakesMembershipPatch({ role: 'relawan' }, 'hospital-1')).toThrow();
    expect(() => nakesMembershipPatch({ role: 'admin' }, 'hospital-1')).toThrow();
    expect(membershipStatus({ role: 'admin' })).toBeNull();
  });
});
