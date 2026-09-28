import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { findCloudPatientByNik } from './patients.js';
import { getLegacyZone } from './caseRecords.js';
import { pfaCaseRecordSchema, srq20CaseRecordSchema } from '../schemas/caseRecord.js';
import { SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { CLASSIFICATION_VERSION } from './classification.js';

function recordTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function summarizeFaskesCases(snapshot) {
  const items = [];
  let unknownCount = 0;
  for (const document of snapshot.docs) {
    const record = document.data();
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      unknownCount++;
      continue;
    }
    const type = record.recordType === 'pfa' && pfaCaseRecordSchema.safeParse(record).success ? 'pfa'
      : record.recordType === 'srq20' && srq20CaseRecordSchema.safeParse(record).success &&
        record.protocolVersion === SRQ20_PROTOCOL.version &&
        record.riskFunctionProtocolVersion === RISK_FUNCTION_PROTOCOL.version &&
        record.classificationVersion === CLASSIFICATION_VERSION ? 'srq20'
        : getLegacyZone(record) ? 'legacy-triage' : 'unknown';
    if (type === 'unknown') {
      unknownCount++;
      continue;
    }
    const item = { id: document.id, type, timestamp: recordTime(record.timestamp || record.createdAt) };
    if (type === 'pfa') item.protocolVersion = record.protocolVersion;
    if (type === 'srq20') {
      item.score = record.srq20Score;
      item.tier = record.tier;
      item.inputMode = record.inputMode;
    }
    if (type === 'legacy-triage') item.zone = getLegacyZone(record);
    items.push(item);
  }
  items.sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0) || a.id.localeCompare(b.id));
  return { items, unknownCount };
}

// Server-only Nakes read boundary. Never invoke Relawan lookup/reconciliation.
export async function loadFaskesHistory(patientNik) {
  if (!/^\d{16}$/.test(patientNik)) throw new Error('NIK pasien tidak valid.');
  const [patientResult, casesResult] = await Promise.allSettled([
    findCloudPatientByNik(patientNik),
    getDocsFromServer(query(collection(db, 'cases'), where('patientNik', '==', patientNik))),
  ]);
  return {
    patient: patientResult.status === 'fulfilled'
      ? { status: patientResult.value ? 'found' : 'not-found', data: patientResult.value?.patient || null }
      : { status: 'unavailable', data: null },
    cases: casesResult.status === 'fulfilled'
      ? { status: 'ready', ...summarizeFaskesCases(casesResult.value) }
      : { status: 'unavailable', items: [], unknownCount: 0 },
  };
}
