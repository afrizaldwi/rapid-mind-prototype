import { useState } from 'react';
import { usePoskoOperations } from '../../hooks/usePoskoOperations';
import { savePoskoResource } from '../../lib/poskoResources';
import { resourceQuantitiesSchema } from '../../schemas/poskoResource';

const empty = { medicinePackages: '', medicalKits: '' };
function quantity(value) {
  return /^(0|[1-9]\d*)$/.test(value) ? Number(value) : NaN;
}

export default function ResourcesPage() {
  const { rows, unmatched, clinical, roster, resources, online, loading, error, current } = usePoskoOperations();
  const [editing, setEditing] = useState('');
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [awaiting, setAwaiting] = useState(null);
  const stamp = (value) => value && `${value.seconds}:${value.nanoseconds}`;
  const confirmed = awaiting && current && resources.revision > awaiting.previousRevision && resources.data?.resources.some((item) =>
    item.poskoId === awaiting.poskoId && item.medicinePackages === awaiting.quantities.medicinePackages &&
    item.medicalKits === awaiting.quantities.medicalKits && stamp(item.updatedAt) !== awaiting.previousUpdatedAt);
  const canSave = current && !busy && (!awaiting || confirmed);
  const begin = (row) => {
    setEditing(row.posko.id);
    setForm(row.resources ? { medicinePackages: String(row.resources.medicinePackages),
      medicalKits: String(row.resources.medicalKits) } : empty);
    setMessage(null);
  };
  const save = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    const quantities = { medicinePackages: quantity(form.medicinePackages), medicalKits: quantity(form.medicalKits) };
    if (!resourceQuantitiesSchema.safeParse(quantities).success) {
      setMessage({ type: 'error', text: 'Masukkan bilangan bulat non-negatif untuk kedua alokasi.' });
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const previousRevision = resources.revision;
      const previousUpdatedAt = stamp(resources.data?.resources.find((item) => item.poskoId === editing)?.updatedAt);
      await savePoskoResource(editing, quantities);
      setAwaiting({ poskoId: editing, quantities, previousRevision, previousUpdatedAt });
      setMessage({ type: 'waiting', text: 'Simpan dikirim. Menunggu alokasi terkonfirmasi server.' });
      setEditing('');
    } catch (cause) { setMessage({ type: 'error', text: cause.message || 'Alokasi gagal disimpan.' }); }
    finally { setBusy(false); }
  };
  const waiting = awaiting && !confirmed;
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Logistik Posko</h1>
      <p className="text-sm text-slate-600">Alokasi operasional per Posko. Jumlah ini adalah snapshot alokasi, bukan stok gudang.</p></div>
    <p role="status" className={`rounded border p-3 text-sm ${current ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {error ? 'Satu atau lebih listener bermasalah; simpan dinonaktifkan.' : loading ? 'Memuat cases, emergencies, Relawan, dan alokasi…' : current ? 'Keempat sumber terkonfirmasi server.' : 'Browser offline, cache, atau perubahan tertunda; data belum terkonfirmasi server.'}
    </p>
    {!online && <p role="alert" className="text-sm text-amber-800">Browser offline; alokasi tidak dapat disimpan.</p>}
    {(unmatched.relawan + unmatched.activeT0 + unmatched.currentSrq + (resources.data?.rejected || 0) + (roster.data?.rejected || 0)) > 0 &&
      <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Data tidak dipetakan: {unmatched.relawan} penugasan Relawan, {unmatched.activeT0} T0, {unmatched.currentSrq} SRQ. Dokumen dilewati: {resources.data?.rejected || 0} alokasi, {roster.data?.rejected || 0} profil Relawan. Kasus/emergency ditolak: {clinical.model.metrics.rejectedCases}/{clinical.model.metrics.rejectedEmergencies}.</p>}
    {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{confirmed ? 'Alokasi terkonfirmasi server.' : message.text}</p>}
    <div className="grid gap-4 lg:grid-cols-2">{rows.map((row) => <section key={row.posko.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{row.posko.name}</h2>
      <div className="grid grid-cols-2 gap-2 text-sm text-slate-700"><span>Relawan ditugaskan: {row.assignedRelawanCount}</span><span>T0 aktif · event: {row.activeT0Count}</span><span>SRQ T1 · pasien: {row.currentSrq.T1}</span><span>SRQ T2 · pasien: {row.currentSrq.T2}</span><span>SRQ T3 · pasien: {row.currentSrq.T3}</span></div>
      <div className="border-t pt-3 text-sm"><p>Paket obat: <strong>{row.resourceInvalid ? 'Data tidak valid' : row.resources ? row.resources.medicinePackages : 'Belum dicatat'}</strong></p><p>Kit medis: <strong>{row.resourceInvalid ? 'Data tidak valid' : row.resources ? row.resources.medicalKits : 'Belum dicatat'}</strong></p></div>
      {editing === row.posko.id ? <form onSubmit={save} className="space-y-3 border-t pt-3">
        <label className="block text-sm">Paket obat<input type="number" min="0" step="1" required value={form.medicinePackages} onChange={(event) => setForm({ ...form, medicinePackages: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="block text-sm">Kit medis<input type="number" min="0" step="1" required value={form.medicalKits} onChange={(event) => setForm({ ...form, medicalKits: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <div className="flex gap-2"><button disabled={!canSave} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan alokasi'}</button><button type="button" disabled={busy} onClick={() => setEditing('')} className="rounded border px-4 py-2">Batal</button></div>
      </form> : <button type="button" disabled={!current || busy || waiting || row.resourceInvalid} onClick={() => begin(row)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">{row.resources ? 'Ubah alokasi' : 'Catat alokasi'}</button>}
    </section>)}</div>
  </div>;
}
