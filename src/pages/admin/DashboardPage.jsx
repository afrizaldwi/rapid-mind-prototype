import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Activity,
  Database,
} from "lucide-react";
import { seedDemoData } from "../../lib/seed";

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [stats, setStats] = useState({
    merah: 0,
    kuning: 0,
    hijau: 0,
    total: 0,
  });
  const [recentCases, setRecentCases] = useState([]);

  const COLORS = {
    merah: "#dc2626",
    kuning: "#f59e0b",
    hijau: "#16a34a",
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const casesRef = collection(db, "cases");
        const querySnapshot = await getDocs(casesRef);

        let merah = 0,
          kuning = 0,
          hijau = 0;
        const allCases = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const zone = (data.zona || data.triageResult || "").toUpperCase();
          if (zone === "MERAH") merah++;
          else if (zone === "KUNING") kuning++;
          else if (zone === "HIJAU") hijau++;

          allCases.push({
            id: doc.id,
            ...data,
            zonaDisplay: zone || "HIJAU",
            dateValue: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : data.timestamp
                ? new Date(data.timestamp)
                : new Date(0),
          });
        });

        allCases.sort((a, b) => b.dateValue - a.dateValue);

        setStats({ merah, kuning, hijau, total: allCases.length });
        setRecentCases(allCases.slice(0, 10));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      await seedDemoData();
      alert("Dataset demo dipastikan tersedia di Firebase tanpa menambah salinan baru.");
      window.location.reload();
    } catch (error) {
      console.error("Error seeding data:", error);
      alert("Gagal menambahkan data simulasi: " + error.message);
    } finally {
      setSeeding(false);
    }
  };

  const pieData = [
    { name: "Merah", value: stats.merah, color: COLORS.merah },
    { name: "Kuning", value: stats.kuning, color: COLORS.kuning },
    { name: "Hijau", value: stats.hijau, color: COLORS.hijau },
  ].filter((item) => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
          <p className="text-slate-500">
            Ringkasan data triase psikologis posko bencana
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium border border-blue-200 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {seeding ? "Membuat Data..." : "Isi Data Simulasi Demo"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Kasus</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Zona Merah</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.merah}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Zona Kuning</p>
            <h3 className="text-2xl font-bold text-slate-900">
              {stats.kuning}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Zona Hijau</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.hijau}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Proporsi Zona
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span>
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Cases */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Kasus Terbaru
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Waktu</th>
                  <th className="px-4 py-3">Relawan</th>
                  <th className="px-4 py-3">Posko</th>
                  <th className="px-4 py-3">Jalur</th>
                  <th className="px-4 py-3 rounded-r-lg">Zona</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      {c.dateValue
                        ? new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(c.dateValue)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {c.relawanName || c.volunteerName || "-"}
                    </td>
                    <td className="px-4 py-3">{c.poskoName || "-"}</td>
                    <td className="px-4 py-3">
                      {c.jalur === "verbal" || c.type === "VERBAL"
                        ? "Verbal"
                        : "Non-Verbal"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          c.zonaDisplay === "MERAH"
                            ? "bg-red-100 text-red-700"
                            : c.zonaDisplay === "KUNING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {c.zonaDisplay}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentCases.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Belum ada data kasus
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
