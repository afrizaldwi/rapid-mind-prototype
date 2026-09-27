# RAPID-MIND — Implementation Plan (Demo Prototype)

> **Dokumen:** Rencana Eksekusi & Implementasi Prototipe RAPID-MIND  
> **Tanggal Pembaruan:** 27 September 2026
> **Status:** **Phase 2A domain foundation selesai di source dan tes otomatis; Screen 5/6/7 serta routing Phase 2 belum dibuat. Validasi browser Phase 2A belum dilakukan. Phase 1C smoke test browser tetap PASS. Belum full E2E. Migrasi v2 berisi data → v4 NOT RUNTIME TESTED.**
> **Target:** Prototipe demo end-to-end tanpa *dead end*, mencakup alur Relawan, Faskes/PSC 119, dan Admin BPBD/Dinkes.

---

## 1. Snapshot Progress Saat Ini

| Area | Status | Catatan |
|---|:---:|---|
| Fondasi React/Firebase/PWA | ✅ | Sudah tersedia |
| Auth + RBAC `relawan/admin` | ✅ | Role `nakes` belum ada |
| Legacy verbal/non-verbal triage | ✅ | Akan menjadi legacy setelah SRQ-20/4-tier aktif |
| Phase 1A: `cases` bertipe/berversi | ✅/⚠️ | Source, pemeriksaan manual browser/runtime terpilih, dan Vitest PASS; belum full E2E |
| Offline `patients` dan `cases` + reconnect sync | ✅ | Startup/reconnect pasien dan pasien baru offline → reconnect lulus smoke test manual |
| Dashboard Admin dasar | ✅ | Snapshot `getDocs`, belum real-time |
| **Screen 2 Patient Lookup** | ✅/⚠️ | UI, NIK lookup, register, history sudah ada; integrasi downstream belum utuh |
| Dexie v4 `patients` + `emergencies` | ✅/⚠️ | Baseline v4 bersih PASS; migrasi v2 berisi data → v4 NOT RUNTIME TESTED |
| PFA LOOK/LISTEN/LINK | ✅/⚠️ | Selesai untuk scope terpilih: source, 78/78 tes otomatis, smoke test percabangan, dan retest pre-merge PASS; belum full E2E |
| `/relawan/history` lintas browser | ⚠️ | History membaca Dexie lokal; hidrasi kasus Firestore lintas browser belum tersedia |
| Red Flag T0-Suspect (Phase 1C) | ✅/⚠️ | Source, tes otomatis, dan smoke test browser PASS; Faskes T0 belum ada |
| SRQ-20 | ✅/⚠️ | Protokol template, validasi, dan base scoring Phase 2A tersedia; halaman belum ada |
| Risk Factor + Gangguan Fungsi | ✅/⚠️ | Protokol template dan validasi Phase 2A tersedia; halaman dan aturan adjustment belum ada |
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

Phase 0A menutup putusnya patient context dan bypass bottom nav. Source Phase 0B menangani persistensi/sinkronisasi pasien dan kasus; source Phase 0C menyiapkan seed demo deterministik. Smoke test manual Firebase, reconnect, baseline v4 bersih, PWA refresh offline, dan seed telah terkonfirmasi PASS. Phase 1A menambahkan `recordType`, `protocolVersion`, `responses`, dan pembaca zona yang aman tanpa mengubah Dexie v4. Pemeriksaan manual Phase 1A untuk simpan legacy verbal/non-verbal, PFA offline→reconnect/cloud, payload tanpa zona/lokasi palsu, dan pembaca Relawan/Admin PASS. Phase 1B menambahkan wizard LOOK/LISTEN/LINK dan protokol provisional; retest browser percabangan pasien PASS. Urutan pasien sebelum kasus diuji oleh Vitest, belum diklaim sebagai pemeriksaan browser manual. Migrasi v2 berisi data → v4 tetap NOT RUNTIME TESTED.

---

## 2. Prinsip & Keputusan Desain yang Berlaku

1. **No dead ends.** Semua tombol demo utama harus menghasilkan transisi state yang jelas dan dapat dipresentasikan end-to-end.
2. **NIK adalah identitas pasien lintas penyimpanan.** Assessment dan case memakai `patientNik`; ID Dexie dan ID dokumen Firestore hanya detail penyimpanan.
3. **Jangan mengandalkan route state sebagai satu-satunya sumber identitas.** Route state boleh digunakan untuk UX, tetapi active assessment context harus bertahan jika user pindah sub-route/refresh ringan.
4. **Offline-first berlaku pada entitas penting, bukan hanya `cases`.** Minimal `patients`, assessment/cases, dan emergency event harus memiliki mekanisme retry/sync yang eksplisit.
5. **SRQ-20 prototype modular.** 20 butir ber-ID stabil berada di `src/protocols/srq20Protocol.js`; teksnya `[Template]` dan dapat diganti tanpa mengubah validasi. Cut-off T3 0–5, T2 6–10, T1 11–20 berasal dari `docs/workflow.md` sebagai **prototype requirement**, bukan klaim validasi klinis dari source code.
6. **Human-in-the-loop.** STT/NLP hanya membantu prefill/auto-check; relawan tetap dapat mengoreksi semua jawaban sebelum submit.
7. **Role 2 dibuat simplified tetapi stateful.** Fokus pada queue T0-Suspect, simulasi Tele-Emergency, confirm/downgrade, dan tracking status.
8. **Real-time menggunakan Firestore `onSnapshot`.** Tidak perlu Cloud Functions/FCM untuk demo awal; Browser Notification + audio chime cukup untuk simulasi command center.
9. **Jangan polish sebelum core loop selesai.** Heatmap kontinu, export, dan animasi berada setelah flow Relawan → Faskes → Admin terhubung.

---

## 3. Arsitektur Data — Current vs Target

### A. Legacy Dexie v2 (input migrasi Phase 0B)

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

**Status Phase 0B:** versi aktif adalah Dexie v4. `patients.syncStatus` memakai `pending | synced | conflict`; `syncPendingData()` memproses pasien pending sebelum kasus. `patientConflicts` menyimpan salinan lengkap row v2 duplikat/invalid dan informasi rekonsiliasi lokal. Kasus memakai `firestoreId` yang dipersist sebelum `setDoc()` agar retry menulis dokumen yang sama.

### B. Target logical model

```text
users
└── { uid, email, name, role, poskoName, poskoLat, poskoLng, phone }

patients
└── { nik, nama, usia, jenisKelamin, poskoName, registeredAt, syncStatus,
      lastPhase?, pfaCompleted? } // dua field terakhir hanya kompatibilitas, bukan sumber kebenaran

cases (rekam asesmen longitudinal)
├── legacy: { recordType?:"legacy-triage", protocolVersion?, patientNik?,
│             zona, triageResult?, jalur, timestamp, synced, firestoreId }
├── PFA: { recordType:"pfa", protocolVersion, patientNik, phase:"akut",
│          responses:{ [itemId]: nilai }, relawanId, poskoName,
│          timestamp, synced, firestoreId }
└── SRQ-20 nanti: { recordType:"srq20", protocolVersion, patientNik,
                   phase:"lanjutan", responses, tier, timestamp, synced, firestoreId }

emergencies
└── { patientNik, relawanId, poskoName, lat, lng,
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

## Phase 0 — Integration Hardening Setelah Track A.1 (**source selesai; smoke test manual terkonfirmasi**)

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
- Result persistence selalu menulis `patientNik`.
- Jika context kosong dan user membuka sub-route langsung, redirect ke `/relawan/patient-lookup`.
- Context sebaiknya memiliki fallback persistence ringan (mis. `sessionStorage`) agar tidak hilang saat refresh selama sesi demo.

**Acceptance criteria:** case yang disimpan setelah memilih pasien dapat ditemukan kembali melalui lookup NIK yang sama.

### 0.3 Perbaiki patient persistence & offline sync — source Phase 0B selesai

**Modify:** `src/lib/db.js`, `src/lib/sync.js`, `src/pages/relawan/PatientLookupPage.jsx`

Target:
- v3 mengarsip seluruh row duplikat/invalid, mempertahankan satu row ekuivalen secara deterministik atau mengarantina grup yang berbeda secara material; v4 memakai `&nik`.
- `syncStatus` pasien membedakan pending, synced, dan conflict. Konflik tidak di-retry otomatis.
- `patients/{nik}` dipakai untuk dokumen baru setelah pembacaan server terhadap canonical path dan query NIK. Satu dokumen lama tetap dipakai; lebih dari satu menjadi konflik eksplisit.
- Profil cloud yang sudah ada menjadi dasar cache lokal tanpa menimpa cloud dengan formulir lokal. NIK tetap identitas domain; age/posko asesmen dapat berbeda dari profil direktori.
- Kasus memakai `firestoreId` persisten dan `setDoc()` agar retry tidak mengalokasikan ID cloud baru.
- Hook sync menangani startup sudah online, reconnect, dan hitungan pending/konflik terpisah.

**Catatan schema:** v2 tetap utuh. Phase 0B memakai v3 untuk audit/cleanup dan v4 untuk index unik `&nik`.

**Batas validasi:** baseline Dexie v4 bersih PASS. Migrasi v2 berisi data → v4 **NOT RUNTIME TESTED**; kode migrasi dipertahankan sebagai perlindungan kompatibilitas dan telah ditinjau dari source.

### 0.4 Seed data Screen 2 yang deterministik — source Phase 0C selesai

**Modify:** `src/lib/seed.js`

Seed memastikan pasien lama sesuai preset (`3201234567890002`, Budi Santoso) dan satu dari sepuluh kasus legacy memiliki `patientNik` itu. Sepuluh kasus memakai ID dan waktu demo stabil; seeding berulang memakai dokumen yang sama. Preset pasien baru (`3201234567890001`) tidak diseed. Record acak dari seed lama tidak dihapus otomatis.

**Acceptance criteria:** pada database demo bersih, dua tombol preset menghasilkan dua branch yang berbeda secara deterministik.

### 0.5 Regression test Phase 0

Skenario wajib:
1. Pasien baru → register → lanjut → case akhir menyimpan NIK yang sama.
2. Pasien lama → lookup → history tampil → lanjut → case akhir menyimpan NIK yang sama.
3. Bottom nav “Triase Baru” selalu masuk Screen 2.
4. Register pasien saat offline → kembali online → patient cloud record akhirnya muncul.
5. Refresh pada tengah assessment tidak membuat assessment berubah menjadi anonim.

**Hasil gate:** smoke test manual Phase 0 terkonfirmasi PASS untuk alur prototipe saat ini. Migrasi legacy berisi data tetap belum diuji runtime karena data prototipe lama sengaja direset. Milestone berikutnya Phase 1.

---

## Phase 1 — Acute Flow: PFA + Red Flag T0

### 1.0 Fondasi persistensi asesmen bertipe (Phase 1A — source selesai)

- `cases` tetap menjadi store longitudinal; ResultPage legacy baru dan record bertipe memakai `recordType` dan `protocolVersion`. `responses` memakai ID item stabil dengan nilai skalar (teks, angka hingga, boolean, atau null) agar isi protokol dapat diganti. Pada akhir Phase 1A, PFA dan SRQ-20 belum memiliki halaman/protokol.
- Record lama tanpa tipe dihitung sebagai triase legacy hanya bila zona merah/kuning/hijau valid. Record yang rusak atau tidak dikenal tidak menjadi Zona Hijau. PFA tampil netral dan dikeluarkan dari statistik/peta zona legacy.
- Upload kasus dengan `patientNik` memastikan pasien lokal sudah `synced`, atau menyinkronkan pasien `pending` terlebih dahulu. Konflik/kegagalan membuat kasus tetap pending. Kasus lama tanpa `patientNik` tetap kompatibel.
- PFA/record bertipe tidak mendapat `zona`, `triageResult`, atau koordinat fallback demo; `location` hanya dibuat dari pasangan angka lat/lng yang valid. ID Firestore kasus tetap dipersist sebelum `setDoc()` dan dipakai ulang saat retry.
- Dexie tetap v4. Bukti PFA selesai nantinya berasal dari record PFA selesai, bukan `patients.pfaCompleted`/`lastPhase`. Pemeriksaan manual browser/runtime terpilih PASS. Vitest mencakup validasi/klasifikasi bertipe, kompatibilitas legacy, serialisasi, urutan pasien→kasus, penggunaan ulang ID Firestore, dan lokasi bertipe; belum ada suite E2E penuh.

### 1.1 PFA Wizard (`PfaPage.jsx` — Screen 3; Phase 1B source selesai)

**Ada:** `src/pages/relawan/PfaPage.jsx`, `src/components/pfa/PfaSection.jsx`, `src/protocols/pfaProtocol.js`, `src/lib/pfa.js`.

Tiga tahap:
- **LOOK:** keamanan fisik, kondisi lingkungan, tanda bahaya akut.
- **LISTEN:** guided listening/dukungan awal.
- **LINK:** kebutuhan dasar, keluarga, shelter, obat, akses layanan.

Implementasi Phase 1B:
- Pasien baru masuk `/relawan/pfa` dari Patient Lookup. Pasien terdaftar hanya menuju fallback triase legacy jika riwayat memiliki record PFA bertipe valid; tanpa bukti tersebut, pasien melanjutkan PFA akut hanya saat asesmen akut NIK yang sama aktif atau ketiadaan PFA telah diverifikasi melalui cloud. Rute PFA dijaga assessment context dan asesmen `lanjutan` dialihkan ke triase legacy tanpa menghapus konteks.
- Definisi protokol LOOK/LISTEN/LINK memakai versi `pfa-prototype-v1`, ID respons stabil, dan teks Indonesia yang **provisional**, bukan protokol klinis final. Boolean wajib harus dijawab eksplisit `true` atau `false`.
- Draf belum selesai hanya berada di `sessionStorage` dan terikat pasien, sesi asesmen, serta versi protokol. Draf tidak ditulis ke `cases`. Pencarian ulang NIK yang sama melanjutkan asesmen akut aktif tanpa mengganti sesi; asesmen pasien lain memerlukan pembatalan eksplisit. Pasien yang ditinggalkan tetap terdaftar dan PFA belum selesai.
- Logout Relawan menghapus asesmen aktif dan draf PFA sesi, sambil mempertahankan pasien terdaftar, kasus selesai, dan data pending sync; login ulang tidak memulihkan draf yang ditinggalkan. Patient Lookup membedakan riwayat cloud yang berhasil dicek dari status tidak terverifikasi (offline atau kueri server gagal). Record PFA lokal valid tetap membuktikan selesai, termasuk `synced: 0`; asesmen akut aktif untuk NIK yang sama tetap dapat dilanjutkan offline dengan sesi/jawaban semula. Tanpa keduanya, hanya riwayat cloud terverifikasi yang boleh memulai PFA baru. Status belum terverifikasi hanya menawarkan `Coba Lagi`, tanpa aksi PFA atau fallback lanjutan dan tanpa membatalkan asesmen pasien lain. Retest browser perbaikan ini **PASS**.
- Selesai PFA menyimpan record bertipe lokal lebih dulu melalui `saveCase()`; record valid dalam riwayat menjadi bukti penyelesaian meskipun `synced: 0`. Kegagalan cloud membiarkan kasus pending dan tidak menahan navigasi pulang. Registrasi maupun `patients.pfaCompleted`/`lastPhase` bukan sumber kebenaran.
- Koordinat PFA hanya berasal dari pasangan angka valid pada profil Relawan. Tidak ada zona legacy atau lokasi fallback; fase akut tidak otomatis berlanjut ke SRQ-20.
- **Status Phase 1B:** selesai untuk scope prototipe terpilih; source dan `npm test` 78/78 PASS. Smoke test browser percabangan, resume, dan pembatalan **PASS**: pasien terdaftar tanpa record PFA selesai melihat `PFA belum selesai` ketika riwayat berhasil diverifikasi; `Lanjutkan PFA` melanjutkan asesmen akut/draf pasien dan sesi aktif yang sama; pindah pasien meminta pembatalan eksplisit, yang menghapus asesmen/draf tetapi mempertahankan pasien terdaftar; setelah PFA selesai, lookup menampilkan `PFA telah selesai` dan aksi fallback SRQ-20. Retest pre-merge **PASS**: pembersihan logout, pengenalan PFA selesai lintas browser saat online, status tidak terverifikasi saat cloud tidak tersedia, resume draf akut pasien yang sama saat offline, serta PFA lokal bertipe valid yang tetap dihitung selesai tanpa verifikasi cloud. Belum ada suite E2E penuh.
- Operasi pasien/PFA IndexedDB offline berhasil. Refresh `npm run dev` saat Chrome DevTools Offline menghasilkan `ERR_INTERNET_DISCONNECTED`, batas pengujian development server. Refresh offline pada bundle produksi `npm run build` + `npm run preview` berhasil melalui PWA/service worker; ini tidak menyatakan seluruh skenario PWA/offline telah diuji E2E.
- **Gap hardening terpisah:** `/relawan/history` membaca `cases` Dexie lokal; browser/sesi lain pada akun Relawan yang sama belum menghidrasi kasus dari Firestore, sehingga isi History dapat berbeda meski upload cloud berhasil. Ini tidak memengaruhi percabangan Patient Lookup. Solusi mendatang dapat menggabungkan kasus Firestore ke History saat online atau melakukan hidrasi Firestore → Dexie; desain belum dipilih.

### 1.2 Persistent Red Flag FAB (`RedFlagFAB.jsx` — Screen 4 trigger)

**Status Phase 1C:** source, 93/93 tes otomatis, dan smoke test browser **PASS**; belum ada suite E2E penuh.

- `RedFlagFAB.jsx` dipasang di `RelawanLayout` pada Home, Patient Lookup, PFA, dan halaman triase legacy; tidak tampil pada History atau rute non-Relawan. Modal tidak mengubah halaman/asesmen/draf PFA saat dibuka, ditutup, atau setelah simpan emergency.
- `redflag-prototype-v1` mendefinisikan tepat tiga indikator provisional dengan ID stabil. Minimal satu pilihan menghasilkan event `t0-suspect` terpisah dari `cases`, termasuk tanpa asesmen pasien aktif.
- Snapshot pasien hanya dari asesmen aktif milik UID Relawan. Posko dan pasangan koordinat hanya dari profil Relawan bila valid; koordinat fallback/random legacy tidak dipakai. Event tidak dihitung sebagai tier kasus atau hasil scoring SRQ-20.

### 1.3 Emergency sync contract

**Status Phase 1C:** source, 93/93 tes otomatis, dan validasi browser manual **PASS**; belum ada suite E2E penuh.

- `emergencies` Dexie v4 menyimpan event tervalidasi lebih dulu dengan `synced: 0`. UI segera menunjukkan simpan lokal, kemudian memantau Promise upload yang dimulai saat online; gagal cloud tetap pending, gagal lokal mempertahankan form untuk retry.
- Serializer eksplisit menulis field event ke Firestore `emergencies`, dengan waktu event sebagai Firestore Timestamp tanpa ID lokal/status sync. `firestoreId` tersimpan sebelum `setDoc()` dan dipakai ulang saat retry; panggilan bersamaan untuk record yang sama digabung.
- Satu lifecycle sinkronisasi memproses pasien → emergency → kasus. Emergency tidak menunggu kesiapan direktori pasien; kasus terkait NIK tetap menunggu pasien aman/synced. Pending count dan hasil `complete` kini memasukkan emergency.
- Smoke test browser Phase 1C **PASS** untuk simpan lokal offline, kata-kata status dan counter pending, serta reconnect. Saat upload Firestore online gagal, event lokal tetap pending dengan `firestoreId` tersimpan; reconnect memakai persis ID tersebut dan menghasilkan satu dokumen emergency Firestore tanpa duplikat. Koordinat profil Relawan yang valid tersalin; tanpa `poskoLat` dan `poskoLng` pada profil, `lat` dan `lng` tidak ada pada record lokal maupun Firestore, tanpa GPS fallback. Hasil manual ini terpisah dari tes otomatis berbasis mock.
- Status/konfirmasi oleh Faskes tetap Phase 3; event Phase 1C hanya `t0-suspect`.

---

## Phase 2 — Longitudinal Flow: SRQ-20 + Risk + Result 4-Tier

### 2A — Domain foundation (source dan tes otomatis selesai)

- `srq20-prototype-v1` berisi tepat 20 butir berurutan `srq20.01`–`srq20.20`; `risk-function-prototype-v1` berisi masing-masing empat butir Faktor Risiko dan Gangguan Fungsi. Semua label masih `[Template]` dan **provisional**, bukan bunyi/indikator klinis final.
- Validator domain menerima jawaban boolean parsial untuk draf dan meminta seluruh butir untuk penyelesaian. Satu draf Screen 5+6 di `rapidMind.longitudinalDraft` terikat UID Relawan, NIK, sesi asesmen, fase lanjutan, dan versi protokol aktif; mode verbal/nonverbal menghasilkan bentuk jawaban SRQ yang sama. Belum ada penyimpanan audio/transkrip.
- `analyzeSrq20()` menghasilkan skor dan base tier T1/T2/T3 dari ambang prototipe `workflow.md`. `calculateFinalTier()` memerlukan checklist Screen 6 lengkap, tetapi algoritme adjustment Screen 6 **NOT DEFINED / NOT IMPLEMENTED**; `classification-prototype-v1` sengaja menghasilkan `finalTier === baseTier`, tanpa bobot atau skor faktor risiko. T0-Suspect tetap mekanisme Red Flag terpisah.
- Record SRQ selesai memerlukan metadata, jawaban lengkap, skor/base tier yang cocok dengan jawaban, dan `tier` sesuai versi klasifikasinya. Validasi memakai versi yang tersimpan pada record dan menolak versi yang belum didukung; validitas v1 tidak bergantung pada versi protokol aktif di masa depan. Dexie tetap v4.

### 2B/2C — UI, hasil, dan save flow (belum dikerjakan)

- Bangun Screen 5 SRQ-20 dengan pilihan verbal/nonverbal, panduan dan kendali manual atas jawaban; STT hanya bantuan dan belum termasuk 2A.
- Bangun Screen 6 sebagai satu halaman dengan bagian Faktor Risiko dan Gangguan Fungsi. Ganti label template setelah isi protokol disepakati; aturan adjustment klasifikasi memerlukan keputusan protokol tersendiri.
- Bangun Screen 7 dan penyimpanan record lengkap, lalu pindahkan routing pasien lama dari fallback triase legacy. Sampai itu selesai, ResultPage dan alur merah/kuning/hijau tetap aktif.

**Gate Phase 2:** pasien lama dapat menjalani `lookup → SRQ-20 → Risk/Function → T1/T2/T3 → save → history lookup` dengan NIK konsisten. Gate ini **belum tercapai** oleh 2A; tidak ada klaim browser/E2E untuk 2A.

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
| ✅ Phase 0B | `src/pages/relawan/PatientLookupPage.jsx`, `src/lib/patients.js` | Lookup/cache, registrasi, rekonsiliasi dan pemulihan konflik cloud lulus smoke test |
| ✅ Phase 0B | `src/lib/db.js` | v2 utuh; v3 audit/cleanup; v4 unique NIK |
| ✅ existing | `src/App.jsx` | Tambah PFA/SRQ/Risk/Faskes routes pada phase terkait |
| ✅ existing | `src/pages/relawan/HomePage.jsx` | Tidak perlu perubahan besar untuk entry Screen 2 |
| ✅/⚠️ Phase 1C | `src/components/layout/RelawanLayout.jsx` | FAB pada route Relawan relevan; pending emergency di banner; smoke test browser Phase 1C PASS |
| ✅ Phase 0A | `src/contexts/AssessmentContext.jsx` | Active patient/phase context + session persistence |
| ✅/⚠️ Phase 1C | `src/lib/sync.js` | Pasien → emergency → kasus; hasil/count emergency terintegrasi; smoke test browser Phase 1C PASS |
| ✅/⚠️ Phase 1A | `src/lib/caseRecords.js`, `src/lib/sync.js`, pembaca kasus Relawan/Admin | Contract bertipe, serializer dan pembacaan zona aman; manual terpilih dan Vitest PASS |
| ✅ Phase 0C | `src/lib/seed.js` | Budi + linked history dan seed berulang lulus smoke test |
| ✅ Phase 1B terpilih | `src/pages/relawan/PfaPage.jsx`, `src/pages/relawan/PatientLookupPage.jsx` | LOOK/LISTEN/LINK; 78/78 tes otomatis, smoke test percabangan, dan retest pre-merge PASS; belum full E2E |
| ✅/⚠️ Phase 1C | `src/components/RedFlagFAB.jsx` | FAB + 3 indikator provisional; smoke test browser Phase 1C PASS |
| ✅ Phase 2A | `src/protocols/srq20Protocol.js` | 20 definisi butir template ber-ID stabil; halaman tetap Phase 2B |
| **NEW Phase 2** | `src/pages/relawan/Srq20Page.jsx` | SRQ-20 + STT assist |
| **NEW Phase 2** | `src/pages/relawan/RiskFactorPage.jsx` | Risk/function evaluation |
| ✅/⚠️ Phase 2A | `src/lib/scoring.js`, `src/lib/classification.js` | SRQ base tier dan kontrak klasifikasi v1 tersedia; UI hasil dan adjustment Screen 6 belum ada |
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

**Status terkini:** Phase 2A menyediakan fondasi domain SRQ-20, Risk/Function, draf, scoring, dan kontrak record; Screen 5/6/7, routing, dan browser flow Phase 2 belum ada. Phase 1C Red Flag/T0-Suspect tetap memiliki smoke test browser **PASS** dari tahap sebelumnya. Hasil manual Phase 0 dan validasi terpilih Phase 1A/1B tetap sebagaimana tercatat sebelumnya. Belum ada suite E2E penuh. `/relawan/history` lintas browser serta hardening idempotensi penyelesaian PFA tetap gap terpisah. Faskes validasi T0 dan hasil T1/T2/T3 masih pekerjaan berikutnya. Migrasi v2 berisi data → v4 tetap **NOT RUNTIME TESTED**; kode migrasi dipertahankan.
