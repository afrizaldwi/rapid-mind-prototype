# RAPID-MIND — Gap Analysis Report

> **Tanggal Pembaruan:** 26 September 2026  
> **Ruang Lingkup:** Audit implementasi aktual terhadap `docs/workflow.md`, `docs/plan.md`, `docs/changes-notes.md`, dan source code pada snapshot proyek saat ini.  
> **Status Keseluruhan:** **Phase 0A/0B/0C lulus smoke test manual yang tercatat. Phase 1A lulus pemeriksaan manual browser/runtime terpilih dan Vitest domain/sinkronisasi; belum full E2E. Migrasi v2 berisi data → v4 NOT RUNTIME TESTED.**
> **Milestone Saat Ini:** Phase 1A fondasi persistensi bertipe selesai pada source, pemeriksaan manual terpilih, dan Vitest; berikutnya Phase 1B PFA UI/protokol. Phase 0 tetap ditutup. Uraian gap lama di bawah diberi konteks historis.

---

## 1. Ringkasan Eksekutif

Perubahan terbaru telah menutup gap terbesar pada versi awal, yaitu tidak adanya identitas penyintas. `PatientLookupPage.jsx` sekarang sudah menyediakan validasi NIK, pencarian lokal IndexedDB, pencarian Firestore saat online, pendaftaran pasien baru, riwayat asesmen, dan percabangan pasien baru/lama.

Phase 0A menambahkan assessment context yang menyimpan NIK pasien selama alur triase legacy dan menulis `patientNik` secara eksplisit pada kasus. Rute triase tanpa asesmen aktif sekarang kembali ke Patient Lookup.

Tombol **Triase Baru** pada bottom navigation menuju `/relawan/patient-lookup`. Source Phase 0B menambahkan retry pasien dan kasus. Firebase, cache offline, startup/reconnect, dan alur demo telah lulus smoke test manual; migrasi v2 berisi data belum diuji runtime.

Phase 1A menjadikan `cases` store rekam asesmen longitudinal bertipe (`recordType`, `protocolVersion`, `responses` ber-ID item stabil) tanpa menaikkan Dexie v4. PFA dapat disimpan sebagai record bertipe tanpa zona; pembaca legacy hanya mengenali zona yang valid. Sinkronisasi cloud seluruh kasus yang memiliki `patientNik` menunggu pasien aman/synced; record bertipe hanya mendapat lokasi jika pasangan koordinat diketahui dan valid. Pemeriksaan manual browser/runtime PASS untuk regresi simpan legacy verbal/non-verbal, PFA offline→reconnect/cloud tanpa zona/lokasi palsu, tampilan Relawan/Admin, dan eksklusi PFA dari agregat zona. Vitest PASS untuk kontrak record, serializer, urutan pasien→kasus, ID Firestore, dan koordinat; urutan pasien→kasus belum diklaim diuji manual di browser.

### Milestone berikutnya

1. **Phase 1B: PFA LOOK/LISTEN/LINK UI dan konten protokol.** Phase 1A lulus pemeriksaan manual terpilih dan Vitest; belum ada suite E2E penuh.
2. Phase 2 berikutnya: SRQ-20 → Risk Factor → Result 4-tier.
3. Migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED** sebagai batas validasi kompatibilitas; kode migrasi dipertahankan.

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
| 8 | Auto-sync pasien dan `cases` saat startup/reconnect | `src/hooks/useOfflineSync.js`, `src/lib/sync.js`, `src/lib/patients.js` | Pasien pending diproses lebih dulu; startup/reconnect pasien PASS di browser |
| 9 | Indikator online/offline dan pending sync | `src/components/layout/RelawanLayout.jsx` | Banner offline, counter pending, dan sync toast tersedia |
| 10 | Dashboard Admin — KPI & distribusi | `src/pages/admin/DashboardPage.jsx` | Snapshot metrik dan kasus terbaru tersedia |
| 11 | Admin — Browser Kasus | `src/pages/admin/CasesPage.jsx` | Pencarian/filter/detail kasus tersedia |
| 12 | Admin — Statistik | `src/pages/admin/StatsPage.jsx` | Line/bar/pie chart tersedia |
| 13 | Admin — Peta Geospasial | `src/pages/admin/MapPage.jsx` | Leaflet + OpenStreetMap dengan circle marker per posko |
| 14 | Riwayat Triase Relawan | `src/pages/relawan/HistoryPage.jsx` | Membaca data lokal dan status sinkronisasi |
| 15 | Konfigurasi PWA/Workbox | `vite.config.js` | Plugin PWA dan precache dikonfigurasi |
| 16 | **Screen 2 — Identitas Penyintas & Auto-Lookup** | `src/pages/relawan/PatientLookupPage.jsx` | Validasi NIK, local-first lookup, Firestore fallback, registrasi baru, tampilan riwayat, preset demo |
| 17 | **Dexie v4 untuk data longitudinal** | `src/lib/db.js` | Baseline v4 bersih PASS; migrasi v2 berisi data → v4 NOT RUNTIME TESTED |
| 18 | Entry point Home menuju Screen 2 | `src/pages/relawan/HomePage.jsx` | CTA “Mulai Triase Baru” sudah menuju `/relawan/patient-lookup` |
| 19 | Fondasi `cases` bertipe/berversi (Phase 1A) | `src/lib/caseRecords.js`, `src/lib/sync.js`, pembaca Relawan/Admin | Source, pemeriksaan manual terpilih, dan Vitest PASS; belum full E2E |

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

**Catatan historis sebelum Phase 0A:** `PatientLookupPage.jsx` pernah membawa data pasien melalui React Router state:

```text
PatientLookupPage
  -> /relawan/triage { patient, phase, ... }
```

Tetapi `TriagePage.jsx` menggunakan `<Link>` ke `/relawan/triage/verbal` dan `/relawan/triage/nonverbal` tanpa meneruskan state pasien. `VerbalPage.jsx` dan `NonVerbalPage.jsx` selanjutnya hanya meneruskan hasil triase ke `ResultPage`.

**Status saat ini:** Phase 0A memakai Assessment Context yang terikat UID Relawan dan tersimpan di sessionStorage. `ResultPage` menulis `patientNik` dari context; gap ini sudah ditutup.

### ⚠️ C. Offline-First untuk Entitas Pasien

**Sebelum Phase 0B:** pasien baru ditulis ke `localDb.patients`, lalu ketika online aplikasi mencoba `addDoc()` ke Firestore tanpa retry pasien.

**Status Phase 0B:** pasien lokal memiliki `pending | synced | conflict`. `syncPendingData()` memproses pasien pending sebelum kasus, dan konflik tidak di-retry otomatis. Startup/reconnect pasien dan pasien baru offline → reconnect lulus smoke test manual.

Komentar lama “local is fine, will sync later” telah diganti oleh alur retry yang nyata.

### ⚠️ D. PFA (Psychological First Aid)

- Saat ini hanya ada modal PFA statis di `ResultPage.jsx` untuk zona merah legacy.
- Fondasi record PFA bertipe sudah ada, tetapi belum ada `PfaPage.jsx` dengan wizard **LOOK → LISTEN → LINK**, konten protokol, atau aksi penyimpanan PFA dari UI.
- Bukti PFA selesai harus berasal dari record PFA selesai, bukan `patients.pfaCompleted` / `lastPhase`; field pasien lama tetap kompatibilitas/demo.

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
- Penyimpanan hasil PFA dari UI dan detail kebutuhan dasar belum ada; `pfaCompleted` pada pasien bukan sumber kebenaran.
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

- `src/lib/seed.js` tetap menghasilkan data legacy merah/kuning/hijau dengan ID demo stabil.
- Source Phase 0C memastikan pasien Budi di `patients` dan satu riwayat dengan `patientNik` Budi. Siti tidak diseed. Seed berulang dan kedua cabang preset lulus smoke test manual.
- Belum menghasilkan kasus T0/T1/T2/T3.
- Belum menghasilkan event emergency T0.

---

## 5. Bug, Integration Gap, dan Technical Debt

### P0 — Menghambat alur end-to-end

1. **Patient state hilang setelah `TriagePage` — selesai pada Phase 0A.**
   Assessment Context sekarang menjaga identitas pasien hingga hasil dan penulisan `patientNik`.

2. **Bottom navigation melewati Screen 2 — selesai pada Phase 0A.**
   Rute lama sebelumnya memiliki:
   ```jsx
   <Link to="/relawan/triage">
   ```
   Sekarang “Triase Baru” menuju Patient Lookup dan rute asesmen dijaga `AssessmentRoute`.

3. **Pasien offline tidak memiliki deferred sync — selesai pada Phase 0B, smoke test PASS.**
   Pasien pending kini diproses sebelum `cases`; kegagalan retryable tetap pending dan duplikasi NIK cloud menjadi conflict.

4. **Preset “Pasien Lama” bukan data seed — selesai pada Phase 0C, smoke test PASS.**
   Seed kini memastikan pasien Budi dan satu kasus yang terkait melalui `patientNik`; Siti sengaja tidak diseed.

### P1 — Integritas data

5. **NIK lokal belum unique — source Phase 0B selesai; baseline v4 PASS.**
   v3 menyimpan salinan row lama dalam audit dan membersihkan duplikasi; v4 memasang `&nik`. Migrasi v2 berisi data → v4 **NOT RUNTIME TESTED**.

6. **Firestore patient create dahulu memakai `addDoc()` — selesai pada Phase 0B, smoke test Firebase PASS.**
   Penulisan baru memakai `patients/{nik}` setelah pembacaan server. Satu dokumen cloud menjadi profil direktori otoritatif; lebih dari satu menjadi konflik tanpa pemilihan `.docs[0]`.

7. **Seed Phase 0C tetap menggunakan zona legacy sesuai scope.**
   Budi kini memiliki linked history; transisi T0/T1/T2/T3 tetap pekerjaan fase berikutnya.

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

Catatan historis: patient context dahulu dapat terputus setelah `/relawan/triage`; Phase 0A telah menutupnya.

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
| **Selesai 0A** | Repair longitudinal routing/context | Assessment Context menjaga NIK hingga hasil |
| **Selesai 0A** | Ubah bottom nav “Triase Baru” → `/relawan/patient-lookup` | Menutup bypass asesmen anonim |
| **0B selesai; runtime PASS** | Patient offline sync + uniqueness strategy | Firebase/reconnect PASS; migrasi v2 berisi data belum diuji runtime |
| **0C selesai; runtime PASS** | Seed patient demo baru/lama | Siti/Budi dan seed berulang PASS |
| **1A manual terpilih + Vitest PASS** | Record asesmen bertipe/berversi | PFA tidak menjadi Zona Hijau; urutan pasien→kasus teruji otomatis |
| **P1B** | PFA LOOK/LISTEN/LINK | Menyelesaikan jalur pasien baru |
| **P1** | Red Flag FAB + T0-Suspect | Menyelesaikan differentiator emergency workflow |
| **P2** | SRQ-20 + Risk Factor + Result 4-tier | Menyelesaikan jalur longitudinal pasien lama |
| **P3** | Role 2 Faskes real-time | Menutup loop T0-Suspect → validasi klinis |
| **P4** | Admin real-time + longitudinal view | Menyelaraskan Role 3 dengan workflow final |
| **P5** | Heatmap, export, PWA assets, polish | Demo hardening setelah core flow tidak memiliki dead end |

---

## 8. Kesimpulan Audit

Snapshot sebelum 0B memiliki Screen 2 dan Dexie v2; Phase 0A kemudian menjaga patient context. Jalur PFA/SRQ khusus masih belum tersedia. Source Phase 0B menangani keunikan NIK, sinkronisasi pasien, konflik data, dan retry kasus yang idempoten. Source Phase 0C memperbaiki seed demo Siti/Budi.

Smoke test manual menemukan overlap header Relawan, kelemahan pemulihan profil saat refresh offline, dan konflik duplikasi cloud yang tetap memblokir pencarian setelah data diperbaiki. Perbaikan source untuk ketiganya telah dibuat dan retest browser mengonfirmasi **PASS**. Cache pasien offline, sinkronisasi startup/reconnect, baseline v4 bersih, serta seed dan cabang Siti/Budi juga **PASS**.

Data prototipe lama sengaja direset; `users` Firestore dipertahankan, sedangkan data pasien/kasus dan site data browser dibersihkan. Aplikasi dimulai dari Dexie v4 bersih lalu seed demo dijalankan ulang. Karena itu, migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED**; kode migrasi telah ditinjau dari source dan tetap menjadi perlindungan kompatibilitas.

Phase 0 ditutup untuk prototipe saat ini. Phase 1A fondasi record bertipe lulus pemeriksaan manual browser/runtime terpilih dan Vitest; suite E2E penuh belum ada. Milestone berikutnya adalah **Phase 1B: UI/protokol PFA LOOK/LISTEN/LINK**. Red Flag/T0, sinkronisasi emergency, SRQ-20, Risk Factor, dan hasil T1/T2/T3 masih belum diimplementasikan. Migrasi Dexie v2 berisi data → v4 tetap **NOT RUNTIME TESTED**.
