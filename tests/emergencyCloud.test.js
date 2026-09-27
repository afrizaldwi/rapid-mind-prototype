import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { collectEmergencyQueue, parseEmergencySnapshot } from '../src/lib/emergencyCloud.js';

const gate = 'redflag.immediate_harm';
const event = (overrides = {}) => ({
  protocolVersion: 'redflag-prototype-v1',
  status: 't0-suspect',
  relawanId: 'relawan-123',
  gates: [gate],
  timestamp: Timestamp.fromDate(new Date('2026-09-27T12:00:00.000Z')),
  ...overrides,
});
const document = (id, data) => ({ id, data: () => data });
const validation = (overrides = {}) => ({
  version: 'secondary-validation-prototype-v1', outcome: 't0-confirmed',
  reviewerId: 'nakes-1', decidedAt: event().timestamp, ...overrides,
});
const referral = (overrides = {}) => ({
  version: 'referral-prototype-v1', status: 'waiting-dispatch',
  createdAt: event().timestamp, createdBy: 'nakes-1',
  updatedAt: event().timestamp, updatedBy: 'nakes-1', ...overrides,
});

describe('Firestore emergency read boundary', () => {
  it('uses Firestore timestamp as origin time and ignores additive metadata', () => {
    const snapshot = document('emergency-1', event({
      patientNik: '3201234567890001',
      patientName: 'Siti',
      lat: 0,
      lng: 0,
      createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z')),
      independentCloudMetadata: { state: 'future' },
    }));
    expect(parseEmergencySnapshot(snapshot)).toEqual({
      id: 'emergency-1',
      origin: {
        protocolVersion: 'redflag-prototype-v1', status: 't0-suspect', relawanId: 'relawan-123',
        gates: [gate], timestamp: '2026-09-27T12:00:00.000Z',
        patientNik: '3201234567890001', patientName: 'Siti', lat: 0, lng: 0,
      },
      validation: null,
      referral: null,
      workflowIssue: null,
    });
  });

  it('accepts a valid emergency with no patient, location, or createdAt', () => {
    expect(parseEmergencySnapshot(document('anonymous', event())).origin).not.toHaveProperty('patientNik');
  });

  it('reads valid validation and referral independently of immutable origin', () => {
    const parsed = parseEmergencySnapshot(document('confirmed', event({
      validation: validation(), referral: referral(),
    })));
    expect(parsed.origin.status).toBe('t0-suspect');
    expect(parsed.validation).toMatchObject({ outcome: 't0-confirmed', reviewerId: 'nakes-1',
      decidedAt: '2026-09-27T12:00:00.000Z' });
    expect(parsed.referral).toMatchObject({ status: 'waiting-dispatch',
      createdAt: '2026-09-27T12:00:00.000Z' });
    expect(parsed.workflowIssue).toBeNull();
    const downgraded = parseEmergencySnapshot(document('downgraded', event({
      validation: validation({ outcome: 'downgraded', downgradedTo: 'T2' }),
    })));
    expect(downgraded.validation.downgradedTo).toBe('T2');
    expect(downgraded.referral).toBeNull();
    expect(downgraded.workflowIssue).toBeNull();
  });

  it.each([
    ['validation', { validation: validation({ decidedAt: 'bad' }) }, 'malformed-validation'],
    ['referral', { validation: validation(), referral: referral({ status: 'unknown' }) }, 'malformed-referral'],
    ['missing referral', { validation: validation() }, 'confirmed-without-referral'],
    ['orphan referral', { referral: referral() }, 'referral-without-validation'],
  ])('preserves a valid origin with %s workflow', (_label, metadata, issue) => {
    const queue = collectEmergencyQueue({ docs: [
      document('workflow-bad', event(metadata)),
      document('origin-bad', event({ gates: ['wrong'] })),
    ] });
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].origin.status).toBe('t0-suspect');
    expect(queue.items[0].workflowIssue.codes).toContain(issue);
    expect(queue.rejected.map(({ id }) => id)).toEqual(['origin-bad']);
  });

  it('rejects malformed required origin fields and invalid timestamp', () => {
    for (const data of [
      event({ timestamp: undefined }), event({ timestamp: '2026-09-27T12:00:00.000Z' }),
      event({ gates: ['redflag.unknown'] }), event({ protocolVersion: 'unknown' }),
      event({ gates: [gate, gate] }),
      event({ relawanId: '' }), event({ status: 't0-confirmed' }),
      event({ lat: 0 }),
    ]) {
      expect(() => parseEmergencySnapshot(document('bad', data))).toThrow();
    }
  });

  it('keeps valid records when another document is rejected, sorts newest first, and deduplicates IDs', () => {
    const snapshot = { docs: [
      document('older', event({ timestamp: Timestamp.fromDate(new Date('2026-09-27T10:00:00.000Z')) })),
      document('bad', event({ gates: ['redflag.unknown'] })),
      { id: 'unreadable', data: () => { throw new Error('bad snapshot'); } },
      document('newer', event()),
      document('newer', event()),
    ] };
    const queue = collectEmergencyQueue(snapshot);
    expect(queue.items.map(({ id }) => id)).toEqual(['newer', 'older']);
    expect(queue.rejected.map(({ id }) => id)).toEqual(['bad', 'unreadable']);
  });
});
