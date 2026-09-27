import React, { useState, useEffect } from "react";
import { Clock, CheckCircle, RefreshCw } from "lucide-react";
import { localDb } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { getCaseRecordType, getLegacyZone } from "../../lib/caseRecords";

export default function HistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const cases = await localDb.cases
        .where("relawanId")
        .equals(user.uid)
        .reverse()
        .sortBy("timestamp");
      setHistory(cases);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getZonaConfig = (zona) => {
    switch (zona) {
      case "merah":
        return "bg-red-100 text-red-700 border-red-200";
      case "kuning":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "hijau":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatDate = (timestamp) => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white px-4 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Riwayat Asesmen Saya</h1>
        <button
          onClick={loadHistory}
          className="text-gray-500 hover:text-blue-600 p-1"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">
            Memuat riwayat...
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 mt-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Belum ada riwayat
            </h3>
            <p className="text-gray-500 text-sm">
              Catatan asesmen yang Anda simpan akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.localId || item.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-2">
                  <div
                    className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border uppercase ${getZonaConfig(getLegacyZone(item))}`}
                  >
                    {getCaseRecordType(item) === 'legacy-triage'
                      ? `Zona ${getLegacyZone(item)}`
                      : getCaseRecordType(item) === 'pfa' ? 'PFA'
                        : getCaseRecordType(item) === 'srq20' ? 'SRQ-20' : 'Catatan tidak diketahui'}
                  </div>
                  {item.synced ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Tersinkron
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                      <Clock className="w-3.5 h-3.5" /> Menunggu
                    </div>
                  )}
                </div>

                {getCaseRecordType(item) === 'legacy-triage' && <p className="text-sm font-medium text-gray-800 mb-1 capitalize">
                  Metode: Jalur{" "}
                  {item.jalur === "verbal" ? "A (Verbal)" : item.jalur === "nonverbal" ? "B (Non-Verbal)" : "Tidak diketahui"}
                </p>}
                {getCaseRecordType(item) === 'srq20' && (
                  <p className="mb-1 text-sm font-medium text-gray-800">
                    {item.tier} · {item.srq20Score} / 20 · {item.inputMode === 'verbal' ? 'Verbal' : 'Non-Verbal'}
                  </p>
                )}
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(item.timestamp)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
