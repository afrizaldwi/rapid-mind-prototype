import { describe, expect, it } from 'vitest';
import { DEMO_POSKOS } from '../src/data/demoPoskos.js';
import { buildPoskoOperations } from '../src/lib/poskoOperations.js';
import { buildAdminReadModel } from '../src/lib/adminReadModel.js';

const [first, second] = DEMO_POSKOS;
const srq = (id, nik, timestamp, tier, poskoName) => ({ id, type: 'srq20', patientNik: nik,
  timestamp, tier, poskoName, patientName: 'Pasien' });
const emergency = (id, poskoName, active) => ({ id, timestamp: '2026-09-28T00:00:00.000Z',
  active, origin: { poskoName }, validation: active ? null : { outcome: 'downgraded', downgradedTo: 'T1' },
  state: active ? 'undecided' : 'downgraded' });

describe('operational Posko projection', () => {
  it('keeps assignment, historical T0, latest SRQ, and resources separate', () => {
    const model = buildAdminReadModel({ items: [
      srq('old', '1111111111111111', '2026-09-26T00:00:00.000Z', 'T3', second.name),
      srq('latest', '1111111111111111', '2026-09-28T00:00:00.000Z', 'T1', first.name),
      srq('future', '1111111111111111', '2026-10-01T00:00:00.000Z', 'T2', second.name),
      srq('other', '2222222222222222', '2026-09-27T00:00:00.000Z', 'T2', second.name),
      srq('unknown', '3333333333333333', '2026-09-27T00:00:00.000Z', 'T3', 'Old Posko'),
      { id: 'pfa', type: 'pfa', patientNik: '4444444444444444', timestamp: '2026-09-28T00:00:00.000Z', poskoName: first.name },
    ], rejected: [] }, { items: [emergency('active', first.name, true),
      emergency('completed', first.name, false), emergency('other', 'Old Posko', true)], rejected: [] },
    '2026-09-29T00:00:00.000Z');
    const roster = { relawan: [
      { poskoName: first.name, poskoLat: first.lat, poskoLng: first.lng },
      { poskoName: first.name, poskoLat: 0, poskoLng: first.lng },
      { poskoName: 'Old Posko', poskoLat: 0, poskoLng: 0 },
    ] };
    const resource = { poskoId: first.id, medicinePackages: 0, medicalKits: 2 };
    const result = buildPoskoOperations(model, roster, { resources: [resource] });
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toEqual({ posko: first, assignedRelawanCount: 1, activeT0Count: 1,
      currentSrq: { T1: 1, T2: 0, T3: 0 }, resources: resource, resourceInvalid: false });
    expect(result.rows[1].currentSrq).toEqual({ T1: 0, T2: 1, T3: 0 });
    expect(result.rows[1].resources).toBeNull();
    expect(result.unmatched).toEqual({ relawan: 2, activeT0: 1, currentSrq: 1 });
  });
  it('always returns all Poskos with unrecorded resources', () => {
    const result = buildPoskoOperations({ activeEmergencies: [], patients: [] }, null, null);
    expect(result.rows.map((row) => row.posko.id)).toEqual(DEMO_POSKOS.map((posko) => posko.id));
    expect(result.rows.every((row) => row.resources === null)).toBe(true);
  });
});
