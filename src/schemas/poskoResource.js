import { z } from 'zod';
import { DEMO_POSKOS } from '../data/demoPoskos';

export const POSKO_RESOURCE_VERSION = 'posko-resource-allocation-v1';
const timestamp = z.custom((value) => !!value && Number.isInteger(value.seconds) &&
  Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1e9 &&
  typeof value.toDate === 'function' && value.toDate() instanceof Date &&
  Number.isFinite(value.toDate().getTime()));
const uid = z.string().trim().min(1);
export const resourceQuantitiesSchema = z.object({
  medicinePackages: z.number().int().nonnegative(),
  medicalKits: z.number().int().nonnegative(),
}).strict();

export function canonicalPosko(id) {
  return DEMO_POSKOS.find((posko) => posko.id === id) || null;
}

export const poskoResourceSchema = z.object({
  schemaVersion: z.literal(POSKO_RESOURCE_VERSION),
  poskoId: z.string(),
  poskoName: z.string(),
  medicinePackages: z.number().int().nonnegative(),
  medicalKits: z.number().int().nonnegative(),
  createdAt: timestamp,
  createdBy: uid,
  updatedAt: timestamp,
  updatedBy: uid,
}).strict().superRefine((value, context) => {
  const posko = canonicalPosko(value.poskoId);
  if (!posko || posko.name !== value.poskoName) context.addIssue({ code: 'custom', message: 'Identitas Posko tidak kanonik' });
});

export function parsePoskoResource(documentId, data) {
  const result = poskoResourceSchema.safeParse(data);
  return result.success && result.data.poskoId === documentId ? result.data : null;
}
