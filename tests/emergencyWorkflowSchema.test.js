import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  nextReferralStatus, parseEmergencyWorkflow, persistedReferralSchema,
  persistedValidationSchema, validationDecisionSchema,
} from '../src/schemas/emergencyWorkflow.js';

const time = Timestamp.fromDate(new Date('2026-09-27T12:00:00.000Z'));
const validation = (overrides = {}) => ({
  version: 'secondary-validation-prototype-v1', outcome: 't0-confirmed',
  reviewerId: 'nakes-1', decidedAt: time, ...overrides,
});
const referral = (overrides = {}) => ({
  version: 'referral-prototype-v1', status: 'waiting-dispatch',
  createdAt: time, createdBy: 'nakes-1', updatedAt: time, updatedBy: 'nakes-1',
  ...overrides,
});

describe('secondary validation contract', () => {
  it('accepts confirmation and both downgrade destinations with no reviewer name', () => {
    expect(persistedValidationSchema.parse(validation()).outcome).toBe('t0-confirmed');
    for (const downgradedTo of ['T1', 'T2']) {
      expect(persistedValidationSchema.parse(validation({ outcome: 'downgraded', downgradedTo })).downgradedTo)
        .toBe(downgradedTo);
      expect(validationDecisionSchema.safeParse({ outcome: 'downgraded', downgradedTo }).success).toBe(true);
    }
  });

  it.each([
    { outcome: 't0-confirmed', downgradedTo: 'T1' },
    { outcome: 'downgraded' },
    { outcome: 'downgraded', downgradedTo: 'T3' },
    { outcome: 'unknown' },
    { outcome: 't0-confirmed', reviewerId: 'caller' },
  ])('rejects invalid decision input %#', (decision) => {
    expect(validationDecisionSchema.safeParse(decision).success).toBe(false);
  });

  it.each([
    { version: 'secondary-validation-prototype-v2' },
    { outcome: 'downgraded' },
    { outcome: 'downgraded', downgradedTo: 'T3' },
    { downgradedTo: 'T1' },
    { reviewerId: '' },
    { reviewerName: 'Dr A' },
    { decidedAt: '2026-09-27T12:00:00.000Z' },
    { clinicalNote: '  padded  ' },
    { clinicalNote: '   ' },
  ])('rejects invalid persisted validation %#', (change) => {
    expect(persistedValidationSchema.safeParse(validation(change)).success).toBe(false);
  });

  it('trims a draft note before it can be persisted', () => {
    expect(validationDecisionSchema.parse({ outcome: 't0-confirmed', clinicalNote: '  checked  ' }))
      .toEqual({ outcome: 't0-confirmed', clinicalNote: 'checked' });
  });
});

describe('referral contract and state machine', () => {
  it('accepts initial waiting-dispatch and each immediate next transition', () => {
    expect(persistedReferralSchema.safeParse(referral()).success).toBe(true);
    expect(nextReferralStatus('waiting-dispatch')).toBe('en-route-to-location');
    expect(nextReferralStatus('en-route-to-location')).toBe('arrived-at-posko');
    expect(nextReferralStatus('arrived-at-posko')).toBe('en-route-to-hospital');
    expect(nextReferralStatus('en-route-to-hospital')).toBe('completed');
    expect(nextReferralStatus('completed')).toBeNull();
  });

  it.each([
    { version: 'referral-prototype-v2' }, { status: 'dispatched' },
    { createdAt: '2026-09-27T12:00:00.000Z' }, { updatedAt: null },
    { createdBy: '' }, { reviewerName: 'Dr A' },
  ])('rejects invalid persisted referral %#', (change) => {
    expect(persistedReferralSchema.safeParse(referral(change)).success).toBe(false);
  });

  it('marks cross-namespace inconsistencies without discarding valid parts', () => {
    expect(parseEmergencyWorkflow({ validation: validation() }).workflowIssue.codes)
      .toContain('confirmed-without-referral');
    expect(parseEmergencyWorkflow({ validation: validation({ outcome: 'downgraded', downgradedTo: 'T1' }),
      referral: referral() }).workflowIssue.codes).toContain('downgraded-with-referral');
    expect(parseEmergencyWorkflow({ referral: referral() }).workflowIssue.codes)
      .toContain('referral-without-validation');
    expect(parseEmergencyWorkflow({ validation: validation(), referral: referral({ createdBy: 'other' }) })
      .workflowIssue.codes).toContain('referral-creation-mismatch');
  });
});
