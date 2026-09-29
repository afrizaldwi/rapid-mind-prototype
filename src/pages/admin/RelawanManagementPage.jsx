import { useState } from 'react';
import { DEMO_POSKOS } from '../../data/demoPoskos';
import { createRelawanAccount } from '../../lib/accountProvisioning';

export default function RelawanManagementPage() {
  const [form, setForm] = useState({ name: '', email: '', initialPassword: '', poskoName: '' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setCreated(null); setBusy(true);
    try {
      const posko = DEMO_POSKOS.find((item) => item.name === form.poskoName);
      if (!posko) throw new Error('Pilih Posko.');
      const result = await createRelawanAccount({ name: form.name, email: form.email,
        initialPassword: form.initialPassword, poskoName: posko.name, poskoLat: posko.lat, poskoLng: posko.lng });
      setCreated(result);
      setForm((previous) => ({ ...previous, initialPassword: '' }));
    } catch (cause) { setError(cause.message || 'Akun Relawan gagal dibuat.'); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-2xl font-bold">Relawan</h1><p className="text-sm text-slate-600">Buat akun Relawan dan pilih Posko penugasan.</p></div>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Buat Akun Relawan</h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Nama lengkap<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Email<input required type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Password awal<input required type="password" minLength={6} autoComplete="new-password" value={form.initialPassword} onChange={(event) => setForm({ ...form, initialPassword: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">Posko<select required value={form.poskoName} onChange={(event) => setForm({ ...form, poskoName: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Pilih Posko</option>{DEMO_POSKOS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">Buat akun</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {created && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Akun Relawan dibuat. UID: {created.uid} · Email: {created.email} · Peran: Relawan · Posko: {created.poskoName}{created.cleanupIssue ? ' · Sesi sementara gagal ditutup; periksa sebelum membuat akun lain.' : ''}</p>}
    </section>
  </div>;
}
