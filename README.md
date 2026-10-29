# Presensi — SMKN 1 Kuantan Mudik (React + Tailwind PWA)

Versi 2.5 - antarmuka React 19 + Vite + Tailwind CSS 4, mobile-first, PWA yang bisa dipasang, plus **manajemen data guru & siswa** (CRUD + import CSV).

Backend: **Google Apps Script + Google Spreadsheet** (`kode.gs` - versi v8: absensi per jam, rekap harian, rekap semester, kasus otomatis, apel pagi, dan rincian per guru).

---

## 1. Yang baru di versi ini

### Absensi per jam & rekap harian konsisten (v8)
- **Izin/cabut hanya di jam tertentu.** Pemilih *"Status diisi untuk: Semua jam | Jam 3 |
  Jam 4 | Jam 5"* memungkinkan satu sesi menyimpan status berbeda tiap jam (mis. izin
  hanya jam 4, siswa lain tetap hadir). Chip per siswa menampilkan status **DIISI** per jam
  dan status **TERSIMPAN** yang sudah ada di server.
- **Kartu "Tercatat hari ini"** menampilkan sesi per jam + siswa yang tidak hadir, dengan
  tautan ke **Riwayat → Edit** untuk mengubah data tersimpan.
- **Rekap bulanan & semester dihitung harian:** Hadir hanya bila **seluruh jam pada hari
  itu hadir**; bila ada Sakit/Izin/Alpha/Cabut, status itulah yang ditampilkan. Jumlah
  semester dihitung per hari (beberapa pertemuan satu tanggal tidak dihitung ganda).
- Catatan kaki pada laporan bulanan & semester menjelaskan aturan tersebut.

### Laporan per jam & ringkasan harian (v7)
- **Perbaikan penting: NISN nol depan.** Sheets menyimpan NISN sebagai angka sehingga
  `0098873773` menjadi `98873773`. Semua pencocokan NISN kini memakai kunci ternormalisasi
  (`nisnKey`), jadi seluruh siswa tercentang dan status `A`/`C` tampil di rekap. Kolom NISN
  juga diformat teks untuk data baru.
- **Rekap harian mengikuti input per jam pelajaran.** Tiap sel berisi status jam itu
  apa adanya (`✓` untuk hadir, `S`/`I`/`A`/`C` untuk lainnya); baris kedua kepala tabel
  menampilkan **mata pelajaran pengampu tiap jam**. Kolom *Status* tetap merangkum
  akhir hari (prioritas `C > A > S > I > H`).
- **Rekap bulanan = ringkasan harian.** Satu tanggal **hanya dicetak bila ada minimal
  satu siswa yang tidak hadir** di hari itu; sel berisi status terburuk hari tersebut
  dan `✓` bila semua jam hadir. Kolom **Jumlah hari** (H/S/I/A/C) dihitung dari
  **seluruh hari yang sudah diinput**, bukan hanya hari yang tampil. Bila tidak ada
  ketidakhadiran sama sekali, tabel diganti keterangan "seluruh siswa hadir".
- **Dashboard Piket: kartu "Absensi per Guru".** Menampilkan daftar sesi persis seperti
  input guru (jam, mapel, kelas, guru) beserta **nama siswa yang tidak hadir** dengan
  warna status. Kartu kelas tetap menjadi ringkasan H/S/I/A/C hari itu.

### Laporan & kasus pembinaan (v4)
- **Rekap guru mapel per semester** — mode *Per guru* di halaman Report punya pilihan
  periode **Bulanan** atau **Semester (pertemuan 1–24)**. Pilih semester (Ganjil/Genap),
  tahun ajaran, dan (opsional) mata pelajaran; tabel menampilkan pertemuan 1–24
  berurutan beserta jumlah H/S/I/A/C per siswa.
- **Cetak bersih** — hasil cetak hanya berisi kop surat, judul, tabel, dan tanda tangan.
  Sidebar, header, tombol, formulir, dan notifikasi tidak ikut tercetak. Laporan
  semester otomatis memakai kertas **A4 landscape**.
- **Kasus otomatis** — siswa yang mencapai **3× Alpha atau 3× Cabut** dalam satu semester
  otomatis dibuatkan kasus pembinaan (level wali kelas, status Open). Notifikasi muncul
  setelah absensi disimpan; halaman **Kasus Pembinaan** juga menyinkronkan data saat dibuka.
- **Menu Kasus Pembinaan** tersedia di sidebar (desktop) dan menu *Lainnya* (HP).

### Portal Orang Tua / Wali (`/ortu`)
- **Halaman publik terpisah** dari akun guru/admin — bisa dibuka langsung lewat
  `#/ortu` atau tautan **“Portal Orang Tua / Wali”** di halaman login.
- **Login paling sederhana, tanpa password:** masukkan **NISN anak** (angka) **atau
  nama anak**, lalu pilih **kelas anak** dari daftar. Tidak perlu tanggal lahir, email,
  atau kode aktivasi. Nama boleh ditulis tanpa huruf besar/tanda baca; bila ada beberapa
  siswa dengan nama mirip, portal menampilkan pilihan (tidak dihitung sebagai percobaan gagal).
- **Ingat perangkat 30 hari** (opsional, aktif secara default) — orang tua tidak perlu
  mengetik NISN setiap kali membuka aplikasi.
- **5× percobaan gagal → jeda 2 menit** di perangkat tersebut.
- Isi dashboard: status kehadiran **hari ini**, **persentase hadir** dan rekap
  H/S/I/A/C per bulan, peringatan bila Alpha/Cabut ≥ 3× sebulan atau ada kasus
  pembinaan terbuka, **laporan keterlambatan (apel pagi)**, serta **riwayat harian** lengkap dengan mapel dan jam.
- Menampilkan **hari efektif** dan daftar **libur nasional** bulan tersebut. Sabtu,
  Minggu, dan libur nasional ditandai **Libur** (bukan “belum absen”).
- Hanya menampilkan **satu siswa** (anak yang login); data tidak bisa diubah dari portal.
- Bisa berpindah bulan untuk melihat riwayat sebelumnya.

> **Catatan keamanan:** NISN bukan data rahasia (tertera di kartu pelajar). Login memakai
> nama anak juga berarti siapa pun yang tahu kelas dan nama anak dapat membuka portal;
> ini konsekuensi dari login “paling sederhana” tanpa password. Pembatasan 5× percobaan
> hanya berlaku di perangkat/browser yang dipakai, bukan di server. Jika sekolah
> membutuhkan perlindungan lebih ketat, tambahkan faktor kedua (mis. tanggal lahir) atau
> kode akses per siswa — struktur portal sudah siap menerima kolom tambahan.

### Kalender libur
- **Sabtu & Minggu** otomatis dianggap libur di Portal Orang Tua, Dashboard Piket,
  dan form Input Absensi.
- **Libur nasional & cuti bersama 2026** (SKB 3 Menteri) tersimpan di
  `src/lib/libur.js`, lengkap dengan nama hari libur. Hari libur tetap bisa diisi
  absensi bila ada kegiatan khusus; aplikasi hanya memberi penanda, tidak memblokir.

### Apel pagi (Dashboard Piket)
- Kartu **“Apel Pagi — Siswa Terlambat”** di dashboard piket. Petugas dapat memilih
  kelas, mencari siswa, mencentang beberapa siswa sekaligus, mengisi **jam datang**
  (otomatis jam sekarang) dan keterangan, lalu menyimpan.
- Data apel disimpan di sheet **`Apel`** (satu baris per siswa per tanggal) sehingga
  **tidak mengganggu** rekap mapel maupun kasus otomatis.
- Siswa yang sudah tercatat pada tanggal yang sama otomatis dilewati (tidak duplikat).
  Catatan apel bisa dihapus dari kartu yang sama.
- Bila server masih **v4** (action apel belum ada), kartu menampilkan keterangan
  "Pencatatan apel pagi belum aktif di server" dan tombol *Catat siswa* dinonaktifkan -
  tanpa pop-up error.

### Keterlambatan di Portal Orang Tua
- Dashboard orang tua punya kartu **Keterlambatan** berisi jumlah terlambat pada bulan
  yang sedang dilihat, daftar tanggal/jam datang/keterangan, dan status **hari ini**
  (terlambat atau tidak).
- Bila bulan berjalan, status hari ini juga tampil langsung di kartu profil anak.
- Data diambil dari sheet `Apel` lewat `getApelPagi?bulan=YYYY-MM&kelas=..&nisn=..`,
  sehingga orang tua hanya melihat catatan anaknya sendiri.

### Manajemen data (khusus admin)
- **Data Guru** (`/guru`) — daftar guru & staf, pencarian, filter role, tambah/edit/hapus.
- **Data Siswa** (`/siswa`) — daftar seluruh siswa, filter kelas, pencarian, pagination 50/halaman, tambah/edit/hapus.
- **Edit lewat sheet** — form muncul sebagai bottom sheet di HP / dialog di desktop.
- **Import massal** — unduh format CSV → isi di Excel/Google Sheets → unggah kembali (atau tempel langsung). Ada pratinjau, validasi, dan pilihan mode:
  - *Tambah & perbarui* (upsert berdasarkan NISN/NIP)
  - *Ganti seluruh data*
- **Kelas baru otomatis** ditambahkan ke sheet `Kelas` saat import menemukan kelas yang belum ada.

### Menu & hak akses
- Menu **Kepsek dihapus dari admin** (juga tidak bisa diakses lewat URL).
- Susunan menu sekarang:

| Role | Menu |
|---|---|
| **admin** | Dashboard, Input Absensi, Data Siswa, Data Guru, Riwayat, Piket, Report, Kasus Pembinaan |
| **kepsek** | Dashboard Kepala Sekolah, Kasus Pembinaan |
| **piket** | Dashboard Piket |
| **guru / wali** | Input Absensi, Report, Kasus Pembinaan |

Setiap rute punya *guard*: membuka rute yang bukan haknya akan dialihkan ke halaman yang benar (sudah diuji untuk admin→/kepsek, guru→/guru, piket→/siswa).

### Instalasi (PWA)
- **Tidak ada tombol/CTA install** di aplikasi (topbar, sidebar, menu *Lainnya*,
  halaman login, maupun halaman `/install` yang kini dihapus).
- Di ponsel hanya muncul **pop-up sekali** (setelah ~2,6 detik). Setelah aplikasi
  terpasang atau pop-up ditutup, pop-up **tidak muncul lagi**.
- Pemasangan dilakukan lewat **menu browser** (Chrome/Edge: menu ⋮ → *Install aplikasi* /
  *Tambahkan ke layar utama*; Safari: Bagikan → *Tambah ke Layar Utama*). Panduan
  lengkap tetap bisa dibuka dari pop-up tersebut.

---

## 2. Pembaruan backend (WAJIB)

File `kode.gs` (v8) memuat seluruh action lama **plus** action data guru/siswa dan apel pagi:

| Method | Action | Keterangan |
|---|---|---|
| GET | `getGuruData` | daftar guru lengkap (tanpa password) |
| GET | `getSiswaData` | daftar siswa (opsional `?kelas=`) |
| POST | `simpanGuru` | tambah/ubah guru (`originalNip` untuk ubah) |
| POST | `hapusGuru` | hapus berdasarkan NIP |
| POST | `importGuru` | import massal (`rows`, `mode`) |
| POST | `simpanSiswa` | tambah/ubah siswa (`originalNisn` untuk ubah) |
| POST | `hapusSiswa` | hapus berdasarkan NISN |
| POST | `importSiswa` | import massal (`rows`, `mode`) |
| GET | `getApelPagi` | daftar siswa terlambat (`?tanggal=&kelas=` atau `?bulan=YYYY-MM&kelas=&nisn=`) |
| POST | `simpanApelPagi` | catat apel (`tanggal`, `kelas`, `jam_datang`, `keterangan`, `siswa[]`) |
| POST | `hapusApelPagi` | hapus satu catatan apel (`id`) |

**Langkah pemasangan:**

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Ganti seluruh isi `Code.gs` di editor Apps Script dengan isi **`kode.gs`**.
3. **Deploy → Manage deployments → Edit (✏️) → Version: New version → Deploy.**
   (Tanpa langkah ini, URL `/exec` masih memakai kode lama dan halaman Data Guru/Siswa bisa menampilkan "Action tidak ditemukan".)

> **Penting soal URL:** alamat backend hanya ada di satu tempat, yaitu `GAS_URL` di
> `src/lib/api.js` (deployment aktif: `AKfycbzjuoBgMlKE2BVUEU3pwZwWGMyITWZUIaq4f8gWx0fGG7dlS6bWUCKqsIWiZJkVDq8`).
> Selalu pakai **Manage deployments -> Edit** pada deployment itu; tombol *New deployment*
> membuat alamat `/exec` baru sehingga aplikasi harus di-build ulang dengan URL baru.
4. Pastikan tab spreadsheet bernama: `Guru`, `Siswa`, `Kelas`, `Mapel`, `Jam`, `Absensi`.
   Sheet **`Kasus`** dan **`Apel`** dibuat otomatis saat dipakai (tidak perlu dibuat manual).

> Rincian bug yang diperbaiki, optimasi, dan rekomendasi ada di **`LAPORAN-PERBAIKAN.md`**.
> Setelah deploy, cek `?action=getVersion` — harus mengembalikan `"version":"v8"` dan
> `fitur` memuat `"nisn-normalisasi"` serta `"piket-per-guru"`.

**Perubahan struktur tabel:** hanya **satu sheet baru, `Apel`**, dengan kolom
`id | tanggal | nisn | nama_siswa | kelas | jam_datang | keterangan | petugas | timestamp`.
Sheet ini terpisah dari `Absensi` agar rekap mapel dan kasus otomatis tidak terpengaruh.
Kolom tabel lama tetap:

- `Guru` : `nip | nama_guru | username | password | role | mapel | kelas_wali`
- `Siswa`: `nisn | nama_siswa | kelas | jk`
- `Kelas`: `nama_kelas | jurusan` (opsional)

Catatan perilaku:
- Password **tidak dikirim** ke browser. Saat mengedit, kolom password dibiarkan kosong = password lama dipertahankan.
- Guru baru tanpa password akan memakai default **`123456`** (bisa langsung diganti).
- Import bersifat *upsert*: NISN/NIP yang sama akan diperbarui, bukan diduplikasi.

---

## 3. Menjalankan

```bash
npm install        # sekali saja
npm run dev        # http://localhost:5173
npm run build      # hasil produksi → dist/
npm run serve      # sajikan dist/ di http://localhost:8080
```

---

## 4. Deploy

- **Netlify/Vercel/Cloudflare Pages**: build `npm run build`, publish `dist` (`netlify.toml` sudah disiapkan).
- **GitHub Pages**: unggah isi `dist/` (semua path relatif, aman di subfolder).
- **Manual**: unggah isi `dist/` ke hosting HTTPS apa pun.

> PWA hanya bisa dipasang lewat **HTTPS** atau **localhost**.

---

## 5. Format import

### Siswa — `format-import-siswa.csv`
```
nisn,nama_siswa,kelas,jk
0012345678,Aditya Pratama,X TKJ 1,L
0012345679,Bunga Lestari,X TKJ 1,P
```

### Guru — `format-import-guru.csv`
```
nip,nama_guru,username,password,role,mapel,kelas_wali
198501012010011001,Waldo Guntala S.Kom,waldo,rahasia123,admin,Informatika,
199002022015022002,Siti Aminah,siti,rahasia123,wali,Matematika,X TKJ 1
```

- Pemisah boleh koma `,` atau titik koma `;` (otomatis terdeteksi).
- `role`: `admin` / `kepsek` / `piket` / `guru` / `wali`.
- `kelas_wali` wajib bila `role = wali`.
- Baris bermasalah dilewati dan dilaporkan setelah import selesai.

---

## 6. Struktur proyek

```
├── index.html                # entri Vite + boot-guard + meta PWA
├── kode.gs                   # backend Apps Script v8 (perbaikan + optimasi)
├── kode.gs.txt               # arsip backend lama (pembanding)
├── LAPORAN-PERBAIKAN.md      # daftar bug, optimasi, dan cara deploy
├── vite.config.js            # base './'
├── netlify.toml
├── serve.mjs                 # server statis dist/
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js                 # service worker (scope-aware)
│   ├── offline.html
│   ├── icons/ · screenshots/
└── src/
    ├── App.jsx               # router + guard per role
    ├── lib/                  # api, auth, pwa, theme, toast, utils, csv, libur
    ├── components/
    │   ├── AppShell.jsx      # sidebar + bottom nav + menu sheet
    │   ├── StatusPicker.jsx
    │   ├── ImportSheet.jsx   # unduh format + upload + pratinjau
    │   ├── InstallSheet.jsx · InstallPopup.jsx
    │   └── ui.jsx
    └── pages/                # Login, Dashboard, InputAbsensi, Piket,
                              # Riwayat, Kepsek, Report, Guru, Siswa,
                              # PortalOrtu (portal orang tua)
```

---

## 7. Catatan rilis

- Setelah mengubah CSS/JS, naikkan `VERSION` di `public/sw.js` agar pengguna menerima versi baru (muncul tombol "Muat ulang").
- Versi vanilla lama tersimpan di `presensi-live-app/` sebagai referensi.

© 2026 SMKN 1 Kuantan Mudik · by Waldo Guntala, S.Kom
