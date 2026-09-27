import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

const nonblank = z.string().trim().min(1);
const persistedNote = z.string().min(1).refine((value) =>
  value === value.trim() && value.trim().length > 0);
const firestoreTime = z.instanceof(Timestamp).refine((value) =>
  Number.isFinite(value.toDate().getTime()));

export const validationDecisionSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('t0-confirmed'),
    clinicalNote: nonblank.optional(),
  }).strict(),
  z.object({
    outcome: z.literal('downgraded'),
    downgradedTo: z.enum(['T1', 'T2']),
    clinicalNote: nonblank.optional(),
  }).strict(),
]);

export const persistedValidationSchema = z.discriminatedUnion('outcome', [
  z.object({
    version: z.literal('secondary-validation-prototype-v1'),
    outcome: z.literal('t0-confirmed'),
    clinicalNote: persistedNote.optional(),
    reviewerId: nonblank,
    decidedAt: firestoreTime,
  }).strict(),
  z.object({
    version: z.literal('secondary-validation-prototype-v1'),
    outcome: z.literal('downgraded'),
    downgradedTo: z.enum(['T1', 'T2']),
    clinicalNote: persistedNote.optional(),
    reviewerId: nonblank,
    decidedAt: firestoreTime,
  }).strict(),
]);

export const referralStatuses = [
  'waiting-dispatch',
  'en-route-to-location',
  'arrived-at-posko',
  'en-route-to-hospital',
  'completed',
];

export const persistedReferralSchema = z.object({
  version: z.literal('referral-prototype-v1'),
  status: z.enum(referralStatuses),
  createdAt: firestoreTime,
  createdBy: nonblank,
  updatedAt: firestoreTime,
  updatedBy: nonblank,
}).strict().refine((value) => value.updatedAt.toMillis() >= value.createdAt.toMillis());

export function nextReferralStatus(status) {
  const index = referralStatuses.indexOf(status);
  return index < 0 || index === referralStatuses.length - 1
    ? null : referralStatuses[index + 1];
}

export function parseEmergencyWorkflow(data) {
  const issues = [];
  let validation = null;
  let referral = null;

  if (Object.hasOwn(data, 'validation')) {
    const parsed = persistedValidationSchema.safeParse(data.validation);
    if (parsed.success) validation = parsed.data;
    else issues.push('malformed-validation');
  }
  if (Object.hasOwn(data, 'referral')) {
    const parsed = persistedReferralSchema.safeParse(data.referral);
    if (parsed.success) referral = parsed.data;
    else issues.push('malformed-referral');
  }
  if (validation?.outcome === 't0-confirmed' && !Object.hasOwn(data, 'referral')) {
    issues.push('confirmed-without-referral');
  }
  if (validation?.outcome === 'downgraded' && Object.hasOwn(data, 'referral')) {
    issues.push('downgraded-with-referral');
  }
  if (!Object.hasOwn(data, 'validation') && Object.hasOwn(data, 'referral')) {
    issues.push('referral-without-validation');
  }
  if (referral && validation?.outcome === 't0-confirmed' &&
      (referral.createdBy !== validation.reviewerId ||
       !referral.createdAt.isEqual(validation.decidedAt))) {
    issues.push('referral-creation-mismatch');
  }

  return { validation, referral, workflowIssue: issues.length ? { codes: issues } : null };
}

export function normalizeWorkflowForRead(workflow) {
  return {
    validation: workflow.validation && {
      ...workflow.validation,
      decidedAt: workflow.validation.decidedAt.toDate().toISOString(),
    },
    referral: workflow.referral && {
      ...workflow.referral,
      createdAt: workflow.referral.createdAt.toDate().toISOString(),
      updatedAt: workflow.referral.updatedAt.toDate().toISOString(),
    },
    workflowIssue: workflow.workflowIssue,
  };
}
