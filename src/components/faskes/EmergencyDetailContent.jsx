import { Link } from 'react-router-dom';
import { RED_FLAG_PROTOCOL } from '../../protocols/redFlagProtocol.js';
import { getNextReferralAction, getWorkflowPresentation, referralLabels } from '../../lib/faskesWorkflowUi.js';

const gateLabels = new Map(RED_FLAG_PROTOCOL.indicators.map(({ id, label }) => [id, label]));
const timeFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function displayTime(value) {
  if (!value) return 'Waktu tidak tersedia';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timeFormat.format(date) : 'Waktu tidak tersedia';
}

function HistoryPanel({ record, history, onRetry }) {
  if (!record.origin.patientNik) {
    return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Konteks pasien</h2><p className="mt-2 text-sm text-slate-600">Emergency anonim atau belum tertaut ke NIK. Riwayat pasien tidak tersedia.</p></section>;
  }
  const patient = history?.patient;
  const cases = history?.cases;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Konteks pasien dan asesmen</h2>
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-red-700 hover:underline">Muat ulang riwayat</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Ringkasan catatan tersimpan; bukan rekomendasi klinis baru.</p>
      {history?.loading && <p className="mt-3 text-sm text-slate-600">Memuat riwayat dari server...</p>}
      {history?.offline && <p className="mt-3 text-sm text-amber-800">Riwayat memerlukan koneksi server. Validasi emergency tidak bergantung pada riwayat ini.</p>}
      {!history?.loading && !history?.offline && <>
        {patient?.status === 'found' && <p className="mt-3 text-sm text-slate-700">Direktori: <span className="font-semibold">{patient.data.nama || 'Nama tidak tersedia'}</span>{patient.data.usia !== undefined ? ` · ${patient.data.usia} tahun` : ''}{patient.data.jenisKelamin ? ` · ${patient.data.jenisKelamin}` : ''}</p>}
        {patient?.status === 'not-found' && <p className="mt-3 text-sm text-slate-600">Profil direktori tidak ditemukan untuk NIK ini.</p>}
        {patient?.status === 'unavailable' && <p className="mt-3 text-sm text-amber-800">Profil pasien belum dapat dimuat dari server.</p>}
        {cases?.status === 'unavailable' && <p className="mt-3 text-sm text-amber-800">Riwayat asesmen belum dapat dimuat dari server.</p>}
        {cases?.status === 'ready' && cases.items.length === 0 && <p className="mt-3 text-sm text-slate-600">Tidak ada riwayat asesmen terverifikasi yang dapat ditampilkan.</p>}
        {cases?.status === 'ready' && cases.items.length > 0 && <ul className="mt-3 space-y-2">
          {cases.items.map((item) => <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">{item.type === 'pfa' ? 'PFA tercatat' : item.type === 'srq20' ? `SRQ-20 · ${item.tier} · ${item.score}/20` : `Triase legacy · Zona ${item.zone}`}</span>
            <span className="ml-2 text-slate-500">{displayTime(item.timestamp)}</span>
            {item.type === 'srq20' && <span className="block text-xs text-slate-500">Mode {item.inputMode === 'verbal' ? 'Verbal' : 'Non-Verbal'}</span>}
          </li>)}
        </ul>}
        {cases?.unknownCount > 0 && <p className="mt-2 text-xs text-amber-800">{cases.unknownCount} catatan tidak dikenali dan tidak ditafsirkan.</p>}
      </>}
    </section>
  );
}

export default function EmergencyDetailContent({ detail, online, history, teleStarted, draft, confirming, busy, blockReason, feedback, onRetry, onHistoryRetry, onStart, onDraftChange, onReviewDecision, onCancelConfirmation, onConfirmDecision, onAdvanceReferral }) {
  const record = detail.record;
  const presentation = getWorkflowPresentation(record);
  const nextAction = getNextReferralAction(record);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link to="/faskes" className="text-sm font-semibold text-red-700 hover:underline">← Kembali ke antrean</Link><h1 className="mt-2 text-2xl font-bold text-slate-900">Detail Emergency</h1></div>
        {record && <p className="max-w-full break-all text-xs text-slate-500">ID: {record.id}</p>}
      </div>

      <p role="status" className={`rounded-lg px-4 py-3 text-sm ${!online || detail.loading || detail.fromCache || detail.listenerError || detail.hasPendingWrites ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
        {detail.listenerError ? 'Listener emergency terputus; data terakhir mungkin tidak mutakhir.' : !online ? 'Browser offline; data yang terlihat mungkin tersimpan di cache.' : detail.loading ? 'Menghubungkan ke Firestore...' : detail.fromCache || detail.hasPendingWrites ? 'Menunggu konfirmasi data dari server.' : 'Data emergency dari server terkini.'}
      </p>
      {detail.listenerError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Emergency tidak dapat diperbarui. Periksa koneksi atau akses akun. <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Coba lagi</button></div>}
      {feedback && <p role="alert" className={`rounded-lg p-4 text-sm ${feedback.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{feedback.message}</p>}

      {!record && <section className="rounded-xl bg-white p-8 text-center text-slate-700">
        {detail.invalidOrigin ? 'Data asal emergency tidak valid dan tidak dapat ditampilkan.' : detail.notFound ? 'Emergency tidak ditemukan di server.' : detail.loading ? 'Memuat detail emergency...' : 'Detail emergency belum tersedia. Periksa koneksi lalu coba lagi.'}
      </section>}

      {record && <>
        <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-red-700">Asal · T0-Suspect</p><h2 className="mt-1 text-xl font-bold text-slate-900">{record.origin.patientName || (record.origin.patientNik ? 'Pasien tertaut tanpa nama' : 'Emergency anonim / tanpa pasien tertaut')}</h2>{record.origin.patientNik ? <p className="text-sm text-slate-600">NIK {record.origin.patientNik}</p> : <p className="text-sm text-slate-600">Tanpa NIK tertaut</p>}</div>
            <time dateTime={record.origin.timestamp} className="text-sm text-slate-700">{displayTime(record.origin.timestamp)}</time>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-900">Relawan</dt><dd className="text-slate-700">{record.origin.relawanName || record.origin.relawanId}</dd></div><div><dt className="font-semibold text-slate-900">Posko</dt><dd className="text-slate-700">{record.origin.poskoName || 'Belum dicatat'}</dd></div><div><dt className="font-semibold text-slate-900">Koordinat posko</dt><dd className="text-slate-700">{record.origin.lat !== undefined && record.origin.lng !== undefined ? `${record.origin.lat}, ${record.origin.lng}` : 'Tidak tersedia'}</dd></div></dl>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Indikator Red Flag dari Relawan</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{record.origin.gates.map((gate) => <li key={gate}>{gateLabels.get(gate) || gate}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Wording indikator masih provisional dan belum tervalidasi klinis.</p>
          {record.origin.note && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Catatan asal:</span> {record.origin.note}</p>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Status validasi sekunder</h2>
          <p className="mt-2 text-base font-semibold text-slate-900">{presentation.title} · {presentation.detail}</p>
          {record.workflowIssue && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Metadata alur Faskes tidak valid atau tidak konsisten. Asal emergency tetap terlihat; seluruh tindakan ditahan sampai data diperbaiki.</p>}
          {record.validation && <div className="mt-3 space-y-1 text-sm text-slate-700"><p>Keputusan final: {record.validation.outcome === 't0-confirmed' ? 'T0-Confirmed' : `Downgraded → ${record.validation.downgradedTo}`}</p><p>Diputuskan: {displayTime(record.validation.decidedAt)}</p>{record.validation.clinicalNote && <p>Catatan klinis: {record.validation.clinicalNote}</p>}</div>}
        </section>

        {!record.validation && !record.workflowIssue && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Tele-Emergency · Simulasi</h2>
          <p className="mt-2 text-sm text-slate-600">Simulasi komunikasi dengan Relawan lapangan untuk validasi sekunder. Aplikasi ini tidak melakukan panggilan langsung.</p>
          {!teleStarted && <button type="button" onClick={onStart} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Mulai Validasi</button>}
          {teleStarted && <form onSubmit={onReviewDecision} className="mt-5 space-y-4">
            <fieldset disabled={!!blockReason || busy} className="space-y-3"><legend className="font-semibold text-slate-900">Hasil validasi sekunder</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="outcome" value="t0-confirmed" checked={draft.outcome === 't0-confirmed'} onChange={() => onDraftChange({ outcome: 't0-confirmed', downgradedTo: '' })} /> Confirm T0</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="outcome" value="downgraded" checked={draft.outcome === 'downgraded'} onChange={() => onDraftChange({ outcome: 'downgraded', downgradedTo: '' })} /> Downgrade</label>
              {draft.outcome === 'downgraded' && <div className="flex gap-4 pl-6"><label className="flex items-center gap-2 text-sm"><input type="radio" name="downgradedTo" value="T1" checked={draft.downgradedTo === 'T1'} onChange={() => onDraftChange({ downgradedTo: 'T1' })} /> T1</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="downgradedTo" value="T2" checked={draft.downgradedTo === 'T2'} onChange={() => onDraftChange({ downgradedTo: 'T2' })} /> T2</label></div>}
              <label className="block text-sm font-semibold text-slate-900" htmlFor="clinical-note">Catatan klinis opsional</label><textarea id="clinical-note" value={draft.clinicalNote} onChange={(event) => onDraftChange({ clinicalNote: event.target.value })} rows={3} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Catatan validasi bila diperlukan" />
            </fieldset>
            <p className="text-xs text-slate-600">Keputusan ini bersifat final pada prototype v1 dan tidak dapat diedit melalui aplikasi.</p>
            {blockReason && <p className="text-sm text-amber-800">{blockReason}</p>}
            <button type="submit" disabled={!!blockReason || busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Tinjau keputusan final</button>
          </form>}
        </section>}

        {record.validation?.outcome === 't0-confirmed' && !record.workflowIssue && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Referral / transport</h2>
          <p className="mt-2 font-semibold text-slate-900">{referralLabels[record.referral?.status] || 'Status referral tidak tersedia'}</p>
          {nextAction && <><p className="mt-2 text-sm text-slate-600">Langkah berikutnya: {nextAction.label}</p>{blockReason && <p className="mt-2 text-sm text-amber-800">{blockReason}</p>}<button type="button" onClick={onAdvanceReferral} disabled={!!blockReason || busy} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{nextAction.label}</button></>}
          {!nextAction && <p className="mt-2 text-sm text-slate-600">Referral selesai. Tidak ada langkah berikutnya.</p>}
        </section>}

        <HistoryPanel record={record} history={history} onRetry={onHistoryRetry} />
      </>}

      {confirming && record && !record.validation && !record.workflowIssue && <div role="dialog" aria-modal="true" aria-labelledby="decision-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="decision-confirm-title" className="text-lg font-bold text-slate-900">Konfirmasi keputusan final</h2><p className="mt-3 text-sm text-slate-700">Keputusan: <span className="font-semibold">{confirming.outcome === 't0-confirmed' ? 'T0-Confirmed' : `Downgraded → ${confirming.downgradedTo}`}</span></p><p className="mt-2 text-sm text-slate-700">Keputusan ini akan disimpan sebagai keputusan final pada prototype v1 dan tidak dapat diedit melalui aplikasi.</p>{blockReason && <p className="mt-3 text-sm text-amber-800">{blockReason}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onCancelConfirmation} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batal</button><button type="button" onClick={onConfirmDecision} disabled={!!blockReason || busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Konfirmasi</button></div></div></div>}
    </div>
  );
}
