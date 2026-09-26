import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Plus,
  Activity,
  Clock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { localDb } from "../../lib/db";
import { getCaseRecordType, getLegacyZone } from "../../lib/caseRecords";

export default function HomePage() {
  const { user, userProfile } = useAuth();
  const [stats, setStats] = useState({ merah: 0, kuning: 0, hijau: 0 });
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.uid) return;
      try {
        const allCases = await localDb.cases
          .where("relawanId")
          .equals(user.uid)
          .reverse()
          .sortBy("timestamp");

        // Calculate today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaysCases = allCases.filter(
          (c) => new Date(c.timestamp) >= today,
        );
        const newStats = {
          merah: todaysCases.filter((c) => getLegacyZone(c) === "merah").length,
          kuning: todaysCases.filter((c) => getLegacyZone(c) === "kuning").length,
          hijau: todaysCases.filter((c) => getLegacyZone(c) === "hijau").length,
        };

        setStats(newStats);
        setRecentCases(allCases.slice(0, 5));
      } catch (error) {
        console.error("Error loading relawan dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const getZonaColor = (zona) => {
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

  const getZonaLabel = (zona) => {
    switch (zona) {
      case "merah":
        return "Merah";
      case "kuning":
        return "Kuning";
      case "hijau":
        return "Hijau";
      default:
        return "Tidak diketahui";
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(timestamp));
  };

  return (
    <div className="p-4 space-y-6">
      {/* Greeting & Posko */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Halo, {userProfile?.name || "Relawan"}! 👋
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
          <MapPin className="w-4 h-4" />
          <span>{userProfile?.poskoName || "Posko Pengungsian"}</span>
        </div>
      </div>

      {/* Quick Action */}
      <Link
        to="/relawan/patient-lookup"
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-6 shadow-md shadow-blue-200 transition-transform active:scale-[0.98]"
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="bg-white/20 p-3 rounded-full">
            <Plus className="w-8 h-8 text-white" />
          </div>
          <span className="text-lg font-bold">Mulai Triase Baru</span>
          <span className="text-blue-100 text-sm text-center">
            Deteksi dini risiko psikologis korban
          </span>
        </div>
      </Link>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
          Triase Legacy Hari Ini
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-500 mb-1" />
            <span className="text-2xl font-bold text-gray-800">
              {stats.merah}
            </span>
            <span className="text-xs text-gray-500 font-medium">Merah</span>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <Activity className="w-6 h-6 text-amber-500 mb-1" />
            <span className="text-2xl font-bold text-gray-800">
              {stats.kuning}
            </span>
            <span className="text-xs text-gray-500 font-medium">Kuning</span>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-green-500 mb-1" />
            <span className="text-2xl font-bold text-gray-800">
              {stats.hijau}
            </span>
            <span className="text-xs text-gray-500 font-medium">Hijau</span>
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            Kasus Terakhir
          </h2>
          <Link
            to="/relawan/history"
            className="text-sm text-blue-600 font-medium hover:underline"
          >
            Lihat Semua
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              Memuat data...
            </div>
          ) : recentCases.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                Belum ada triase hari ini.
              </p>
            </div>
          ) : (
            recentCases.map((caseItem) => (
              <div
                key={caseItem.localId || caseItem.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
              >
                <div>
                  <div
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${getZonaColor(getLegacyZone(caseItem))} mb-1`}
                  >
                    {getCaseRecordType(caseItem) === 'legacy-triage'
                      ? `Zona ${getZonaLabel(getLegacyZone(caseItem))}`
                      : getCaseRecordType(caseItem) === 'pfa' ? 'PFA'
                        : getCaseRecordType(caseItem) === 'srq20' ? 'SRQ-20' : 'Catatan tidak diketahui'}
                  </div>
                  {getCaseRecordType(caseItem) === 'legacy-triage' && <div className="text-sm text-gray-600 flex items-center gap-1.5">
                    <span className="capitalize">
                      Jalur{" "}
                      {caseItem.jalur === "verbal"
                        ? "A (Verbal)"
                        : caseItem.jalur === "nonverbal" ? "B (Non-Verbal)" : "Tidak diketahui"}
                    </span>
                  </div>}
                </div>
                <div className="text-xs text-gray-400 font-medium">
                  {formatDate(caseItem.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
