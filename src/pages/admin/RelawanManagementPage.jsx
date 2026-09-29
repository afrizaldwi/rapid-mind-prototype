import { useEffect, useState } from 'react';
import { DEMO_POSKOS } from '../../data/demoPoskos';
import { createRelawanAccount } from '../../lib/accountProvisioning';
import { reassignRelawan, rosterIsCurrent, watchRelawan } from '../../lib/relawanManagement';

export default function RelawanManagementPage() {
  const [form, setForm] = useState({ name: '', email: '', initialPassword: '', poskoName: '' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState(null);
  const [rosterStatus, setRosterStatus] = useState('loading');
  const [rosterError, setRosterError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [targetPosko, setTargetPosko] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnline = () => { setOnline(navigator.onLine); setRosterStatus('stale'); };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    const unsubscribe = watchRelawan((value) => {
      setRoster(value); setRosterStatus('ready'); setRosterError('');
    }, () => { setRosterStatus('error'); setRosterError('Daftar Relawan gagal diperbarui.'); });
    return () => {
      unsubscribe();
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const assign = async (event) => {
    event.preventDefault();
    setAssignmentError(''); setAssignmentSuccess('');
    const profile = roster?.relawan.find((item) => item.uid === selectedUid);
    if (!profile || !rosterIsCurrent(roster, navigator.onLine) || rosterStatus !== 'ready' || assigning ||
        !targetPosko || targetPosko === profile.poskoName) {
      setAssignmentError('Penugasan belum tersedia. Periksa pilihan dan koneksi server.');
      return;
    }
    setAssigning(true);
    try {
      await reassignRelawan(selectedUid, targetPosko);
      setAssignmentSuccess('Penugasan disimpan. Menunggu daftar terkonfirmasi server.');
      setSelectedUid(''); setTargetPosko('');
    } catch (cause) { setAssignmentError(cause.message || 'Penugasan gagal disimpan.'); }
    finally { setAssigning(false); }
  };

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

  const current = rosterStatus === 'ready' && rosterIsCurrent(roster, online);
  const selected = roster?.relawan.find((item) => item.uid === selectedUid);

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-2xl font-bold">Relawan</h1><p className="text-sm text-slate-600">Buat akun dan kelola penugasan Posko Relawan.</p></div>
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
      {created && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Akun Relawan dibuat. Email: {created.email} · Peran: Relawan · Posko: {created.poskoName}{created.cleanupIssue ? ' · Sesi sementara gagal ditutup; periksa sebelum membuat akun lain.' : ''}</p>}
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div><h2 className="font-semibold">Penugasan Posko</h2><p className="text-sm text-slate-600">Relawan ditugaskan berdasarkan profil saat ini. Catatan kegiatan lama tetap memakai Posko saat dicatat.</p></div>
      {rosterStatus === 'loading' && <p className="text-sm text-slate-600">Memuat daftar Relawan...</p>}
      {rosterStatus === 'error' && <p role="alert" className="text-sm text-red-700">{rosterError} Penugasan dinonaktifkan sampai daftar terhubung kembali.</p>}
      {rosterStatus !== 'loading' && rosterStatus !== 'error' && !current && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Daftar dari cache, perubahan tertunda, atau browser offline. Penugasan dinonaktifkan sampai data dikonfirmasi server.</p>}
      {rosterStatus === 'ready' && current && <p role="status" className="text-sm text-green-700">Daftar terkonfirmasi server.</p>}
      {roster?.rejected > 0 && <p role="alert" className="text-sm text-amber-800">{roster.rejected} profil Relawan tidak valid dilewati.</p>}
      {roster && (roster.relawan.length === 0 ? <p className="text-sm text-slate-600">Belum ada Relawan ditugaskan.</p> :
        <ul className="space-y-2">{roster.relawan.map((profile) => <li key={profile.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0"><p className="font-medium text-slate-900">{profile.name}</p><p className="break-all text-sm text-slate-600">{profile.email}</p><p className="text-sm text-slate-700">Posko: {profile.poskoName}</p></div>
          <button type="button" disabled={!current || assigning} onClick={() => { setSelectedUid(profile.uid); setTargetPosko(''); setAssignmentError(''); setAssignmentSuccess(''); }} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Ubah Posko</button>
        </li>)}</ul>)}
      {selected && <form onSubmit={assign} className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Pindahkan {selected.name} dari {selected.poskoName}</p>
        <label className="block text-sm">Posko tujuan<select required value={targetPosko} disabled={!current || assigning} onChange={(event) => setTargetPosko(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Pilih Posko tujuan</option>{DEMO_POSKOS.filter((item) => item.name !== selected.poskoName).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <div className="flex gap-2"><button disabled={!current || assigning || !targetPosko} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{assigning ? 'Menyimpan...' : 'Simpan penugasan'}</button><button type="button" disabled={assigning} onClick={() => { setSelectedUid(''); setTargetPosko(''); }} className="rounded-lg border px-4 py-2 text-sm">Batal</button></div>
      </form>}
      {assignmentError && <p role="alert" className="text-sm text-red-700">{assignmentError}</p>}
      {assignmentSuccess && <p role="status" className="text-sm text-green-700">{assignmentSuccess}</p>}
    </section>
  </div>;
}
