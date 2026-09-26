import React, { useState, useEffect, Fragment } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ClipboardList, ChevronDown, ChevronUp, Search } from "lucide-react";
import { getCaseRecordType, getLegacyZone } from "../../lib/caseRecords";

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterZona, setFilterZona] = useState("SEMUA");
  const [filterPosko, setFilterPosko] = useState("SEMUA");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const casesRef = collection(db, "cases");
        const querySnapshot = await getDocs(casesRef);

        const data = [];
        querySnapshot.forEach((doc) => {
          const item = doc.data();
          const zone = getLegacyZone(item)?.toUpperCase() || null;
          const dateVal = item.createdAt?.toDate
            ? item.createdAt.toDate()
            : item.timestamp
              ? new Date(item.timestamp)
              : new Date(0);
          data.push({
            id: doc.id,
            ...item,
            recordKind: getCaseRecordType(item),
            zonaDisplay: zone,
            dateValue: dateVal,
          });
        });
        data.sort((a, b) => b.dateValue - a.dateValue);
        setCases(data);
      } catch (error) {
        console.error("Error fetching cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const poskos = [
    "SEMUA",
    ...new Set(cases.map((c) => c.poskoName).filter(Boolean)),
  ];

  const filteredCases = cases.filter((c) => {
    if (filterZona !== "SEMUA" && (c.recordKind !== 'legacy-triage' || c.zonaDisplay !== filterZona)) return false;
    if (filterPosko !== "SEMUA" && c.poskoName !== filterPosko) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const volunteer = (c.relawanName || c.volunteerName || "").toLowerCase();
      return (
        volunteer.includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.poskoName && c.poskoName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
          <ClipboardList className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Daftar Kasus Triase
          </h1>
          <p className="text-slate-500">
            Kelola dan pantau seluruh data kasus yang masuk
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari ID / Relawan..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filterZona}
            onChange={(e) => setFilterZona(e.target.value)}
          >
            <option value="SEMUA">Semua Zona</option>
            <option value="MERAH">Zona Merah</option>
            <option value="KUNING">Zona Kuning</option>
            <option value="HIJAU">Zona Hijau</option>
          </select>

          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filterPosko}
            onChange={(e) => setFilterPosko(e.target.value)}
          >
            {poskos.map((p) => (
              <option key={p} value={p}>
                {p === "SEMUA" ? "Semua Posko" : p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Nama Relawan</th>
                <th className="px-6 py-4">Posko</th>
                <th className="px-6 py-4">Jalur</th>
                <th className="px-6 py-4">Jenis / Zona</th>
                <th className="px-6 py-4">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c, idx) => (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {c.dateValue
                        ? new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(c.dateValue)
                        : "-"}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {c.relawanName || c.volunteerName || "-"}
                    </td>
                    <td className="px-6 py-4">{c.poskoName || "-"}</td>
                    <td className="px-6 py-4">
                      {c.recordKind === 'legacy-triage'
                        ? (c.jalur === "verbal" || c.type === "VERBAL" ? "Verbal" :
                          c.jalur === 'nonverbal' || c.type === 'NON_VERBAL' ? 'Non-Verbal' : '-')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          c.zonaDisplay === "MERAH"
                            ? "bg-red-100 text-red-700"
                            : c.zonaDisplay === "KUNING"
                              ? "bg-amber-100 text-amber-700"
                            : c.zonaDisplay === "HIJAU"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.zonaDisplay || (c.recordKind === 'pfa' ? 'PFA' :
                          c.recordKind === 'srq20' ? 'SRQ-20' : 'Tidak diketahui')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className="p-1 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        {expandedId === c.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-600" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {expandedId === c.id && (
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={7} className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-2">
                              Informasi Detail
                            </h4>
                            <div className="space-y-2 text-sm">
                              <p>
                                <span className="text-slate-500">
                                  ID Kasus:
                                </span>{" "}
                                {c.id}
                              </p>
                              {c.recordKind === 'legacy-triage' && <p>
                                <span className="text-slate-500">
                                  Status PFA:
                                </span>{" "}
                                {c.needsPFA
                                  ? "Direkomendasikan PFA"
                                  : "Tidak perlu PFA"}
                              </p>}
                              {c.recordKind === 'pfa' && <p>
                                <span className="text-slate-500">Versi protokol:</span>{" "}
                                {c.protocolVersion}
                              </p>}
                              <p>
                                <span className="text-slate-500">
                                  Sumber:
                                </span>{" "}
                                Firestore
                              </p>
                            </div>
                          </div>

                          <div>
                            {c.recordKind === 'pfa' ? (
                              <>
                                <h4 className="font-semibold text-slate-900 mb-2">Respons PFA</h4>
                                <div className="space-y-1 text-sm">
                                  {Object.entries(c.responses).map(([key, value]) => (
                                    <div key={key} className="flex justify-between gap-3 border-b border-slate-200 py-1">
                                      <span className="text-slate-600">{key}</span>
                                      <span className="font-medium text-slate-900 text-right">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : c.recordKind !== 'legacy-triage' ? (
                              <p className="text-sm text-slate-500">Detail catatan belum tersedia.</p>
                            ) : c.jalur === "verbal" || c.type === "VERBAL" ? (
                              <>
                                <h4 className="font-semibold text-slate-900 mb-2">
                                  Transkrip Percakapan
                                </h4>
                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm italic text-slate-600 max-h-32 overflow-y-auto mb-3">
                                  "{c.transcript || "Tidak ada transkrip"}"
                                </div>
                                {(c.detectedKeywords || c.keywords) &&
                                  (c.detectedKeywords || c.keywords).length >
                                    0 && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                        Kata Kunci Terdeteksi:
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {(c.detectedKeywords || c.keywords).map(
                                          (kw, i) => (
                                            <span
                                              key={i}
                                              className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded-md border border-red-100"
                                            >
                                              {kw}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </>
                            ) : (
                              <>
                                <h4 className="font-semibold text-slate-900 mb-2">
                                  Hasil Ceklis
                                </h4>
                                <div className="space-y-1">
                                  {c.checklistAnswers &&
                                    Object.entries(c.checklistAnswers).map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className="flex justify-between items-center text-sm border-b border-slate-200 py-1 last:border-0"
                                        >
                                          <span className="text-slate-600 capitalize">
                                            {key
                                              .replace(/([A-Z])/g, " $1")
                                              .trim()}
                                          </span>
                                          <span
                                            className={`font-medium ${value ? "text-red-600" : "text-slate-400"}`}
                                          >
                                            {value ? "Ya" : "Tidak"}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  {(!c.checklistAnswers ||
                                    Object.keys(c.checklistAnswers).length ===
                                      0) && (
                                    <p className="text-sm text-slate-500">
                                      Data ceklis tidak tersedia
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Tidak ada data kasus yang cocok dengan filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
