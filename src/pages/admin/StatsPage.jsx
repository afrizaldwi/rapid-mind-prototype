import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { BarChart3, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getLegacyZone } from "../../lib/caseRecords";

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    poskoData: [],
    pieData: [],
    trendData: [],
    totalCases: 0,
  });

  const COLORS = {
    MERAH: "#dc2626",
    KUNING: "#f59e0b",
    HIJAU: "#16a34a",
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const casesRef = collection(db, "cases");
        const querySnapshot = await getDocs(casesRef);

        let totalMerah = 0,
          totalKuning = 0,
          totalHijau = 0;
        const poskoMap = {};
        const dateMap = {};

        // Setup last 7 days for trend
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          });
          dateMap[dateStr] = { date: dateStr, MERAH: 0, KUNING: 0, HIJAU: 0 };
        }

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const zone = getLegacyZone(data)?.toUpperCase();
          if (!zone) return;
          const posko = data.poskoName || "Posko Utama";

          // Totals
          if (zone === "MERAH") totalMerah++;
          else if (zone === "KUNING") totalKuning++;
          else if (zone === "HIJAU") totalHijau++;

          // Posko Map
          if (!poskoMap[posko])
            poskoMap[posko] = { posko, MERAH: 0, KUNING: 0, HIJAU: 0 };
          poskoMap[posko][zone]++;

          // Date Map
          const docDate = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.timestamp
              ? new Date(data.timestamp)
              : null;
          if (docDate) {
            const dateStr = docDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });
            if (dateMap[dateStr]) {
              dateMap[dateStr][zone]++;
            }
          }
        });

        setStats({
          poskoData: Object.values(poskoMap),
          pieData: [
            { name: "Merah", value: totalMerah, color: COLORS.MERAH },
            { name: "Kuning", value: totalKuning, color: COLORS.KUNING },
            { name: "Hijau", value: totalHijau, color: COLORS.HIJAU },
          ].filter((item) => item.value > 0),
          trendData: Object.values(dateMap),
          totalCases: querySnapshot.size,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
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
          <BarChart3 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Statistik Triase
          </h1>
          <p className="text-slate-500">
            Analisis data dan tren kondisi psikologis
          </p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Catatan (semua jenis)</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold text-slate-900">
              {stats.totalCases}
            </h3>
            <span className="text-xs text-slate-400 mb-1">keseluruhan</span>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
          <p className="text-sm text-red-600/80 mb-1">Zona Merah</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold text-red-700">
              {stats.pieData.find((d) => d.name === "Merah")?.value || 0}
            </h3>
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
          <p className="text-sm text-amber-600/80 mb-1">Zona Kuning</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold text-amber-700">
              {stats.pieData.find((d) => d.name === "Kuning")?.value || 0}
            </h3>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
          <p className="text-sm text-green-600/80 mb-1">Zona Hijau</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-bold text-green-700">
              {stats.pieData.find((d) => d.name === "Hijau")?.value || 0}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Tren Harian (7 Hari Terakhir)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.trendData}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  name="Zona Merah"
                  dataKey="MERAH"
                  stroke={COLORS.MERAH}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  name="Zona Kuning"
                  dataKey="KUNING"
                  stroke={COLORS.KUNING}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  name="Zona Hijau"
                  dataKey="HIJAU"
                  stroke={COLORS.HIJAU}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Distribusi per Posko
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.poskoData}
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="posko"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend />
                <Bar
                  name="Merah"
                  dataKey="MERAH"
                  stackId="a"
                  fill={COLORS.MERAH}
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  name="Kuning"
                  dataKey="KUNING"
                  stackId="a"
                  fill={COLORS.KUNING}
                />
                <Bar
                  name="Hijau"
                  dataKey="HIJAU"
                  stackId="a"
                  fill={COLORS.HIJAU}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Proporsi Zona Keseluruhan
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
