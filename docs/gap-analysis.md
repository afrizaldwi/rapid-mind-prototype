# RAPID-MIND — Gap Analysis Report

> **Tanggal Pembaruan:** 29 September 2026
> **Ruang Lingkup:** Audit implementasi aktual terhadap `docs/workflow.md`, `docs/plan.md`, `docs/changes-notes.md`, dan source code pada snapshot proyek saat ini.  
> **Status Keseluruhan:** **Phase 2C dan smoke browser A–J PASS. Phase 3.1 Faskes Foundation + Real-Time Emergency Reception selesai untuk scope prototipe terpilih. Phase 3.2B COMPLETE / PASS untuk selected prototype scope: source, 295/295 tes otomatis, dan browser smoke A-L PASS di bawah Test Mode Rules; belum full E2E. Phase 4.1 COMPLETE / PASS untuk scope prototipe terpilih: 320/320 tes dan gate browser A–L PASS di bawah Test Mode. Phase 4.2 COMPLETE / PASS untuk scope prototipe terpilih: 336/336 tes dan browser gate A–L PASS/NDV terbatas di bawah Test Mode. Migrasi v2 berisi data → v4 NOT RUNTIME TESTED.** Phase 4.3 provisioning client terisolasi + registri RS COMPLETE / PASS untuk selected prototype scope; 370/370 tes dan browser A–L PASS di deployed Test Mode. Phase 4.4A Volunteer Deployment Management COMPLETE / PASS untuk selected prototype scope; Phase 4.4 keseluruhan belum selesai karena 4.4B Resource Management masih planned.
> **Milestone Saat Ini:** Source Phase 3.2A tersedia; restricted Rules belum deployed dan emergency-create Playground FAIL / unresolved. Phase 3.2B browser gate A-L PASS untuk scope terpilih, tetapi listener error callback nyata dan `hasPendingWrites` gating NOT DIRECTLY VERIFIED di browser. Phase 4.1 browser gate A–L PASS; cache/pending saat offline dan pemulihan dua stream saat reconnect DIRECTLY VERIFIED. Map/Stats Phase 4.2 browser gate A–L PASS/NDV terbatas; future emergency dan `0,0` tidak langsung diverifikasi di browser, tetapi tercakup tes otomatis. Provisioning/registri Phase 4.3 selesai untuk scope terpilih. Phase 4.4A deployment Relawan selesai untuk scope terpilih dengan H/K limitations; 4.4B Resource Management tetap planned. Adjustment Risk/Function, hidrasi History lintas browser, hardening idempotensi PFA, dan validasi klinis tetap pekerjaan terpisah.

---

## 1. Ringkasan Eksekutif

Perubahan terbaru telah menutup gap terbesar pada versi awal, yaitu tidak adanya identitas penyintas. `PatientLookupPage.jsx` sekarang sudah menyediakan validasi NIK, pencarian lokal IndexedDB, pencarian Firestore saat online, pendaftaran pasien baru, riwayat asesmen, dan percabangan pasien baru/lama.

Phase 0A menambahkan assessment context yang menyimpan NIK pasien selama alur triase legacy dan menulis `patientNik` secara eksplisit pada kasus. Rute triase tanpa asesmen aktif sekarang kembali ke Patient Lookup.

Tombol **Triase Baru** pada bottom navigation menuju `/relawan/patient-lookup`. Source Phase 0B menambahkan retry pasien dan kasus. Firebase, cache offline, startup/reconnect, dan alur demo telah lulus smoke test manual; migrasi v2 berisi data belum diuji runtime.

Phase 1A menjadikan `cases` store rekam asesmen longitudinal bertipe (`recordType`, `protocolVersion`, `responses` ber-ID item stabil) tanpa menaikkan Dexie v4. PFA dapat disimpan sebagai record bertipe tanpa zona; pembaca legacy hanya mengenali zona yang valid. Sinkronisasi cloud seluruh kasus yang memiliki `patientNik` menunggu pasien aman/synced; record bertipe hanya mendapat lokasi jika pasangan koordinat diketahui dan valid. Pemeriksaan manual browser/runtime PASS untuk regresi simpan legacy verbal/non-verbal, PFA offline→reconnect/cloud tanpa zona/lokasi palsu, tampilan Relawan/Admin, dan eksklusi PFA dari agregat zona. Vitest PASS untuk kontrak record, serializer, urutan pasien→kasus, ID Firestore, dan koordinat; urutan pasien→kasus belum diklaim diuji manual di browser.

### Milestone berikutnya

1. **Phase 3.2 — Role 2 Faskes / PSC 119:** penerimaan T0-Suspect real-time dan gate dua browser Phase 3.1 PASS. Foundation source 3.2A tersedia; UI 3.2B dan browser smoke A-L PASS untuk scope terpilih di bawah Test Mode Rules. Otorisasi backend runtime belum diuji dan restricted Rules belum deployed.
2. **Hardening terpisah:** hidrasi/tampilan `/relawan/history` lintas browser dan idempotensi penyelesaian PFA tetap terbuka. Keterbatasan akurasi Whisper lokal juga belum diselesaikan.
3. Migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED** sebagai batas validasi kompatibilitas; kode migrasi dipertahankan.

---

## 2. Fitur yang Sudah Terimplementasi (✅)

| # | Fitur | File Terkait | Status Aktual |
|---|---|---|---|
| 1 | Firebase Auth Email/Password | `src/contexts/AuthContext.jsx`, `src/pages/LoginPage.jsx` | Berfungsi untuk akun yang memiliki profil Firestore |
| 2 | Protected Routes & RBAC dasar | `src/components/ProtectedRoute.jsx`, `src/App.jsx` | Mendukung role `relawan`, `nakes`, dan `admin`; backend Rules baru tersedia lokal, belum deployed |
| 3 | Speech-to-Text browser | `src/hooks/useSpeechToText.js` | Input suara live ketika browser mendukung Web Speech API |
| 4 | Offline Whisper prototype | `src/hooks/useOfflineWhisper.js`, `src/workers/whisperWorker.js` | Model Whisper Tiny dijalankan melalui Transformers.js/Web Worker dengan browser cache |
| 5 | Jalur Verbal legacy berbasis NLP keyword | `src/pages/relawan/VerbalPage.jsx`, `src/lib/scoring.js`, `src/lib/keywords.js` | Berfungsi sebagai triase prototype lama; belum SRQ-20 |
| 6 | Jalur Non-Verbal legacy 8-butir | `src/pages/relawan/NonVerbalPage.jsx` | Checklist observasi sudah clickable dan menghasilkan zona lama |
| 7 | Offline-first penyimpanan `cases` | `src/lib/db.js`, `src/lib/sync.js` | Kasus selalu disimpan lokal terlebih dahulu |
| 8 | Auto-sync pasien dan `cases` saat startup/reconnect | `src/hooks/useOfflineSync.js`, `src/lib/sync.js`, `src/lib/patients.js` | Pasien pending diproses lebih dulu; startup/reconnect pasien PASS di browser |
| 9 | Indikator online/offline dan pending sync | `src/components/layout/RelawanLayout.jsx` | Banner offline, counter pending, dan sync toast tersedia |
| 10 | Dashboard Admin — Phase 4.1 | `src/pages/admin/DashboardPage.jsx`, `src/lib/adminReadModel.js` | Live cases/emergencies, T0 aktif, SRQ per NIK, rolling 30-day; automated dan browser A–L PASS |
| 11 | Admin — Browser Kasus | `src/pages/admin/CasesPage.jsx` | PFA/SRQ persisted/legacy, filter/detail dan warning malformed; browser A–L PASS |
| 12 | Admin — Statistik | `src/pages/admin/StatsPage.jsx` | Phase 4.2 modern Stats PASS/NDV terbatas: SRQ current, rolling trend, downgrade, legacy, dan kualitas data terpisah |
| 13 | Admin — Peta Geospasial | `src/pages/admin/MapPage.jsx` | Phase 4.2 Leaflet map PASS/NDV terbatas: koordinat aktual SRQ/T0 tanpa fallback atau jitter |
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
- Pasien baru masuk `/relawan/pfa` setelah registrasi. Pasien terdaftar dengan PFA bertipe valid kini masuk `/relawan/srq20`; tanpa record PFA valid, aturan lanjut PFA akut dan verifikasi riwayat cloud tetap berlaku.
- Cabang fase lanjutan dan resume NIK/sesi yang sama lulus smoke test browser Phase 2C. SRQ selesai berikutnya membuat record baru untuk NIK yang sama; tidak ada interval asesmen ulang yang ditentukan.

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
- Hanya record PFA bertipe valid dalam riwayat menjadi bukti penyelesaian, termasuk yang belum tersinkron. Pasien terdaftar tanpa record tersebut melihat `PFA belum selesai` bila riwayat cloud telah diverifikasi, atau bila asesmen akut untuk NIK yang sama masih aktif; asesmen aktif/draf pasien dan sesi yang sama dapat dilanjutkan. Pasien lain memerlukan pembatalan eksplisit sebelum memulai aksi yang valid; pembatalan menghapus asesmen/draf, sedangkan pasien tetap terdaftar. Setelah PFA selesai, lookup menampilkan `PFA telah selesai` dan menuju SRQ-20. Retest browser Phase 1B percabangan, resume, dan pembatalan **PASS**; routing produksi Phase 2C juga **PASS** pada smoke browser terpilih.
- Perbaikan pre-merge: logout menghapus draf PFA bersama asesmen aktif, tanpa menghapus pasien IndexedDB atau kasus selesai/pending; login ulang tidak memulihkan draf. Patient Lookup membedakan riwayat cloud yang berhasil diverifikasi dari kueri server yang gagal atau mode offline. PFA lokal bertipe valid tetap membuktikan selesai walau cloud tidak terverifikasi; Browser B saat online tetap mengenali PFA bertipe selesai dari Browser A. Asesmen akut aktif untuk NIK yang sama dapat dilanjutkan offline dengan sesi/jawaban semula. Tanpa bukti selesai maupun asesmen aktif, hanya verifikasi cloud yang berhasil mengizinkan PFA baru; status tidak terverifikasi hanya menawarkan `Coba Lagi`, tanpa aksi PFA atau fallback lanjutan. Seluruh retest browser pre-merge terarah ini **PASS**; belum ada suite E2E penuh.
- Operasi IndexedDB pasien/PFA saat offline berhasil. Refresh `npm run dev` dengan Chrome DevTools Offline menghasilkan `ERR_INTERNET_DISCONNECTED`, batas pengujian development server; refresh offline dengan bundle produksi `npm run build` + `npm run preview` berhasil melalui PWA/service worker. Ini bukan cacat PWA produksi dan belum membuktikan seluruh skenario offline lewat E2E.

### ⚠️ E. Triage Scoring

- Jalur triase legacy eksplisit tetap memakai **merah/kuning/hijau** dari `analyzeTranscript()` dan `analyzeChecklist()`; alur longitudinal produksi kini menghasilkan T1/T2/T3 melalui SRQ-20.
- Index `tier` pada Dexie menyimpan tier SRQ selesai. T0-Suspect tetap event Red Flag terpisah, belum klasifikasi kasus SRQ.
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
- Penerimaan live read-only oleh Role 2 ditambahkan pada Phase 3.1 dan lulus smoke browser dua sesi tanpa refresh. Konfirmasi/override scoring reguler belum diimplementasikan; keputusan Faskes adalah Phase 3.2.

### Screen 5 — SRQ-20 Terstruktur

- `src/protocols/srq20Protocol.js` menyediakan 20 ID stabil dengan teks `[Template]` **provisional**; validasi dan base scoring sudah ada. Ambang T3 0–5, T2 6–10, T1 11–20 mengikuti spesifikasi prototipe pada `workflow.md`, bukan validasi klinis final.
- `Srq20Page.jsx` tersedia di `/relawan/srq20` untuk asesmen `lanjutan` milik Relawan aktif. Dua mode input berbagi `srqResponses`; 20 jawaban Ya/Tidak harus eksplisit dan yang hilang terlihat belum dijawab. Draf memulihkan mode/jawaban antar layar dan refresh.
- STT dan Whisper lokal hanya membantu transkrip sementara yang dapat diedit; tidak ada auto-check dari teks karena pemetaan keyword untuk protokol template belum disepakati. Relawan menentukan seluruh jawaban terstruktur secara manual.
- Smoke test browser Phase 2B menjalankan Whisper lokal, tetapi hasilnya tidak akurat untuk satu kalimat bahasa Indonesia yang diuji; ini keterbatasan kualitas bantuan transkripsi, bukan blocker atau perubahan scoring SRQ. STT browser langsung mentranskripsi kalimat yang sama dengan benar.
- Tooltip edukasi per pertanyaan belum ada.

### Screen 6 — Risk Factor & Daily Function

- `RiskFactorPage.jsx` tersedia di `/relawan/risk-factor`, dengan dua bagian terpisah dari protokol: masing-masing empat butir `[Template]` **provisional**. Akses memerlukan draf valid dan 20 SRQ lengkap; delapan jawaban harus eksplisit sebelum cek kesiapan.
- Selesai Screen 6 menyimpan draf raw lengkap lalu membuka Screen 7. Form yang belum lengkap tetap menampilkan error. Screen 6 tidak menyimpan kasus.
- Algoritme adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED**. `classification-prototype-v1` memerlukan kedua checklist lengkap tetapi sengaja menghasilkan `finalTier === baseTier`; tidak ada bobot atau `riskFactorScore` buatan.

### Screen 7 — Hasil SRQ T1/T2/T3

- `LongitudinalResultPage.jsx` menampilkan hasil dari draf lengkap terikat sesi, termasuk setelah reload, dan menyimpan record SRQ bertipe melalui `saveCase()` lokal lebih dulu. Hasil `synced: false` tetap dianggap simpan lokal berhasil. History Relawan pada browser yang sama menampilkan tier, skor, dan mode.
- `ResultPage.jsx` tetap menampilkan zona merah/kuning/hijau untuk triase legacy eksplisit. T0-Suspect tetap mekanisme emergency terpisah.
- Algoritme adjustment Risk/Function **NOT DEFINED / NOT IMPLEMENTED**; v1 sengaja menghasilkan tier akhir sama dengan tier dasar. Smoke test browser Phase 2C Screen 7, simpan online/offline, dan reconnect **PASS** untuk scope terpilih; ini bukan validasi klinis atau suite E2E penuh.

### Role 2 — Tenaga Kesehatan / Faskes / PSC 119

**Phase 3.1 selesai untuk scope prototipe terpilih: source, tes otomatis, dan smoke browser PASS:**
- Role `nakes` dari profil Firestore, guard dan login ke `/faskes`, shell Faskes, serta antrean read-only `onSnapshot` pada `emergencies` tersedia. Registrasi publik hanya Relawan; Admin/Nakes demo diprovisi manual pada Firebase Auth dan `users/{uid}`.
- Setiap dokumen cloud diparsing sendiri. Firestore `timestamp` adalah waktu asal wajib dan dikonversi ke ISO sebelum validasi origin strict; `createdAt` dan metadata tambahan ditoleransi sebagai field cloud, bukan kontrak origin. Dokumen malformed ditampilkan sebagai jumlah/ID yang ditolak sementara event valid tetap terlihat. Tampilan antrean menangani cache/offline, error listener, dan retry manual.
- Retry Relawan memakai ID tersimpan dan `setDoc(..., { merge: true })` sehingga field cloud lain tidak terhapus pada retry normal. **Merge bukan otorisasi backend tingkat field.** Jalur read emergency Nakes lulus uji runtime Phase 3.1. Deployed Firestore Security Rules untuk write workflow Phase 3.2 tetap **NEEDS VERIFICATION**, termasuk penetapan role, create/retry field origin Relawan, dan update field workflow hanya oleh Nakes.
- **Gate browser Phase 3.1 PASS:** akun/profil Nakes dan isolasi route tiga role bekerja; T0-Suspect linked dan anonim diterima pada sesi Faskes terpisah melalui `onSnapshot` tanpa refresh, dengan detail origin benar, urutan terbaru, dan tanpa duplikat. Offline Relawan→reconnect mengunggah satu emergency; dokumen malformed dilaporkan terpisah dan peringatannya hilang setelah dokumen dihapus tanpa refresh. Tampilan Faskes offline/cache/reconnect, registrasi publik Relawan saja, serta login Relawan/Admin lama juga PASS. Jalur read emergency Nakes teruji runtime. Ini smoke browser terpilih, bukan suite E2E penuh atau verifikasi backend field-level authorization.

**Phase 3.2A source tersedia lokal, gate keamanan belum lulus:** Rules eksplisit, `firebase.json`, schema workflow, parser warning, transaksi validasi write-once, dan transisi referral berurutan sudah dibuat. Origin `t0-suspect` tetap terpisah; metadata workflow malformed tidak menghilangkan origin valid. Restricted Rules compile **PASS** dan basic read-role Playground matrix **PASS**, tetapi Relawan emergency-create Playground **FAIL / unresolved**; restricted Rules deployed **NO**, runtime authorization verification **NOT PERFORMED**, dan final security hardening gate **REQUIRED**. Test Mode masih aktif sementara. Automated emulator Rules tests tidak dilakukan. Client Admin tidak lagi dapat menjalankan seed; fixture lama tetap data referensi.

**Phase 3.2B COMPLETE / PASS untuk selected prototype scope:** detail `/faskes/emergencies/:id` memakai listener satu dokumen dengan metadata; UI menampilkan origin, riwayat server-only, simulasi Tele-Emergency, keputusan final, dan langkah referral berikutnya. Aksi menunggu snapshot server sehat dan dinonaktifkan saat offline/cache/error/workflow rusak. `npm test` **295/295 PASS** (17 file), lint/build/diff-check PASS dengan warning lama, dan browser smoke A-L **PASS** di bawah Test Mode Rules. Gate browser membuktikan antrean live tanpa refresh, detail route benar, origin T0-Suspect tetap immutable, validasi T0/T1/T2 persisted, referral dua sesi Nakes berurutan, konflik `already-decided`/`stale-transition` converge ke listener state, offline/cache memblokir workflow writes, refresh detail pulih dari Firestore, workflow malformed mempertahankan origin dengan warning, riwayat linked server-only tampil, dan emergency anonim tidak memuat riwayat. Listener error callback nyata dan `hasPendingWrites` gating **NOT DIRECTLY VERIFIED** di browser. Browser notification/audio dipindah ke Phase 3.2C. Hasil ini bukan full E2E dan bukan verifikasi restricted Rules atau backend authorization.

### Role 3 — Fitur Lanjutan

- Real-time listener `onSnapshot`.
- Banner T0 aktif.
- Filter Fase Akut vs Lanjutan.
- Longitudinal patient table 30 hari.
- Export PDF/Excel.
- Resource/volunteer management yang disebut di workflow.

### Data Demo dan Migrasi Tier

- `src/lib/seed.js` sekarang hanya fixture historis kasus legacy merah/kuning/hijau; tidak ada fungsi tulis browser. Dokumen demo yang sudah ada tetap dapat dibaca.
- Pada Phase 0C, seeding browser memastikan Budi dan satu riwayat linked; seed berulang serta kedua cabang preset saat itu lulus smoke test manual. Provisioning baru sekarang memerlukan jalur berprivilege di luar aplikasi.
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

4. **Preset “Pasien Lama” bukan data seed — selesai pada Phase 0C, smoke test PASS saat itu.**
   Dataset Phase 0C memastikan Budi dan satu kasus terkait melalui `patientNik`; Siti sengaja tidak diseed. Sejak Phase 3.2A, tombol seed browser telah dihapus.

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

10. **Login selalu menuju `/relawan` — pernyataan historis, sudah diperbaiki Phase 3.1.**
    Role `relawan`, `nakes`, dan `admin` kini menuju `/relawan`, `/faskes`, dan `/admin` sesuai profil Firestore. Guard rute bukan batas otorisasi backend.

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
| **2C selesai untuk scope terpilih** | Screen 7, save flow, routing pasien lama ke SRQ, History lokal | Source, 216/216 tes otomatis, dan smoke browser A–J PASS; belum full E2E |
| **Hardening terbuka** | Hidrasi/tampilan `/relawan/history` lintas browser | Firestore menyimpan kasus, tetapi History masih membaca Dexie lokal |
| **P3.1 selesai untuk scope terpilih** | Faskes Foundation + Real-Time Emergency Reception | Source, tes otomatis, dan smoke browser dua sesi PASS; rules write Phase 3.2 masih perlu verifikasi |
| **P3.2A source lokal; gate keamanan terbuka** | Security + Workflow Write Foundation | Compile/read-role Playground PASS; emergency-create FAIL / unresolved; restricted Rules belum deployed; otorisasi runtime belum diuji |
| **P3.2B COMPLETE / PASS untuk scope terpilih** | Faskes workflow UI | Source, 295/295 tes otomatis, dan browser smoke A-L PASS di bawah Test Mode Rules; bukan verifikasi backend authorization |
| **P4.1 COMPLETE / PASS untuk scope terpilih** | Admin read model + command center | Source, 320/320 tes, dan browser gate A–L PASS di Test Mode |
| **P4.2 COMPLETE / PASS untuk scope terpilih** | Modern geospatial/analytics | Source, 336/336 tes otomatis, dan browser A–L PASS/NDV terbatas; future emergency dan `0,0` tidak langsung browser-verified tetapi tercakup automated tests |
| **P4.3 COMPLETE / PASS untuk scope terpilih** | Provisioning client terisolasi + registri RS | 370/370 tes; browser A–L PASS di Test Mode dan restricted Rules belum deployed |
| **P5** | Export, PWA assets, polish | Demo hardening setelah core flow tidak memiliki dead end |

---

## 8. Kesimpulan Audit

Snapshot sebelum 0B memiliki Screen 2 dan Dexie v2; Phase 0A kemudian menjaga patient context. Source Phase 0B menangani keunikan NIK, sinkronisasi pasien, konflik data, dan retry kasus yang idempoten. Source Phase 0C memperbaiki seed demo Siti/Budi. Phase 1B menyediakan jalur PFA khusus; Phase 2B menambahkan UI SRQ-20 dan Risk/Function di rute terjaga. Phase 2C menghubungkan routing produksi, Screen 7, simpan SRQ bertipe, dan tampilan History lokal. Smoke browser A–J Phase 2C **PASS** untuk scope terpilih.

Smoke test manual menemukan overlap header Relawan, kelemahan pemulihan profil saat refresh offline, dan konflik duplikasi cloud yang tetap memblokir pencarian setelah data diperbaiki. Perbaikan source untuk ketiganya telah dibuat dan retest browser mengonfirmasi **PASS**. Cache pasien offline, sinkronisasi startup/reconnect, baseline v4 bersih, serta seed dan cabang Siti/Budi juga **PASS**.

Data prototipe lama sengaja direset; `users` Firestore dipertahankan, sedangkan data pasien/kasus dan site data browser dibersihkan. Aplikasi dimulai dari Dexie v4 bersih lalu seed demo dijalankan ulang. Karena itu, migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED**; kode migrasi telah ditinjau dari source dan tetap menjadi perlindungan kompatibilitas.

Phase 0 dan hasil validasi terpilih Phase 1A/1B tetap sebagaimana tercatat. Phase 1C menyediakan FAB Red Flag, event `t0-suspect`, dan sinkronisasi emergency; smoke test browser Phase 1C **PASS**. Phase 2A menyediakan kontrak SRQ-20, Risk/Function, draf, scoring, dan validasi record. Phase 2B menambahkan Screen 5/6; smoke browser A–H tetap PASS dengan limitasi akurasi Whisper lokal pada C. Phase 2C menghubungkan flow produksi dan record SRQ selesai; tes otomatis tahap itu **216/216 PASS** (9 file), dan smoke browser A–J **PASS** untuk scope terpilih. Gate Phase 2 `lookup → SRQ-20 → Risk/Function → T1/T2/T3 → save → History lokal` telah dijalankan di browser.

Phase 3.1 menambahkan Role 2 Nakes, antrean emergency read-only real-time, parser cloud per dokumen, dan retry Relawan merge-safe; gate historisnya `npm test` **222/222 PASS** (11 file) dan smoke browser dua sesi **PASS**. Phase 3.2A menambahkan foundation keamanan dan transaksi; Rules compile dan basic read-role Playground **PASS**, tetapi emergency-create **FAIL / unresolved**, restricted Rules belum deployed, dan otorisasi runtime belum diuji. Phase 3.2B menambahkan UI Faskes dan sekarang **COMPLETE / PASS untuk selected prototype scope**: source implementation complete, `npm test` **295/295 PASS** (17 file), lint/build/diff-check PASS dengan warning lama, dan browser smoke A-L PASS di bawah Test Mode Rules. Hasil ini memverifikasi immutable T0-Suspect origin, workflow secondary validation/referral dua sesi Nakes, dan boundary riwayat Faskes server-only untuk scope terpilih; listener error callback nyata dan `hasPendingWrites` gating **NOT DIRECTLY VERIFIED** di browser. Tes Rules emulator otomatis **NOT PERFORMED**. Adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED** sehingga v1 tetap `finalTier === baseTier`; klasifikasi SRQ/Risk-Function serta wording protokol/klinis belum divalidasi klinis. Hidrasi `/relawan/history` lintas browser, hardening idempotensi PFA, dan suite E2E penuh tetap terbuka; migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**. T0 tetap event Red Flag terpisah dan triase legacy tetap kompatibel; Admin Phase 4.1 kini COMPLETE/PASS untuk scope prototipe terpilih; browser gate A–L PASS di bawah Test Mode. Map/Stats modern Phase 4.2 kini COMPLETE/PASS untuk scope prototipe terpilih dengan 336/336 tes otomatis dan browser A–L PASS/NDV terbatas; future emergency, `0,0`, one-coordinate-only map, zero-coordinate map, dan empty-SRQ view tidak langsung diverifikasi di browser, sedangkan future emergency dan `0,0` tercakup automated tests. Provisioning client terisolasi + registri RS Phase 4.3 COMPLETE/PASS untuk scope terpilih; browser A–L PASS di Test Mode. Phase 4.4A Volunteer Deployment Management COMPLETE/PASS untuk scope terpilih dengan 377/377 tes, lint/build/diff-check PASS, dan browser A–L PASS/PASS WITH LIMITATION; synthetic T0 future-activity scope dan listener-error callback caveat tetap dicatat.

### Phase 4.1 — Admin Read Model + Real-Time Command Center

**COMPLETE / PASS untuk selected prototype scope.** Proyeksi Admin murni menerima snapshot `cases` dan `emergencies`, memisahkan dokumen malformed, mempertahankan origin T0 valid ketika workflow rusak, dan membaca skor/base tier/final tier SRQ yang tersimpan tanpa recompute. Metrik tier memilih SRQ bertanggal terbaru yang `<= now` sekali per NIK (tie: ID dokumen leksikografis). Catatan masa depan tetap di riwayat, tidak menjadi SRQ/asesmen/snapshot pasien terkini, dan dihitung sebagai peringatan kualitas data. Downgrade Nakes T1/T2 dan zona merah/kuning/hijau legacy dilaporkan terpisah. Jumlah pasien berarti NIK valid unik yang teramati dalam kasus. Rolling 30-day berdasarkan timestamp asesmen persisted mencakup tepat 30 hari lalu sampai waktu referensi inklusif; catatan lebih lama dan waktu masa depan tidak masuk. Tidak ada asumsi day-zero atau lokasi fallback.

Dashboard memakai dua listener Firestore independen dengan status loading/cache/pending/error dan perhatian T0 yang tetap terlihat saat filter asesmen berubah. CasesPage modern menampilkan hasil SRQ tersimpan dan catatan PFA/legacy. `MapPage.jsx`/`StatsPage.jsx` kemudian dimigrasi pada Phase 4.2. `npm test` **320/320 PASS (18 file)**, lint/build **PASS** dengan warning lama; diff-check di luar `docs/workflow.md` **PASS**, tetapi full `git diff --check` gagal karena whitespace pada perubahan workflow milik pengguna yang dipertahankan. Gate browser Phase 4.1 A–L **PASS**: PFA/SRQ live dan persisted, SRQ berulang/current per pasien, refresh, future/malformed isolation, T0 live/confirmed/completed, downgrade Nakes terpisah dari SRQ, workflow malformed mempertahankan origin, serta filter/detail Cases. Offline cache/pending dan reconnect dua stream **DIRECTLY VERIFIED** di browser; listener error callback nyata **NOT DIRECTLY VERIFIED**. Ini validasi aplikasi/demo di Test Mode, bukan full E2E atau otorisasi backend. Phase 4.2 geospatial/analytics kini COMPLETE/PASS untuk scope prototipe terpilih; Phase 4.3 provisioning client terisolasi + registri RS **COMPLETE / PASS untuk scope terpilih**; hospital-aware referral routing menyusul registri. Caveat lama tetap: tidak ada suite E2E penuh, migrasi Dexie v2 berisi data → v4 NOT RUNTIME TESTED, hidrasi Relawan History lintas browser terbuka, restricted Rules belum deployed dan otorisasi runtime belum diverifikasi, Test Mode tidak aman, serta protokol/klasifikasi klinis provisional.

### Roadmap dan UX Admin setelah Phase 4.1

| Fase | Status / cakupan |
|---|---|
| 4.1 — Admin Read Model + Real-Time Command Center | COMPLETE / PASS untuk scope prototipe terpilih |
| 4.2 — Modern Geospatial + Analytics | COMPLETE / PASS untuk scope terpilih: Map/Stats dari read model, provenance terpisah, tanpa koordinat fabrikasi; browser A–L PASS/NDV terbatas |
| 4.3 — Admin Provisioning + Hospital Registry | COMPLETE / PASS untuk scope terpilih; browser A–L PASS di Test Mode |
| 4.4 — Volunteer / Resource Management | 4.4A deployment COMPLETE/PASS for selected prototype scope; 4.4B resources PLANNED; whole phase incomplete |
| 5.1 — Organization/Hospital-Aware T0 Routing | PLANNED, setelah registri |
| 5.2 — SRQ Item 17 + STT Safety Automation | PLANNED |
| 5.3 — Real Day 1–30 Monitoring Semantics | PLANNED |
| 5.4 — Export / Reporting | PLANNED |
| 5.5 — PWA / Demo Hardening | PLANNED; Admin UX redesign/polish menyeluruh |

UI Admin 4.1 tervalidasi fungsional tetapi **bukan UX final**. Riwayat longitudinal kini memadatkan beberapa SRQ dalam satu row/sel; perbaikan berikutnya perlu memisahkan current state, full history, rolling-window history, dan anomali data, serta memperbaiki responsive/table density dan hierarki/konsistensi visual. UI fungsional Map/Stats termasuk 4.2; redesign Admin menyeluruh termasuk 5.5.

### Phase 4.2 — Modern Geospatial + Analytics

**COMPLETE / PASS untuk selected prototype scope.** Map/Stats kini memakai read model modern dan listener metadata kedua koleksi. SRQ map hanya latest eligible per NIK dengan koordinat record itu sendiri; T0 map hanya event aktif bertanggal tidak melewati `now`. Bucket menggunakan pasangan koordinat aktual, termasuk `0,0`; tidak ada fallback posko atau jitter. Donut SRQ current menghitung pasien, sedangkan tren rolling 30 × 24 jam inklusif menghitung asesmen historis berulang per tanggal UTC dan tier persisted. Downgrade Nakes serta triase legacy ditampilkan terpisah. Warning mencakup malformed case/origin/workflow, undated/future case, future emergency, dan current SRQ/T0 tanpa koordinat.

`npm test` **336/336 PASS (18 file)**; lint **PASS** dengan 7 warning lama; build **PASS** dengan warning dependency `eval`/bundle lama. Browser gate A–L dilakukan di sesi Admin, Relawan, dan Nakes terpisah melalui UI normal. A, B, C, D, E, F, H, J, K, dan L **PASS**. Gate G **PASS** untuk koordinat valid dan koordinat hilang; subcase `0,0` **NOT DIRECTLY VERIFIED** di browser. Gate I future emergency **NOT DIRECTLY VERIFIED** karena tidak ada fixture aman dan tidak dilakukan direct backend write untuk memanufaktur state. Map rendering, bucket koordinat, marker popup, donut SRQ, rolling chart, reload tanpa runtime exception, cache/pending warning saat offline, dan pemulihan live setelah reconnect teramati PASS. Future emergency dan `0,0` tetap dicakup tes otomatis. One-coordinate-only map, zero-coordinate map, dan empty-SRQ view belum diverifikasi langsung di browser. Tidak ada verifikasi backend authorization atau Rules emulator. Restricted Firestore Rules belum deployed; emergency-create Rules Playground masih FAIL/unresolved, sehingga Test Mode bukan bukti keamanan backend. Full E2E, migrasi Dexie v2 berisi data → v4, validasi klinis wording/klasifikasi, Risk/Function adjustment, History Relawan lintas browser, dan idempotensi PFA masih terbuka. Redesign Admin menyeluruh tetap Phase 5.5.

### Phase 4.3 — Admin-Provisioned Accounts + Hospital Registry

**COMPLETE / PASS FOR SELECTED PROTOTYPE SCOPE.** Login universal menjadi satu-satunya auth publik. Admin memakai halaman terpisah `/admin/relawan` dan `/admin/nakes`; halaman Nakes juga mempertahankan lookup UID serta edit membership. Kredensial baru dibuat melalui Firebase Web Auth kedua bernama `admin-account-provisioning` dengan persistensi memori, sedangkan profil ditulis oleh Firestore app utama dalam sesi Admin. Setelah penulisan, sesi sementara ditutup; kegagalan profil memicu percobaan penghapusan Auth baru. Tidak ada halaman atau helper pembuat Admin. Registri `healthcareOrganizations/{organizationId}` tetap menyimpan ID stabil, nama, tipe hospital, status aktif/nonaktif, kelayakan rujukan T0 terpisah, alamat/koordinat pasangan opsional, dan audit. Nakes menunjuk RS lewat `organizationId`; tanpa ID berarti belum ditugaskan. Tidak ada seed RS, routing T0 tetap Phase 5.1, dan workflow Phase 3 tidak memerlukan tujuan RS.

Browser Gate A awal mengungkap asumsi registrasi publik yang salah; setelah koreksi source, gate revisi A–L **PASS** pada deployed Test Mode. Gate mencakup login/isolasi role, pembuatan Relawan/Nakes tanpa kehilangan sesi Admin, Posko, registri satu RS, koordinat `0,0`/parsial/absen, membership UID, identitas RS Faskes, regresi T0/referral, dan batas tanpa Cloud Function. Observasi UI E/F **resolved**: ID internal RS dihapus dari UI normal; form reset setelah save sukses dan menampilkan status berhasil. Source Rules hanya mengizinkan Admin membuat profil Relawan/Nakes. Browser Test Mode memverifikasi perilaku aplikasi/demo saja. Restricted source Rules belum deployed; Relawan emergency-create Playground **FAIL/unresolved**; otorisasi runtime belum diverifikasi; emulator Rules tests belum ada; Test Mode bukan bukti keamanan backend; suite E2E penuh belum ada. Firebase Email/Password signup tetap dapat dipanggil di luar UI Admin; backend tepercaya/Admin SDK diperlukan untuk produksi. Migrasi Dexie v2 berisi data ke v4 belum runtime-tested, History Relawan lintas browser, idempotensi PFA, wording/klasifikasi klinis provisional, Risk/Function adjustment undefined, dan SRQ/STT safety automation tetap terbuka. Phase 4.4A kini selesai untuk scope terpilih; Phase 4.4B dan routing RS Phase 5.1 tetap masa depan.

### Phase 4.4A — Volunteer Deployment Management (COMPLETE / PASS for selected prototype scope)

Roster Admin membaca hanya profil `users` dengan `role == 'relawan'` melalui `onSnapshot` dan metadata. Profil malformed diisolasi; cache, pending write, offline, dan listener error tidak dianggap state operasional server-confirmed. Transaksi assignment mengubah hanya `poskoName`, `poskoLat`, `poskoLng` dari `DEMO_POSKOS` pada profil Relawan existing. Riwayat PFA/SRQ/T0 dan snapshot Posko lama tidak ditulis ulang. Source Rules mendukung query role terbatas dan update assignment Admin yang struktural, tetapi belum deployed atau diuji lewat emulator.

Automated/source checks: **377/377 PASS (22 file)**; lint PASS dengan 6 warning lama; build PASS dengan warning dependency `eval`/bundle lama; `git diff --check` PASS. Browser gate eksternal di Chrome/CDP deployed Test Mode: A Route/RBAC **PASS**; B Relawan-only roster **PASS**; C provisioning regression/live roster **PASS**; D reassignment persistence **PASS**; E identity immutability **PASS**; F runtime Relawan profile **PASS**; G historical Posko preservation **PASS**; H future activity **PASS WITH LIMITATION** karena synthetic Red Flag/T0-Suspect dibuat melalui UI normal dan muncul di Admin Command Center dengan Posko terkini, tanpa klaim seluruh PFA/SRQ flow; I second Admin real-time **PASS**; J offline/cache write guard **PASS**; K reload/listener stability **PASS WITH LIMITATION** karena reload/no-duplicate/server-confirmed/no-exception/usable controls terverifikasi, tetapi listener error callback nyata **NOT DIRECTLY VERIFIED**; L regression boundary **PASS**.

Deployed Test Mode bukan bukti otorisasi backend; runtime restricted-Rules authorization belum diuji; Rules emulator tests belum dilakukan; source restricted Rules belum deployed. Phase 4.4B Resource Management masih planned, sehingga Phase 4.4 belum complete. Hospital-aware T0 routing tetap Phase 5.1. Emergency-create Playground, validasi klinis, History lintas browser, idempotensi PFA, migrasi Dexie populated v2→v4, dan full E2E tetap gap.
