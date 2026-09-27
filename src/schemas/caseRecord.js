import { z } from "zod";

const canonicalIdentifierSchema = z.string().min(1).refine(
  (value) => value === value.trim(),
);

export const responseValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.number().finite(),
  z.null(),
]);

export const responsesSchema = z.record(
  canonicalIdentifierSchema,
  responseValueSchema,
).refine((responses) => Object.keys(responses).length > 0);

export const baseTypedCaseRecordSchema = z.object({
  protocolVersion: canonicalIdentifierSchema,
  patientNik: z.string().regex(/^\d{16}$/),
  relawanId: canonicalIdentifierSchema,
  responses: responsesSchema,
}).passthrough().refine((record) =>
  !("zona" in record) && !("triageResult" in record));

export const pfaCaseRecordSchema = baseTypedCaseRecordSchema.safeExtend({
  recordType: z.literal("pfa"),
  phase: z.literal("akut"),
});

export const srq20CaseRecordSchema = baseTypedCaseRecordSchema.safeExtend({
  recordType: z.literal("srq20"),
  phase: z.literal("lanjutan"),
  responses: z.record(canonicalIdentifierSchema, z.boolean()),
  inputMode: z.enum(["verbal", "nonverbal"]),
  srq20Score: z.number().int().min(0).max(20),
  baseTier: z.enum(["T1", "T2", "T3"]),
  riskFunctionProtocolVersion: canonicalIdentifierSchema,
  riskFactors: z.record(canonicalIdentifierSchema, z.boolean()),
  functionalImpairment: z.record(canonicalIdentifierSchema, z.boolean()),
  classificationVersion: canonicalIdentifierSchema,
  tier: z.enum(["T1", "T2", "T3"]),
});
