import { useEffect, useState } from 'react';
import { createNakesAccount } from '../../lib/accountProvisioning';
import { membershipStatus } from '../../schemas/healthcareOrganization';
import { assignNakesOrganization, lookupPrivilegedProfile, watchHospitals } from '../../lib/healthcareOrganizations';

export default function NakesManagementPage() {
  const [form, setForm] = useState({ name: '', email: '', initialPassword: '', organizationId: '' });
  const [created, setCreated] = useState(null);
  const [createError, setCreateError] = useState('');
  const [uid, setUid] = useState('');
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [registryReady, setRegistryReady] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => watchHospitals(({ hospitals: data }) => { setHospitals(data); setRegistryReady(true); },
    () => { setRegistryReady(false); setMessage('Daftar rumah sakit gagal dimuat.'); }), []);

  const create = async (event) => {
    event.preventDefault(); setCreateError(''); setCreated(null); setBusy(true);
    try {
      if (!registryReady) throw new Error('Daftar rumah sakit belum tersedia.');
      if (form.organizationId && !hospitals.some((item) => item.id === form.organizationId)) throw new Error('Rumah sakit tidak tersedia.');
      const result = await createNakesAccount({ name: form.name, email: form.email,
        initialPassword: form.initialPassword, ...(form.organizationId ? { organizationId: form.organizationId } : {}) });
      setCreated(result);
      setForm((previous) => ({ ...previous, initialPassword: '' }));
    } catch (error) { setCreateError(error.message || 'Akun Nakes gagal dibuat.'); }
    finally { setBusy(false); }
  };
  const lookup = async (event) => {
    event.preventDefault(); setMessage(''); setProfile(null); setBusy(true);
    try {
      const found = await lookupPrivilegedProfile(uid.trim());
      if (found.role !== 'nakes') throw new Error('Profil ini bukan Nakes.');
      setProfile(found); setOrganizationId(membershipStatus(found) || '');
    } catch (error) { setMessage(error.message || 'Profil tidak dapat dibaca.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await assignNakesOrganization(profile, organizationId || null);
      const updated = await lookupPrivilegedProfile(profile.uid);
      setProfile(updated); setOrganizationId(membershipStatus(updated) || ''); setMessage('Keanggotaan Nakes tersimpan.');
    } catch (error) { setMessage(error.message || 'Keanggotaan gagal disimpan.'); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-2xl font-bold">Nakes</h1><p className="text-sm text-slate-600">Buat akun Nakes dan kelola keanggotaan rumah sakit.</p></div>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Buat Akun Nakes</h2>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Nama lengkap<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Email<input required type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Password awal<input required type="password" minLength={6} autoComplete="new-password" value={form.initialPassword} onChange={(event) => setForm({ ...form, initialPassword: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Rumah sakit<select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Belum ditugaskan</option>{hospitals.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.operationalStatus})</option>)}</select></label>
        <button disabled={busy || !registryReady} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">Buat akun</button>
      </form>
      {createError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
      {created && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Akun Nakes dibuat. UID: {created.uid} · Email: {created.email} · Peran: Nakes · Rumah sakit: {created.organizationId ? hospitals.find((item) => item.id === created.organizationId)?.name || created.organizationId : 'Belum ditugaskan'}{created.cleanupIssue ? ' · Sesi sementara gagal ditutup; periksa sebelum membuat akun lain.' : ''}</p>}
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Keanggotaan Nakes Existing</h2>
      <p className="text-sm text-slate-600">Cari profil Nakes yang sudah ada melalui UID Firebase Authentication.</p>
      <form onSubmit={lookup} className="flex gap-2"><input aria-label="UID akun Nakes" placeholder="UID Firebase Auth" value={uid} onChange={(event) => setUid(event.target.value)} required className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Cari</button></form>
      {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
      {profile && <div className="space-y-3"><h3 className="font-semibold">{profile.name || 'Tanpa nama'}</h3><p className="text-sm">UID: {profile.uid}</p><p className="text-sm">Email: {profile.email || 'Tidak tersedia'}</p><p className="text-sm">Peran: Nakes</p><p className="text-sm">Saat ini: {membershipStatus(profile) ? hospitals.find((item) => item.id === membershipStatus(profile))?.name || `Organisasi tidak ditemukan (${membershipStatus(profile)})` : 'Belum ditugaskan ke organisasi'}</p>
        <label className="block text-sm">Rumah sakit<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Belum ditugaskan</option>{hospitals.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.operationalStatus})</option>)}</select></label>
        <button type="button" onClick={save} disabled={busy || !registryReady} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">Simpan keanggotaan</button>
      </div>}
    </section>
  </div>;
}
