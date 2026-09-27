# RAPID-MIND — Gap Analysis Report

> **Tanggal Pembaruan:** 27 September 2026
> **Ruang Lingkup:** Audit implementasi aktual terhadap `docs/workflow.md`, `docs/plan.md`, `docs/changes-notes.md`, dan source code pada snapshot proyek saat ini.  
> **Status Keseluruhan:** **Phase 2B Screen 5/6 selesai untuk scope terpilih: source, tes otomatis, dan smoke test browser A–H PASS dengan keterbatasan akurasi Whisper lokal pada C. Screen 7/save/routing produksi tetap Phase 2C. Hasil smoke test manual Phase 0 dan Phase 1 tetap sebagaimana tercatat. Belum full E2E. Migrasi v2 berisi data → v4 NOT RUNTIME TESTED.**
> **Milestone Saat Ini:** UI SRQ-20 verbal/nonverbal dan Risk/Function memakai draf Phase 2A. Adjustment klasifikasi, hidrasi History lintas browser, hardening idempotensi PFA, dan Faskes T0 tetap pekerjaan terpisah.

---

## 1. Ringkasan Eksekutif

Perubahan terbaru telah menutup gap terbesar pada versi awal, yaitu tidak adanya identitas penyintas. `PatientLookupPage.jsx` sekarang sudah menyediakan validasi NIK, pencarian lokal IndexedDB, pencarian Firestore saat online, pendaftaran pasien baru, riwayat asesmen, dan percabangan pasien baru/lama.

Phase 0A menambahkan assessment context yang menyimpan NIK pasien selama alur triase legacy dan menulis `patientNik` secara eksplisit pada kasus. Rute triase tanpa asesmen aktif sekarang kembali ke Patient Lookup.

Tombol **Triase Baru** pada bottom navigation menuju `/relawan/patient-lookup`. Source Phase 0B menambahkan retry pasien dan kasus. Firebase, cache offline, startup/reconnect, dan alur demo telah lulus smoke test manual; migrasi v2 berisi data belum diuji runtime.

Phase 1A menjadikan `cases` store rekam asesmen longitudinal bertipe (`recordType`, `protocolVersion`, `responses` ber-ID item stabil) tanpa menaikkan Dexie v4. PFA dapat disimpan sebagai record bertipe tanpa zona; pembaca legacy hanya mengenali zona yang valid. Sinkronisasi cloud seluruh kasus yang memiliki `patientNik` menunggu pasien aman/synced; record bertipe hanya mendapat lokasi jika pasangan koordinat diketahui dan valid. Pemeriksaan manual browser/runtime PASS untuk regresi simpan legacy verbal/non-verbal, PFA offline→reconnect/cloud tanpa zona/lokasi palsu, tampilan Relawan/Admin, dan eksklusi PFA dari agregat zona. Vitest PASS untuk kontrak record, serializer, urutan pasien→kasus, ID Firestore, dan koordinat; urutan pasien→kasus belum diklaim diuji manual di browser.

### Milestone berikutnya

1. **Phase 2C:** Screen 7, hasil T1/T2/T3, save record, dan perpindahan routing Patient Lookup dari fallback triase legacy ke SRQ. Smoke test browser Phase 2B terpilih selesai, dengan keterbatasan akurasi Whisper lokal yang masih terbuka.
2. **Hardening riwayat Relawan:** selesaikan hidrasi/tampilan kasus lintas browser tanpa mengubah kontrak PFA selesai.
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
| 20 | PFA LOOK/LISTEN/LINK (Phase 1B) | `src/pages/relawan/PfaPage.jsx`, `src/protocols/pfaProtocol.js`, `src/lib/pfa.js` | Source, 78/78 tes otomatis, smoke test percabangan, dan retest pre-merge PASS; belum full E2E |
| 21 | Red Flag/T0-Suspect (Phase 1C) | `src/components/RedFlagFAB.jsx`, `src/lib/emergencies.js`, `src/lib/sync.js` | Source, 93/93 tes otomatis, dan smoke test browser Phase 1C PASS; belum full E2E |

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
- Pasien baru masuk `/relawan/pfa` setelah registrasi. Pasien terdaftar dengan PFA bertipe valid memakai `/relawan/triage` sebagai fallback sampai SRQ-20 tersedia; tanpa record PFA valid, pasien melanjutkan PFA akut hanya bila asesmen akut untuk NIK yang sama aktif atau riwayat cloud berhasil diperiksa dan tidak menunjukkan PFA selesai.
- Cabang fase lanjutan belum menjadi screen SRQ-20 sesuai `workflow.md`.

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

### ✅/⚠️ D. PFA (Psychological First Aid)

- Modal PFA statis di `ResultPage.jsx` tetap hanya untuk zona merah legacy.
- `PfaPage.jsx` menyediakan wizard **LOOK → LISTEN → LINK** dan protokol modular `pfa-prototype-v1` dengan teks provisional serta ID respons stabil. Draf hanya disimpan di `sessionStorage` dengan pemeriksaan ikatan pasien/sesi/versi; record PFA selesai disimpan ke `cases` melalui `saveCase()`.
- Hanya record PFA bertipe valid dalam riwayat menjadi bukti penyelesaian, termasuk yang belum tersinkron. Pasien terdaftar tanpa record tersebut melihat `PFA belum selesai` bila riwayat cloud telah diverifikasi, atau bila asesmen akut untuk NIK yang sama masih aktif; asesmen aktif/draf pasien dan sesi yang sama dapat dilanjutkan. Pasien lain memerlukan pembatalan eksplisit sebelum memulai aksi yang valid; pembatalan menghapus asesmen/draf, sedangkan pasien tetap terdaftar. Setelah PFA selesai, lookup menampilkan `PFA telah selesai` dan aksi fallback SRQ-20 saat ini. Retest browser percabangan, resume, dan pembatalan **PASS**.
- Perbaikan pre-merge: logout menghapus draf PFA bersama asesmen aktif, tanpa menghapus pasien IndexedDB atau kasus selesai/pending; login ulang tidak memulihkan draf. Patient Lookup membedakan riwayat cloud yang berhasil diverifikasi dari kueri server yang gagal atau mode offline. PFA lokal bertipe valid tetap membuktikan selesai walau cloud tidak terverifikasi; Browser B saat online tetap mengenali PFA bertipe selesai dari Browser A. Asesmen akut aktif untuk NIK yang sama dapat dilanjutkan offline dengan sesi/jawaban semula. Tanpa bukti selesai maupun asesmen aktif, hanya verifikasi cloud yang berhasil mengizinkan PFA baru; status tidak terverifikasi hanya menawarkan `Coba Lagi`, tanpa aksi PFA atau fallback lanjutan. Seluruh retest browser pre-merge terarah ini **PASS**; belum ada suite E2E penuh.
- Operasi IndexedDB pasien/PFA saat offline berhasil. Refresh `npm run dev` dengan Chrome DevTools Offline menghasilkan `ERR_INTERNET_DISCONNECTED`, batas pengujian development server; refresh offline dengan bundle produksi `npm run build` + `npm run preview` berhasil melalui PWA/service worker. Ini bukan cacat PWA produksi dan belum membuktikan seluruh skenario offline lewat E2E.

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

## 4. Fitur yang Belum Diimplementasikan atau Belum Diuji (❌/⚠️)

### Screen 3 — PFA Interaktif (Fase Akut Hari 1–3)

- UI, routing pasien baru, dan penyimpanan PFA lokal sudah diimplementasikan pada Phase 1B. Retest percabangan/resume/pembatalan dan refresh offline pada preview produksi **PASS**; belum ada suite E2E penuh.

### Screen 4 — Red Flag Emergency / T0

- Persistent `RedFlagFAB` tersedia pada halaman Relawan relevan, dengan tiga indikator prototipe ber-ID stabil dan syarat minimal satu pilihan.
- Event `t0-suspect` tersimpan lokal pada `emergencies`, termasuk tanpa pasien aktif. Upload Firestore segera saat online dan retry reconnect memakai ID dokumen yang sama; sinkronisasi pasien yang gagal tidak menahan emergency.
- Posko dan koordinat berasal dari profil Relawan bila valid; tidak ada GPS fallback. Smoke test browser Phase 1C **PASS**: koordinat profil yang valid tersalin; setelah `poskoLat` dan `poskoLng` dihapus, kedua koordinat tidak ada di record lokal maupun Firestore.
- Smoke test browser Phase 1C **PASS** untuk simpan lokal saat offline, status/counter pending, reconnect, dan retry: kegagalan Firestore saat online menyisakan event pending dengan `firestoreId` tersimpan; reconnect memakai ID yang sama dan menghasilkan satu dokumen emergency Firestore tanpa duplikat. FAB, validasi indikator, tautan pasien PFA aktif, kelanjutan PFA, serta layering modal Patient Lookup dan Result zona merah legacy juga PASS. Hasil ini terpisah dari 93 tes otomatis berbasis mock; belum ada suite E2E penuh.
- Pengiriman alert/konfirmasi ke Role 2 dan override scoring reguler belum diimplementasikan dalam Phase 1C.

### Screen 5 — SRQ-20 Terstruktur

- `src/protocols/srq20Protocol.js` menyediakan 20 ID stabil dengan teks `[Template]` **provisional**; validasi dan base scoring sudah ada. Ambang T3 0–5, T2 6–10, T1 11–20 mengikuti spesifikasi prototipe pada `workflow.md`, bukan validasi klinis final.
- `Srq20Page.jsx` tersedia di `/relawan/srq20` untuk asesmen `lanjutan` milik Relawan aktif. Dua mode input berbagi `srqResponses`; 20 jawaban Ya/Tidak harus eksplisit dan yang hilang terlihat belum dijawab. Draf memulihkan mode/jawaban antar layar dan refresh.
- STT dan Whisper lokal hanya membantu transkrip sementara yang dapat diedit; tidak ada auto-check dari teks karena pemetaan keyword untuk protokol template belum disepakati. Relawan menentukan seluruh jawaban terstruktur secara manual.
- Smoke test browser Phase 2B menjalankan Whisper lokal, tetapi hasilnya tidak akurat untuk satu kalimat bahasa Indonesia yang diuji; ini keterbatasan kualitas bantuan transkripsi, bukan blocker atau perubahan scoring SRQ. STT browser langsung mentranskripsi kalimat yang sama dengan benar.
- Tooltip edukasi per pertanyaan belum ada.

### Screen 6 — Risk Factor & Daily Function

- `RiskFactorPage.jsx` tersedia di `/relawan/risk-factor`, dengan dua bagian terpisah dari protokol: masing-masing empat butir `[Template]` **provisional**. Akses memerlukan draf valid dan 20 SRQ lengkap; delapan jawaban harus eksplisit sebelum cek kesiapan.
- Selesai Screen 6 hanya menyimpan draf lengkap dan menampilkan pesan siap diproses pada layar yang sama. Tidak ada hasil klinis, save case, atau Screen 7 pada Phase 2B.
- Algoritme adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED**. `classification-prototype-v1` memerlukan kedua checklist lengkap tetapi sengaja menghasilkan `finalTier === baseTier`; tidak ada bobot atau `riskFactorScore` buatan.

### Screen 7 — Hasil T0/T1/T2/T3

- `ResultPage.jsx` masih menampilkan zona merah/kuning/hijau.
- Belum ada output UI T1/T2/T3 atau save flow Phase 2; T0-Suspect tetap mekanisme emergency terpisah.
- Skema dan validasi domain untuk `srq20Score`, base tier, data Risk/Function, versi klasifikasi, serta tier akhir sudah ada, tetapi belum ada record Phase 2 yang dibuat oleh UI.

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

**Gap terbuka — hidrasi riwayat Relawan lintas browser.** `/relawan/history` membaca `cases` dari Dexie browser setempat. Kasus diunggah ke Firestore, tetapi browser/sesi lain belum menghidrasi `cases` lokal untuk halaman ini. Browser A dan B dengan akun Relawan yang sama dapat menampilkan isi History berbeda; ini bukan bukti kegagalan persistensi cloud. Patient Lookup Browser B menemukan NIK PFA selesai yang sama dan mengenali record PFA bertipe valid melalui gabungan riwayat lokal + Firestore, sehingga ini bukan cacat percabangan Phase 1B. Hardening nanti dapat menggabungkan kasus Firestore ke tampilan History saat online atau melakukan hidrasi Firestore → Dexie; desain belum dipilih.

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
  ├─ PFA belum selesai          ├─ PFA selesai
  │                             │
  ↓                             ↓
 /relawan/pfa              /relawan/triage
  ↓                             ↓
 Save PFA                  Verbal / Non-Verbal
                                ↓
                       Merah / Kuning / Hijau
                                ↓
                            Save case

Rute langsung dengan konteks lanjutan valid:
/relawan/srq20 → /relawan/risk-factor → draf siap (tanpa save case)
```

Catatan: pasien baru menjalani PFA. Pasien dengan PFA selesai masih sengaja memasuki `/relawan/triage` sebagai fallback produksi; rute SRQ Screen 5/6 tersedia untuk uji langsung dengan konteks `lanjutan` yang valid. Patient context dahulu dapat terputus setelah `/relawan/triage`; Phase 0A telah menutupnya.

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
| **1B selesai untuk scope terpilih** | PFA LOOK/LISTEN/LINK + perbaikan pre-merge | Source, 78/78 tes otomatis, smoke test percabangan, dan retest logout/verifikasi riwayat cloud PASS; belum full E2E |
| **1C source + tes otomatis + smoke test browser PASS** | Red Flag FAB + T0-Suspect + persistensi/sinkronisasi emergency | Pencatatan event emergency dan alur browser terpilih tervalidasi; belum full E2E |
| **2A source + tes otomatis PASS** | Fondasi domain SRQ-20, Risk/Function, draf, scoring, dan record lengkap | Tidak mengubah UI/routing; tidak ada validasi browser Phase 2A |
| **2B selesai untuk scope terpilih; smoke browser PASS dengan limitasi Whisper** | Screen 5 SRQ dan Screen 6 Risk/Function | Source, 194/194 tes otomatis, serta smoke A–H selesai; akurasi Whisper lokal masih terbuka |
| **P2C** | Screen 7, save flow, dan routing pasien lama ke SRQ | Menyelesaikan jalur longitudinal produksi |
| **Hardening terbuka** | Hidrasi/tampilan `/relawan/history` lintas browser | Firestore menyimpan kasus, tetapi History masih membaca Dexie lokal |
| **P3** | Role 2 Faskes real-time | Menutup loop T0-Suspect → validasi klinis |
| **P4** | Admin real-time + longitudinal view | Menyelaraskan Role 3 dengan workflow final |
| **P5** | Heatmap, export, PWA assets, polish | Demo hardening setelah core flow tidak memiliki dead end |

---

## 8. Kesimpulan Audit

Snapshot sebelum 0B memiliki Screen 2 dan Dexie v2; Phase 0A kemudian menjaga patient context. Source Phase 0B menangani keunikan NIK, sinkronisasi pasien, konflik data, dan retry kasus yang idempoten. Source Phase 0C memperbaiki seed demo Siti/Budi. Phase 1B menyediakan jalur PFA khusus; Phase 2B menambahkan UI SRQ-20 dan Risk/Function di rute terjaga, tetapi alur produksi masih memakai fallback triase legacy setelah PFA selesai.

Smoke test manual menemukan overlap header Relawan, kelemahan pemulihan profil saat refresh offline, dan konflik duplikasi cloud yang tetap memblokir pencarian setelah data diperbaiki. Perbaikan source untuk ketiganya telah dibuat dan retest browser mengonfirmasi **PASS**. Cache pasien offline, sinkronisasi startup/reconnect, baseline v4 bersih, serta seed dan cabang Siti/Budi juga **PASS**.

Data prototipe lama sengaja direset; `users` Firestore dipertahankan, sedangkan data pasien/kasus dan site data browser dibersihkan. Aplikasi dimulai dari Dexie v4 bersih lalu seed demo dijalankan ulang. Karena itu, migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED**; kode migrasi telah ditinjau dari source dan tetap menjadi perlindungan kompatibilitas.

Phase 0 dan hasil validasi terpilih Phase 1A/1B tetap sebagaimana tercatat. Phase 1C menyediakan FAB Red Flag, event `t0-suspect`, dan sinkronisasi emergency; 93/93 tes otomatis pada tahap 1C serta smoke test browser Phase 1C **PASS**. Phase 2A menyediakan kontrak SRQ-20, Risk/Function, draf, scoring, dan validasi record. Phase 2B menambahkan Screen 5/6 dan dua rute terjaga. **Validasi otomatis/unit** `npm test` 194/194 PASS (9 file) mencakup logika deterministik jawaban, transisi, draf terikat sesi, kesiapan, dan klasifikasi v1. **Manual browser smoke** delapan kelompok A–H di `docs/changes-notes.md` selesai: A, B, D, E, F, G, H **PASS**; C **PASS WITH LIMITATION** karena runtime Whisper lokal berjalan tetapi transkripsinya tidak akurat untuk kalimat uji. Keterbatasan kualitas ini masih terbuka dan tidak memblokir Phase 2B; tes unit tidak membuktikan runtime browser. Screen 6 tidak membuat kasus SRQ baru; record IndexedDB yang sudah ada tetap bertipe PFA. Adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED**; Screen 7/save dan routing produksi SRQ tetap Phase 2C. PFA selesai lintas browser dikenali Patient Lookup saat online; hidrasi `/relawan/history` lintas browser dan hardening idempotensi PFA tetap pekerjaan terpisah. Suite E2E penuh belum ada. Validasi klinis T0 oleh Faskes dan hasil T1/T2/T3 masih pekerjaan berikutnya. Migrasi Dexie v2 berisi data → v4 tetap **NOT RUNTIME TESTED**.
