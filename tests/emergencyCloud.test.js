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
    });
  });

  it('accepts a valid emergency with no patient, location, or createdAt', () => {
    expect(parseEmergencySnapshot(document('anonymous', event())).origin).not.toHaveProperty('patientNik');
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
