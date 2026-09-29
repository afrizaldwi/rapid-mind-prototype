import { z } from 'zod';

const nonblank = z.string().trim().min(1);
const lat = z.number().finite().min(-90).max(90);
const lng = z.number().finite().min(-180).max(180);

export const healthcareOrganizationInputSchema = z.object({
  schemaVersion: z.literal('healthcare-organization-v1'),
  name: nonblank,
  type: z.literal('hospital'),
  operationalStatus: z.enum(['active', 'inactive']),
  t0ReferralEligible: z.boolean(),
  address: nonblank.optional(),
  lat: lat.optional(),
  lng: lng.optional(),
}).strict().refine((value) => (value.lat === undefined) === (value.lng === undefined), {
  message: 'Lintang dan bujur harus diisi atau dihapus bersama.',
});

export const healthcareOrganizationSchema = healthcareOrganizationInputSchema.safeExtend({
  createdAt: z.custom((value) => value?.toDate instanceof Function),
  createdBy: nonblank,
  updatedAt: z.custom((value) => value?.toDate instanceof Function),
  updatedBy: nonblank,
});

export function organizationInputFromForm(form) {
  const input = {
    schemaVersion: 'healthcare-organization-v1',
    name: form.name,
    type: 'hospital',
    operationalStatus: form.operationalStatus,
    t0ReferralEligible: form.t0ReferralEligible,
  };
  if (form.address.trim()) input.address = form.address;
  if (form.lat !== '' || form.lng !== '') {
    // Number('') would silently turn an incomplete pair into zero.
    if (form.lat !== '') input.lat = Number(form.lat);
    if (form.lng !== '') input.lng = Number(form.lng);
  }
  return healthcareOrganizationInputSchema.parse(input);
}

export function membershipStatus(profile) {
  if (profile?.role !== 'nakes') return null;
  return typeof profile.organizationId === 'string' && profile.organizationId.trim()
    ? profile.organizationId : null;
}

export function nakesMembershipPatch(profile, organizationId) {
  if (profile?.role !== 'nakes') throw new Error('Hanya profil Nakes yang dapat ditetapkan ke rumah sakit.');
  if (organizationId !== null && (typeof organizationId !== 'string' || !organizationId.trim() || organizationId !== organizationId.trim() || organizationId.includes('/'))) {
    throw new Error('ID organisasi tidak valid.');
  }
  return organizationId === null ? null : { organizationId };
}
