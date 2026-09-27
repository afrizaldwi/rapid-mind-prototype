import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, MapPin, RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collectEmergencyQueue } from '../../lib/emergencyCloud';
import { RED_FLAG_PROTOCOL } from '../../protocols/redFlagProtocol';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const gateLabels = new Map(RED_FLAG_PROTOCOL.indicators.map(({ id, label }) => [id, label]));
const timeFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function EmergencyCard({ emergency }) {
  const { id, origin, workflowIssue } = emergency;
  const hasLocation = origin.lat !== undefined && origin.lng !== undefined;
  return (
    <article className="rounded-xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-red-700">T0-Suspect</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {origin.patientName || (origin.patientNik ? 'Pasien tanpa nama' : 'Darurat tanpa identitas pasien')}
          </h2>
          {origin.patientNik && <p className="text-sm text-slate-600">NIK {origin.patientNik}</p>}
        </div>
        <time dateTime={origin.timestamp} className="text-sm font-medium text-slate-700">
          {timeFormat.format(new Date(origin.timestamp))}
        </time>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <p><span className="font-semibold">Posko:</span> {origin.poskoName || 'Belum dicatat'}</p>
        <p><span className="font-semibold">Relawan:</span> {origin.relawanName || origin.relawanId}</p>
      </div>
      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-900">Indikator Red Flag</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {origin.gates.map((gate) => <li key={gate}>{gateLabels.get(gate)}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Wording indikator masih provisional dan belum tervalidasi klinis.</p>
      </div>
      {origin.note && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Catatan:</span> {origin.note}</p>}
      {workflowIssue && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Metadata alur Faskes tidak valid. T0-Suspect tetap terlihat; tindakan untuk catatan ini perlu ditahan sampai data diperbaiki.</p>}
      <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-600">
        <MapPin className="h-4 w-4" />
        {hasLocation ? `Koordinat posko: ${origin.lat}, ${origin.lng}` : 'Koordinat tidak tersedia'}
      </p>
      <p className="mt-2 text-xs text-slate-400">ID emergency: {id}</p>
    </article>
  );
}

export default function EmergencyQueuePage() {
  const isOnline = useOnlineStatus();
  const [retryKey, setRetryKey] = useState(0);
  const [queue, setQueue] = useState({ items: [], rejected: [], loading: true, fromCache: true, listenerError: null });

  useEffect(() => {
    let active = true;
    const unsubscribe = onSnapshot(
      collection(db, 'emergencies'),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active) return;
        const { items, rejected } = collectEmergencyQueue(snapshot);
        setQueue({ items, rejected, loading: false, fromCache: snapshot.metadata.fromCache, listenerError: null });
      },
      (error) => {
        if (!active) return;
        console.error('Gagal mendengarkan antrean emergency:', error);
        setQueue((previous) => ({ ...previous, loading: false, listenerError: error }));
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [retryKey]);

  const retry = () => {
    setQueue((previous) => ({ ...previous, loading: true, listenerError: null }));
    setRetryKey((value) => value + 1);
  };

  const stale = !isOnline || queue.fromCache || !!queue.listenerError;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Antrean Darurat</h1>
          <p className="mt-1 text-sm text-slate-600">Penerimaan T0-Suspect secara real-time. Antrean ini hanya untuk dibaca.</p>
        </div>
        <div className="rounded-xl bg-red-700 px-4 py-2 text-center text-white">
          <span className="block text-2xl font-bold">{queue.items.length}</span>
          <span className="text-xs">T0-Suspect terlihat</span>
        </div>
      </div>

      <p role="status" className={`rounded-lg px-3 py-2 text-sm ${stale ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
        {queue.listenerError
          ? 'Listener terputus. Antrean terakhir mungkin tidak mutakhir.'
          : !isOnline
            ? 'Browser offline. Data yang tampil mungkin berasal dari cache.'
            : queue.loading || queue.fromCache
              ? 'Menghubungkan ke Firestore; data yang tampil mungkin berasal dari cache.'
              : 'Data Firestore terkini.'}
      </p>

      {queue.listenerError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>Antrean tidak dapat diperbarui. Periksa koneksi atau akses akun, lalu coba lagi.</p>
          <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Coba lagi
          </button>
        </div>
      )}

      {queue.rejected.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> {queue.rejected.length} dokumen emergency tidak dapat ditampilkan
          </summary>
          <p className="mt-2">Data asal atau timestamp dokumen berikut tidak valid. Dokumen lain tetap ditampilkan.</p>
          <ul className="mt-2 list-disc pl-5">
            {queue.rejected.map(({ id }) => <li key={id}>{id || '(tanpa ID)'}</li>)}
          </ul>
        </details>
      )}

      {queue.loading && <p className="rounded-xl bg-white p-8 text-center text-slate-600">Memuat antrean emergency...</p>}
      {!queue.loading && queue.items.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-slate-600">Belum ada T0-Suspect yang dapat ditampilkan.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {queue.items.map((emergency) => <EmergencyCard key={emergency.id} emergency={emergency} />)}
      </div>
    </div>
  );
}
