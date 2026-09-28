import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildAdminReadModel, collectAdminCases, projectAdminEmergencies } from '../lib/adminReadModel';

const initial = { status: 'loading', data: null, fromCache: false, pending: false };

export function useAdminRealtimeModel() {
  const [cases, setCases] = useState(initial);
  const [emergencies, setEmergencies] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscribe = (name, project, update) => onSnapshot(
      collection(db, name),
      { includeMetadataChanges: true },
      (snapshot) => {
        update({ status: 'ready', data: project(snapshot), fromCache: snapshot.metadata.fromCache, pending: snapshot.metadata.hasPendingWrites });
        setNow(Date.now());
      },
      () => update((previous) => ({ ...previous, status: 'error' })),
    );
    const stopCases = subscribe('cases', collectAdminCases, setCases);
    const stopEmergencies = subscribe('emergencies', projectAdminEmergencies, setEmergencies);
    return () => { clearInterval(timer); stopCases(); stopEmergencies(); };
  }, []);

  const model = useMemo(() => buildAdminReadModel(cases.data, emergencies.data, now), [cases.data, emergencies.data, now]);
  const current = [cases, emergencies].every((stream) => stream.status === 'ready' && !stream.fromCache && !stream.pending);
  const loading = cases.status === 'loading' || emergencies.status === 'loading';
  const error = cases.status === 'error' || emergencies.status === 'error';
  const status = error ? 'Listener bermasalah; data terakhir mungkin sudah berubah' : loading ? 'Memuat cases dan emergencies' : current ? 'Live dari server · kedua sumber terkonfirmasi' : 'Cache/pending; menunggu kedua sumber terkonfirmasi server';
  return { model, current, loading, error, status };
}
