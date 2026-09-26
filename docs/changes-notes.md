# Catatan Perubahan & Implementasi: Track A.1 (Identitas Penyintas & Auto-Lookup)

> **Dokumen:** Implementation & Changelog Notes  
> **Ruang Lingkup:** Track A — Poin 1 (Screen 2: Identitas Penyintas & Auto-Lookup System)  
> **Tanggal:** 25 September 2026  
> **Status:** Phase 0 source selesai dan smoke test browser terkonfirmasi. Phase 1A source, pemeriksaan manual browser/runtime terpilih, dan Vitest PASS; Phase 1B berikutnya. Migrasi Dexie v2 berisi data belum diuji runtime.
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
- **Masih berikutnya:** Phase 1B UI dan konten protokol PFA LOOK/LISTEN/LINK. Red Flag/T0, sinkronisasi emergency, SRQ-20, Risk Factor, serta hasil T1/T2/T3 belum diimplementasikan; Phase 1 belum selesai.
