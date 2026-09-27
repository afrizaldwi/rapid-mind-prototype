# Catatan Perubahan & Implementasi: Track A.1 (Identitas Penyintas & Auto-Lookup)

> **Dokumen:** Implementation & Changelog Notes  
> **Ruang Lingkup:** Track A — Poin 1 (Screen 2: Identitas Penyintas & Auto-Lookup System)  
> **Tanggal:** 25 September 2026  
> **Status:** Phase 2C selesai untuk scope prototipe terpilih: source, 216/216 tes otomatis, dan smoke test browser A–J **PASS**. Hasil smoke test Phase 0/1 dan Phase 2B tetap sebagaimana tercatat. Belum ada suite E2E penuh. Migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**.
---

## 1. Ringkasan Eksekutif

Pada tahap ini, kita telah mengimplementasikan **Screen 2 (Identitas Penyintas & Auto-Lookup System)** sesuai dengan spesifikasi di `docs/workflow.md` dan `docs/plan.md`. 

Sebelum perubahan ini, alur utama relawan langsung diarahkan ke pemilihan metode triase tanpa pencatatan identitas penyintas, sehingga belum tersedia fondasi untuk menghubungkan asesmen dengan rekam longitudinal penyintas. Setelah perubahan ini, alur utama dari HomePage telah diarahkan melalui verifikasi NIK menggunakan mekanisme pencarian otomatis (*auto-lookup*) dua arah (offline-first melalui IndexedDB dan online via Firestore). Penegakan identifikasi pasien pada seluruh jalur masuk asesmen dan propagasi identitas pasien hingga hasil akhir akan diselesaikan pada Phase 0 (Integration Hardening).

---

## 2. Rincian Berkas yang Dibuat / Dimodifikasi

### A. Berkas Baru yang Dibuat

#### 1. `src/pages/relawan/PatientLookupPage.jsx` [NEW]
* **Fungsi Utama:**
  Halaman antarmuka relawan untuk identifikasi penyintas (Screen 2) sebelum memulai intervensi PFA atau Wawancara SRQ-20.
* **Fitur-Fitur yang Diimplementasikan:**
  1. **Validasi Format NIK:** Input hanya menerima angka maksimal 16 digit dengan validasi regex (`/^\d{16}$/`), dilengkapi indikator visual kelengkapan digit.
  2. **Mesin Auto-Lookup Dua Tingkat (Offline-First):**
     - **Tingkat 1 (Lokal):** Melakukan kueri ke IndexedDB (`localDb.patients`) berdasarkan NIK. Jika ditemukan di area *blank spot* (tanpa sinyal), data langsung dimuat beserta riwayat triase pasien tersebut (`localDb.cases.where("patientNik").equals(nik)`).
     - **Tingkat 2 (Cloud):** Jika tidak ditemukan di lokal dan perangkat dalam kondisi online, sistem melakukan kueri ke koleksi Firestore `patients` dan mengambil seluruh riwayat asesmen di koleksi `cases`.
  3. **Percabangan Logika Alur Pasien:**
     - **Kasus Pasien Lama (NIK Ditemukan):** Menampilkan kartu profil pasien (Nama, Usia, Jenis Kelamin, Posko) dan riwayat asesmen sebelumnya. Menampilkan tombol aksi utama: *"Lanjutkan ke Wawancara SRQ-20"* (Fase Lanjutan Hari 4–30).
     - **Kasus Pasien Baru (NIK Tidak Ditemukan):** Menampilkan formulir pendaftaran penyintas baru (Nama Lengkap, Usia, Jenis Kelamin toggle L/P). Data disimpan ke IndexedDB lokal (dan Firestore jika online) dengan penanda `phase: "akut"`, lalu diarahkan dengan tombol *"Daftarkan & Mulai PFA"*.
  4. **Simulasi Cepat untuk Demo Juri:**
     - Tombol preset *"Pasien Baru"* (`3201234567890001` - Siti Aminah, 34 thn) dan *"Pasien Lama"* (`3201234567890002` - Budi Santoso, 45 thn) agar pengguna/juri tidak perlu mengetik 16 digit manual saat demonstrasi.

---

### B. Berkas yang Dimodifikasi

#### 2. `src/lib/db.js` [MODIFY]
* **Perubahan yang Dilakukan:**
  Meningkatkan versi skema IndexedDB Dexie dari **versi 1** ke **versi 2**:
  ```javascript
  localDb.version(2).stores({
    cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId, patientNik, tier',
    patients: '++id, nik, nama, poskoName, registeredAt',
    emergencies: '++id, patientNik, relawanId, status, timestamp, synced',
    pendingSync: null // cleanup tabel yang tidak pernah dipakai
  })
  ```
* **Alasan & Latar Belakang:**
  - **Tabel `patients` Baru:** Diperlukan untuk menyimpan direktori penyintas secara lokal di perangkat relawan agar fitur auto-lookup tetap berfungsi 100% saat terjadi pemadaman internet di lokasi bencana.
  - **Index `patientNik` & `tier` pada Tabel `cases`:** Menghubungkan riwayat asesmen dengan identitas unik pasien, serta mempersiapkan transisi skema dari 3-zona ke 4-tier (T0/T1/T2/T3).
  - **Tabel `emergencies` Baru:** Disiapkan untuk menampung antrean krisis T0 Red Flag pada pengerjaan fase berikutnya.
* **Bug / Technical Debt yang Diselesaikan:**
  - **Tabel `pendingSync` Menganggur (Dead Schema):** Di versi 1, tabel `pendingSync` dideklarasikan tetapi tidak pernah dipakai oleh `sync.js` (sinkronisasi langsung menggunakan query `cases.where("synced").equals(0)`). Di versi 2, tabel ini dihapus secara bersih melalui `pendingSync: null` tanpa merusak data kasus yang ada.

#### 3. `src/App.jsx` [MODIFY]
* **Perubahan yang Dilakukan:**
  - Mengimpor komponen `PatientLookupPage`.
  - Menambahkan rute anak di dalam kluster rute terproteksi relawan:
    ```jsx
    <Route path="patient-lookup" element={<PatientLookupPage />} />
    ```
* **Alasan:**
  Mendaftarkan Screen 2 ke dalam hierarki routing aplikasi di bawah pengawasan `ProtectedRoute` (hanya bisa diakses oleh akun dengan role `relawan`).

#### 4. `src/pages/relawan/HomePage.jsx` [MODIFY]
* **Perubahan yang Dilakukan:**
  Mengubah target navigasi pada tombol CTA kartu utama ("Mulai Triase Baru"):
  - *Sebelum:* `<Link to="/relawan/triage">`
  - *Sesudah:* `<Link to="/relawan/patient-lookup">`
* **Alasan:**
  Mengarahkan entry point utama dari HomePage ke alur identifikasi penyintas sesuai `workflow.md`, sehingga proses triase baru dimulai dari pencarian atau pendaftaran NIK. Penutupan jalur navigasi lain yang masih dapat melewati Screen 2 akan dilakukan pada Phase 0 (Integration Hardening).

#### 5. `src/components/layout/RelawanLayout.jsx` [MODIFY]
* **Perubahan yang Dilakukan:**
  Memperbarui kondisi logika variabel `hideBottomNav`:
  ```javascript
  const hideBottomNav = location.pathname.includes('/triage/verbal') || 
                        location.pathname.includes('/triage/nonverbal') || 
                        location.pathname.includes('/triage/result') ||
                        location.pathname.includes('/patient-lookup');
  ```
* **Alasan & Masalah UI yang Dicegah:**
  Halaman `PatientLookupPage` memiliki tombol aksi tetap di bagian bawah (*fixed bottom action bar* untuk mendaftar/melanjutkan). Jika *Bottom Navigation Bar* utama tetap tampil, kedua elemen navigasi akan bertumpuk (*collision/overlap*) dan menutupi tombol submit pada layar smartphone.

---

## 3. Hasil Pengujian & Verifikasi

1. **Pengujian Build Produksi (`npm run build`):**
   - Sukses dikompilasi dengan Vite 8.3 / Rolldown dalam 719ms tanpa error.
   - PWA Service Worker dan Manifest ter-generate dengan benar.
2. **Pengujian Analisis Statis Kode (`npm run lint`):**
   - 34 file diperiksa oleh Oxlint dengan 104 aturan.
   - **Hasil: 0 Error**, 30 warning (hanya unused import bawaan lama di file lain yang tidak tersentuh).

---

## 4. Alur Kerja Pengguna Setelah Perubahan Ini

```
[HomePage Relawan]
        │
        ▼ (Klik "Mulai Triase Baru")
[PatientLookupPage (Screen 2)]
        │
        ├─► [Input NIK / Gunakan Preset Demo] ──► Klik "Cari"
        │
        ├──► NIK Ditemukan (Pasien Lama)
        │       ├── Tampil profil dan riwayat asesmen yang ditemukan
        │       └── Klik "Lanjutkan ke Wawancara SRQ-20"
        │               └──► Saat ini menuju `/relawan/triage` dengan state pasien
        │
        └──► NIK Belum Ada (Pasien Baru)
                ├── Formulir nama, usia, jenis kelamin terbuka
                ├── Data pasien disimpan ke IndexedDB
                └── Klik "Daftarkan & Mulai PFA"
                        └──► Saat ini menuju `/relawan/triage` dengan state pasien

Catatan:
Dedicated PFA dan SRQ-20 flow belum diimplementasikan pada Track A.1. Integrasi routing berdasarkan fase, propagasi patient context sepanjang asesmen, dan eliminasi jalur yang melewati Screen 2 akan dikerjakan pada Phase 0 dan fase implementasi berikutnya.
```

---

## Phase 0A — Assessment Session Integrity (26 September 2026)

- **Entry asesmen wajib melalui Patient Lookup.** Tombol bottom navigation “Triase Baru” menuju `/relawan/patient-lookup`; rute triase legacy tetap tersedia, tetapi seluruhnya dijaga oleh `AssessmentRoute` dan mengarahkan pengguna tanpa asesmen aktif kembali ke Patient Lookup.
- **Identitas pasien dipertahankan sepanjang asesmen.** `AssessmentProvider` mencakup rute Relawan, termasuk lookup, triase, verbal, non-verbal, dan hasil. Lookup memulai asesmen pasien baru (`akut`) setelah penyimpanan lokal berhasil, atau pasien lama (`lanjutan`) dengan riwayat yang ditemukan. Halaman triase membaca pasien dari context, bukan meneruskan identitas melalui route state.
- **Pemulihan dalam tab yang sama.** Context menyimpan asesmen aktif bersama UID Relawan pada `sessionStorage` (`rapidMind.activeAssessment`) dan memulihkannya saat halaman dimuat ulang hanya untuk UID Relawan yang sama. Schema Zod terpusat memvalidasi asesmen baru dan data yang dipulihkan; data tanpa pemilik yang cocok, JSON rusak, atau data tidak valid dibuang dengan aman.
- **Kasus terhubung eksplisit ke pasien.** `ResultPage` menulis `patientNik`, nama, usia, jenis kelamin, dan fase dari context. Data hasil sementara tetap berada pada route state dan diikat ke waktu mulai asesmen agar hasil lama tidak tersimpan untuk pasien yang baru dipilih. Result tanpa payload valid kembali ke pemilihan jalur triase.
- **Pembersihan sesi.** Setelah `saveCase()` berhasil menulis kasus lokal, navigasi menuju Beranda terjadi lebih dulu; asesmen aktif dan entri `sessionStorage` dihapus saat rute Beranda yang tidak dijaga sudah aktif. Jika penyimpanan lokal gagal, asesmen tetap ada. Logout eksplisit Relawan menghapus asesmen sebelum permintaan logout autentikasi.
- **Validasi:** `npm run lint` lulus tanpa error (peringatan kode lama masih ada); `npm run build` berhasil. Jalur langsung, lookup baru/lama, refresh, save sukses/gagal, dan logout ditinjau dari rute serta aliran data di source. Interaksi browser dengan akun Firebase tidak dijalankan pada tahap ini.

Pekerjaan Phase 0 lain seperti keunikan NIK dan sinkronisasi pasien offline masih terbuka. PFA dan SRQ-20 khusus belum diimplementasikan.

Catatan kronologis: pernyataan “interaksi browser tidak dijalankan” di atas berlaku pada saat implementasi 0A ditulis. Pemilik proyek kemudian melaporkan bahwa smoke test manual 0A dilakukan; sesi pengerjaan 0B ini tidak mengulang tes browser tersebut.

---

## Phase 0B — Patient Persistence & Offline Sync Integrity (26 September 2026)

- Dexie v2 dibiarkan utuh. v3 menambah status sinkronisasi dan audit semua row pasien lama yang duplikat atau invalid; duplikat yang ekuivalen menyisakan satu row deterministik, sedangkan grup berbeda secara material dikarantina. v4 baru memasang index unik `&nik`. Semua row v2 yang dipindah tersimpan lengkap dalam audit.
- Status pasien `pending`, `synced`, dan `conflict` membedakan retryable, berhasil, dan integritas yang memerlukan resolusi manual. Konflik tidak di-retry otomatis. Hitungan pending dan konflik dipisahkan.
- `src/lib/patients.js` memusatkan lookup, registrasi lokal dahulu, pembacaan cloud dari server, rekonsiliasi profil, cache cloud ke Dexie, serta sync pasien pending. Dokumen baru memakai `patients/{nik}` setelah cek canonical dan query NIK; dokumen legacy tunggal dipakai tanpa duplikasi. Lebih dari satu dokumen NIK menjadi konflik eksplisit. NIK tetap identitas domain dan `patientNik` tetap linkage kasus.
- Field profil yang ada pada satu dokumen cloud menjadi otoritatif untuk cache direktori; field cloud yang tidak ada boleh memakai nilai lokal. Perbedaan usia/posko/status/registrasi biasa tidak membuat identitas baru. Nilai formulir lokal yang diganti disimpan dalam audit. Posko/usia pada asesmen aktif tetap merupakan snapshot konteks asesmen.
- Kasus kini menyimpan `firestoreId` sebelum cloud write dan memakai `setDoc()` pada ID tersebut, sehingga retry setelah cloud write sukses tetapi update lokal gagal tidak membuat dokumen baru. Kasus lama yang sudah synced tetap kompatibel. Kasus pending lama yang pernah berhasil `addDoc()` tetapi kehilangan ID cloud tidak bisa direkonsiliasi tanpa bukti tambahan; periksa data lama secara manual bila relevan.
- Sinkronisasi startup/reconnect memproses pasien sebelum kasus. Banner menampilkan pending dan konflik; toast sukses hanya mengikuti percobaan sinkronisasi nyata yang menyisakan nol pending dan nol konflik.
- **Verifikasi pada tahap implementasi source:** review source, `git diff --check`, lint, dan build. Migrasi IndexedDB aktual, Firebase, dan reconnect browser belum dijalankan pada tahap itu; hasil smoke test berikutnya tercatat pada bagian penutupan Phase 0.

---

## Phase 0C — Deterministic Demo Patient Dataset (26 September 2026)

- Seed admin memastikan pasien Budi (`3201234567890002`) ada di Firestore setelah pemeriksaan server canonical dan legacy. Jika NIK itu sudah milik profil demo berbeda atau memiliki beberapa dokumen, seeding berhenti tanpa menimpa data.
- Satu dari sepuluh kasus zona legacy memakai `patientNik` Budi dan profil pasien yang sesuai. Nama relawan dalam sampel tidak lagi disalahartikan sebagai identitas pasien.
- Kesepuluh kasus memakai ID dan timestamp demo yang stabil dengan `setDoc()`; seeding ulang memakai dokumen yang sama. Siti (`3201234567890001`) tidak dibuat oleh seed. Dokumen acak dari seed lama tidak dihapus.
- Pesan tombol admin diubah agar tidak mengklaim sepuluh dokumen baru selalu ditambahkan.
- **Verifikasi pada tahap implementasi source:** review source, lint, dan build. Hasil preset dan seeding berulang di Firebase/browser kemudian diuji manual; hasilnya tercatat pada bagian penutupan Phase 0.

---

## Phase 0 — Perbaikan temuan smoke test browser (26 September 2026)

Smoke test manual menemukan tiga masalah: refresh offline dapat menampilkan halaman kosong, header lokal halaman Relawan bertumpuk dengan header/banner global, dan konflik duplikasi NIK cloud tetap memblokir pencarian setelah data Firestore diperbaiki.

- Source fix auth mengaktifkan cache IndexedDB Firestore melalui `persistentLocalCache()` sambil mempertahankan long polling. `AuthContext` memeriksa profil dari server saat online dan memulihkan profil cache ketika offline atau pembacaan server gagal. `ProtectedRoute` memisahkan loading auth/profil dari profil yang tidak tersedia, menyediakan pesan dan tombol ulangi, serta tetap menerapkan role yang diketahui.
- Enam header halaman Relawan (Patient Lookup, Triage, Verbal, Non-Verbal, Result, History) kembali ke alur dokumen. Header dan banner global tetap dimiliki `RelawanLayout`.
- Pencarian **Cari** saat online dapat memeriksa ulang konflik `cloud-duplicate` melalui pembacaan server. Tepat satu dokumen cloud menyelesaikan audit dan merekonsiliasi cache; lebih dari satu atau nol dokumen tetap konflik. Konflik migrasi lokal tidak diselesaikan oleh pencarian. Sinkronisasi latar tetap melewati pasien berstatus `conflict`.
- **Status pada saat source fix:** browser belum diuji ulang. Hasil retest final tercatat pada bagian penutupan Phase 0 di bawah. Reload offline pada `npm run dev` bukan gate PWA produksi.

---

## Penutupan Phase 0 — hasil smoke test manual

Pemilik proyek mengonfirmasi hasil berikut pada prototipe saat ini:

| Skenario | Hasil |
|---|---|
| Regresi assessment/session Phase 0A | PASS |
| Perbaikan overlap header/banner Relawan | PASS |
| Pasien cloud tercache lokal dan tersedia offline | PASS |
| Deteksi duplikasi NIK cloud | PASS |
| Pemulihan konflik duplikasi cloud setelah perbaikan Firestore | PASS |
| Refresh offline PWA produksi dan pemulihan autentikasi/profil | PASS |
| Sinkronisasi pasien saat offline → online | PASS |
| Sinkronisasi pasien pending saat startup sudah online | PASS |
| Seed demo deterministik berulang | PASS |
| Cabang pasien baru Siti | PASS |
| Cabang pasien lama Budi dengan riwayat tertaut | PASS |
| Pasien baru dibuat offline lalu tersinkron saat reconnect | PASS |
| Baseline database Dexie v4 yang bersih | PASS |
| Migrasi Dexie v2 berisi data → v4 | **NOT RUNTIME TESTED** |

Data demo dan pengujian lokal/Firestore sengaja direset karena seluruh data prototipe sebelumnya dapat dibuang. Koleksi Firestore `users` dipertahankan; data pasien dan kasus aplikasi/demo dibersihkan; site data browser direset; aplikasi dimulai dari database Dexie v4 yang bersih; seed deterministik dijalankan ulang dengan berhasil. Karena tidak dibuat database v2 berisi data buatan untuk pengujian, migrasi v2 → v4 tetap berupa perlindungan kompatibilitas yang diimplementasikan dan ditinjau dari source, tanpa klaim lulus runtime.

Validasi reload offline formal menggunakan `npm run build`, `npm run preview`, Google Chrome, DevTools Network → Offline, lalu normal reload: **PASS**. Brave juga bekerja saat koneksi Wi-Fi/jaringan nyata dimatikan. Pada simulasi Offline di Brave DevTools, muncul `ERR_INTERNET_DISCONNECTED` meskipun service worker aktif dan Workbox precache terisi; ini dicatat sebagai caveat lingkungan pengujian, bukan kesimpulan umum tentang Brave. Tidak ada perubahan source PWA tambahan karena pengujian Chrome DevTools dan putus jaringan nyata di Brave berhasil.

Phase 0 ditutup untuk prototipe saat ini. Milestone pengembangan berikutnya adalah Phase 1 (PFA LOOK/LISTEN/LINK dan Red Flag T0); migrasi legacy yang belum diuji tetap dicatat sebagai batas validasi, bukan hasil PASS.

---

## Phase 1A — Fondasi Persistensi Asesmen Bertipe (26 September 2026)

- `cases` tetap menjadi store rekam asesmen longitudinal. `src/lib/caseRecords.js` mengenali `recordType: "legacy-triage" | "pfa" | "srq20"`, zona legacy yang valid, dan record lama tanpa tipe. Record tanpa zona valid atau bertipe tidak dikenal bersifat unknown, bukan Hijau. Record bertipe wajib mempunyai `protocolVersion` dan `responses` dengan ID item stabil; PFA tidak boleh membawa `zona`/`triageResult`.
- `ResultPage` menandai simpanan triase baru sebagai `legacy-triage` versi `legacy-demo-v1`. `saveCaseLocally()` memvalidasi record sebelum menulis ke Dexie. Serializer Firestore hanya menulis `zona`/`triageResult` untuk legacy; PFA tidak otomatis menjadi Hijau. Untuk record bertipe, `location` hanya ditulis bila ada pasangan angka lintang/bujur yang valid, termasuk nilai nol; koordinat fallback demo hanya dipertahankan untuk legacy.
- Jalur cloud kasus bersama kini memeriksa setiap `patientNik`. Pasien pending disinkronkan lebih dulu memakai helper pasien yang sudah ada; pasien conflict atau gagal sinkron membuat kasus tetap pending. Jika row pasien lokal tidak ada, helper pasien memerlukan konfirmasi cloud unik dari server. Kasus legacy tanpa `patientNik` tetap mengikuti jalur kompatibilitas. Alokasi `firestoreId` sebelum `setDoc()` dan retry ke ID yang sama dipertahankan.
- Patient Lookup, Home, History, serta Dashboard/Cases/Stats/Map Admin membedakan PFA dari zona legacy. PFA dan record unknown diberi label netral dan tidak masuk hitungan zona merah/kuning/hijau atau marker peta zona. Detail PFA dasar menampilkan versi protokol dan pasangan ID respons/nilai.
- Dexie tetap versi 4; migrasi v2→v4 tetap ada. `patients.pfaCompleted`/`lastPhase` tetap field kompatibilitas/demo, bukan sumber kebenaran PFA selesai. PFA selesai nantinya dibuktikan oleh record PFA selesai; Phase 1A tidak membuat draft atau UI PFA.
- **Pemeriksaan manual browser/runtime Phase 1A — PASS:** simpan legacy verbal dan non-verbal; persistensi PFA bertipe saat offline dan sinkronisasi reconnect→cloud; PFA cloud tanpa `zona`/`triageResult` atau `location` palsu saat koordinat tidak ada; pembaca Relawan/Admin; PFA tidak masuk agregat zona merah/kuning/hijau. Hasil ini terpisah dari tes otomatis dan tidak membuktikan urutan pasien→kasus secara manual.
- **Vitest Phase 1A — PASS:** `tests/caseRecords.test.js` dan `tests/sync.test.js` menguji validasi/klasifikasi bertipe, kompatibilitas legacy, serialisasi PFA/legacy, urutan pasien pending sebelum penulisan kasus, pemblokiran konflik/kegagalan pasien, konfirmasi cloud saat pasien lokal hilang, penggunaan ulang `firestoreId`, batas simpan lokal, serta lokasi bertipe termasuk nol. Semua Firebase, Dexie, dan helper pasien dimock; tidak ada akses cloud/IndexedDB nyata dan belum ada suite E2E penuh. `npm run lint`, `npm run build`, dan `git diff --check` lulus dengan warning yang tercatat. Migrasi Dexie v2 berisi data → v4 tetap **NOT RUNTIME TESTED**.
- **Status setelah Phase 1B:** UI dan konten protokol PFA LOOK/LISTEN/LINK serta unit test selesai; regresi percabangan PFA lulus retest browser terpilih. Red Flag/T0 serta persistensi/sinkronisasi emergency menjadi pekerjaan Phase 1 berikutnya; SRQ-20, Risk Factor, dan hasil T1/T2/T3 tetap Phase 2. Phase 1 belum selesai.

---

## Phase 1B — UI PFA LOOK/LISTEN/LINK dan Konfigurasi Protokol (26 September 2026)

- Pasien baru yang berhasil didaftarkan masuk `/relawan/pfa`. Pasien terdaftar hanya masuk fallback `/relawan/triage` jika riwayat berisi record PFA bertipe yang valid; registrasi atau riwayat legacy saja tidak membuktikan PFA selesai. Route PFA berada di bawah `AssessmentRoute`; tanpa pasien aktif diarahkan ke Patient Lookup, sedangkan asesmen `lanjutan` diarahkan ke triase legacy tanpa menghapus konteks.
- `src/protocols/pfaProtocol.js` mendefinisikan LOOK/LISTEN/LINK versi `pfa-prototype-v1` dengan teks Indonesia **provisional** dan ID item stabil. Boolean wajib harus dijawab eksplisit; `false` tetap jawaban sah. Modul `src/lib/pfa.js` memvalidasi kelengkapan dan jenis jawaban serta membangun record PFA melalui kontrak kasus bertipe Phase 1A.
- Draf wizard di `sessionStorage` terikat waktu mulai asesmen, NIK, dan versi protokol. Draf yang salah ikatan, ID, tipe respons, atau section dibuang seluruhnya; draf tidak ditulis ke `cases`. Pasien yang sama dengan asesmen akut aktif dapat melanjutkan PFA tanpa mengganti sesi/draf. Memulai asesmen pasien lain memerlukan pembatalan eksplisit; pembatalan menghapus asesmen aktif dan draf, tetapi pasien lama tetap terdaftar dan diklasifikasikan PFA belum selesai. Selesai PFA menyimpan satu record bertipe lokal lebih dahulu lewat `saveCase()`, menghapus draf, lalu kembali ke Home meskipun upload cloud tertunda. Gagal simpan lokal mempertahankan draf dan asesmen untuk dicoba lagi.
- Record selesai yang valid pada riwayat merupakan bukti PFA, termasuk saat `synced: 0`; bukan keberadaan pasien atau `patients.pfaCompleted`/`lastPhase`. Snapshot `poskoName` memakai nilai pasien yang tersedia; koordinat hanya disertakan dari pasangan angka valid pada profil Relawan. PFA tidak mempunyai `zona`, `triageResult`, `tier`, atau koordinat fallback/random.
- **Validasi otomatis:** `npm test` 72/72 PASS (3 file), `npm run lint` exit 0 dengan warning yang sudah ada, `npm run build` PASS dengan warning dependency/ukuran bundle yang sudah ada, dan `git diff --check` PASS. Belum ada suite E2E penuh; migrasi Dexie v2 berisi data → v4 tetap **NOT RUNTIME TESTED**.
- **Retest browser Phase 1B — PASS:** pasien terdaftar tanpa record PFA bertipe selesai melihat `PFA belum selesai`; `Lanjutkan PFA` mempertahankan asesmen akut dan draf untuk pasien/sesi aktif yang sama. Pindah ke pasien lain meminta pembatalan eksplisit; pembatalan menghapus asesmen aktif/draf tanpa menghapus pasien terdaftar. Setelah PFA benar-benar selesai, lookup menampilkan `PFA telah selesai` dan aksi fallback SRQ-20 saat ini. Patient Lookup di browser lain juga mengenali NIK dengan PFA bertipe valid melalui gabungan riwayat lokal + Firestore.
- **Offline refresh Phase 1B:** operasi pasien/PFA pada IndexedDB berhasil saat offline. Refresh dengan `npm run dev` dan Chrome DevTools Offline menampilkan `ERR_INTERNET_DISCONNECTED`; ini batas pengujian development server. Skenario yang sama pada bundle produksi (`npm run build` + `npm run preview`) berhasil refresh offline melalui PWA/service worker. Hasil ini tidak menyatakan seluruh skenario PWA/offline telah diuji E2E.
- **Known issue terpisah — riwayat Relawan lintas browser:** `/relawan/history` membaca `cases` dari Dexie lokal. Kasus diunggah ke Firestore, tetapi browser/sesi lain belum menghidrasi `cases` lokal untuk halaman tersebut, sehingga Browser A dan B dengan akun Relawan yang sama dapat menampilkan riwayat berbeda. Ini bukan kegagalan persistensi cloud atau cacat percabangan PFA: Patient Lookup Browser B menemukan NIK yang sama dan mengenali PFA selesai dari gabungan riwayat lokal + Firestore. Hardening berikutnya dapat menggabungkan kasus Firestore ke tampilan History saat online atau menghidrasi Firestore → Dexie; pilihan desain belum ditetapkan.

### Perbaikan pre-merge Phase 1B (27 September 2026)

- Logout Relawan kini menghapus asesmen aktif dan draf PFA `sessionStorage` sebelum logout Firebase dan navigasi login. Pasien terdaftar, kasus selesai, dan data pending sync tetap tersimpan.
- Patient Lookup kini memuat riwayat kasus dari Firestore dengan kueri server eksplisit saat online dan mencatat apakah pemeriksaan cloud berhasil. Kegagalan kueri atau mode offline tidak lagi dianggap bukti bahwa PFA belum selesai. Record PFA bertipe valid di lokal tetap membuktikan selesai, termasuk `synced: 0`; asesmen akut aktif untuk NIK yang sama tetap dapat dilanjutkan dengan draf yang sama saat offline. Hanya ketiadaan PFA setelah pemeriksaan cloud berhasil yang mengizinkan PFA akut baru. Jika status belum dapat diverifikasi, UI menahan kedua aksi lanjutan dan menyediakan `Coba Lagi` tanpa membatalkan asesmen pasien lain.
- **Validasi source:** `npm test` 78/78 PASS (3 file); `npm run lint`, `npm run build`, dan `git diff --check` exit 0 dengan warning lint/build yang sudah ada.
- **Retest browser pre-merge — PASS:** logout setelah menjawab PFA menghapus `rapidMind.activeAssessment` dan `rapidMind.pfaDraft`; pasien terdaftar tetap di IndexedDB, kasus selesai/pending tidak terhapus, dan login ulang tidak memulihkan draf yang ditinggalkan. Browser B saat online mengenali PFA bertipe yang diselesaikan dan tersinkron dari Browser A sebagai `PFA telah selesai` serta menampilkan aksi fallback lanjutan saat ini. Saat identitas pasien tercache tetapi kasus PFA tidak ada di lokal dan riwayat cloud tidak dapat diperiksa karena offline, hanya `Status PFA belum dapat diverifikasi.` dan `Coba Lagi` yang tampil, tanpa aksi PFA maupun fallback lanjutan. Asesmen akut aktif untuk NIK yang sama tetap menampilkan `PFA belum selesai`, `Asesmen aktif dapat dilanjutkan`, dan `Lanjutkan PFA` saat offline serta memulihkan sesi/jawaban yang sama. Record PFA bertipe valid yang selesai secara lokal tetap berstatus selesai meski verifikasi cloud tidak tersedia. Smoke test percabangan/resume/pembatalan Phase 1B sebelumnya juga PASS. Belum ada suite E2E penuh.
- Gap hidrasi `/relawan/history` lintas browser tetap terpisah dan terbuka. Migrasi Dexie v2 berisi data → v4 tetap **NOT RUNTIME TESTED**.

---

## Phase 1C — Red Flag / T0-Suspect Emergency (27 September 2026)

- FAB Red Flag terpasang pada layout Relawan untuk Home, Patient Lookup, PFA, dan seluruh halaman triase legacy; History dan rute non-Relawan tidak menampilkannya. Modal tetap di rute semula dan tidak mengubah asesmen aktif, draf PFA, pasien, atau kasus. Tiga indikator ber-ID stabil dalam `redflag-prototype-v1` memakai teks Indonesia **provisional**, bukan kriteria klinis tervalidasi; minimal satu indikator harus dipilih.
- `emergencies` pada Dexie v4 menjadi sumber event `t0-suspect` terpisah. Skema Zod mengharuskan UID Relawan, versi protokol, timestamp, dan indikator yang dikenal. NIK/nama pasien hanya diambil dari asesmen aktif milik Relawan yang sama; event tanpa pasien tetap sah. Posko dan koordinat hanya berasal dari profil Relawan. Koordinat disimpan hanya sebagai pasangan angka valid, termasuk nol; fallback posko Patient Lookup dan koordinat legacy/random tidak dipakai.
- Simpan lokal berhasil langsung menghasilkan keadaan UI “tersimpan di perangkat”. Upload Firestore online dimulai segera dan Promise-nya ditangani; kegagalan cloud mempertahankan `synced: 0`, sedangkan kegagalan IndexedDB menahan form agar bisa dicoba ulang. Serializer Firestore eksplisit mengirim field event dan `timestamp`/`createdAt` sebagai Firestore Timestamp, tanpa `id`, `synced`, atau metadata lokal. ID dokumen Firestore disimpan sebelum `setDoc()` dan dipakai ulang pada retry; penulisan bersamaan pada tab yang sama digabung.
- `syncPendingData()` sekarang memproses pasien → emergency → kasus. Kegagalan/konflik direktori pasien tidak menahan emergency; kasus terkait pasien tetap memakai gate ketat lama. `getSyncCounts()`, banner pending, dan perhitungan `complete` memasukkan emergency. Tidak ada watcher reconnect kedua dan tidak ada Dexie v5.
- **Validasi otomatis:** `npm test` **93/93 PASS** (4 file). `npm run lint` exit 0 dengan warning lama; `npm run build` PASS dengan warning dependency `eval` dan ukuran bundle yang sudah ada; `git diff --check` PASS. Tes memakai mock Firebase/Dexie, bukan Firestore/IndexedDB browser nyata.
- **Manual browser Phase 1C — PASS (dilaporkan setelah validasi otomatis):** FAB tampil pada rute Relawan yang diwajibkan, tidak tampil pada rute yang dikecualikan, serta tidak menutup bottom navigation atau aksi halaman fixed. Event tanpa pasien dari Home dan event yang tertaut pasien pada PFA aktif berhasil dibuat; syarat minimal satu indikator bekerja. Buka, tutup, dan simpan Red Flag mempertahankan jawaban, bagian PFA, dan asesmen aktif; PFA tetap dapat dilanjutkan. Saat offline, event tersimpan lokal lebih dulu dengan kata-kata status dan counter pending yang benar, lalu tersinkron saat reconnect.
- **Manual layering Phase 1C — PASS:** trigger Red Flag tetap dapat diakses di atas dialog konfirmasi asesmen belum selesai pada Patient Lookup. Pada Result zona merah legacy, trigger tetap dapat diakses saat modal PFA otomatis terbuka dan membuka modal T0-Suspect di atasnya.
- **Manual retry dan integritas lokasi Phase 1C — PASS:** kegagalan Firestore saat online meninggalkan event lokal pending dengan `firestoreId` yang sudah tersimpan; reconnect memakai kembali ID persis itu dan menghasilkan satu dokumen emergency Firestore tanpa duplikat. Koordinat profil Relawan yang valid tersalin ke event. Setelah `poskoLat` dan `poskoLng` dihapus dari profil, `lat` dan `lng` sama-sama tidak ada pada record emergency lokal maupun Firestore; tidak ada koordinat fallback GPS.
- Hasil manual browser ini terpisah dari 93 tes otomatis berbasis mock dan bukan suite E2E penuh. Belum ada Faskes receiver, konfirmasi klinis, atau klaim penerimaan alert oleh PSC/Faskes.
- Batas yang tetap terbuka: suite E2E penuh belum ada; migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**; hidrasi `/relawan/history` lintas browser masih terbuka; hardening idempotensi penyelesaian PFA tetap pekerjaan terpisah; validasi T0 oleh Faskes adalah fase berikutnya.

## Phase 2A — Longitudinal Domain Foundation (27 September 2026)

- Protokol `srq20-prototype-v1` berisi tepat 20 butir boolean ber-ID `srq20.01`–`srq20.20`. `risk-function-prototype-v1` memisahkan empat Faktor Risiko dan empat Gangguan Fungsi. Semua label `[Template]` bersifat **provisional**, bukan bunyi SRQ atau indikator klinis final. Validator domain menerima jawaban parsial untuk draf dan mewajibkan seluruh ID yang dikenal untuk penyelesaian; ID asing, tipe selain boolean, dan versi yang tidak didukung ditolak.
- `analyzeSrq20()` menghitung jumlah `true` pada 20 jawaban lengkap. Ambang prototipe berasal dari `docs/workflow.md`: 0–5 → T3, 6–10 → T2, 11–20 → T1. Scorer verbal/non-verbal zona legacy tidak diubah. T0-Suspect tetap di jalur Red Flag emergency, bukan hasil SRQ.
- `classification-prototype-v1` memerlukan jawaban Screen 6 lengkap dan base tier T1/T2/T3. Screen 6 secara arsitektur dimaksudkan memengaruhi klasifikasi kelak, tetapi algoritme adjustment **NOT DEFINED / NOT IMPLEMENTED**. Oleh karena itu, `finalTier === baseTier`, `adjustmentRuleDefined: false`, dan `adjustmentsApplied: []`; tidak dibuat bobot, eskalasi, atau `riskFactorScore` palsu.
- Satu draf `rapidMind.longitudinalDraft` untuk Screen 5+6 menyimpan mode verbal/nonverbal, langkah, serta respons terstruktur. Pemulihan menuntut UID Relawan, NIK, `assessment.startedAt`, fase `lanjutan`, versi protokol aktif, dan seluruh jawaban parsial valid. Simpan/muat/hapus `sessionStorage` bersifat defensif. Audio dan transkrip tidak masuk kontrak draf.
- Skema SRQ bertipe kini mewajibkan metadata Phase 2, rentang skor 0–20, enum mode/tier, dan map boolean tanpa `zona`/`triageResult`. Boundary `validateCaseForSave()` menyusun pemeriksaan protokol lengkap, skor dan base tier yang dihitung ulang, serta aturan tier akhir v1 sebelum persistensi. Validasi memilih semantik berdasarkan **versi yang tersimpan pada record**; hanya tiga versi v1 di atas yang didukung sekarang. Versi aktif draf dapat berubah tanpa mengubah validitas record historis v1.
- **Validasi otomatis Phase 2A:** `npm test` **165/165 PASS** (8 file); `npm run lint` exit 0 tanpa error, dengan warning lama hanya pada file yang tidak diubah; `npm run build` PASS dengan warning dependency `eval` dan ukuran bundle yang sudah ada; `git diff --check` PASS. Tes domain memakai Vitest; tidak ada pengujian browser Phase 2A.
- Tidak ada halaman atau routing Screen 5/6/7, builder/save flow UI, STT baru, dependency, atau migrasi Dexie pada Phase 2A. Browser/E2E Phase 2A **tidak diuji dan tidak diklaim selesai**. Batas lama tetap berlaku: migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**, hidrasi `/relawan/history` lintas browser belum ada, dan hardening idempotensi PFA masih terbuka.

## Phase 2B — Longitudinal Assessment UI: Screen 5 + Screen 6 (27 September 2026)

- `/relawan/srq20` dan `/relawan/risk-factor` sekarang berada di bawah `AssessmentRoute`. Keduanya mensyaratkan asesmen `lanjutan` milik UID Relawan yang masuk. Konteks hilang kembali ke Patient Lookup, fase akut ke PFA, dan akses Screen 6 tanpa draf valid serta SRQ lengkap kembali ke Screen 5. Layout menyembunyikan bottom navigation serta tetap menampilkan Red Flag FAB pada kedua layar.
- Screen 5 merender 20 butir `[Template]` dari `SRQ20_PROTOCOL.items`. Mode `verbal` dan `nonverbal` memakai objek `srqResponses` yang sama: `true` = Ya, `false` = Tidak, key hilang = belum dijawab. Progres terlihat; mode dan seluruh jawaban tetap ada saat berganti mode, lanjut, kembali, atau refresh selama draf sesi masih tersedia.
- Mode verbal memakai hook Speech-to-Text dan pilihan transkripsi Whisper lokal untuk rekaman sebagai bantuan transkrip yang dapat diedit. Tidak ada pemetaan keyword klinis pada protokol template ini, sehingga teks tidak otomatis mengisi jawaban SRQ. Audio/transkrip hanya state sementara, bukan isi `rapidMind.longitudinalDraft` atau record kasus. Hook suara mendapat pembatalan start yang masih menunggu izin mikrofon serta cleanup recognition, recorder, track, visualizer, dan AudioContext; API hook legacy tetap sama.
- Screen 6 merender dua bagian dari `RISK_FUNCTION_PROTOCOL`: empat Faktor Risiko dan empat Gangguan Fungsi, semuanya `[Template]`. Delapan jawaban juga memisahkan `false` dari key yang hilang. Aksi kembali mempertahankan draf. Aksi pemeriksaan menuntut SRQ dan Risk/Function lengkap, menjalankan `analyzeSrq20()` dan `calculateFinalTier()` hanya sebagai cek kesiapan, menyimpan draf lengkap, lalu tetap di Screen 6 dengan pesan netral. Skor/tier turunan tidak disimpan ke draf. Adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED**; v1 tetap `finalTier === baseTier`.
- Draf baru dimulai dengan tiga objek jawaban kosong dan mode verbal; seluruh simpan/muat memakai helper Phase 2A. Kegagalan penyimpanan menampilkan peringatan, mempertahankan jawaban dalam memori, dan menahan transisi atau konfirmasi siap yang bergantung pada draf tersimpan. Logout dan konfirmasi pembatalan asesmen pasien lain menghapus draf longitudinal. Patient Lookup setelah PFA selesai tetap sengaja memulai `lanjutan` menuju triase legacy; PFA, History, dan save semantics tidak dialihkan pada 2B.
- **Validasi otomatis/unit Phase 2B:** `npm test` **194/194 PASS** (9 file; sebelumnya 173/173 pada 8 file). Helper alur murni menguji draf awal, jumlah jawaban eksplisit, validasi dan transisi Screen 5↔6, pergantian mode tanpa mengubah jawaban/metadata, syarat draf sesi untuk Screen 6, kesiapan lengkap, penolakan data/versi tidak valid, serta klasifikasi v1 `finalTier === baseTier`. Hasil analisis tetap turunan dan tidak masuk draf. Tes ini tidak membuktikan API mikrofon, runtime Whisper, tampilan visual, React Router, refresh browser, atau integrasi legacy.
- **Manual browser smoke Phase 2B — hasil uji terpilih:**
  1. **A — PASS, integrasi rute:** tanpa asesmen → Patient Lookup; fase akut → PFA; konteks `lanjutan` valid milik Relawan → Screen 5; akses Screen 6 tanpa SRQ lengkap → Screen 5.
  2. **B — PASS, tampilan/interaksi Screen 5:** belum dijawab terlihat berbeda dari Tidak; Ya/Tidak berfungsi, counter bertambah, dan pergantian verbal/nonverbal mempertahankan jawaban terstruktur yang ditampilkan.
  3. **C — PASS WITH LIMITATION, runtime suara:** izin dan rekaman mikrofon, STT browser langsung, playback audio, serta runtime Whisper lokal berjalan; transkrip tidak mengubah jawaban SRQ terstruktur secara otomatis. STT browser mentranskripsi kalimat `Saya merasa sulit tidur setelah kejadian ini.` dengan benar, sedangkan Whisper lokal untuk kalimat yang sama menghasilkan `Terima kasih, Terima kasih`. Akurasi transkripsi Whisper lokal ini masih menjadi keterbatasan kualitas, bukan blocker Phase 2B. Whisper tetap bantuan opsional; Relawan memilih jawaban SRQ secara manual.
  4. **D — PASS, cleanup suara:** stop normal, pergantian verbal → nonverbal, unmount/navigasi, dan pembatalan saat izin/start mikrofon tertunda melepas capture tanpa mengaktifkannya lagi secara keliru.
  5. **E — PASS, refresh/sesi:** reload Screen 5 memulihkan mode dan jawaban SRQ; reload Screen 6 memulihkan jawaban Screen 6 melalui `sessionStorage`.
  6. **F — PASS, UI Screen 5↔6:** Screen 5 lengkap menuju Screen 6; Back kembali ke Screen 5; masuk lagi ke Screen 6 memulihkan jawaban Risk/Function parsial.
  7. **G — PASS, batas kesiapan Screen 6:** formulir belum lengkap menampilkan feedback; formulir lengkap hanya menampilkan pesan netral dan tetap di Screen 6. Tidak ada kasus baru dengan `recordType: "srq20"` di IndexedDB. Kasus yang sudah ada tetap `recordType: "pfa"`, sesuai alur PFA sebelumnya; penyimpanan kasus SRQ selesai masih Phase 2C.
  8. **H — PASS, regresi lintas layar:** Red Flag FAB bekerja tanpa menutupi kontrol tetap; logout dan pembatalan/pindah pasien membersihkan draf/UI longitudinal; PFA, rekaman/triase verbal legacy, dan triase nonverbal legacy tetap berjalan.
- Pengujian manual konteks `lanjutan` dapat membuka rute SRQ secara langsung karena Patient Lookup masih sengaja memakai fallback triase sampai Phase 2C. Semua caveat lama tetap berlaku: migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**, History lintas browser belum dihidrasi, suite E2E penuh belum ada, idempotensi PFA masih perlu hardening, dan validasi T0 oleh Faskes belum tersedia.

## Phase 2C — Longitudinal Result + Production Routing Integration (27 September 2026)

- Patient Lookup kini mengarahkan PFA bertipe yang selesai ke `/relawan/srq20`; asesmen `lanjutan` aktif untuk NIK yang sama mempertahankan `startedAt` dan draf. Modal asesmen belum selesai serta redirect fase lanjutan dari PFA juga menuju SRQ. Rute triase legacy tetap tersedia untuk penggunaan eksplisit.
- Satu penyimpanan Screen 7 menyelesaikan satu sesi asesmen, bukan seluruh pemantauan pasien. NIK yang sama dapat memiliki PFA dan beberapa record SRQ selesai yang terpisah. Patient Lookup membedakan SRQ pertama setelah PFA, melanjutkan asesmen `lanjutan` aktif pada sesi yang sama, dan memulai asesmen baru setelah ada SRQ selesai. Tidak ada pembaruan/penimpaan kasus SRQ sebelumnya atau aturan interval asesmen ulang pada prototipe ini.
- Screen 6 memvalidasi 20 SRQ dan delapan Risk/Function, menyimpan draf raw lengkap, lalu membuka `/relawan/srq20/result`. Screen 7 berada di bawah guard Relawan dan asesmen, merekonstruksi skor/tier dari draf terikat sesi setelah refresh, menampilkan ringkasan pasien/mode/skor/tier dan hitungan Ya Risk/Function, serta menyediakan kembali ke Screen 6. Draf Risk/Function yang valid namun belum lengkap kembali ke Screen 6; draf tidak valid tetap ditolak oleh kontrak ketat yang sudah ada. FAB Red Flag tetap tampil dan bottom navigation disembunyikan.
- `buildSrq20CaseRecord()` membuat record `srq20` tervalidasi dari jawaban boolean lengkap dan versi protokol aktif, memakai `analyzeSrq20()`, `calculateFinalTier()`, dan `validateCaseForSave()`. Snapshot pasien dan Relawan mengikuti pola PFA; `poskoName` hanya dari profil Relawan non-kosong yang bukan fallback demo `Posko Utama - Kota`. Koordinat hanya dari pasangan angka profil yang valid, termasuk `0, 0`. Record tidak memiliki zona legacy, transkrip/audio, skor risiko buatan, atau field penyesuaian klasifikasi.
- Aksi simpan Screen 7 memakai lock selama halaman terpasang dan `saveCase()` yang sudah ada. Setelah persistensi lokal berhasil, termasuk hasil `synced: false`, draf dihapus dan navigasi Home membawa `completedAssessmentStartedAt` agar layout membersihkan asesmen aktif. Error build/simpan lokal tetap di Screen 7 dengan draf/asesmen terjaga untuk retry. History lokal menampilkan tier, skor SRQ, dan mode; hidrasi lintas browser belum dibuat.
- **Validasi otomatis:** `npm test` **216/216 PASS** (9 file). Tes builder mencakup mode, batas T3/T2/T1, semua jawaban/versi, snapshot, koordinat valid/invalid, penolakan konteks/jawaban, serta field terlarang. Tes sinkronisasi SRQ membuktikan persistensi lokal pending dan payload cloud bertipe tanpa zona/lokasi palsu memakai mock. `npm run lint` exit 0 dengan warning baseline; `npm run build` PASS dengan warning dependency `eval` dan ukuran bundle yang sudah ada. Tes ini belum membuktikan runtime IndexedDB, Firebase, React Router, atau interaksi browser.
- **Manual browser smoke Phase 2C — PASS, dilaporkan pengguna:**
  1. **A — routing produksi/resume:** PFA bertipe selesai dari Patient Lookup menuju `/relawan/srq20`, tanpa fallback normal ke triase legacy; asesmen `lanjutan` aktif untuk NIK yang sama mempertahankan sesi.
  2. **B — Screen 5→6→7:** 20 jawaban SRQ dan delapan Risk/Function lengkap membuka `/relawan/srq20/result`; Screen 6 sendiri tidak membuat kasus SRQ.
  3. **C — batas tier prototipe:** 0 Ya → T3, 6 Ya → T2, 11 Ya → T1. Perubahan jawaban Risk/Function tidak mengubah tier akhir v1 karena aturan adjustment belum ada; ini bukan validasi klinis.
  4. **D/E — refresh dan edit:** Screen 7 memulihkan hasil dari draf terikat sesi setelah reload; kembali dan mengubah jawaban menghasilkan perhitungan ulang, tanpa hasil turunan yang tersimpan di draf.
  5. **F — simpan online:** Screen 7 menghasilkan kasus SRQ bertipe, menyimpan lokal, lalu kembali ke Home dengan asesmen/draf dibersihkan; hasil terlihat pada jalur data/riwayat yang diharapkan.
  6. **G — simpan offline/reconnect:** kasus tersimpan lokal dengan sync pending; Home dan pembersihan draf tetap berjalan. Reconnect menyinkronkan kasus; retry memakai Firestore ID tersimpan tanpa dokumen cloud duplikat.
  7. **H1 — koordinat valid:** pasangan angka valid dari profil Relawan terautentikasi muncul pada kasus SRQ lokal dan `location` cloud. **H2 — koordinat absen:** setelah kedua koordinat profil dihapus, kasus lokal tidak memiliki field koordinat dan kasus Firestore tidak memiliki `location` atau fallback palsu. Karena profil diubah langsung di Firebase Console, pengguna logout lalu login kembali agar `userProfile` dimuat ulang; ini langkah setup tes. Koordinat `0,0` hanya tercakup tes otomatis, bukan smoke browser tersendiri.
  8. **I — History lokal:** record SRQ bertipe menampilkan tier akhir, skor `/ 20`, dan mode input pada Dexie browser yang sama; hidrasi History lintas browser tetap terbuka.
  9. **J — regresi terpilih:** Red Flag tersedia pada layar longitudinal; PFA, logout, pembatalan/pindah pasien, dan triase legacy eksplisit tetap berfungsi.
- Smoke A–J di atas adalah pemeriksaan browser manual terpilih, bukan suite E2E penuh. Tes otomatis berbasis mock tetap terpisah dari bukti runtime browser.
- Batas tetap terbuka: belum ada suite E2E penuh; migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**; hidrasi `/relawan/history` lintas browser dan hardening idempotensi penyelesaian PFA terpisah; wording protokol/klinis masih provisional; algoritme adjustment Risk/Function **NOT DEFINED / NOT IMPLEMENTED**; akurasi Whisper lokal tetap keterbatasan terpisah; validasi T0 oleh Faskes tetap Phase 3.

## Phase 3.1 — Faskes Foundation + Real-Time Emergency Reception (27 September 2026)

- Role `nakes` diterima dari profil Firestore pada AuthContext, dengan route `/faskes` dan redirect langsung sesuai `relawan → /relawan`, `nakes → /faskes`, `admin → /admin`. Login menunggu siklus profil AuthContext dan mempertahankan pemulihan profil cache/offline. Guard Relawan/Admin tetap terpisah. Pendaftaran mandiri sekarang hanya membuat profil Relawan; akun Nakes/Admin demo harus diprovisi manual di Firebase Auth dan `users/{uid}`. Perubahan UI/client ini bukan kontrol otorisasi backend.
- `FaskesLayout` menyediakan identitas, nama akun, logout, navigasi antrean, dan sinyal browser online/offline. `EmergencyQueuePage` memakai `onSnapshot` pada `emergencies`, melepas listener saat unmount, dan menampilkan T0-Suspect terbaru lebih dahulu tanpa polling/refresh. Jumlah antrean berasal dari listener yang sama; kartu menampilkan waktu, pasien/NIK bila ada, posko, Relawan, indikator berlabel, catatan, dan ketersediaan koordinat. Label Red Flag tetap provisional, bukan kriteria klinis tervalidasi. Status loading, kosong, cache/offline, error listener, dan retry manual tersedia.
- Pembaca cloud memproses setiap dokumen secara independen. Firestore `timestamp` adalah waktu origin yang wajib: dikonversi ke ISO lalu divalidasi dengan kontrak event `t0-suspect` yang sama. `createdAt` dan metadata tambahan ditoleransi sebagai field cloud dan tidak menjadi syarat origin. Satu dokumen malformed masuk daftar ID ditolak tanpa menghilangkan emergency valid. Event lokal tetap schema strict; status workflow Faskes tidak dibuat pada fase ini.
- Retry Relawan tetap local-first dengan `synced: 0/1`, Firestore ID yang disimpan sebelum upload, dan coalescing pada row yang sama. `setDoc(..., { merge: true })` mengganti hanya field origin yang diserialisasi dan mempertahankan field cloud independen ketika retry normal, termasuk bila write cloud sukses tetapi update `synced` lokal gagal. **Merge tidak memberi otorisasi backend tingkat field.** Jalur read emergency Nakes lulus uji runtime Phase 3.1. Deployed Firestore Security Rules untuk write workflow Phase 3.2 tetap **NEEDS VERIFICATION**, termasuk pembatasan penetapan role, create/retry origin Relawan, dan update field workflow hanya oleh Nakes. Tidak ada `firestore.rules` atau konfigurasi project Firebase lokal untuk memverifikasi rules deployed.
- **Validasi otomatis/source:** `npm test` **222/222 PASS** (11 file). Tes baru mencakup normalisasi Timestamp, toleransi `createdAt`/field cloud tambahan, penolakan origin malformed, emergency tanpa pasien, isolasi dokumen rusak, urutan/deduplikasi antrean, route role, dan preservasi metadata pada retry ID sama. `npm run lint` exit 0 tanpa warning baru; `npm run build` PASS dengan warning lama dependency `eval` dan ukuran bundle; `git diff --check` PASS. Tes mock/unit sendiri tidak membuktikan listener Firestore, rules, atau UX dua browser; smoke browser terpilih di bawah memverifikasi perilaku runtime Phase 3.1.
- **Gate browser Phase 3.1 — PASS untuk scope prototipe terpilih (dilaporkan pengguna):**
  1. Akun Firebase Auth Nakes dan profil `users/{uid}` yang sesuai berhasil login.
  2. Relawan menuju `/relawan`, Nakes `/faskes`, dan Admin `/admin`; akses wrong-role kembali ke home role akun yang sedang login.
  3. Sesi browser Relawan dan Faskes terpisah bekerja.
  4. T0-Suspect linked muncul di antrean Faskes lewat Firestore `onSnapshot` tanpa refresh.
  5. Pasien/NIK, posko, Relawan, label Red Flag, catatan/lokasi bila ada, dan timestamp tampil benar.
  6. T0-Suspect tanpa pasien aktif memakai fallback anonim tanpa identitas pasien buatan.
  7. Urutan antrean terbaru lebih dulu dan event tidak terduplikasi.
  8. T0-Suspect yang dibuat saat Relawan offline tetap pending lokal; setelah reconnect terunggah dan muncul sekali di Faskes tanpa refresh.
  9. Dokumen emergency Firestore yang sengaja malformed dilaporkan terpisah; emergency valid tetap terlihat.
  10. Setelah dokumen malformed dihapus, peringatan hilang tanpa refresh.
  11. Tampilan Faskes saat browser offline/cache/reconnect bekerja benar.
  12. Registrasi publik hanya menawarkan Relawan; login Relawan/Admin lama tetap bekerja.
- Hasil di atas adalah smoke browser manual terpilih, **bukan suite E2E penuh** atau verifikasi otorisasi backend field-level. Phase 3.1 selesai untuk scope prototipe terpilih; Phase 3.2 **Secondary Validation + Referral Workflow** belum dimulai.
- Caveat lama tetap berlaku: tidak ada full E2E suite; migrasi Dexie v2 berisi data → v4 **NOT RUNTIME TESTED**; History Relawan lintas browser tetap lokal; hardening idempotensi PFA terbuka; wording klinis/protokol provisional; klasifikasi SRQ/Risk-Function belum divalidasi klinis; algoritme adjustment Risk/Function belum didefinisikan; akurasi Whisper lokal terbatas; T0 Red Flag terpisah dari tier SRQ; dan kompatibilitas triase legacy dipertahankan.
