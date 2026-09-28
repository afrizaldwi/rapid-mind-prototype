import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { buildAdminReadModel, collectAdminCases, projectAdminEmergencies } from '../../lib/adminReadModel';

const initial = { status: 'loading', data: null, fromCache: false, pending: false };
const formatTime = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Waktu tidak tersedia';
const statusText = (stream) => stream.status === 'loading' ? 'Memuat' : stream.status === 'error' ? 'Koneksi bermasalah; data terakhir bukan status terkini' : stream.fromCache || stream.pending ? 'Cache/pending; menunggu konfirmasi server' : 'Live dari server';

export default function DashboardPage() {
  const [caseStream, setCaseStream] = useState(initial);
  const [emergencyStream, setEmergencyStream] = useState(initial);
  const [phase, setPhase] = useState('all');
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
    const stopCases = subscribe('cases', collectAdminCases, setCaseStream);
    const stopEmergencies = subscribe('emergencies', projectAdminEmergencies, setEmergencyStream);
    return () => { clearInterval(timer); stopCases(); stopEmergencies(); };
  }, []);

  const model = useMemo(() => buildAdminReadModel(caseStream.data, emergencyStream.data, now), [caseStream.data, emergencyStream.data, now]);
  const caseCurrent = caseStream.status === 'ready' && !caseStream.fromCache && !caseStream.pending;
  const emergencyCurrent = emergencyStream.status === 'ready' && !emergencyStream.fromCache && !emergencyStream.pending;
  const recentCases = model.cases.filter((item) => phase === 'all' || item.type === phase).slice(0, 8);
  const windowPatients = model.patients.filter((patient) => patient.windowAssessmentCount > 0);

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
      <p className="text-slate-500">Pemantauan asesmen dan emergency dari data Firestore yang tersedia</p>
      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        <span className="rounded bg-blue-50 px-3 py-2 text-blue-800">Cases: {statusText(caseStream)}</span>
        <span className="rounded bg-red-50 px-3 py-2 text-red-800">Emergencies: {statusText(emergencyStream)}</span>
      </div>
    </div>

    <section className="rounded-xl border border-red-200 bg-red-50 p-5" aria-label="Perhatian T0 aktif">
      <h2 className="text-lg font-bold text-red-900">Perhatian T0-Suspect aktif {emergencyCurrent ? `(${model.metrics.activeT0})` : '(status belum terkonfirmasi)'}</h2>
      {!emergencyCurrent && <p className="text-sm text-red-800 mt-1">Data emergency belum terkonfirmasi dari server. Daftar di bawah mungkin sudah berubah.</p>}
      {model.activeEmergencies.length === 0 && <p className="text-sm text-red-800 mt-2">{emergencyCurrent ? 'Tidak ada T0 aktif pada data saat ini.' : 'Belum ada data T0 aktif yang dapat ditampilkan.'}</p>}
      <div className="grid gap-3 mt-3 md:grid-cols-2">
        {model.activeEmergencies.map((event) => <div key={event.id} className="rounded-lg border border-red-200 bg-white p-4 text-sm">
          <div className="font-semibold text-red-900">T0-Suspect · {event.presentation.title}</div>
          <div>{event.presentation.detail} · {formatTime(event.origin.timestamp)}</div>
          <div>Pasien: {event.origin.patientName || '-'} · NIK: {event.origin.patientNik || '-'}</div>
          <div>Relawan: {event.origin.relawanName || event.origin.relawanId} · Posko: {event.origin.poskoName || '-'}</div>
        </div>)}
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['SRQ T1 pasien', model.metrics.latestTiers.T1], ['SRQ T2 pasien', model.metrics.latestTiers.T2], ['SRQ T3 pasien', model.metrics.latestTiers.T3], ['Pasien terdata (NIK unik)', model.metrics.trackedPatients], ['PFA / SRQ catatan', `${model.metrics.pfaRecords} / ${model.metrics.srqRecords}`]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{caseCurrent ? value : '—'}</p>
      </div>)}
    </div>
    {!caseCurrent && <p className="text-sm text-amber-800">Metrik kasus menunggu konfirmasi server; nilai tersimpan tidak dinyatakan sebagai kondisi terkini.</p>}

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Alur operasional dan kualitas data</h2>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>Workflow issue: {emergencyCurrent ? model.metrics.workflowIssues : '—'}</div>
        <div>Downgrade Nakes ke T1 / T2: {emergencyCurrent ? `${model.metrics.downgraded.T1} / ${model.metrics.downgraded.T2}` : '—'}</div>
        <div>Kasus malformed: {caseCurrent ? model.metrics.rejectedCases : '—'}</div>
        <div>Origin emergency ditolak: {emergencyCurrent ? model.metrics.rejectedEmergencies : '—'}</div>
      </div>
      {caseCurrent && model.metrics.undatedCases > 0 && <p className="text-xs text-amber-800 mt-2">{model.metrics.undatedCases} catatan tanpa waktu valid tidak masuk jendela waktu atau pemilihan SRQ terkini.</p>}
      {caseCurrent && model.metrics.futureDatedCases > 0 && <p className="text-xs text-amber-800 mt-2">{model.metrics.futureDatedCases} catatan memiliki timestamp di masa depan dan tidak digunakan sebagai status terkini.</p>}
      {emergencyStream.data?.items.filter((item) => item.state === 'workflow-issue').map((event) => <p key={event.id} className="mt-2 text-sm text-amber-800">T0-Suspect {event.id}: metadata workflow perlu diperiksa.</p>)}
      {caseCurrent && <p className="mt-2 text-xs text-slate-500">Legacy triage historis: merah {model.metrics.legacy.merah}, kuning {model.metrics.legacy.kuning}, hijau {model.metrics.legacy.hijau}. Tidak termasuk hitungan SRQ.</p>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Aktivitas asesmen terbaru</h2>
        <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={phase} onChange={(event) => setPhase(event.target.value)} aria-label="Filter fase asesmen">
          <option value="all">Semua catatan</option><option value="pfa">PFA / Akut</option><option value="srq20">SRQ / Lanjutan</option>
        </select></div>
      <p className="mt-1 text-xs text-slate-500">Filter ini hanya berlaku untuk aktivitas asesmen. Perhatian T0 tetap terlihat di atas.</p>
      <p className="mt-2 text-sm">Rolling 30-day window: PFA {caseCurrent ? model.metrics.windowPfa : '—'}, SRQ {caseCurrent ? model.metrics.windowSrq : '—'}.</p>
      <div className="mt-3 space-y-2">{recentCases.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-2 text-sm">
        <span>{item.type === 'srq20' ? `SRQ ${item.tier} · skor ${item.score}` : item.type === 'pfa' ? 'PFA / Akut' : `Legacy triage · ${item.zone}`} · {item.patientName || item.patientNik || '-'} · {item.poskoName || '-'}{item.timestamp && Date.parse(item.timestamp) > now ? ' · Waktu masa depan; bukan status terkini' : ''}</span><span className="text-slate-500">{formatTime(item.timestamp)}</span>
      </div>)}{recentCases.length === 0 && <p className="text-sm text-slate-500">Belum ada asesmen untuk filter ini.</p>}</div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Pasien longitudinal · rolling 30-day window</h2>
      <p className="text-xs text-slate-500 mt-1">Asesmen bertanggal dari {formatTime(model.windowStart)} hingga {formatTime(model.reference)}, termasuk batas awal. Ringkasan pasien memakai seluruh catatan valid.</p>
      <div className="overflow-x-auto mt-3"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['NIK / pasien', 'Posko', 'Pertama / terbaru', 'PFA / SRQ', 'SRQ tersimpan terbaru', 'Riwayat SRQ dalam jendela'].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr></thead><tbody>
        {windowPatients.map((patient) => <tr key={patient.nik} className="border-t border-slate-100 align-top"><td className="px-3 py-2">{patient.nik}<br />{patient.patientName || '-'}</td><td className="px-3 py-2">{patient.poskoName || '-'}</td><td className="px-3 py-2">{formatTime(patient.firstAssessment)}<br />{formatTime(patient.latestAssessment)}</td><td className="px-3 py-2">{patient.pfaCount} / {patient.srqCount}</td><td className="px-3 py-2">{patient.latestSrq ? `${patient.latestSrq.score} · SRQ ${patient.latestSrq.tier}` : '-'}</td><td className="px-3 py-2">{patient.windowSrqHistory.map((item) => `${formatTime(item.timestamp)}: ${item.score}/${item.tier}`).join('; ') || '-'}</td></tr>)}
      </tbody></table>{windowPatients.length === 0 && <p className="py-5 text-sm text-slate-500">Belum ada asesmen dalam jendela ini.</p>}</div>
    </section>
  </div>;
}
