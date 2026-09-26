# RAPID-MIND — Implementation Plan (Demo Prototype)

> **Dokumen:** Rencana Eksekusi & Implementasi Prototipe RAPID-MIND  
> **Tanggal Pembaruan:** 26 September 2026  
> **Status:** **In Progress — Track A.1 sudah terimplementasi pada level UI/lookup; integration hardening menjadi pekerjaan berikutnya**  
> **Target:** Prototipe demo end-to-end tanpa *dead end*, mencakup alur Relawan, Faskes/PSC 119, dan Admin BPBD/Dinkes.

---

## 1. Snapshot Progress Saat Ini

| Area | Status | Catatan |
|---|:---:|---|
| Fondasi React/Firebase/PWA | ✅ | Sudah tersedia |
| Auth + RBAC `relawan/admin` | ✅ | Role `nakes` belum ada |
| Legacy verbal/non-verbal triage | ✅ | Akan menjadi legacy setelah SRQ-20/4-tier aktif |
| Offline `cases` + reconnect sync | ✅ | Berfungsi hanya untuk entitas `cases` |
| Dashboard Admin dasar | ✅ | Snapshot `getDocs`, belum real-time |
| **Screen 2 Patient Lookup** | ✅/⚠️ | UI, NIK lookup, register, history sudah ada; integrasi downstream belum utuh |
| Dexie v2 `patients` + `emergencies` | ✅ | Tabel tersedia, tetapi patient sync/uniqueness belum selesai |
| PFA LOOK/LISTEN/LINK | ❌ | Belum ada page |
| Red Flag T0 | ❌ | Belum ada component/flow |
| SRQ-20 | ❌ | Belum ada page/question module |
| Risk Factor | ❌ | Belum ada page |
| Result 4-tier | ❌ | Masih merah/kuning/hijau |
| Role 2 Faskes | ❌ | Belum ada |
| Admin real-time/longitudinal | ❌ | Belum ada |

### Milestone yang sudah selesai dari plan sebelumnya

- `PatientLookupPage.jsx` dibuat.
- Route `/relawan/patient-lookup` dibuat.
- CTA utama Home diarahkan ke patient lookup.
- Dexie dinaikkan ke v2.
- Tabel `patients` dan `emergencies` disiapkan.
- Index `patientNik` dan `tier` ditambahkan ke `cases`.
- `pendingSync` lama dihapus dari schema v2.

### Temuan yang mengubah urutan plan

Sebelum membangun PFA/SRQ-20, proyek perlu satu fase **Integration Hardening** karena patient context saat ini terputus setelah `TriagePage`, bottom nav masih dapat melewati Screen 2, dan pasien offline belum memiliki deferred sync.

---

## 2. Prinsip & Keputusan Desain yang Berlaku

1. **No dead ends.** Semua tombol demo utama harus menghasilkan transisi state yang jelas dan dapat dipresentasikan end-to-end.
2. **Patient identity adalah first-class context.** Setiap PFA, assessment, emergency, dan result harus membawa `patientId/patientNik` secara konsisten sampai persistence layer.
3. **Jangan mengandalkan route state sebagai satu-satunya sumber identitas.** Route state boleh digunakan untuk UX, tetapi active assessment context harus bertahan jika user pindah sub-route/refresh ringan.
4. **Offline-first berlaku pada entitas penting, bukan hanya `cases`.** Minimal `patients`, assessment/cases, dan emergency event harus memiliki mekanisme retry/sync yang eksplisit.
5. **SRQ-20 prototype modular.** 20 butir ditempatkan di `src/lib/srq20Questions.js` agar konten dapat diganti tanpa mengubah komponen. Konten/cut-off dalam demo mengikuti spesifikasi proyek dan harus diperlakukan sebagai **prototype requirement**, bukan klaim validasi klinis dari source code.
6. **Human-in-the-loop.** STT/NLP hanya membantu prefill/auto-check; relawan tetap dapat mengoreksi semua jawaban sebelum submit.
7. **Role 2 dibuat simplified tetapi stateful.** Fokus pada queue T0-Suspect, simulasi Tele-Emergency, confirm/downgrade, dan tracking status.
8. **Real-time menggunakan Firestore `onSnapshot`.** Tidak perlu Cloud Functions/FCM untuk demo awal; Browser Notification + audio chime cukup untuk simulasi command center.
9. **Jangan polish sebelum core loop selesai.** Heatmap kontinu, export, dan animasi berada setelah flow Relawan → Faskes → Admin terhubung.

---

## 3. Arsitektur Data — Current vs Target

### A. Current Dexie v2

```text
RapidMindDB v2
├── cases
│   └── indexes: localId, firestoreId, synced, timestamp, zona,
│                poskoName, relawanId, patientNik, tier
├── patients
│   └── indexes: id, nik, nama, poskoName, registeredAt
└── emergencies
    └── indexes: id, patientNik, relawanId, status, timestamp, synced
```

**Current limitation:** hanya `cases.synced` yang diproses oleh `syncPendingCases()`.

### B. Target logical model

```text
users
└── { uid, email, name, role, poskoName, poskoLat, poskoLng, phone }

patients
└── { patientId, nik, nama, usia, jenisKelamin, poskoName,
      registeredAt, lastPhase, pfaCompleted, synced }

pfaRecords / cases
└── { patientId, patientNik, phase:"akut", look, listen, link,
      relawanId, poskoName, timestamp, synced }

assessments / cases
└── { patientId, patientNik, phase:"lanjutan", srq20Score,
      answers, riskFactors, riskFactorScore, tier, timestamp, synced }

emergencies
└── { patientId, patientNik, relawanId, poskoName, lat, lng,
      gates, status, downgradedTo, ambulanceStatus,
      createdAt, confirmedAt, synced }
```

### C. Sync strategy target

Untuk demo, gunakan satu pola yang konsisten:

```text
write local first
  ↓
mark unsynced
  ↓
if online -> push immediately
  ↓ failure/offline
keep unsynced
  ↓
connection restored
  ↓
retry sync
```

Jika implementasi generic outbox dianggap terlalu besar untuk scope demo, minimal sediakan fungsi sinkronisasi terpisah untuk `patients`, `cases`, dan `emergencies` dengan contract yang sama.

---

## 4. Urutan Implementasi Baru

Urutan di bawah menggantikan pendekatan “langsung tiga track paralel” sampai dependency P0 selesai. Setelah Phase 0, Track Relawan/Faskes/Admin dapat kembali dikerjakan paralel.

---

## Phase 0 — Integration Hardening Setelah Track A.1 (**0A implemented; remaining work pending**)

### 0.1 Tutup semua bypass Screen 2

**Status:** Diimplementasikan pada Phase 0A.

**Modify:** `src/components/layout/RelawanLayout.jsx`

- Ubah tombol bottom navigation **Triase Baru** dari `/relawan/triage` menjadi `/relawan/patient-lookup`.
- Active-state nav harus menganggap patient lookup dan seluruh assessment flow sebagai bagian dari “Triase Baru”.
- Jangan hapus route legacy `/relawan/triage` dulu sampai PFA/SRQ-20 menggantikannya.

**Acceptance criteria:** tidak ada entry point normal dari UI yang dapat memulai assessment tanpa identitas pasien.

### 0.2 Buat assessment patient context yang tidak hilang antar route

**Status:** Diimplementasikan pada Phase 0A dengan NIK sebagai penghubung pasien; tidak memakai `patientId` lintas penyimpanan.

**Recommended new component/context:** `src/contexts/AssessmentContext.jsx` atau mekanisme equivalent yang persisten ringan.

State minimum:

```js
{
  patient: {
    patientId,
    nik,
    nama,
    usia,
    jenisKelamin,
    poskoName
  },
  phase: "akut" | "lanjutan",
  previousHistory: [],
  startedAt
}
```

Requirements:
- `PatientLookupPage` menginisialisasi active assessment.
- Triage/PFA/SRQ/Risk/Result membaca context yang sama.
- Result persistence selalu menulis `patientNik` dan, jika digunakan, `patientId`.
- Jika context kosong dan user membuka sub-route langsung, redirect ke `/relawan/patient-lookup`.
- Context sebaiknya memiliki fallback persistence ringan (mis. `sessionStorage`) agar tidak hilang saat refresh selama sesi demo.

**Acceptance criteria:** case yang disimpan setelah memilih pasien dapat ditemukan kembali melalui lookup NIK yang sama.

### 0.3 Perbaiki patient persistence & offline sync

**Modify:** `src/lib/db.js`, `src/lib/sync.js`, `src/pages/relawan/PatientLookupPage.jsx`

Target:
- Cegah duplicate NIK di local DB.
- Tambahkan status sync pasien atau generic outbox.
- Pasien yang dibuat offline otomatis dikirim ketika koneksi kembali.
- Ganti komentar “will sync later” menjadi benar secara implementasi, bukan hanya asumsi.
- Cloud create harus melakukan duplicate guard berdasarkan NIK sebelum membuat record baru.

**Catatan schema:** jika perubahan index Dexie diperlukan (`&nik`, `synced`, atau outbox baru), naikkan schema ke **v3** daripada mengubah definisi v2 yang sudah dipakai.

### 0.4 Seed data Screen 2 yang deterministik

**Modify:** `src/lib/seed.js`

Tambahkan minimal:
- 1 pasien lama sesuai preset demo (`3201234567890002`, Budi Santoso).
- Riwayat case yang benar-benar memakai `patientNik` pasien tersebut.
- Opsional: record PFA dummy agar UI dapat menampilkan “PFA sebelumnya”.
- Pastikan preset pasien baru (`3201234567890001`) tidak ikut diseed sehingga tetap menghasilkan branch “new patient”.

**Acceptance criteria:** pada database demo bersih, dua tombol preset menghasilkan dua branch yang berbeda secara deterministik.

### 0.5 Regression test Phase 0

Skenario wajib:
1. Pasien baru → register → lanjut → case akhir menyimpan NIK yang sama.
2. Pasien lama → lookup → history tampil → lanjut → case akhir menyimpan NIK yang sama.
3. Bottom nav “Triase Baru” selalu masuk Screen 2.
4. Register pasien saat offline → kembali online → patient cloud record akhirnya muncul.
5. Refresh pada tengah assessment tidak membuat assessment berubah menjadi anonim.

**Gate:** jangan mulai Phase 1 sebelum acceptance criteria Phase 0 terpenuhi.

---

## Phase 1 — Acute Flow: PFA + Red Flag T0

### 1.1 PFA Wizard (`PfaPage.jsx` — Screen 3)

**New:** `src/pages/relawan/PfaPage.jsx`

Tiga tahap:
- **LOOK:** keamanan fisik, kondisi lingkungan, tanda bahaya akut.
- **LISTEN:** guided listening/dukungan awal.
- **LINK:** kebutuhan dasar, keluarga, shelter, obat, akses layanan.

Requirements:
- Membaca active patient context.
- Stepper UI mobile-first.
- State tidak hilang antar langkah.
- Save record lokal terlebih dahulu.
- Update `patients.pfaCompleted = true` dan `lastPhase` sesuai desain final.
- Selesai PFA tidak boleh memaksa pasien akut langsung menjalani SRQ-20 bila workflow demo memisahkan fase hari 1–3 vs hari 4–30.

### 1.2 Persistent Red Flag FAB (`RedFlagFAB.jsx` — Screen 4 trigger)

**New:** `src/components/RedFlagFAB.jsx`

Requirements:
- Dipasang di `RelawanLayout.jsx` pada screen relevan.
- Tidak tampil di login/admin/faskes.
- 3 Verification Gate.
- Minimal satu gate sebelum submit.
- Membaca patient context jika tersedia.
- Membuat event `T0-Suspect` local-first.
- Menyimpan posko/location yang diketahui, bukan random GPS palsu.
- T0 tidak bergantung pada skor SRQ-20.

### 1.3 Emergency sync contract

**Modify:** `src/lib/sync.js`

- `emergencies` harus mengikuti pola local-first + retry.
- Ketika online, push ke Firestore `emergencies`.
- Status update dari Faskes harus dapat direfleksikan pada UI yang relevan.

**Gate Phase 1:** demo pasien baru dapat menjalankan PFA, dan Red Flag dari flow relawan menghasilkan T0-Suspect persistence tanpa dead end.

---

## Phase 2 — Longitudinal Flow: SRQ-20 + Risk + Result 4-Tier

### 2.1 Structured questions module

**New:** `src/lib/srq20Questions.js`

- 20 item modular.
- `id`, `question`, optional `helperText`, optional keyword mapping untuk prototype STT assist.
- Jangan hard-code copy pertanyaan di component.

### 2.2 `Srq20Page.jsx` — Screen 5

Requirements:
- Membaca active patient context.
- 20 jawaban terstruktur.
- Verbal STT sebagai bantuan input.
- Non-verbal/manual interaction sesuai scope prototype.
- Auto-check hanyalah suggestion.
- Relawan dapat override setiap jawaban.
- Tooltip/panduan per item.
- Progress indicator dan score preview.

### 2.3 `RiskFactorPage.jsx` — Screen 6

- 6–8 indikator fungsi/risiko sesuai spesifikasi proyek.
- Menyimpan data terstruktur, bukan hanya total score.
- Output diteruskan ke final classification.

### 2.4 Unified scoring engine

**Modify:** `src/lib/scoring.js`

Tambahkan API baru tanpa langsung merusak fungsi legacy:

```js
analyzeSrq20(answers)
calculateFinalTier({ srqScore, riskFactors, isRedFlag })
```

Target output:
- T0 jika emergency override aktif.
- T1/T2/T3 mengikuti rule prototype pada `workflow.md`.

Legacy `analyzeTranscript()` / `analyzeChecklist()` dapat dipertahankan sementara sampai seluruh route baru stabil, kemudian dideprecate.

### 2.5 Result 4-tier — Screen 7

**Modify:** `src/pages/relawan/ResultPage.jsx` atau buat route baru lalu migrasikan.

Persist minimal:

```js
{
  patientId,
  patientNik,
  phase,
  srq20Score,
  answers,
  riskFactors,
  riskFactorScore,
  tier,
  relawanId,
  poskoName,
  timestamp
}
```

**Gate Phase 2:** pasien lama dapat menjalani `lookup → SRQ-20 → risk factor → T1/T2/T3 → save → history lookup` dengan NIK tetap konsisten.

---

## Phase 3 — Role 2 Faskes / PSC 119

### 3.1 Auth/RBAC role `nakes`

**Modify:**
- `src/contexts/AuthContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/RegisterPage.jsx`
- `src/App.jsx`

Requirements:
- Support `relawan | nakes | admin`.
- Login redirect langsung sesuai role.
- `ProtectedRoute` mendukung single atau multiple allowed roles.
- Untuk demo, batasi/labeli registrasi role sensitif; jangan mengandalkan registrasi admin/nakes terbuka sebagai desain produksi.

### 3.2 Faskes shell

**New:** `src/components/layout/FaskesLayout.jsx`

- Connection indicator.
- Counter T0-Suspect aktif.
- Navigation minimal untuk emergency queue.

### 3.3 Real-time emergency queue

**New:** `src/pages/faskes/EmergencyQueuePage.jsx`

- Firestore `onSnapshot(collection(db, "emergencies"))`.
- T0-Suspect card.
- Patient/posko/gates/time.
- Sort pending terbaru/urgency state.

### 3.4 Tele-Emergency simulation + validation

- Modal simulasi call.
- Clinical note.
- **Confirm T0-Confirmed**.
- **Downgrade T1/T2**.
- Persist status update ke Firestore.

### 3.5 Transport status

Minimal stateful steps:

```text
Menunggu Dispatch
→ Menuju Lokasi
→ Tiba di Posko
→ Dalam Perjalanan ke RS
→ Selesai
```

### 3.6 Browser alert

- Browser Notification API setelah permission eksplisit.
- Audio chime untuk event T0 baru.
- Tidak perlu Cloud Functions/FCM untuk demo prototype.

**Gate Phase 3:** dua browser session berbeda dapat memperagakan `Relawan T0-Suspect → Faskes sees alert → Confirm/Downgrade`.

---

## Phase 4 — Role 3 Admin Real-Time & Longitudinal

### 4.1 Migrate admin reads to real-time where valuable

Prioritas `onSnapshot`:
1. Dashboard KPI/T0 banner.
2. Map active status.
3. Optional cases table.

Tidak semua halaman harus real-time jika tidak memberi nilai demo.

### 4.2 4-tier visual migration

- Ganti agregasi merah/kuning/hijau menjadi T0/T1/T2/T3.
- T0 emergency active harus terlihat berbeda dari T1 high risk.
- Pertahankan compatibility mapper sementara bila legacy seed masih digunakan selama transisi.

### 4.3 Phase filter

- Akut Hari 1–3.
- Lanjutan Hari 4–30.

### 4.4 Longitudinal patient view

- Master patient table.
- Search NIK/nama.
- History assessment per pasien.
- Mini trend/sparkline hanya jika data time-series sudah tersedia; jangan membuat trend sintetis tanpa label demo.

### 4.5 Map enhancement

Urutan:
1. Marker status T0/T1/T2/T3.
2. Popup ringkasan posko.
3. Baru setelah itu optional `leaflet.heat` density layer.

### 4.6 Export

PDF/Excel berada setelah flow data benar. Untuk demo awal, CSV export dapat menjadi fallback termurah jika export kompleks mengganggu deadline.

---

## Phase 5 — Demo Hardening, PWA, dan Cleanup

### 5.1 PWA assets

- Tambah `public/icon-192.png`.
- Tambah `public/icon-512.png`.
- Sinkronkan `includeAssets` dengan asset yang benar (`favicon.svg` atau sediakan `.ico`).
- Tambah metadata PWA/mobile yang diperlukan di `index.html`.

### 5.2 Seed migration final

`src/lib/seed.js` final harus menghasilkan dataset yang konsisten:
- patients.
- PFA/assessment history.
- T0/T1/T2/T3.
- minimal satu T0-Suspect aktif.
- posko coordinates.
- relasi `patientNik` yang valid.

### 5.3 Legacy cleanup

Setelah route baru stabil:
- Tentukan apakah `TriagePage`, `VerbalPage`, dan `NonVerbalPage` tetap dipakai sebagai fallback/demo atau dihapus.
- Hapus dead imports dan logic zona lama yang tidak lagi digunakan.
- Jangan menghapus sebelum regression test route baru selesai.

### 5.4 Build/lint/demo test

Minimum gate sebelum presentasi:

```bash
npm run build
npm run lint
```

Lalu jalankan semua scenario demo pada browser normal + simulated offline.

---

## 5. File Change Matrix — Updated

| Status Saat Ini | File | Next Action |
|:---:|---|---|
| ✅ existing | `src/pages/relawan/PatientLookupPage.jsx` | Integrasikan assessment context + patient sync contract |
| ✅ existing | `src/lib/db.js` | Pertahankan v2; gunakan v3 jika index/sync schema berubah |
| ✅ existing | `src/App.jsx` | Tambah PFA/SRQ/Risk/Faskes routes pada phase terkait |
| ✅ existing | `src/pages/relawan/HomePage.jsx` | Tidak perlu perubahan besar untuk entry Screen 2 |
| ⚠️ modify next | `src/components/layout/RelawanLayout.jsx` | Bottom nav → patient lookup; kemudian inject RedFlagFAB |
| **NEW next** | `src/contexts/AssessmentContext.jsx` | Active patient/phase context + session persistence |
| ⚠️ modify next | `src/lib/sync.js` | Patient sync; kemudian emergency sync |
| ⚠️ modify next | `src/lib/seed.js` | Seed patients + linked history terlebih dahulu |
| **NEW Phase 1** | `src/pages/relawan/PfaPage.jsx` | LOOK/LISTEN/LINK |
| **NEW Phase 1** | `src/components/RedFlagFAB.jsx` | FAB + 3 verification gates |
| **NEW Phase 2** | `src/lib/srq20Questions.js` | Structured question definitions |
| **NEW Phase 2** | `src/pages/relawan/Srq20Page.jsx` | SRQ-20 + STT assist |
| **NEW Phase 2** | `src/pages/relawan/RiskFactorPage.jsx` | Risk/function evaluation |
| ⚠️ Phase 2 | `src/lib/scoring.js` | Add 4-tier API; deprecate legacy later |
| ⚠️ Phase 2 | `src/pages/relawan/ResultPage.jsx` | Migrate to patient-linked 4-tier result |
| **NEW Phase 3** | `src/components/layout/FaskesLayout.jsx` | Role 2 shell |
| **NEW Phase 3** | `src/pages/faskes/EmergencyQueuePage.jsx` | Real-time queue + validation |
| ⚠️ Phase 3 | `src/contexts/AuthContext.jsx` | Add nakes helpers/profile behavior |
| ⚠️ Phase 3 | `src/components/ProtectedRoute.jsx` | Multi-role support |
| ⚠️ Phase 3 | `src/pages/LoginPage.jsx` | Direct role-based redirect |
| ⚠️ Phase 3 | `src/pages/RegisterPage.jsx` | Demo nakes role strategy |
| ⚠️ Phase 4 | `src/pages/admin/DashboardPage.jsx` | `onSnapshot`, T0 banner, 4-tier metrics |
| ⚠️ Phase 4 | `src/pages/admin/MapPage.jsx` | 4-tier marker + optional heat layer |
| ⚠️ Phase 5 | `vite.config.js`, `index.html`, `public/` | PWA asset/meta cleanup |

---

## 6. Updated Demo Test Matrix

### Scenario A — New Patient / Acute Flow

1. Login Relawan.
2. Tekan “Triase Baru”.
3. Pastikan selalu masuk `/relawan/patient-lookup`.
4. Pilih preset pasien baru.
5. Lookup menghasilkan “tidak ditemukan”.
6. Register pasien.
7. Masuk PFA.
8. Selesaikan LOOK/LISTEN/LINK.
9. Pastikan record tetap terkait NIK yang sama.

### Scenario B — Returning Patient / Longitudinal Flow

1. Pilih preset pasien lama.
2. Lookup menemukan pasien dan history.
3. Masuk SRQ-20.
4. Gunakan STT untuk membantu input satu atau beberapa item.
5. Override manual salah satu auto-check.
6. Isi Risk Factor.
7. Result T1/T2/T3.
8. Save.
9. Lookup NIK yang sama kembali dan pastikan assessment baru muncul pada history.

### Scenario C — T0 Two-Tiered Emergency

1. Dari screen relawan aktif, tekan Red Flag.
2. Pilih minimal satu verification gate.
3. Kirim T0-Suspect.
4. Session Faskes menerima alert via `onSnapshot` tanpa refresh.
5. Buka Tele-Emergency simulation.
6. Confirm T0 atau downgrade T1/T2.
7. Admin menunjukkan perubahan status yang relevan.

### Scenario D — Offline Patient + Assessment

1. Matikan network.
2. Register pasien baru.
3. Lanjutkan flow yang tersedia dan save data.
4. Pastikan local records memiliki status pending/unsynced.
5. Hidupkan network.
6. Pastikan **patient dan case/emergency**, bukan hanya case, akhirnya tersinkron.
7. Refresh dan lookup NIK; data tetap tersedia.

### Scenario E — Route Guard

1. Buka route assessment tanpa active patient context.
2. Sistem redirect ke patient lookup.
3. Login sebagai role berbeda dan pastikan route cluster tidak dapat diakses silang.

---

## 7. Definition of Done per Coding Step

Setiap task implementasi dianggap selesai hanya jika:

1. Source code diubah sesuai scope task tanpa refactor besar yang tidak diperlukan.
2. Tidak menimbulkan dead-end navigation.
3. Data model yang ditulis memiliki patient linkage bila relevan.
4. Offline behavior diperiksa bila task menyentuh data relawan.
5. `npm run build` berhasil.
6. `npm run lint` tidak menambah error baru.
7. Minimal acceptance scenario task diuji secara manual.
8. `docs/changes-notes.md` ditambah entry milestone baru.
9. `docs/gap-analysis.md` diperbarui jika status feature berubah.
10. `docs/plan.md` ditandai progress-nya jika milestone selesai.

---

## 8. Aturan Eksekusi dengan Codex

Pengerjaan berikutnya dilakukan **satu milestone kecil per Codex task**, bukan meminta Codex membangun seluruh roadmap sekaligus.

Setiap prompt Codex harus menyertakan:
- file yang wajib dibaca terlebih dahulu (`docs/workflow.md`, `docs/gap-analysis.md`, `docs/plan.md`, dan file source terkait);
- scope file yang boleh dibuat/diubah;
- existing behavior yang tidak boleh rusak;
- data contract/input-output yang diharapkan;
- acceptance criteria;
- test/build/lint requirement;
- instruksi memperbarui `docs/changes-notes.md` setelah task berhasil.

**Next Codex milestone:** Lanjutkan pekerjaan Phase 0 yang tersisa setelah integritas sesi asesmen Phase 0A; keunikan NIK dan sinkronisasi pasien offline belum ditangani.
