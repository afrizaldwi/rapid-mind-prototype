import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAdminRealtimeModel } from '../../hooks/useAdminRealtimeModel';

const layers = [
  { key: 'T0', label: 'T0 · emergency aktif', color: '#b91c1c' },
  { key: 'T1', label: 'T1 · SRQ High Risk', color: '#ea580c' },
  { key: 'T2', label: 'T2 · SRQ Moderate Risk', color: '#ca8a04' },
  { key: 'T3', label: 'T3 · SRQ Low Risk', color: '#16a34a' },
];
const initialCenter = [-6.2, 106.8]; // Neutral navigation viewport, never an observed point.

function FocusObservedPoints({ buckets }) {
  const map = useMap();
  useEffect(() => {
    if (buckets.length) map.fitBounds(buckets.map(({ coordinates }) => [coordinates.lat, coordinates.lng]), { maxZoom: 12, padding: [30, 30] });
  }, [buckets, map]);
  return null;
}

export default function MapPage() {
  const { model, current, loading, error, status } = useAdminRealtimeModel();
  const center = model.geospatial[0]?.coordinates;
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Peta risiko geospasial</h1>
      <p className="text-sm text-slate-600">T0 aktif dan SRQ terkini dari koordinat yang benar-benar tersimpan; ukuran lingkaran menunjukkan jumlah pada koordinat persis.</p>
      <p className={`mt-2 text-sm ${current ? 'text-green-800' : error ? 'text-red-800' : 'text-amber-800'}`} role="status">{status}</p>
    </div>
    {!current && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Proyeksi yang terlihat belum merupakan kondisi operasional terkonfirmasi dari server.</p>}
    {loading && <p className="text-sm text-slate-600">Memuat kedua sumber data…</p>}
    {!loading && model.geospatial.length === 0 && <p className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-700">Belum ada koordinat valid pada T0 aktif atau SRQ terkini. Tidak ada titik data sintetis.</p>}
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-4 text-xs">{layers.map((layer) => <span key={layer.key} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: layer.color }} />{layer.label}</span>)}</div>
      <div className="h-[540px] overflow-hidden rounded-lg"><MapContainer center={center ? [center.lat, center.lng] : initialCenter} zoom={center ? 11 : 5} style={{ height: '100%', width: '100%' }}>
        <FocusObservedPoints buckets={model.geospatial} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {model.geospatial.flatMap((bucket) => layers.filter((layer) => bucket[layer.key] > 0).map((layer) => <CircleMarker key={`${bucket.key}-${layer.key}`} center={[bucket.coordinates.lat, bucket.coordinates.lng]} radius={Math.min(26, 7 + 3 * Math.sqrt(bucket[layer.key]))} pathOptions={{ color: layer.color, fillColor: layer.color, fillOpacity: layer.key === 'T0' ? 0.18 : 0.12, weight: layer.key === 'T0' ? 3 : 2 }}>
          <Popup><div className="space-y-1 text-sm"><strong>{bucket.labels.join(' / ') || 'Lokasi tanpa label posko'}</strong><div>Koordinat: {bucket.key}</div><div>T0 aktif: {bucket.T0} event</div><div>SRQ T1: {bucket.T1} pasien</div><div>SRQ T2: {bucket.T2} pasien</div><div>SRQ T3: {bucket.T3} pasien</div><div className="text-xs">Populasi T0 dan SRQ dapat tumpang tindih.</div></div></Popup>
        </CircleMarker>))}
      </MapContainer></div>
    </div>
    <p className="text-xs text-slate-600">SRQ tanpa koordinat: {model.metrics.currentSrqWithoutCoordinates}; T0 aktif tanpa koordinat: {model.metrics.activeT0WithoutCoordinates}. Downgrade Nakes dan triase legacy tidak menentukan lapisan SRQ.</p>
  </div>;
}
