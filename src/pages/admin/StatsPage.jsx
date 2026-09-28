import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useAdminRealtimeModel } from '../../hooks/useAdminRealtimeModel';

const tiers = [
  { key: 'T1', label: 'T1 · High Risk', color: '#ea580c' },
  { key: 'T2', label: 'T2 · Moderate Risk', color: '#ca8a04' },
  { key: 'T3', label: 'T3 · Low Risk', color: '#16a34a' },
];

export default function StatsPage() {
  const { model, current, loading, error, status } = useAdminRealtimeModel();
  const { metrics } = model;
  const distribution = tiers.map((tier) => ({ name: tier.label, value: metrics.latestTiers[tier.key], color: tier.color }));
  const currentSrqCount = distribution.reduce((sum, item) => sum + item.value, 0);
  const cards = [
    ['Pasien terdata · NIK valid unik', metrics.trackedPatients],
    ...tiers.map((tier) => [`SRQ terkini ${tier.key} · pasien`, metrics.latestTiers[tier.key]]),
    ['T0 aktif · event', metrics.activeT0],
    ['PFA · catatan', metrics.pfaRecords],
    ['SRQ · catatan historis', metrics.srqRecords],
  ];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Analitik asesmen dan emergency</h1>
      <p className="text-sm text-slate-600">Status SRQ pasien terkini, volume catatan, dan event T0 ditampilkan menurut asal datanya.</p>
      <p className={`mt-2 text-sm ${current ? 'text-green-800' : error ? 'text-red-800' : 'text-amber-800'}`} role="status">{status}</p>
    </div>
    {!current && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{loading ? 'Menunggu kedua listener.' : 'Angka yang terlihat belum merupakan kondisi operasional terkonfirmasi dari server.'}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '—' : value}</p></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Distribusi SRQ terkini</h2><p className="text-xs text-slate-600">Satu SRQ eligible terbaru per NIK; denominator {loading ? '—' : currentSrqCount} pasien SRQ. T0 event tidak termasuk.</p>
        {currentSrqCount ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{distribution.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <p className="py-16 text-center text-sm text-slate-500">Belum ada SRQ terkini.</p>}
        <div className="flex flex-wrap gap-3 text-sm">{distribution.map((item) => <span key={item.name} style={{ color: item.color }}>{item.name}: {item.value}</span>)}</div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Hasil validasi sekunder Nakes</h2><p className="text-xs text-slate-600">Downgrade event T0; terpisah dari hasil asesmen SRQ.</p><div className="mt-5 space-y-2 text-sm"><p>Downgrade → T1: {metrics.downgraded.T1}</p><p>Downgrade → T2: {metrics.downgraded.T2}</p><p>T0 aktif: {metrics.activeT0} event</p></div>
        <h3 className="mt-6 font-semibold">Triase legacy historis</h3><p className="text-xs text-slate-600">Merah/kuning/hijau tidak termasuk tier SRQ.</p><p className="mt-3 text-sm">Merah {metrics.legacy.merah} · Kuning {metrics.legacy.kuning} · Hijau {metrics.legacy.hijau}</p>
      </section>
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Riwayat asesmen SRQ · rolling 30 × 24 jam</h2><p className="text-xs text-slate-600">{model.windowStart} sampai {model.reference}, inklusif. Satu baris per tanggal kalender UTC; asesmen berulang dihitung sebagai event terpisah menurut tier akhir yang tersimpan. Ini berbeda dari distribusi pasien terkini.</p>
      {model.srqTrend.length ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={model.srqTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend />{tiers.map((tier) => <Bar key={tier.key} dataKey={tier.key} name={`SRQ ${tier.key}`} stackId="srq" fill={tier.color} />)}</BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-slate-500">Belum ada asesmen SRQ dalam jendela ini.</p>}
    </section>
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><h2 className="font-semibold text-amber-950">Kualitas data</h2><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><p>Kasus malformed: {metrics.rejectedCases}</p><p>Origin emergency malformed: {metrics.rejectedEmergencies}</p><p>Metadata workflow bermasalah: {metrics.workflowIssues}</p><p>Kasus tanpa waktu: {metrics.undatedCases}</p><p>Kasus masa depan: {metrics.futureDatedCases}</p><p>Emergency masa depan: {metrics.futureDatedEmergencies}</p><p>SRQ terkini tanpa koordinat: {metrics.currentSrqWithoutCoordinates}</p><p>T0 aktif tanpa koordinat: {metrics.activeT0WithoutCoordinates}</p></div></section>
  </div>;
}
