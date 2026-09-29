import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { organizationInputFromForm } from '../../schemas/healthcareOrganization';
import { saveHospital, watchHospitals } from '../../lib/healthcareOrganizations';

const blank = { name: '', address: '', lat: '', lng: '', operationalStatus: 'active', t0ReferralEligible: false };
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2';

export default function OrganizationRegistryPage() {
  const { user } = useAuth();
  const [registry, setRegistry] = useState({ hospitals: [], rejected: [], fromCache: false, pending: false });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => watchHospitals((value) => { setRegistry(value); setStatus('ready'); setError(''); }, () => {
    setStatus('error'); setError('Daftar rumah sakit gagal dimuat.');
  }), []);

  const edit = (hospital) => {
    setSelectedId(hospital.id);
    setForm({ name: hospital.name, address: hospital.address || '', lat: hospital.lat === undefined ? '' : String(hospital.lat), lng: hospital.lng === undefined ? '' : String(hospital.lng), operationalStatus: hospital.operationalStatus, t0ReferralEligible: hospital.t0ReferralEligible });
    setError('');
    setSuccess('');
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const input = organizationInputFromForm(form);
      await saveHospital({ id: selectedId, input, adminUid: user.uid });
      setSelectedId(null);
      setForm(blank);
      setSuccess('Rumah sakit berhasil disimpan.');
    } catch (cause) {
      setError(cause?.issues ? cause.issues.map((issue) => issue.message).join(' ') : cause.message || 'Gagal menyimpan rumah sakit.');
    } finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Registri Rumah Sakit</h1><p className="text-sm text-slate-600">Identitas organisasi untuk keanggotaan Nakes. Belum digunakan untuk tujuan rujukan T0.</p></div>
    {registry.fromCache && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Data dari cache; periksa koneksi sebelum mengubah.</p>}
    {registry.pending && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Perubahan menunggu sinkronisasi.</p>}
    {status === 'loading' && <p>Memuat rumah sakit...</p>}
    {status === 'error' && <p role="alert" className="text-red-700">{error}</p>}
    {status === 'ready' && <section className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 font-semibold">Rumah sakit terdaftar</h2>
      {registry.hospitals.length === 0 ? <p className="text-sm text-slate-600">Belum ada rumah sakit. Buat catatan demo secara manual.</p> :
        <ul className="space-y-2">{registry.hospitals.map((hospital) => <li key={hospital.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div><p className="font-medium">{hospital.name}</p><p className="text-xs text-slate-500">{hospital.operationalStatus} · T0: {hospital.t0ReferralEligible ? 'memenuhi syarat' : 'tidak memenuhi syarat'}</p></div>
          <button type="button" onClick={() => edit(hospital)} className="rounded-lg border px-3 py-1.5 text-sm">Lihat / Edit</button>
        </li>)}</ul>}
      {registry.rejected.length > 0 && <p role="alert" className="mt-3 text-sm text-red-700">{registry.rejected.length} dokumen organisasi tidak valid: {registry.rejected.join(', ')}</p>}
    </section>}
    <section className="rounded-xl border bg-white p-5">
      <div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold">{selectedId ? 'Edit rumah sakit' : 'Tambah rumah sakit'}</h2>{selectedId && <button type="button" onClick={() => { setSelectedId(null); setForm(blank); setError(''); setSuccess(''); }} className="text-sm text-blue-700">Buat baru</button>}</div>
      {success && !error && <p role="status" className="mb-3 text-sm text-green-700">{success}</p>}
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">Nama RS<input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="block text-sm">Alamat (opsional)<input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Lintang (opsional)<input type="number" step="any" className={inputClass} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></label>
          <label className="text-sm">Bujur (opsional)<input type="number" step="any" className={inputClass} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></label>
        </div>
        <button type="button" onClick={() => setForm({ ...form, lat: '', lng: '' })} className="text-sm text-blue-700">Hapus kedua koordinat</button>
        <label className="block text-sm">Status operasional<select className={inputClass} value={form.operationalStatus} onChange={(e) => setForm({ ...form, operationalStatus: e.target.value })}><option value="active">Aktif</option><option value="inactive">Tidak aktif</option></select></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.t0ReferralEligible} onChange={(e) => setForm({ ...form, t0ReferralEligible: e.target.checked })} />Layak menerima rujukan T0</label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={saving || status !== 'ready' || registry.fromCache || registry.pending || (!selectedId && registry.hospitals.length > 0)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan rumah sakit'}</button>
        {!selectedId && registry.hospitals.length > 0 && <p className="text-xs text-slate-500">Scope demo ini menggunakan satu rumah sakit. Pilih catatan yang ada untuk mengubahnya.</p>}
      </form>
    </section>
  </div>;
}
