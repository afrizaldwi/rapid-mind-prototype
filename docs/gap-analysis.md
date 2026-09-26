# RAPID-MIND — Gap Analysis Report

> **Tanggal Pembaruan:** 26 September 2026  
> **Ruang Lingkup:** Audit implementasi aktual terhadap `docs/workflow.md`, `docs/plan.md`, `docs/changes-notes.md`, dan source code pada snapshot proyek saat ini.  
> **Status Keseluruhan:** **Fondasi prototipe sudah berjalan, Screen 2 sudah diimplementasikan, tetapi alur longitudinal pasien belum tersambung end-to-end.**  
> **Milestone Saat Ini:** Track A.1 (Identitas Penyintas & Auto-Lookup) **terimplementasi pada level UI/lookup**, dengan beberapa pekerjaan integrasi kritis yang harus diselesaikan sebelum melanjutkan ke PFA/SRQ-20.

---

## 1. Ringkasan Eksekutif

Perubahan terbaru telah menutup gap terbesar pada versi awal, yaitu tidak adanya identitas penyintas. `PatientLookupPage.jsx` sekarang sudah menyediakan validasi NIK, pencarian lokal IndexedDB, pencarian Firestore saat online, pendaftaran pasien baru, riwayat asesmen, dan percabangan pasien baru/lama.

Namun, implementasi Screen 2 belum sepenuhnya membentuk alur longitudinal yang utuh. Saat pasien diarahkan ke `/relawan/triage`, identitas pasien dibawa melalui `location.state`, tetapi `TriagePage.jsx` tidak meneruskan state tersebut ke Jalur Verbal/Non-Verbal. Akibatnya, `ResultPage.jsx` dan data `cases` yang disimpan dapat kehilangan `patientNik`, sehingga asesmen tidak lagi terhubung ke penyintas yang dipilih.

Selain itu, tombol **Triase Baru** pada bottom navigation masih langsung menuju `/relawan/triage`, sehingga Screen 2 dapat dilewati. Sinkronisasi offline juga baru mencakup entitas `cases`; pasien baru yang dibuat saat offline belum memiliki mekanisme deferred sync ke Firestore.

### Blocker prioritas sebelum fitur besar berikutnya

1. **Pertahankan identitas pasien sepanjang seluruh assessment flow.**
2. **Tutup jalur bypass Screen 2 dari bottom navigation.**
3. **Tambahkan sinkronisasi pasien yang dibuat saat offline.**
4. **Seed pasien demo lama agar tombol preset “Pasien Lama” benar-benar ditemukan pada database bersih.**
5. Setelah empat poin tersebut stabil, lanjutkan ke **PFA → Red Flag T0 → SRQ-20 → Risk Factor → Result 4-tier**.

---

## 2. Fitur yang Sudah Terimplementasi (✅)

| # | Fitur | File Terkait | Status Aktual |
|---|---|---|---|
| 1 | Firebase Auth Email/Password | `src/contexts/AuthContext.jsx`, `src/pages/LoginPage.jsx` | Berfungsi untuk akun yang memiliki profil Firestore |
| 2 | Protected Routes & RBAC dasar | `src/components/ProtectedRoute.jsx`, `src/App.jsx` | Mendukung role `relawan` dan `admin` |
| 3 | Speech-to-Text browser | `src/hooks/useSpeechToText.js` | Input suara live ketika browser mendukung Web Speech API |
| 4 | Offline Whisper prototype | `src/hooks/useOfflineWhisper.js`, `src/workers/whisperWorker.js` | Model Whisper Tiny dijalankan melalui Transformers.js/Web Worker dengan browser cache |
| 5 | Jalur Verbal legacy berbasis NLP keyword | `src/pages/relawan/VerbalPage.jsx`, `src/lib/scoring.js`, `src/lib/keywords.js` | Berfungsi sebagai triase prototype lama; belum SRQ-20 |
| 6 | Jalur Non-Verbal legacy 8-butir | `src/pages/relawan/NonVerbalPage.jsx` | Checklist observasi sudah clickable dan menghasilkan zona lama |
| 7 | Offline-first penyimpanan `cases` | `src/lib/db.js`, `src/lib/sync.js` | Kasus selalu disimpan lokal terlebih dahulu |
| 8 | Auto-sync `cases` saat koneksi kembali | `src/hooks/useOfflineSync.js`, `src/lib/sync.js` | Pending `cases` dengan `synced=0` didorong ke Firestore |
| 9 | Indikator online/offline dan pending sync | `src/components/layout/RelawanLayout.jsx` | Banner offline, counter pending, dan sync toast tersedia |
| 10 | Dashboard Admin — KPI & distribusi | `src/pages/admin/DashboardPage.jsx` | Snapshot metrik dan kasus terbaru tersedia |
| 11 | Admin — Browser Kasus | `src/pages/admin/CasesPage.jsx` | Pencarian/filter/detail kasus tersedia |
| 12 | Admin — Statistik | `src/pages/admin/StatsPage.jsx` | Line/bar/pie chart tersedia |
| 13 | Admin — Peta Geospasial | `src/pages/admin/MapPage.jsx` | Leaflet + OpenStreetMap dengan circle marker per posko |
| 14 | Riwayat Triase Relawan | `src/pages/relawan/HistoryPage.jsx` | Membaca data lokal dan status sinkronisasi |
| 15 | Konfigurasi PWA/Workbox | `vite.config.js` | Plugin PWA dan precache dikonfigurasi |
| 16 | **Screen 2 — Identitas Penyintas & Auto-Lookup** | `src/pages/relawan/PatientLookupPage.jsx` | Validasi NIK, local-first lookup, Firestore fallback, registrasi baru, tampilan riwayat, preset demo |
| 17 | **Dexie v2 untuk data longitudinal awal** | `src/lib/db.js` | Tabel `patients` dan `emergencies` tersedia; `cases` memiliki index `patientNik`/`tier`; `pendingSync` lama dibersihkan |
| 18 | Entry point Home menuju Screen 2 | `src/pages/relawan/HomePage.jsx` | CTA “Mulai Triase Baru” sudah menuju `/relawan/patient-lookup` |

---

## 3. Fitur yang Terimplementasi Sebagian (⚠️)

### ⚠️ A. Screen 2 — Branching Pasien Baru/Lama

**Sudah ada:**
- NIK 16 digit.
- Pencarian pasien lokal terlebih dahulu.
- Firestore lookup ketika online.
- Form registrasi pasien baru.
- Riwayat asesmen pasien lama.
- State `phase: "akut" | "lanjutan"` ketika meninggalkan Screen 2.

**Masih belum lengkap:**
- Pasien baru dan pasien lama **keduanya masih diarahkan ke `/relawan/triage`** karena `PfaPage.jsx` dan `Srq20Page.jsx` belum tersedia.
- Dengan demikian, branching saat ini baru bersifat **logical intent**, belum menjadi branching screen sesuai `workflow.md`.

### ⚠️ B. Longitudinal Patient Context

`PatientLookupPage.jsx` membawa data pasien melalui React Router state:

```text
PatientLookupPage
  -> /relawan/triage { patient, phase, ... }
```

Tetapi `TriagePage.jsx` menggunakan `<Link>` ke `/relawan/triage/verbal` dan `/relawan/triage/nonverbal` tanpa meneruskan state pasien. `VerbalPage.jsx` dan `NonVerbalPage.jsx` selanjutnya hanya meneruskan hasil triase ke `ResultPage`.

**Dampak:** `ResultPage` dapat menyimpan kasus tanpa `patientNik`, sehingga lookup riwayat berikutnya tidak melihat asesmen tersebut sebagai bagian dari pasien yang sama.

### ⚠️ C. Offline-First untuk Entitas Pasien

**Sudah ada:** pasien baru selalu ditulis ke `localDb.patients`, dan ketika perangkat sedang online aplikasi mencoba `addDoc()` ke Firestore.

**Belum ada:** mekanisme queue/retry pasien. Jika penulisan Firestore gagal atau pasien dibuat saat offline, `syncPendingCases()` hanya menyinkronkan tabel `cases` dan **tidak pernah menyinkronkan `patients`**.

Komentar kode “local is fine, will sync later” pada `PatientLookupPage.jsx` belum sesuai dengan implementasi aktual.

### ⚠️ D. PFA (Psychological First Aid)

- Saat ini hanya ada modal PFA statis di `ResultPage.jsx` untuk zona merah legacy.
- Belum ada `PfaPage.jsx` dengan wizard **LOOK → LISTEN → LINK** dan penyimpanan status PFA ke pasien.

### ⚠️ E. Triage Scoring

- Sistem aktif masih memakai **merah/kuning/hijau** dari `analyzeTranscript()` dan `analyzeChecklist()`.
- Index `tier` sudah disiapkan pada Dexie, tetapi pipeline aktif belum menghasilkan `T0/T1/T2/T3`.
- Cut-off SRQ-20 pada `workflow.md` masih merupakan **spesifikasi proyek**; validasi klinis/rujukan resmi tidak termasuk audit source code ini.

### ⚠️ F. Dashboard Admin / Role 3

- UI dashboard, kasus, statistik, dan peta sudah ada.
- Seluruh halaman admin saat ini menggunakan `getDocs()` sehingga data adalah **snapshot**, bukan command-center real-time.
- Belum ada filter fase akut/lanjutan, longitudinal patient table, T0 alert banner, atau export laporan.

### ⚠️ G. Admin Map / Heatmap

- Circle marker proporsional sudah tersedia.
- Belum ada layer density heatmap dan belum ada visual state T0/T1/T2/T3 sesuai target akhir.

### ⚠️ H. PWA Installability

- `vite-plugin-pwa` sudah dikonfigurasi dan `registerType: "autoUpdate"` digunakan.
- Manifest mereferensikan `/icon-192.png` dan `/icon-512.png`, tetapi kedua file belum ada.
- `includeAssets` mereferensikan `favicon.ico`, sedangkan `public/` saat ini memiliki `favicon.svg`.
- `index.html` belum memiliki metadata PWA/mobile yang direncanakan.

---

## 4. Fitur yang Belum Diimplementasikan (❌)

### Screen 3 — PFA Interaktif (Fase Akut Hari 1–3)

- `PfaPage.jsx` belum ada.
- Wizard LOOK / LISTEN / LINK belum ada.
- Penyimpanan `pfaCompleted`, detail kebutuhan dasar, dan hasil PFA belum ada.
- Routing pasien baru langsung ke PFA belum ada.

### Screen 4 — Red Flag Emergency / T0

- Persistent `RedFlagFAB` belum ada.
- 3 Verification Gate belum ada.
- Persistensi event T0-Suspect belum ada walaupun tabel `emergencies` sudah disiapkan.
- Capture lokasi posko untuk event emergency belum ada.
- Pengiriman alert ke Role 2 belum ada.
- Override T0 terhadap scoring reguler belum ada.

### Screen 5 — SRQ-20 Terstruktur

- `src/lib/srq20Questions.js` belum ada.
- `Srq20Page.jsx` belum ada.
- 20-butir structured questionnaire belum ada.
- STT belum dipetakan ke item SRQ-20.
- Human-in-the-loop manual override per butir belum ada.
- Tooltip edukasi per pertanyaan belum ada.

### Screen 6 — Risk Factor & Daily Function

- `RiskFactorPage.jsx` belum ada.
- Checklist keberfungsian harian dan faktor risiko belum ada.
- Data risk factor belum masuk ke mesin klasifikasi akhir.

### Screen 7 — Hasil T0/T1/T2/T3

- `ResultPage.jsx` masih menampilkan zona merah/kuning/hijau.
- Belum ada output T0/T1/T2/T3.
- Belum ada penyimpanan `srq20Score`, `riskFactorScore`, `phase`, dan patient linkage yang konsisten.

### Role 2 — Tenaga Kesehatan / Faskes / PSC 119

Belum ada seluruh cluster Role 2:
- Role `nakes` pada register/auth profile.
- Multi-role guard di `ProtectedRoute`.
- `/faskes` route cluster.
- `FaskesLayout.jsx`.
- Real-time `EmergencyQueuePage.jsx`.
- Tele-Emergency simulation modal.
- Confirm `T0-Confirmed`.
- Downgrade ke T1/T2.
- Tracking status ambulans/tim mobile.
- Browser notification/audio alert T0.

### Role 3 — Fitur Lanjutan

- Real-time listener `onSnapshot`.
- Banner T0 aktif.
- Filter Fase Akut vs Lanjutan.
- Longitudinal patient table 30 hari.
- Export PDF/Excel.
- Resource/volunteer management yang disebut di workflow.

### Data Demo dan Migrasi Tier

- `src/lib/seed.js` masih menghasilkan data legacy merah/kuning/hijau.
- Belum menghasilkan pasien terpisah pada `patients`.
- Belum menghasilkan kasus T0/T1/T2/T3.
- Belum menghasilkan event emergency T0.

---

## 5. Bug, Integration Gap, dan Technical Debt

### P0 — Menghambat alur end-to-end

1. **Patient state hilang setelah `TriagePage`.**  
   `PatientLookupPage` mengirim `patient` melalui route state, tetapi `TriagePage` tidak meneruskannya ke Verbal/Non-Verbal. Ini memutus `patientNik` dari case hasil asesmen.

2. **Bottom navigation masih melewati Screen 2.**  
   `RelawanLayout.jsx` masih memiliki:
   ```jsx
   <Link to="/relawan/triage">
   ```
   sehingga relawan dapat membuat asesmen tanpa NIK walaupun CTA Home sudah diperbaiki.

3. **Pasien offline tidak memiliki deferred sync.**  
   `syncPendingCases()` hanya membaca `localDb.cases`; `localDb.patients` tidak memiliki mekanisme retry.

4. **Preset “Pasien Lama” bukan data seed.**  
   `DEMO_PATIENTS.existing` hanya mengisi field UI. `src/lib/seed.js` tidak membuat record `patients`, sehingga pada database bersih NIK preset tersebut dapat dianggap belum terdaftar.

### P1 — Integritas data

5. **NIK lokal belum unique.**  
   Skema `patients: '++id, nik, ...'` memungkinkan record dengan NIK sama tersimpan lebih dari sekali.

6. **Firestore patient create memakai `addDoc()`.**  
   Setiap registrasi membuat document ID baru. Tanpa uniqueness guard, duplikasi NIK di cloud memungkinkan dan lookup hanya mengambil `snapshot.docs[0]`.

7. **Seed belum mengikuti schema longitudinal baru.**  
   Data demo masih fokus pada `zona`/`triageResult` legacy dan belum menyiapkan patient history yang dibutuhkan Screen 2.

### P2 — Legacy logic yang akan diganti

8. **`q8` positif tidak memengaruhi `analyzeChecklist()`.**  
   Pertanyaan “relatif tenang” tersedia di UI tetapi tidak dibaca oleh scoring.

9. **`ZONA_HIJAU_INDICATORS` tidak digunakan.**  
   Zona hijau tetap merupakan fallback dari ketiadaan keyword merah/kuning.

10. **Login selalu menuju `/relawan`.**  
    Role admin baru dipantulkan oleh `ProtectedRoute`; role `nakes` belum memiliki redirect path.

11. **Koordinat case diberi random jitter saat save.**  
    Ini berguna untuk visual demo, tetapi bukan data GPS aktual dan tidak boleh dipresentasikan sebagai koordinat penyintas yang benar-benar diukur.

---

## 6. Alur Aktual Saat Ini vs Target

### Alur aktual

```text
Login
  ↓
Home
  ↓
Patient Lookup  ────────────────┐
  │                             │
  ├─ NIK baru                   ├─ NIK lama
  │                             │
  └──────────────┬──────────────┘
                 ↓
          /relawan/triage
                 ↓
          Verbal / Non-Verbal
                 ↓
        Merah / Kuning / Hijau
                 ↓
             Save case
```

Masalah utama: patient context dapat terputus setelah `/relawan/triage`.

### Target workflow

```text
Patient Lookup
  │
  ├─ Pasien Baru ──> PFA (LOOK/LISTEN/LINK) ──> Save PFA
  │
  └─ Pasien Lama ──> SRQ-20 ──> Risk Factor ──> T1/T2/T3 Result

Screen 2–7
  └─ Persistent Red Flag ──> T0-Suspect ──> Role 2 Verification
                                     │
                                     ├─ T0-Confirmed
                                     └─ Downgrade T1/T2
```

---

## 7. Prioritas Implementasi yang Direkomendasikan

| Prioritas | Pekerjaan | Alasan |
|---|---|---|
| **P0** | Repair longitudinal routing/context | Tanpa ini Screen 2 tidak menghasilkan rekam pasien yang benar |
| **P0** | Ubah bottom nav “Triase Baru” → `/relawan/patient-lookup` | Menutup bypass asesmen anonim |
| **P0** | Patient offline sync + uniqueness strategy | Menjamin janji offline-first berlaku untuk identitas, bukan hanya kasus |
| **P0** | Seed patient demo baru/lama | Membuat skenario demo Screen 2 deterministik |
| **P1** | PFA LOOK/LISTEN/LINK | Menyelesaikan jalur pasien baru |
| **P1** | Red Flag FAB + T0-Suspect | Menyelesaikan differentiator emergency workflow |
| **P2** | SRQ-20 + Risk Factor + Result 4-tier | Menyelesaikan jalur longitudinal pasien lama |
| **P3** | Role 2 Faskes real-time | Menutup loop T0-Suspect → validasi klinis |
| **P4** | Admin real-time + longitudinal view | Menyelaraskan Role 3 dengan workflow final |
| **P5** | Heatmap, export, PWA assets, polish | Demo hardening setelah core flow tidak memiliki dead end |

---

## 8. Kesimpulan Audit

Snapshot saat ini **lebih maju daripada `gap-analysis.md` sebelumnya** karena Screen 2 dan fondasi Dexie v2 sudah tersedia. Namun klaim “Identitas Penyintas & Auto-Lookup selesai” perlu dibatasi: fungsi lookup/UI memang sudah ada, tetapi integrasi longitudinal end-to-end masih belum selesai karena patient context dapat hilang, jalur PFA/SRQ belum tersedia, dan pasien offline belum ikut mekanisme sync.

Fokus berikutnya sebaiknya **bukan menambah dashboard/polish**, melainkan menutup empat P0 integration gaps agar Screen 2 benar-benar menjadi fondasi seluruh alur RAPID-MIND.
