import { DEMO_POSKOS } from '../data/demoPoskos';

export function buildPoskoOperations(model, roster, resourceData) {
  const rows = DEMO_POSKOS.map((posko) => ({ posko, assignedRelawanCount: 0,
    activeT0Count: 0, currentSrq: { T1: 0, T2: 0, T3: 0 },
    resources: resourceData?.resources?.find((item) => item.poskoId === posko.id) || null,
    resourceInvalid: resourceData?.invalidIds?.includes(posko.id) || false }));
  const byName = new Map(rows.map((row) => [row.posko.name, row]));
  const unmatched = { relawan: 0, activeT0: 0, currentSrq: 0 };
  for (const profile of roster?.relawan || []) {
    const row = byName.get(profile.poskoName);
    if (row && row.posko.lat === profile.poskoLat && row.posko.lng === profile.poskoLng) row.assignedRelawanCount++;
    else unmatched.relawan++;
  }
  for (const event of model.activeEmergencies || []) {
    const row = byName.get(event.origin?.poskoName);
    if (row) row.activeT0Count++;
    else unmatched.activeT0++;
  }
  for (const patient of model.patients || []) {
    const srq = patient.latestSrq;
    if (!srq) continue;
    const row = byName.get(srq.poskoName);
    if (row && Object.hasOwn(row.currentSrq, srq.tier)) row.currentSrq[srq.tier]++;
    else unmatched.currentSrq++;
  }
  return { rows, unmatched };
}
