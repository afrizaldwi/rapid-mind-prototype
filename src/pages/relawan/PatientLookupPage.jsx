import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  UserPlus,
  History,
  CreditCard,
  User,
  Calendar,
  Users,
  Zap,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useAssessment } from "../../hooks/useAssessment";
import { localDb } from "../../lib/db";
import { getCaseRecordType, getLegacyZone } from "../../lib/caseRecords";
import { clearPfaDraft, getPfaProgressState } from "../../lib/pfa";
import { clearLongitudinalDraft } from "../../lib/longitudinalAssessment";
import { lookupPatient, registerPatient } from "../../lib/patients";
import { collection, query, where, getDocsFromServer } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ───────────────────────────────────────────────
// Demo quick-fill patient presets (easy to swap later)
// ───────────────────────────────────────────────
const DEMO_PATIENTS = {
  new: {
    nik: "3201234567890001",
    nama: "Siti Aminah",
    usia: "34",
    jenisKelamin: "P",
  },
  existing: {
    nik: "3201234567890002",
    nama: "Budi Santoso",
    usia: "45",
    jenisKelamin: "L",
  },
};

function historyBadge(record) {
  const zone = getLegacyZone(record);
  if (zone) return {
    label: `Zona ${zone}`,
    color: zone === 'merah' ? 'bg-red-100 text-red-700' :
      zone === 'kuning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
  };
  const type = getCaseRecordType(record);
  return {
    label: type === 'pfa' ? 'PFA' : type === 'srq20' ? 'SRQ-20' : 'Catatan tidak diketahui',
    color: 'bg-gray-100 text-gray-700',
  };
}

export default function PatientLookupPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { assessment, startAssessment, clearAssessment } = useAssessment();

  const [nik, setNik] = useState("");
  const [nama, setNama] = useState("");
  const [usia, setUsia] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState(null); // null | { found: boolean, patient?, history?, cloudVerified? }
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  // ──────────── NIK validation ────────────
  const isNikValid = /^\d{16}$/.test(nik);
  const isFormComplete = isNikValid && nama.trim() && usia.trim() && jenisKelamin;
  const pfaProgress = lookupResult?.found ? getPfaProgressState({
    history: lookupResult.history,
    cloudVerified: lookupResult.cloudVerified,
    assessment,
    patientNik: lookupResult.patient.nik,
  }) : null;

  const needsAbandonment = (targetNik, action) => {
    if (assessment && assessment.patient?.nik !== targetNik) {
      setPendingAction(action);
      return true;
    }
    return false;
  };

  const loadHistory = async (patientNik) => {
    const localCases = await localDb.cases.where("patientNik").equals(patientNik).toArray();
    if (!navigator.onLine) return { history: localCases, cloudVerified: false };
    try {
      const snapshot = await getDocsFromServer(query(collection(db, "cases"), where("patientNik", "==", patientNik)));
      const localCloudIds = new Set(localCases.map((item) => item.firestoreId).filter(Boolean));
      const cloudCases = snapshot.docs.filter((item) => !localCloudIds.has(item.id)).map((item) => ({ id: item.id, ...item.data() }));
      const history = [...localCases, ...cloudCases].sort((a, b) => {
        const date = (item) => new Date(item.timestamp?.toDate?.() || item.timestamp || 0).getTime() || 0;
        return date(b) - date(a);
      });
      return { history, cloudVerified: true };
    } catch (error) {
      console.error("Gagal memuat riwayat cloud:", error);
      return { history: localCases, cloudVerified: false };
    }
  };

  // ──────────── Auto-Lookup Logic ────────────
  const handleLookup = async () => {
    if (!isNikValid) {
      setError("NIK harus 16 digit angka.");
      return;
    }
    setError("");
    setIsSearching(true);
    setLookupResult(null);

    try {
      const result = await lookupPatient(nik, navigator.onLine);
      if (result) {
        const { history, cloudVerified } = await loadHistory(nik);
        setLookupResult({
          found: true,
          patient: result.patient,
          history,
          cloudVerified,
          source: result.source,
        });
        setNama(result.patient.nama || nama);
        setUsia(result.patient.usia?.toString() || usia);
        setJenisKelamin(result.patient.jenisKelamin || jenisKelamin);
        return;
      }
      setLookupResult({ found: false });
    } catch (err) {
      console.error("Lookup error:", err);
      setError(err.name === "PatientConflictError" ? err.message : "Gagal melakukan pencarian cloud. Coba lagi saat layanan tersedia.");
    } finally {
      setIsSearching(false);
    }
  };

  // ──────────── Register new patient & navigate ────────────
  const handleRegisterAndProceed = async (allowReplace = false) => {
    if (!isFormComplete) return;
    if (!allowReplace && needsAbandonment(nik, 'register')) return;

    const patientData = {
      nik,
      nama: nama.trim(),
      usia: parseInt(usia, 10),
      jenisKelamin,
      poskoName: userProfile?.poskoName || "Posko Utama - Kota",
      registeredAt: new Date().toISOString(),
      lastPhase: "akut",
      pfaCompleted: false,
      registeredBy: user?.uid,
    };

    try {
      const result = await registerPatient(patientData, navigator.onLine);
      if (result.existing) {
        const { history, cloudVerified } = await loadHistory(nik);
        setLookupResult({ found: true, patient: result.patient, history, cloudVerified, source: "local" });
        setError("NIK sudah terdaftar. Gunakan data pasien yang ditemukan.");
        return;
      }
      startAssessment({ patient: result.patient, phase: "akut", isNewPatient: true });
      navigate("/relawan/pfa");
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.name === "PatientConflictError" ? err.message : "Gagal menyimpan data pasien.");
    }
  };

  // ──────────── Continue the phase supported by completed case history ────────────
  const handleProceedExisting = (allowReplace = false) => {
    if (!lookupResult?.patient) return;

    const patient = lookupResult.patient;
    const progress = getPfaProgressState({
      history: lookupResult.history,
      cloudVerified: lookupResult.cloudVerified,
      assessment,
      patientNik: patient.nik,
    });
    if (progress === 'unknown') return;
    if (!allowReplace && needsAbandonment(patient.nik, 'existing')) return;

    try {
      if (progress === 'completed') {
        startAssessment({
          patient,
          phase: "lanjutan",
          previousHistory: lookupResult.history || [],
        });
        // Falls back to triage until the dedicated SRQ-20 flow is built.
        navigate("/relawan/triage");
      } else if (progress === 'in-progress') {
        navigate("/relawan/pfa");
      } else {
        if (assessment?.patient?.nik !== patient.nik || assessment?.phase !== 'akut') {
          startAssessment({
            patient,
            phase: "akut",
            previousHistory: lookupResult.history || [],
            isNewPatient: false,
          });
        }
        navigate("/relawan/pfa");
      }
    } catch (err) {
      console.error("Assessment error:", err);
      setError("Data pasien tidak valid. Cari ulang pasien.");
    }
  };

  const handleConfirmAbandonment = () => {
    const action = pendingAction;
    setPendingAction(null);
    clearAssessment();
    clearPfaDraft();
    clearLongitudinalDraft();
    if (action === 'register') void handleRegisterAndProceed(true);
    if (action === 'existing') handleProceedExisting(true);
  };

  // ──────────── Demo quick-fill ────────────
  const fillDemo = (type) => {
    const preset = DEMO_PATIENTS[type];
    setNik(preset.nik);
    setNama(preset.nama);
    setUsia(preset.usia);
    setJenisKelamin(preset.jenisKelamin);
    setLookupResult(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate("/relawan")}
          className="p-1 -ml-1 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">
          Identitas Penyintas
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Demo Buttons */}
        <div className="bg-slate-100 rounded-xl p-3">
          <p className="text-xs text-slate-500 font-medium mb-2">
            ⚡ Simulasi Cepat (Demo)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fillDemo("new")}
              className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Pasien Baru
            </button>
            <button
              onClick={() => fillDemo("existing")}
              className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center gap-1"
            >
              <History className="w-3.5 h-3.5" />
              Pasien Lama
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* NIK Input + Lookup */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            <CreditCard className="w-4 h-4 inline mr-1.5 -mt-0.5 text-gray-400" />
            Nomor Induk Kependudukan (NIK)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={16}
              value={nik}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                setNik(val);
                setLookupResult(null);
              }}
              placeholder="Masukkan 16 digit NIK"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono tracking-wider"
            />
            <button
              onClick={handleLookup}
              disabled={!isNikValid || isSearching}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg disabled:bg-gray-300 transition-colors flex items-center gap-1.5 text-sm font-bold"
            >
              {isSearching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Cari
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {nik.length}/16 digit
            {nik.length > 0 && nik.length < 16 && (
              <span className="text-amber-500"> — belum lengkap</span>
            )}
            {isNikValid && (
              <span className="text-green-600"> — ✓ format valid</span>
            )}
          </p>
        </div>

        {/* Lookup Result: Patient Found */}
        {lookupResult?.found && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 p-2 rounded-full">
                <History className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 text-sm">
                  Penyintas Ditemukan
                </h3>
                <p className="text-xs text-amber-600 mt-0.5">
                  {pfaProgress === 'completed' ? 'PFA telah selesai. Riwayat asesmen tersedia.' :
                    pfaProgress === 'in-progress' ? 'PFA belum selesai. Asesmen aktif dapat dilanjutkan.' :
                    pfaProgress === 'incomplete' ? 'PFA belum selesai. Lanjutkan asesmen fase akut.' :
                    'Status PFA belum dapat diverifikasi.'}
                </p>
              </div>
            </div>

            {/* Patient Info Card */}
            <div className="bg-white rounded-xl p-3 border border-amber-100">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Nama</span>
                  <p className="font-medium text-gray-800">
                    {lookupResult.patient.nama}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Usia</span>
                  <p className="font-medium text-gray-800">
                    {lookupResult.patient.usia} tahun
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Jenis Kelamin</span>
                  <p className="font-medium text-gray-800">
                    {lookupResult.patient.jenisKelamin === "L"
                      ? "Laki-laki"
                      : "Perempuan"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Posko</span>
                  <p className="font-medium text-gray-800">
                    {lookupResult.patient.poskoName}
                  </p>
                </div>
              </div>
            </div>

            {/* History Summary */}
            {lookupResult.history && lookupResult.history.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-amber-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Riwayat Asesmen ({lookupResult.history.length} catatan)
                </p>
                <div className="space-y-1.5">
                  {lookupResult.history.slice(0, 3).map((h, i) => (
                    <div
                      key={h.id || h.localId || i}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-600">
                        {h.timestamp
                          ? new Intl.DateTimeFormat("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(
                              new Date(
                                h.timestamp?.toDate?.() || h.timestamp,
                              ),
                            )
                          : "—"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${historyBadge(h).color}`}
                      >
                        {historyBadge(h).label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pfaProgress === 'unknown' ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-800">Riwayat cloud belum dapat diperiksa. Sambungkan internet lalu cari ulang agar status asesmen tidak salah.</p>
                <button type="button" onClick={handleLookup} disabled={isSearching}
                  className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">
                  {isSearching ? 'Mencari...' : 'Coba Lagi'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleProceedExisting()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {pfaProgress === 'completed' ? 'Lanjutkan ke Wawancara SRQ-20' :
                  pfaProgress === 'in-progress' ? 'Lanjutkan PFA' : 'Mulai / Lanjutkan PFA'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Lookup Result: Patient Not Found → Show Registration Form */}
        {lookupResult && !lookupResult.found && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-blue-800 text-sm">
                  Penyintas Baru
                </h3>
                <p className="text-xs text-blue-600 mt-0.5">
                  NIK belum terdaftar. Lengkapi data penyintas di bawah untuk
                  memulai PFA (Fase Akut Hari 1–3).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Registration Form — shown after lookup returns not found, or always visible for data entry */}
        {lookupResult !== null && !lookupResult.found && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
              Data Penyintas
            </h3>

            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                <User className="w-4 h-4 inline mr-1 -mt-0.5 text-gray-400" />
                Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama lengkap penyintas"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Usia & Jenis Kelamin */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  <Calendar className="w-4 h-4 inline mr-1 -mt-0.5 text-gray-400" />
                  Usia
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="120"
                  value={usia}
                  onChange={(e) => setUsia(e.target.value)}
                  placeholder="Tahun"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  <Users className="w-4 h-4 inline mr-1 -mt-0.5 text-gray-400" />
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenisKelamin("L")}
                    className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${
                      jenisKelamin === "L"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenisKelamin("P")}
                    className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${
                      jenisKelamin === "P"
                        ? "bg-pink-50 border-pink-500 text-pink-700 ring-2 ring-pink-500/20"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    P
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action — Register & Start PFA */}
      {lookupResult !== null && !lookupResult.found && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => handleRegisterAndProceed()}
              disabled={!isFormComplete}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-300 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Daftarkan & Mulai PFA
            </button>
            {!isFormComplete && (
              <p className="text-xs text-gray-400 text-center mt-2">
                Lengkapi semua data di atas untuk melanjutkan
              </p>
            )}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="unfinished-assessment-title">
            <h2 id="unfinished-assessment-title" className="text-lg font-bold text-gray-900">Asesmen Belum Selesai</h2>
            <p className="mt-2 text-sm text-gray-700">
              Asesmen untuk {assessment?.patient?.nama || 'penyintas lain'} belum selesai. Memulai asesmen pasien lain akan membatalkan draf yang sedang aktif.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" onClick={() => navigate(assessment?.phase === 'akut' ? '/relawan/pfa' : '/relawan/triage')}
                className="rounded-xl border border-blue-600 px-4 py-3 text-sm font-bold text-blue-700">
                {assessment?.phase === 'akut' ? 'Kembali ke PFA' : 'Kembali ke Asesmen'}
              </button>
              <button type="button" onClick={handleConfirmAbandonment}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white">
                Batalkan Asesmen & Lanjutkan
              </button>
              <button type="button" onClick={() => setPendingAction(null)}
                className="px-4 py-2 text-sm text-gray-600">Tetap di Pencarian</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
