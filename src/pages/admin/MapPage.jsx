import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon } from "lucide-react";
import { getLegacyZone } from "../../lib/caseRecords";

// Dummy coordinates for poskos if not provided in DB
const DUMMY_POSKOS = {
  "Posko Utama": { lat: -6.2, lng: 106.816666 },
  "Posko Timur": { lat: -6.22, lng: 106.85 },
  "Posko Barat": { lat: -6.18, lng: 106.75 },
  "Posko Utara": { lat: -6.13, lng: 106.82 },
  "Posko Selatan": { lat: -6.28, lng: 106.8 },
};

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [poskoData, setPoskoData] = useState([]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const casesRef = collection(db, "cases");
        const querySnapshot = await getDocs(casesRef);

        const aggregated = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const zone = getLegacyZone(data)?.toUpperCase();
          if (!zone) return;
          const posko = data.poskoName || "Posko Tidak Diketahui";

          if (!aggregated[posko]) {
            aggregated[posko] = {
              name: posko,
              merah: 0,
              kuning: 0,
              hijau: 0,
              lat:
                data.lat ||
                data.poskoLat ||
                data.location?.lat ||
                DUMMY_POSKOS[posko]?.lat ||
                -6.2088,
              lng:
                data.lng ||
                data.poskoLng ||
                data.location?.lng ||
                DUMMY_POSKOS[posko]?.lng ||
                106.8456,
            };
          }

          if (zone === "MERAH") aggregated[posko].merah++;
          else if (zone === "KUNING") aggregated[posko].kuning++;
          else if (zone === "HIJAU") aggregated[posko].hijau++;
        });

        setPoskoData(Object.values(aggregated));
      } catch (error) {
        console.error("Error fetching map data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <MapIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Peta Sebaran Triase
          </h1>
          <p className="text-slate-500">
            Visualisasi geospasial kasus berdasarkan posko
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-[600px] relative">
        <MapContainer
          center={[-6.2, 106.8]}
          zoom={11}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {poskoData.map((posko, idx) => (
            <div key={idx}>
              {posko.merah > 0 && (
                <CircleMarker
                  center={[posko.lat, posko.lng]}
                  radius={10 + posko.merah * 2}
                  pathOptions={{
                    color: "#dc2626",
                    fillColor: "#dc2626",
                    fillOpacity: 0.5,
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div className="p-1">
                      <h3 className="font-bold mb-2">{posko.name}</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-red-600">Merah:</span>{" "}
                          <span>{posko.merah}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-amber-600">Kuning:</span>{" "}
                          <span>{posko.kuning}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-green-600">Hijau:</span>{" "}
                          <span>{posko.hijau}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )}
              {posko.kuning > 0 && (
                <CircleMarker
                  center={[posko.lat, posko.lng]}
                  radius={8 + posko.kuning * 1.5}
                  pathOptions={{
                    color: "#f59e0b",
                    fillColor: "#f59e0b",
                    fillOpacity: 0.6,
                    weight: 1,
                  }}
                />
              )}
              {posko.hijau > 0 && (
                <CircleMarker
                  center={[posko.lat, posko.lng]}
                  radius={6 + posko.hijau * 1}
                  pathOptions={{
                    color: "#16a34a",
                    fillColor: "#16a34a",
                    fillOpacity: 0.7,
                    weight: 1,
                  }}
                />
              )}
            </div>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-[400] bg-white p-4 rounded-lg shadow-lg border border-slate-200">
          <h4 className="font-semibold text-sm mb-2">Legenda Kepadatan</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500/50 border border-red-600" />
              <span>Zona Merah</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500/60 border border-amber-600" />
              <span>Zona Kuning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500/70 border border-green-600" />
              <span>Zona Hijau</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">
              *Ukuran lingkaran = jumlah kasus
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
