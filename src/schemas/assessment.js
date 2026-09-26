import { z } from "zod";

export const assessmentPatientSchema = z.object({
  nik: z.string().regex(/^\d{16}$/),
  nama: z.string(),
  usia: z.number().int().nonnegative().nullable(),
  jenisKelamin: z.string(),
  poskoName: z.string(),
});

export const assessmentSchema = z.object({
  relawanId: z.string().min(1),
  patient: assessmentPatientSchema,
  phase: z.enum(["akut", "lanjutan"]),
  previousHistory: z.array(z.unknown()),
  isNewPatient: z.boolean(),
  startedAt: z.iso.datetime(),
});
