import { pfaCaseRecordSchema, srq20CaseRecordSchema } from '../schemas/caseRecord.js';
import { PFA_PROTOCOL } from '../protocols/pfaProtocol.js';
import { SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { CLASSIFICATION_VERSION } from './classification.js';
import { getLegacyZone } from './caseRecords.js';
import { collectEmergencyQueue } from './emergencyCloud.js';
import { getWorkflowPresentation } from './faskesWorkflowUi.js';

const NIK = /^\d{16}$/;
const DAY = 24 * 60 * 60 * 1000;

export function readTime(value) {
  const candidate = value?.toDate ? value.toDate() : value;
  const date = candidate instanceof Date ? candidate :
    (typeof candidate === 'string' || typeof candidate === 'number' ? new Date(candidate) : null);
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function modernCoordinates(record) {
  const pair = record?.location && typeof record.location === 'object' ? record.location : record;
  const lat = pair?.lat;
  const lng = pair?.lng;
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng } : null;
}

function snapshotText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function projectAdminCase(id, record) {
  if (typeof id !== 'string' || !id || !record || typeof record !== 'object' || Array.isArray(record)) return null;
  let type = null;
  if (record.recordType === 'pfa' && pfaCaseRecordSchema.safeParse(record).success &&
      record.protocolVersion === PFA_PROTOCOL.version) type = 'pfa';
  else if (record.recordType === 'srq20' && srq20CaseRecordSchema.safeParse(record).success &&
      record.protocolVersion === SRQ20_PROTOCOL.version &&
      record.riskFunctionProtocolVersion === RISK_FUNCTION_PROTOCOL.version &&
      record.classificationVersion === CLASSIFICATION_VERSION) type = 'srq20';
  else if (getLegacyZone(record)) type = 'legacy-triage';
  if (!type) return null;
  const item = {
    id, type, timestamp: readTime(record.timestamp) || readTime(record.createdAt),
    patientNik: typeof record.patientNik === 'string' && NIK.test(record.patientNik) ? record.patientNik : null,
    patientName: snapshotText(record.patientName),
    poskoName: snapshotText(record.poskoName),
    relawanName: snapshotText(record.relawanName) || snapshotText(record.volunteerName),
    relawanId: snapshotText(record.relawanId),
    coordinates: type === 'legacy-triage' ? null : modernCoordinates(record),
  };
  if (type === 'pfa') {
    item.protocolVersion = record.protocolVersion;
    item.responses = record.responses;
  } else if (type === 'srq20') {
    // The historical result is the persisted result. Save-side validation remains separate.
    item.score = record.srq20Score;
    item.baseTier = record.baseTier;
    item.tier = record.tier;
    item.inputMode = record.inputMode;
  } else {
    item.zone = getLegacyZone(record);
  }
  return item;
}

export function collectAdminCases(snapshot) {
  const byId = new Map();
  const rejected = [];
  for (const document of snapshot.docs) {
    try {
      const item = projectAdminCase(document.id, document.data());
      if (item) byId.set(item.id, item);
      else rejected.push({ id: document?.id || '(unknown)', reason: 'Catatan kasus tidak dikenal atau tidak valid' });
    } catch (error) {
      rejected.push({ id: document?.id || '(unknown)', reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { items: [...byId.values()].sort(newestFirst), rejected };
}

export function newestFirst(a, b) {
  return ((b.timestamp ? Date.parse(b.timestamp) : -Infinity) - (a.timestamp ? Date.parse(a.timestamp) : -Infinity)) || a.id.localeCompare(b.id);
}

export function projectAdminEmergencies(snapshot) {
  const { items, rejected } = collectEmergencyQueue(snapshot);
  return {
    items: items.map((event) => {
      const state = event.workflowIssue ? 'workflow-issue'
        : !event.validation ? 'undecided'
          : event.validation.outcome === 'downgraded' ? 'downgraded'
            : event.referral?.status === 'completed' ? 'completed' : 'confirmed';
      return {
        ...event, timestamp: event.origin.timestamp, state,
        active: state === 'undecided' || state === 'confirmed',
        coordinates: modernCoordinates(event.origin),
        presentation: getWorkflowPresentation(event),
      };
    }),
    rejected,
  };
}

export function buildAdminReadModel(casesData, emergencyData, now) {
  const reference = readTime(now);
  if (!reference) throw new Error('Waktu referensi Admin tidak valid.');
  const cases = casesData?.items || [];
  const emergencies = emergencyData?.items || [];
  const referenceTime = Date.parse(reference);
  const cutoff = referenceTime - 30 * DAY;
  const patientsByNik = new Map();
  for (const item of cases) {
    if (!item.patientNik || !NIK.test(item.patientNik)) continue;
    if (!patientsByNik.has(item.patientNik)) patientsByNik.set(item.patientNik, []);
    patientsByNik.get(item.patientNik).push(item);
  }
  const patients = [...patientsByNik.entries()].map(([nik, records]) => {
    const ordered = [...records].sort(newestFirst);
    const srqHistory = ordered.filter((item) => item.type === 'srq20');
    const datedSrq = srqHistory.filter((item) => item.timestamp);
    const currentEligible = ordered.filter((item) => item.timestamp && Date.parse(item.timestamp) <= referenceTime);
    const latestSrq = currentEligible.find((item) => item.type === 'srq20') || null;
    const latestNamedSnapshot = currentEligible.find((item) => item.patientName || item.poskoName);
    return {
      nik, patientName: latestNamedSnapshot?.patientName || null,
      poskoName: latestNamedSnapshot?.poskoName || null,
      firstAssessment: currentEligible.at(-1)?.timestamp || null,
      latestAssessment: currentEligible[0]?.timestamp || null,
      pfaCount: ordered.filter((item) => item.type === 'pfa').length,
      srqCount: srqHistory.length,
      latestSrq,
      srqHistory,
      windowAssessmentCount: currentEligible.filter((item) => Date.parse(item.timestamp) >= cutoff).length,
      windowSrqHistory: datedSrq.filter((item) => {
        const time = Date.parse(item.timestamp);
        return time >= cutoff && time <= referenceTime;
      }),
    };
  }).sort((a, b) => ((b.latestAssessment ? Date.parse(b.latestAssessment) : -Infinity) - (a.latestAssessment ? Date.parse(a.latestAssessment) : -Infinity)) || a.nik.localeCompare(b.nik));
  const latestTiers = { T1: 0, T2: 0, T3: 0 };
  for (const patient of patients) if (patient.latestSrq) latestTiers[patient.latestSrq.tier]++;
  const windowCases = cases.filter((item) => item.timestamp && Date.parse(item.timestamp) >= cutoff && Date.parse(item.timestamp) <= referenceTime);
  const activeEmergencies = emergencies.filter((item) => item.active && item.timestamp && Date.parse(item.timestamp) <= referenceTime);
  const currentSrq = patients.map((patient) => patient.latestSrq).filter(Boolean);
  const buckets = new Map();
  const addPoint = (coordinates, label, tier) => {
    if (!coordinates) return;
    const key = `${coordinates.lat},${coordinates.lng}`;
    if (!buckets.has(key)) buckets.set(key, { key, coordinates, labels: new Set(), T0: 0, T1: 0, T2: 0, T3: 0 });
    const bucket = buckets.get(key);
    if (label) bucket.labels.add(label);
    bucket[tier]++;
  };
  for (const item of currentSrq) addPoint(item.coordinates, item.poskoName, item.tier);
  for (const item of activeEmergencies) addPoint(item.coordinates, item.origin.poskoName, 'T0');
  const geospatial = [...buckets.values()].sort((a, b) => a.coordinates.lat - b.coordinates.lat || a.coordinates.lng - b.coordinates.lng)
    .map((bucket) => ({ ...bucket, labels: [...bucket.labels].sort() }));
  const trendByDate = new Map();
  for (const item of windowCases) {
    if (item.type !== 'srq20') continue;
    const date = item.timestamp.slice(0, 10);
    if (!trendByDate.has(date)) trendByDate.set(date, { date, T1: 0, T2: 0, T3: 0 });
    trendByDate.get(date)[item.tier]++;
  }
  const srqTrend = [...trendByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    cases, emergencies, patients, activeEmergencies, geospatial, srqTrend, reference, windowStart: new Date(cutoff).toISOString(),
    metrics: {
      trackedPatients: patients.length,
      pfaRecords: cases.filter((item) => item.type === 'pfa').length,
      srqRecords: cases.filter((item) => item.type === 'srq20').length,
      windowPfa: windowCases.filter((item) => item.type === 'pfa').length,
      windowSrq: windowCases.filter((item) => item.type === 'srq20').length,
      latestTiers,
      activeT0: activeEmergencies.length,
      workflowIssues: emergencies.filter((item) => item.state === 'workflow-issue').length,
      downgraded: {
        T1: emergencies.filter((item) => item.state === 'downgraded' && item.validation.downgradedTo === 'T1').length,
        T2: emergencies.filter((item) => item.state === 'downgraded' && item.validation.downgradedTo === 'T2').length,
      },
      legacy: Object.fromEntries(['merah', 'kuning', 'hijau'].map((zone) => [zone, cases.filter((item) => item.zone === zone).length])),
      rejectedCases: casesData?.rejected?.length || 0,
      rejectedEmergencies: emergencyData?.rejected?.length || 0,
      undatedCases: cases.filter((item) => !item.timestamp).length,
      futureDatedCases: cases.filter((item) => item.timestamp && Date.parse(item.timestamp) > referenceTime).length,
      futureDatedEmergencies: emergencies.filter((item) => item.timestamp && Date.parse(item.timestamp) > referenceTime).length,
      currentSrqWithoutCoordinates: currentSrq.filter((item) => !item.coordinates).length,
      activeT0WithoutCoordinates: activeEmergencies.filter((item) => !item.coordinates).length,
    },
  };
}
