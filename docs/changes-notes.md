# Catatan Perubahan & Implementasi: Track A.1 (Identitas Penyintas & Auto-Lookup)

> **Dokumen:** Implementation & Changelog Notes  
> **Ruang Lingkup:** Track A — Poin 1 (Screen 2: Identitas Penyintas & Auto-Lookup System)  
> **Tanggal:** 25 September 2026  
> **Status:** Implementasi Screen 2 Selesai & Terverifikasi — Integrasi End-to-End Dilanjutkan pada Phase 0 (Build 0 Error, Lint Clean)
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
