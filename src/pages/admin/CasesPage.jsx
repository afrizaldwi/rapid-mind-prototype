import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { collectAdminCases } from '../../lib/adminReadModel';

const formatTime = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Waktu tidak tersedia';
const label = (item) => item.type === 'pfa' ? 'PFA / Akut' : item.type === 'srq20' ? `SRQ / Lanjutan · ${item.tier}` : `Legacy triage · ${item.zone}`;

export default function CasesPage() {
  const [result, setResult] = useState({ items: [], rejected: [] });
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState('all');
  const [posko, setPosko] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'cases')).then((snapshot) => {
      if (active) { setResult(collectAdminCases(snapshot)); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  const poskos = useMemo(() => [...new Set(result.items.map((item) => item.poskoName).filter(Boolean))].sort(), [result.items]);
  const filtered = result.items.filter((item) => {
    if (filter === 'pfa' || filter === 'srq20' || filter === 'legacy-triage') { if (item.type !== filter) return false; }
    else if (filter !== 'all' && (item.type !== 'srq20' || item.tier !== filter)) return false;
    if (posko !== 'all' && item.poskoName !== posko) return false;
    const haystack = [item.id, item.patientNik, item.patientName, item.relawanName, item.relawanId, item.poskoName].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Catatan asesmen Admin</h1><p className="text-slate-500">PFA, SRQ-20 tersimpan, dan triase legacy dari Firestore</p></div>
    {status === 'loading' && <p className="text-sm text-slate-600">Memuat catatan...</p>}
    {status === 'error' && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Catatan tidak dapat dimuat. Coba buka kembali halaman ini.</p>}
    {status === 'ready' && <>
      {result.rejected.length > 0 && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{result.rejected.length} catatan tidak dikenal atau malformed dipisahkan dari daftar.</p>}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input className="min-w-56 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Cari NIK, nama, Relawan, posko, ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter jenis asesmen"><option value="all">Semua</option><option value="pfa">PFA / Akut</option><option value="srq20">SRQ / Lanjutan</option><option value="T1">SRQ T1</option><option value="T2">SRQ T2</option><option value="T3">SRQ T3</option><option value="legacy-triage">Legacy triage</option></select>
        <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={posko} onChange={(event) => setPosko(event.target.value)} aria-label="Filter posko"><option value="all">Semua Posko</option>{poskos.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Waktu', 'Pasien / NIK', 'Relawan', 'Posko', 'Jenis / hasil', 'Detail'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3 whitespace-nowrap">{formatTime(item.timestamp)}</td><td className="px-4 py-3">{item.patientName || '-'}<br />{item.patientNik || '-'}</td><td className="px-4 py-3">{item.relawanName || item.relawanId || '-'}</td><td className="px-4 py-3">{item.poskoName || '-'}</td><td className="px-4 py-3 font-medium">{label(item)}</td><td className="px-4 py-3"><button className="text-blue-700 hover:underline" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? 'Tutup' : 'Lihat'}</button>{expanded === item.id && <div className="mt-3 min-w-64 space-y-1 text-slate-700"><p>ID: {item.id}</p>{item.type === 'srq20' && <><p>Skor SRQ tersimpan: {item.score}</p><p>Base tier tersimpan: {item.baseTier}</p><p>Final tier tersimpan: {item.tier}</p><p>Mode: {item.inputMode}</p><p>Waktu asesmen: {formatTime(item.timestamp)}</p></>}{item.type === 'pfa' && <><p>Versi: {item.protocolVersion}</p><p>Respons PFA:</p>{Object.entries(item.responses).map(([key, value]) => <p key={key}>{key}: {String(value)}</p>)}</>}{item.type === 'legacy-triage' && <p>Zona legacy: {item.zone}</p>}</div>}</td></tr>)}
      </tbody></table>{filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Tidak ada catatan yang cocok.</p>}</div>
    </>}
  </div>;
}
