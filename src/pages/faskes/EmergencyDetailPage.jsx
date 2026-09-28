import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import { parseEmergencySnapshot } from '../../lib/emergencyCloud.js';
import { advanceReferral, decideEmergency } from '../../lib/emergencyWorkflow.js';
import { loadFaskesHistory } from '../../lib/faskesHistory.js';
import { buildDecisionPayload, getNextReferralAction, getWorkflowErrorMessage, getWriteBlockReason, isAwaitingListener } from '../../lib/faskesWorkflowUi.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import EmergencyDetailContent from '../../components/faskes/EmergencyDetailContent.jsx';

const initialDetail = { record: null, loading: true, fromCache: true, hasPendingWrites: false, listenerError: null, notFound: false, invalidOrigin: false };
const initialDraft = { outcome: '', downgradedTo: '', clinicalNote: '' };
const initialHistory = { nik: null, loading: false, offline: false, patient: null, cases: null };

export default function EmergencyDetailPage() {
  const { id } = useParams();
  return <EmergencyDetailWorkspace key={id} id={id} />;
}

function EmergencyDetailWorkspace({ id }) {
  const online = useOnlineStatus();
  const [retryKey, setRetryKey] = useState(0);
  const [historyRetryKey, setHistoryRetryKey] = useState(0);
  const [detail, setDetail] = useState(initialDetail);
  const [history, setHistory] = useState(initialHistory);
  const [teleStarted, setTeleStarted] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [awaiting, setAwaiting] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSnapshot(doc(db, 'emergencies', id), { includeMetadataChanges: true }, (snapshot) => {
      if (!active) return;
      const metadata = { loading: false, fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites, listenerError: null };
      if (!snapshot.exists()) {
        if (snapshot.metadata.fromCache) {
          setDetail((previous) => ({ ...previous, ...metadata, notFound: false }));
        } else {
          setDetail({ ...initialDetail, ...metadata, record: null, notFound: true });
        }
        return;
      }
      try {
        const record = parseEmergencySnapshot(snapshot);
        setDetail({ ...initialDetail, ...metadata, record });
      } catch (error) {
        console.error('Data asal emergency tidak valid:', error);
        setDetail({ ...initialDetail, ...metadata, loading: false, record: null, invalidOrigin: true });
      }
    }, (error) => {
      if (!active) return;
      console.error('Gagal mendengarkan detail emergency:', error);
      setDetail((previous) => ({ ...previous, loading: false, fromCache: true, listenerError: error }));
    });
    return () => { active = false; unsubscribe(); };
  }, [id, retryKey]);

  const record = detail.record;
  const patientNik = record?.origin.patientNik;
  const historyKey = `${id}:${patientNik}:${historyRetryKey}`;

  useEffect(() => {
    let active = true;
    if (!patientNik || !online) return () => { active = false; };
    loadFaskesHistory(patientNik).then((result) => {
      if (active) setHistory({ key: historyKey, nik: patientNik, loading: false, offline: false, ...result });
    }).catch((error) => {
      console.error('Gagal memuat riwayat Faskes:', error);
      if (active) setHistory({ key: historyKey, nik: patientNik, loading: false, offline: false,
        patient: { status: 'unavailable', data: null }, cases: { status: 'unavailable', items: [], unknownCount: 0 } });
    });
    return () => { active = false; };
  }, [patientNik, online, historyKey]);

  const visibleHistory = !patientNik ? initialHistory : !online
    ? { ...initialHistory, nik: patientNik, offline: true }
    : history.key === historyKey ? history : { ...initialHistory, nik: patientNik, loading: true };
  const awaitingActive = isAwaitingListener(awaiting, detail);
  const visibleConfirming = record?.validation || record?.workflowIssue || detail.invalidOrigin || detail.notFound ? null : confirming;
  const blockReason = getWriteBlockReason({ online, detail, busy, awaiting: awaitingActive });

  function updateDraft(patch) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setFeedback(null);
  }

  function reviewDecision(event) {
    event.preventDefault();
    if (blockReason || record?.validation || inFlight.current) return;
    try {
      const decision = buildDecisionPayload(draft);
      setConfirming(decision);
      setFeedback(null);
    } catch {
      setFeedback({ type: 'error', message: draft.outcome === 'downgraded' ? 'Pilih T1 atau T2 untuk downgrade.' : 'Pilih hasil validasi yang sah.' });
    }
  }

  async function confirmDecision() {
    if (inFlight.current || !visibleConfirming || !record || record.validation || blockReason) return;
    inFlight.current = true;
    setBusy(true);
    setConfirming(null);
    setFeedback(null);
    try {
      await decideEmergency(id, visibleConfirming);
      setAwaiting({ type: 'decision' });
      setFeedback({ type: 'info', message: 'Keputusan disimpan. Menunggu tampilan data server terbaru.' });
    } catch (error) {
      if (error?.code === 'already-decided') setAwaiting({ type: 'decision' });
      if (['malformed-workflow', 'invalid-origin', 'not-found'].includes(error?.code)) setAwaiting({ type: 'fault', code: error.code });
      setFeedback({ type: 'error', message: getWorkflowErrorMessage(error) });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function advance() {
    const action = getNextReferralAction(record);
    if (inFlight.current || !action || blockReason) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await advanceReferral(id, action.currentStatus, action.nextStatus);
      setAwaiting({ type: 'referral', previousStatus: action.currentStatus });
      setFeedback({ type: 'info', message: 'Status referral disimpan. Menunggu tampilan data server terbaru.' });
    } catch (error) {
      if (error?.code === 'stale-transition') setAwaiting({ type: 'referral', previousStatus: action.currentStatus });
      if (['malformed-workflow', 'invalid-origin', 'not-found'].includes(error?.code)) setAwaiting({ type: 'fault', code: error.code });
      setFeedback({ type: 'error', message: getWorkflowErrorMessage(error) });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <EmergencyDetailContent
    detail={detail} online={online} history={visibleHistory}
    teleStarted={teleStarted} draft={draft} confirming={visibleConfirming} busy={busy} blockReason={blockReason} feedback={feedback}
    onRetry={() => { setDetail((previous) => ({ ...previous, loading: true, fromCache: true, hasPendingWrites: false, listenerError: null })); setRetryKey((value) => value + 1); }} onHistoryRetry={() => setHistoryRetryKey((value) => value + 1)}
    onStart={() => setTeleStarted(true)} onDraftChange={updateDraft} onReviewDecision={reviewDecision}
    onCancelConfirmation={() => setConfirming(null)} onConfirmDecision={confirmDecision} onAdvanceReferral={advance}
  />;
}
