import { z } from 'zod';
import { RED_FLAG_PROTOCOL } from '../protocols/redFlagProtocol.js';

const indicatorIds = RED_FLAG_PROTOCOL.indicators.map((indicator) => indicator.id);
const snapshot = z.string().trim().min(1);
const lat = z.number().finite().min(-90).max(90);
const lng = z.number().finite().min(-180).max(180);

// Keep event identity separate from later Faskes status/confirmation fields.
export const emergencyIdentitySchema = z.object({
  protocolVersion: z.literal(RED_FLAG_PROTOCOL.version),
  patientNik: z.string().regex(/^\d{16}$/).optional(),
  patientName: snapshot.optional(),
  relawanId: snapshot,
  relawanName: snapshot.optional(),
  poskoName: snapshot.optional(),
  lat: lat.optional(),
  lng: lng.optional(),
  gates: z.array(z.enum(indicatorIds)).min(1).max(indicatorIds.length)
    .refine((gates) => new Set(gates).size === gates.length),
  note: snapshot.optional(),
  timestamp: z.iso.datetime(),
}).strict().refine((record) => (record.lat === undefined) === (record.lng === undefined), {
  message: 'Koordinat posko harus berupa pasangan lintang dan bujur.',
});

export const emergencyEventSchema = emergencyIdentitySchema.safeExtend({
  status: z.literal('t0-suspect'),
});

export const localEmergencySchema = emergencyEventSchema.safeExtend({
  id: z.number().int().positive().optional(),
  synced: z.union([z.literal(0), z.literal(1)]),
  firestoreId: z.string().min(1).nullable(),
});
