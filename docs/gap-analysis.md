# RAPID-MIND — Gap Analysis Report

> **Tanggal:** 25 September 2026  
> **Ruang Lingkup:** Audit implementasi kode terhadap kebutuhan di `docs/workflow.md`  
> **Status Keseluruhan:** ✅ 14 Selesai | ⚠️ 3 Parsial | ❌ 22 Belum Terimplementasi

---

## 1. Fitur yang Sudah Terimplementasi (✅)

| # | Fitur | File Terkait | Catatan |
|---|-------|-------------|---------|
| 1 | Auth Email/Password (2 role: relawan, admin) | `src/contexts/AuthContext.jsx`, `src/pages/LoginPage.jsx` | Firebase Auth, profil Firestore |
| 2 | Protected Routes & RBAC | `src/components/ProtectedRoute.jsx`, `src/App.jsx` | Guard per-role, redirect otomatis |
| 3 | Speech-to-Text Dual Mode | `src/hooks/useSpeechToText.js`, `src/hooks/useOfflineWhisper.js`, `src/workers/whisperWorker.js` | Cloud STT (online) + Whisper WASM (offline) |
| 4 | Jalur A — Triase Verbal (NLP Keyword) | `src/pages/relawan/VerbalPage.jsx`, `src/lib/scoring.js`, `src/lib/keywords.js` | 16 keyword merah, 25 kuning |
| 5 | Jalur B — Triase Non-Verbal (Checklist 8 butir) | `src/pages/relawan/NonVerbalPage.jsx` | 3 kritis + 4 peringatan + 1 positif |
| 6 | Offline-First Data Storage | `src/lib/db.js`, `src/lib/sync.js`, `src/hooks/useOfflineSync.js` | IndexedDB via Dexie, auto-sync saat online |
| 7 | Indikator Status Online/Offline | `src/components/layout/RelawanLayout.jsx`, `src/hooks/useOnlineStatus.js` | Badge pending count, banner offline |
| 8 | Dashboard Admin — KPI Cards & Pie Chart | `src/pages/admin/DashboardPage.jsx` | Total kasus, distribusi zona, 10 kasus terbaru |
| 9 | Admin — Browser Kasus | `src/pages/admin/CasesPage.jsx` | Pencarian, filter zona/posko, accordion detail |
| 10 | Admin — Statistik & Tren | `src/pages/admin/StatsPage.jsx` | Line chart 7 hari, bar chart per posko, pie global |
| 11 | Admin — Peta Geospasial | `src/pages/admin/MapPage.jsx` | Leaflet + OpenStreetMap, circle marker per posko |
| 12 | PWA Config | `vite.config.js` | vite-plugin-pwa, precaching workbox |
| 13 | Demo Data Seeding | `src/lib/seed.js` | 10 kasus sintetis di 5 posko Jabodetabek |
| 14 | Riwayat Triase Relawan | `src/pages/relawan/HistoryPage.jsx` | Daftar offline-aware dengan status sinkronisasi |

---

## 2. Fitur Terimplementasi Sebagian (⚠️)

### ⚠️ PFA (Psychological First Aid)
- **Saat ini:** Hanya modal statis 6 langkah yang muncul di `ResultPage.jsx` saat zona merah.
- **Seharusnya (Screen 3):** Wizard interaktif 3 langkah (LOOK → LISTEN → LINK) sebagai alur terpisah untuk Fase Akut Hari 1–3.
- **Gap:** Tidak ada halaman panduan interaktif mandiri sebelum triase lanjutan.

### ⚠️ Triage Scoring
- **Saat ini:** 3 zona warna (merah / kuning / hijau) dengan skor 0–3.
- **Seharusnya (Screen 7):** 4 tier standar bencana — T0 (Emergency), T1 (High Risk: SRQ ≥ 11), T2 (Moderate: SRQ 6–10), T3 (Low: SRQ 0–5).
- **Gap:** Belum ada tier T0 darurat dan cut-off score SRQ-20 baku.

### ⚠️ Admin Map (Heatmap)
- **Saat ini:** Circle marker proporsional per posko (bukan continuous density heatmap).
- **Seharusnya:** Interactive Geospatial Heatmap dengan layer densitas dan visual pin berkedip untuk T0.
- **Gap:** Belum ada library visualisasi heatmap kontinu (`leaflet.heat`).

---

## 3. Fitur yang Belum Diimplementasikan (❌)

### Screen 2 — Identitas Penyintas & Auto-Lookup System
- **Form Identitas Pasien:** Tidak ada input NIK (16 digit), nama, usia, jenis kelamin, dan kerentanan khusus sebelum triase.
- **Auto-Lookup System:** Belum ada branching logic berbasis NIK:
  - *NIK Baru:* Harusnya diarahkan ke Menu PFA (Fase Akut Hari 1–3).
  - *NIK Terdaftar:* Harusnya menampilkan riwayat medis sebelumnya dan langsung ke Wawancara SRQ-20 (Fase Lanjutan Hari 4–30).
- **Dampak:** Kasus tersimpan tanpa ID pasien sehingga pemantauan longitudinal tidak dapat berjalan.

### Screen 3 — Menu PFA Interaktif (Fase Akut: Hari 1–3)
- **Wizard Look-Listen-Link:** Belum ada antarmuka panduan 3 tahap:
  - *LOOK:* Observasi visual keselamatan fisik dan tanda bahaya.
  - *LISTEN:* Panduan dialog penenangan dan pendengaran aktif.
  - *LINK:* Checklist pemenuhan kebutuhan dasar (pangan, shelter, obat, keluarga).
- **Separasi Fase:** Belum ada pemisahan penanganan fase akut (Hari 1–3) vs fase lanjutan (Hari 4–30).

### Screen 4 — Red Flag Emergency (T0)
- **Persistent Floating Shortcut (FAB):** Belum ada tombol darurat mengambang merah yang selalu aktif di Screen 2–7.
- **3 Verification Gate Modal:** Belum ada modal konfirmasi singkat (Ideasi bunuh diri, Psikosis akut/agitasi, Kegawatan medis fisik) sebelum sinyal darurat terkirim.
- **Klasifikasi T0-Suspect:** Belum ada pencatatan status krisis T0 terpisah dari skor SRQ-20.
- **Kunci GPS & Pengiriman Alert:** Belum ada pengiriman payload darurat ke Command Center Faskes / PSC 119.

### Screen 5 — Wawancara SRQ-20 (Fase Lanjutan: Hari 4–30)
- **Instrumen Kuesioner SRQ-20:** Belum ada instrumen 20 pertanyaan baku WHO. Jalur verbal saat ini hanya mencocokkan kata kunci pada teks bebas.
- **STT Auto-Checklist pada Soal:** Belum ada pemetaan pengenalan suara ke butir-butir pertanyaan SRQ-20 dengan kendali manual relawan (human-in-the-loop).
- **Tooltip Edukasi Relawan:** Belum ada petunjuk edukasi di setiap butir pertanyaan agar relawan tidak salah tafsir saat bertanya.

### Screen 6 — Penilaian Faktor Risiko & Keberfungsian Hidup
- **Form Evaluasi Dampak Trauma:** Belum ada evaluasi dampak trauma pada keberfungsian harian (tidur, makan, aktivitas harian, duka cita keluarga inti).

### Role 2 — Dashboard Tenaga Kesehatan / Faskes / PSC 119
- **Seluruh Dashboard Role 2 Belum Ada:**
  - Antrean Panggilan Darurat T0-Suspect real-time.
  - Kartu T0 pulsing alert dengan data posko, NIK, dan gejala red flag.
  - Modal verifikasi Tele-Emergency (simulasi panggilan video/suara ke relawan posko).
  - Tombol aksi validasi dua arah: **Konfirmasi Rujukan (T0-Confirmed)** atau **Downgrade Status (ke T1/T2)**.
  - Status pemantauan armada ambulans/tim reaksi cepat.

### Role 3 — Peningkatan Dashboard Admin (BPBD & Dinkes)
- **Filter Rentang Fase:** Belum ada filter pemilah data Fase Akut (Hari 1–3) vs Fase Lanjutan (Hari 4–30).
- **Sinkronisasi Real-Time:** Dashboard saat ini menggunakan `getDocs` sekali baca (belum memakai `onSnapshot` untuk update langsung tanpa refresh).
- **Ekspor Laporan:** Belum ada tombol ekspor ringkasan eksekutif ke PDF/Excel.
- **Tabel Longitudinal 30 Hari:** Belum ada tabel master pasien yang menampilkan riwayat perkembangan risiko per individu.

### Otentikasi & RBAC
- **Role Nakes/Faskes:** Sistem otentikasi saat ini hanya mengenali `relawan` dan `admin`. Role faskes (`nakes`) belum terdaftar.
- **Registrasi Terbuka:** Pembuatan akun Admin masih terbuka bebas tanpa kode verifikasi atau proteksi.

### PWA & Infrastruktur
- **Aset Ikon Hilang:** Berkas `icon-192.png` dan `icon-512.png` belum ada di folder `public/`.
- **PWA Meta Tags:** `index.html` belum memiliki meta tag tema, apple mobile web app, dan manifest header.

---

## 4. Temuan Bug & Inkonsistensi Logika

1. **Butir Pertanyaan `q8` Tidak Dihitung (`src/lib/scoring.js`):**
   Pada `NonVerbalPage.jsx`, terdapat pertanyaan `q8` (*"Korban bisa berkomunikasi dan tampak relatif tenang"*), namun di dalam fungsi `analyzeChecklist` variabel `q8` sama sekali tidak dievaluasi dalam skoring.
2. **Indikator Hijau Tidak Digunakan (`src/lib/keywords.js`):**
   Array `ZONA_HIJAU_INDICATORS` diekspor tetapi tidak pernah diimpor ke `scoring.js`. Zona hijau saat ini murni merupakan *fallback* jika tidak ada kata kunci merah/kuning.
3. **Tabel `pendingSync` Menganggur (`src/lib/db.js`):**
   Tabel `pendingSync` dideklarasikan di skema IndexedDB, tetapi kode sinkronisasi di `sync.js` hanya memfilter `localDb.cases.where("synced").equals(0)`.
4. **Alur Redirect Login Kurang Tepat (`src/pages/LoginPage.jsx`):**
   Login selalu mengarahkan pengguna ke `/relawan`, lalu bergantung pada `ProtectedRoute` untuk memantul akun admin ke `/admin`.
