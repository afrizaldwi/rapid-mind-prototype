import { describe, expect, it } from 'vitest';
import { buildDecisionPayload, getNextReferralAction, getWorkflowErrorMessage, getWorkflowPresentation, getWriteBlockReason, isAwaitingListener } from '../src/lib/faskesWorkflowUi.js';

const origin = { status: 't0-suspect', timestamp: '2026-09-27T12:00:00.000Z' };
const emergency = (workflow = {}) => ({ id: 'em-1', origin, validation: null, referral: null, workflowIssue: null, ...workflow });

describe('Faskes workflow presentation', () => {
  it('projects undecided, confirmed, downgraded, completed, and malformed states without changing origin', () => {
    expect(getWorkflowPresentation(emergency())).toEqual({ title: 'T0-Suspect', detail: 'Belum divalidasi' });
    for (const [status, label] of [
      ['waiting-dispatch', 'Menunggu Dispatch'], ['en-route-to-location', 'Menuju Lokasi'],
      ['arrived-at-posko', 'Tiba di Posko'], ['en-route-to-hospital', 'Dalam Perjalanan ke RS'],
      ['completed', 'Selesai'],
    ]) {
      const record = emergency({ validation: { outcome: 't0-confirmed' }, referral: { status } });
      expect(getWorkflowPresentation(record)).toEqual({ title: 'T0-Confirmed', detail: label });
      expect(record.origin.status).toBe('t0-suspect');
    }
    for (const tier of ['T1', 'T2']) {
      expect(getWorkflowPresentation(emergency({ validation: { outcome: 'downgraded', downgradedTo: tier } })))
        .toEqual({ title: 'Downgraded', detail: tier });
    }
    expect(getWorkflowPresentation(emergency({ workflowIssue: { codes: ['malformed-validation'] } })).title)
      .toBe('Alur Faskes perlu diperiksa');
  });

  it('offers only the immediate referral step and treats completion as terminal', () => {
    for (const [current, next, label] of [
      ['waiting-dispatch', 'en-route-to-location', 'Menuju Lokasi'],
      ['en-route-to-location', 'arrived-at-posko', 'Tiba di Posko'],
      ['arrived-at-posko', 'en-route-to-hospital', 'Dalam Perjalanan ke RS'],
      ['en-route-to-hospital', 'completed', 'Selesai'],
    ]) {
      expect(getNextReferralAction(emergency({ validation: { outcome: 't0-confirmed' }, referral: { status: current } })))
        .toEqual({ currentStatus: current, nextStatus: next, label });
    }
    expect(getNextReferralAction(emergency({ validation: { outcome: 't0-confirmed' }, referral: { status: 'completed' } }))).toBeNull();
    expect(getNextReferralAction(emergency({ validation: { outcome: 'downgraded', downgradedTo: 'T1' } }))).toBeNull();
    expect(getNextReferralAction(emergency({ workflowIssue: { codes: ['bad'] }, validation: { outcome: 't0-confirmed' }, referral: { status: 'waiting-dispatch' } }))).toBeNull();
  });
});

describe('decision payload and write eligibility', () => {
  it('normalizes notes, omits blanks and reviewer fields, and rejects T3', () => {
    expect(buildDecisionPayload({ outcome: 't0-confirmed', downgradedTo: 'T1', clinicalNote: '  Checked  ', reviewerId: 'forged' }))
      .toEqual({ outcome: 't0-confirmed', clinicalNote: 'Checked' });
    expect(buildDecisionPayload({ outcome: 'downgraded', downgradedTo: 'T1', clinicalNote: '   ' }))
      .toEqual({ outcome: 'downgraded', downgradedTo: 'T1' });
    expect(buildDecisionPayload({ outcome: 'downgraded', downgradedTo: 'T2' }))
      .toEqual({ outcome: 'downgraded', downgradedTo: 'T2' });
    expect(() => buildDecisionPayload({ outcome: 'downgraded', downgradedTo: 'T3' })).toThrow();
    expect(() => buildDecisionPayload({ outcome: 'downgraded' })).toThrow();
  });

  it('blocks every unsafe listener and connection condition, then re-enables after server recovery', () => {
    const healthy = { record: emergency(), loading: false, fromCache: false, hasPendingWrites: false, listenerError: null, invalidOrigin: false, notFound: false };
    expect(getWriteBlockReason({ online: true, detail: healthy })).toBeNull();
    for (const change of [
      { online: false }, { detail: { ...healthy, loading: true } },
      { detail: { ...healthy, listenerError: new Error('denied') } },
      { detail: { ...healthy, fromCache: true } },
      { detail: { ...healthy, hasPendingWrites: true } },
      { detail: { ...healthy, invalidOrigin: true } },
      { detail: { ...healthy, notFound: true } },
      { detail: { ...healthy, record: emergency({ workflowIssue: { codes: ['bad'] } }) } },
      { busy: true }, { awaiting: true },
    ]) {
      expect(getWriteBlockReason({ online: true, detail: healthy, ...change })).toBeTruthy();
    }
    expect(getWriteBlockReason({ online: true, detail: { ...healthy, fromCache: true } })).toBeTruthy();
    expect(getWriteBlockReason({ online: true, detail: healthy })).toBeNull();
  });

  it('keeps a successful or conflicted action locked until a healthy changed snapshot arrives', () => {
    const healthy = { record: emergency(), loading: false, fromCache: false, hasPendingWrites: false, listenerError: null };
    expect(isAwaitingListener({ type: 'decision' }, healthy)).toBe(true);
    expect(isAwaitingListener({ type: 'decision' }, { ...healthy, record: emergency({ validation: { outcome: 't0-confirmed' } }), fromCache: true })).toBe(true);
    expect(isAwaitingListener({ type: 'decision' }, { ...healthy, record: emergency({ validation: { outcome: 't0-confirmed' } }) })).toBe(false);
    const referral = { type: 'referral', previousStatus: 'waiting-dispatch' };
    expect(isAwaitingListener(referral, { ...healthy, record: emergency({ referral: { status: 'waiting-dispatch' } }) })).toBe(true);
    expect(isAwaitingListener(referral, { ...healthy, record: emergency({ referral: { status: 'en-route-to-location' } }) })).toBe(false);
    expect(isAwaitingListener({ type: 'fault', code: 'malformed-workflow' }, healthy)).toBe(true);
    expect(isAwaitingListener({ type: 'fault', code: 'malformed-workflow' }, { ...healthy, record: emergency({ workflowIssue: { codes: ['bad'] } }) })).toBe(false);
    expect(isAwaitingListener({ type: 'fault', code: 'invalid-origin' }, { ...healthy, record: null, invalidOrigin: true })).toBe(false);
    expect(isAwaitingListener({ type: 'fault', code: 'not-found' }, { ...healthy, record: null, notFound: true })).toBe(false);
  });

  it.each(['already-decided', 'stale-transition', 'permission-denied', 'offline', 'unavailable', 'malformed-workflow', 'invalid-origin', 'not-found', 'unauthenticated', 'invalid-transition', 'no-referral'])
    ('maps %s to a safe UI message', (code) => {
      expect(getWorkflowErrorMessage({ code })).toBeTruthy();
    });
  it('has a safe unknown-error message', () => {
    expect(getWorkflowErrorMessage(new Error('secret internal detail'))).not.toContain('secret');
  });
});
