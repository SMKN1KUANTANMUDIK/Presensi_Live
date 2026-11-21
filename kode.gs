// ============================================================
//  FILE: kode.gs  |  VERSI: v8 (final)  |  Diperbarui: 2026-10-29
//  Setelah deploy, verifikasi: <URL /exec>?action=getVersion
//  harus menampilkan "version":"v8".
// ============================================================
// ============================================================
//  PRESENSI SMKN 1 KUANTAN MUDIK
//  Google Apps Script — Backend Utama (v8 · absensi per jam + rekap harian)
//
//  Cek cepat setelah deploy: buka
//    <URL /exec>?action=getVersion
//  dan pastikan "version":"v8" serta fitur memuat "absensi-per-jam" +
//  "rekap-harian-konsisten".
//
//  PERUBAHAN v8 (2026-10-29):
//  - simpanAbsensi menerima detail[].perJam = {"1":"I","2":"H",...} sehingga
//    satu sesi bisa menyimpan status berbeda per jam (izin/cabut hanya pada
//    jam tertentu). Tanpa perJam, perilaku lama tetap sama.
//  - getRekapGuruSemester & getAbsensiGuru memakai status harian: Hadir hanya
//    bila SEMUA jam pada hari itu hadir; bila ada Sakit/Izin/Alpha/Cabut,
//    status itu yang ditampilkan. Jumlah semester dihitung per hari (beberapa
//    pertemuan di tanggal sama tidak dihitung berulang).
//  - getVersion: fitur "absensi-per-jam", "rekap-harian-konsisten".
//
//  PERBAIKAN v7.1 (2026-10-29):
//  - NISN dinormalisasi (nisnKey) saat mencocokkan baris Absensi/Apel dengan
//    master siswa. Google Sheets menyimpan NISN sebagai angka sehingga nol di
//    depan hilang ("0098873773" → 98873773); akibatnya siswa tidak tercentang
//    di rekap dan status A/C tidak muncul. Kini semua pencocokan memakai kunci
//    numerik yang sama.
//  - Kolom NISN diformat teks ("@") sebelum menulis, agar nol di depan tetap
//    tersimpan untuk data baru.
//  - getVersion: fitur "nisn-normalisasi".
//
//  PERUBAHAN v7 (2026-10-29):
//  - getDashboardPiket: guruList kini memuat jam, absen[] (siswa non-hadir per
//    guru) dan totalAbsen; kelas memuat jamInfo {jam: {mapel, guru}} untuk
//    kop tabel laporan harian.
//  - getVersion → "v7" + fitur "piket-per-guru", "jam-info-harian".
//
//  PERUBAHAN v6 (2026-10-28):
//  - Sheet baru "Apel" (id, tanggal, nisn, nama_siswa, kelas, jam_datang,
//    keterangan, petugas, timestamp) — terpisah dari "Absensi" agar rekap
//    mapel dan kasus otomatis tidak terpengaruh.
//  - getApelPagi(tanggal, kelas, bulan, nisn):
//      tanggal + kelas          → perilaku lama (Dashboard Piket)
//      bulan + kelas (+ nisn)   → laporan satu bulan (Portal Orang Tua)
//      tanpa tanggal/bulan      → default hari ini (kompatibel)
//    Respons menambah field "bulan" dan "nisn".
//  - simpanApelPagi / hapusApelPagi, dedupe per tanggal + NISN.
//  - getVersion → "v6" + fitur "apel-pagi", "apel-bulanan".
//
//  PERUBAHAN BESAR vs v4:
//  1. BUG FATAL: "tutupKasusPembinaan" tidak punya break → hasilnya
//     selalu ditimpa "catatTindakanKasus". Sekarang router berbasis
//     tabel aksi, mustahil fall-through.
//  2. BUG FATAL: `const sh` di-assign ulang (getKasusPembinaan &
//     simpanKasusPembinaan) → "Assignment to constant variable".
//  3. Header sheet Kasus hanya 11 kolom padahal dipakai 18 kolom.
//     Sekarang header dilengkapi otomatis.
//  4. formatDate() memakai Utilities.formatDate per baris (sangat
//     lambat) → diganti formatter lokal. Ratusan ribu panggilan
//     Java dihilangkan.
//  5. Semua baca Absensi memakai window tanggal + baca per potongan
//     (chunk) sehingga dashboard tidak lagi membaca seluruh sheet.
//  6. getRiwayatAbsensi dibaca dari baris terbaru (terbalik) dengan
//     batas waktu aman, jadi tidak timeout saat data sudah menumpuk.
//  7. Konflik jadwal sekarang dicek per kelas+jam (bukan per mapel),
//     jadi satu kelas tidak bisa diabsen dua guru di jam yang sama.
//  8. updateAbsensi & hapusAbsensi menulis/menghapus secara batch.
//  9. Cache master data (config/kelas/siswa) 10 menit + invalidasi.
// 10. Import siswa/guru: validasi username unik, kelas baru dibuat
//     sekaligus (bukan satu per satu), tulis satu kali.
//
//  CARA SETUP:
//  1. Buka Google Spreadsheet → Extensions → Apps Script
//  2. Paste seluruh kode ini
//  3. Isi SPREADSHEET_ID dan FOLDER_FOTO_ID di bawah
//  4. Deploy → Manage deployments → Edit → Version: New version
//     - Execute as: Me
//     - Who has access: Anyone
// ============================================================

// ============================================================
//  KONFIGURASI — WAJIB DIISI
// ============================================================

const SPREADSHEET_ID  = "1LHJN8bojB9xqVZAbFJQyJ6OsZGSOcYuId-ta-rMePyk";
const FOLDER_FOTO_ID  = "1PcdEaF3FJqLm199nnK_SCC15JtaBeciA";

// Opsional: ID spreadsheet arsip. Kosongkan = dibuat otomatis
// saat arsipkanAbsensiLama() dijalankan pertama kali.
const ARSIP_SPREADSHEET_ID = "";

// ============================================================
//  NAMA SHEET — SESUAI TAB DI SPREADSHEET
// ============================================================

const SHEET_GURU    = "Guru";
const SHEET_SISWA   = "Siswa";
const SHEET_KELAS   = "Kelas";
const SHEET_MAPEL   = "Mapel";
const SHEET_JAM     = "Jam";
const SHEET_ABSENSI = "Absensi";
const SHEET_KASUS   = "Kasus";
const SHEET_APEL    = "Apel";

// ============================================================
//  KONSTANTA
// ============================================================

const ROLE_VALID     = ["admin", "kepsek", "piket", "guru", "wali"];
const DEFAULT_PASSWORD = "123456";

const ABS_COLS = 11;
const ABS = {
  ID: 0, TGL: 1, JAM: 2, KELAS: 3, MAPEL: 4,
  GURU: 5, NISN: 6, NAMA: 7, STATUS: 8, FOTO: 9, TS: 10
};

const ABS_HEADER = [
  "id", "tanggal", "jam", "kelas", "mapel", "guru",
  "nisn", "nama_siswa", "status", "foto", "timestamp"
];

const KASUS_HEADER = [
  "id", "tanggal", "nisn", "nama_siswa", "kelas",
  "jenis", "keterangan", "status", "alasan_penutupan",
  "tanggal_ditutup", "created_at", "level",
  "tindakan_wali", "tindakan_bk", "tindakan_kepsek",
  "escalated_to", "catatan_wali", "catatan_bk"
];

// Kehadiran apel pagi / siswa terlambat.
// Satu baris = satu siswa pada satu tanggal (tidak dicampur ke sheet Absensi
// agar tidak mengganggu rekap mapel & kasus otomatis).
const APEL_COLS = 9;
const APEL = {
  ID: 0, TGL: 1, NISN: 2, NAMA: 3, KELAS: 4,
  JAM: 5, KET: 6, PETUGAS: 7, TS: 8
};

const APEL_HEADER = [
  "id", "tanggal", "nisn", "nama_siswa", "kelas",
  "jam_datang", "keterangan", "petugas", "timestamp"
];

const HEADERS = {};
HEADERS[SHEET_GURU]    = ["nip", "nama_guru", "username", "password", "role", "mapel", "kelas_wali"];
HEADERS[SHEET_SISWA]   = ["nisn", "nama_siswa", "kelas", "jk", "no_hp_ortu"];
HEADERS[SHEET_KELAS]   = ["nama_kelas", "jurusan"];
HEADERS[SHEET_MAPEL]   = ["kode", "nama"];
HEADERS[SHEET_JAM]     = ["no_jam", "mulai", "selesai"];
HEADERS[SHEET_ABSENSI] = ABS_HEADER;
HEADERS[SHEET_KASUS]   = KASUS_HEADER;
HEADERS[SHEET_APEL]    = APEL_HEADER;

const PRIOR = { H: 1, I: 2, S: 3, A: 4, C: 5 };
const STATUS_VALID = { H: 1, S: 1, I: 1, A: 1, C: 1 };

const CHUNK_ROWS = 8000;        // baris per pembacaan (hemat memori)
const CACHE_TTL  = 600;         // detik
const RIWAYAT_LIMIT_DEFAULT = 0;    // 0 = tanpa batas jumlah sesi
const RIWAYAT_BUDGET_MS = 12000;    // < timeout frontend 20 detik
const MAKS_FOTO_BYTE = 6 * 1024 * 1024;
const MAKS_JAM = 20;

// ============================================================
//  UTILITAS UMUM
// ============================================================

// Objek di-cache hanya selama satu eksekusi (bukan antar-request).
let __ss = null;
const __sheetCache = {};

function getSS() {
  if (!__ss) __ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return __ss;
}

function getSheet(name) {
  if (__sheetCache[name]) return __sheetCache[name];
  const sh = getSS().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan di spreadsheet.');
  __sheetCache[name] = sh;
  return sh;
}

function str(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Kunci NISN tahan beda format.
 * Google Sheets kadang menyimpan NISN sebagai angka sehingga nol di depan
 * hilang ("0098873773" → 98873773). Semua pencocokan NISN antar-sheet harus
 * memakai kunci ini agar siswa tetap ketemu.
 */
function nisnKey(v) {
  const digits = str(v).replace(/[^0-9]/g, "");
  if (!digits) return "";
  const trimmed = digits.replace(/^0+/, "");
  return trimmed || "0";
}

/** Peta nisnKey → NISN asli dari master siswa (untuk tampilan). */
function nisnMasterMap() {
  const map = {};
  readSiswaMasterCached().forEach(s => {
    const k = nisnKey(s.nisn);
    if (k && !map[k]) map[k] = s.nisn;
  });
  return map;
}

function toInt(v) {
  const n = Number(v);
  return isFinite(n) ? Math.trunc(n) : 0;
}

function pad2(n) {
  n = Number(n);
  return (n < 10 ? "0" : "") + n;
}

function outputJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(err, extra) {
  const message = err && err.message ? err.message : String(err);
  try {
    console.error(err && err.stack ? err.stack : message);
  } catch (e) { /* abaikan */ }
  const out = { success: false, error: message };
  if (extra) Object.keys(extra).forEach(k => { out[k] = extra[k]; });
  return out;
}

// ============================================================
//  TANGGAL & WAKTU (cepat, tanpa Utilities.formatDate)
// ============================================================

/**
 * Normalisasi berbagai bentuk tanggal menjadi "yyyy-MM-dd".
 * Mengembalikan "" bila tidak valid (tidak pernah melempar error).
 */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function dateKey(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return value.getFullYear() + "-" + pad2(value.getMonth() + 1) + "-" + pad2(value.getDate());
  }

  const s = String(value).trim();
  if (!s) return "";

  // Fast path untuk format ISO "YYYY-MM-DD" (hindari regex & Date per baris)
  if (s.length === 10 && s.charCodeAt(4) === 45 && s.charCodeAt(7) === 45) {
    const fast = validDateKey(s.slice(0, 4), s.slice(5, 7), s.slice(8, 10));
    if (fast) return fast;
  }

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDateKey(m[1], m[2], m[3]);

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    let a = Number(m[1]), b = Number(m[2]);
    let day, mon;
    if (a > 12)      { day = a; mon = b; }
    else if (b > 12) { mon = a; day = b; }
    else             { day = a; mon = b; } // locale Indonesia: dd/mm/yyyy
    return validDateKey(m[3], mon, day);
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : dateKey(d);
}

/**
 * Susun "yyyy-MM-dd" bila tahun/bulan/tanggal masuk akal.
 * Menangkap input rusak seperti "2026-02-31" atau "2026-13-05"
 * (kalau tidak divalidasi, baris tersimpan tapi hilang dari semua rekap).
 */
function validDateKey(year, month, day) {
  const y = toInt(year);
  const mo = toInt(month);
  const d = toInt(day);
  if (y < 1970 || y > 2999 || mo < 1 || mo > 12 || d < 1) return "";
  let maxDay = DAYS_IN_MONTH[mo];
  if (mo === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) maxDay = 29;
  if (d > maxDay) return "";
  return y + "-" + pad2(mo) + "-" + pad2(d);
}

/** Kompatibilitas dengan kode lama. */
function formatDate(value) {
  return dateKey(value);
}

function timeKey(d) {
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function nowTimestamp() {
  const d = new Date();
  return dateKey(d) + " " + timeKey(d);
}

/** "2026-10-27" → Date lokal jam 12:00 (aman dari pergeseran zona waktu). */
function parseDateKey(key) {
  const k = dateKey(key);
  if (!k) return null;
  const p = k.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function monthEndKey(ym) {
  const y = Number(String(ym).slice(0, 4));
  const m = Number(String(ym).slice(5, 7));
  if (m < 1 || m > 12) return "";
  return dateKey(new Date(y, m, 0));
}

/**
 * Validasi kunci bulan "yyyy-MM".
 * Mengembalikan "" bila bukan bulan yang valid (mis. "2026-13").
 */
function monthKey(value) {
  const s = str(value);
  if (!/^\d{4}-\d{2}$/.test(s)) return "";
  const m = Number(s.slice(5, 7));
  if (m < 1 || m > 12) return "";
  return s;
}

// ============================================================
//  SEMESTER
//  Ganjil : 1 Juli  – 31 Desember (tahun mulai)
//  Genap   : 1 Januari – 30 Juni (tahun berikutnya)
// ============================================================

/**
 * Rentang tanggal satu semester.
 * @param {string} semesterRaw "ganjil" | "genap" | "1" | "2" (kosong = ikut tanggal acuan)
 * @param {number|string} tahunRaw tahun mulai tahun ajaran (mis. 2025 untuk 2025/2026)
 * @param {string} refKey tanggal acuan "yyyy-MM-dd" (opsional)
 */
function semesterRange(semesterRaw, tahunRaw, refKey) {
  const ref = dateKey(refKey) || dateKey(new Date());
  const refYear = toInt(ref.slice(0, 4)) || new Date().getFullYear();
  const refMonth = toInt(ref.slice(5, 7)) || (new Date().getMonth() + 1);

  const s = str(semesterRaw).toLowerCase();
  const eksplisit =
    s === "1" || s === "ganjil" || s === "odd" ? "ganjil"
      : s === "2" || s === "genap" || s === "even" ? "genap"
        : "";

  // semester tanpa tahun → semester yang paling baru berjalan/selesai
  const semester = eksplisit || (refMonth >= 7 ? "ganjil" : "genap");

  let startYear = toInt(tahunRaw);
  if (startYear < 2000 || startYear > 2100) {
    // Ganjil (Jul–Des startYear): saat Jul–Des masih berjalan,
    //   startYear = tahun berjalan; selain itu semester ganjil terakhir.
    // Genap (Jan–Des startYear+1): selalu startYear = refYear - 1,
    //   karena semester genap berjalan Jan–Jun (belum pernah > refYear).
    startYear = semester === "ganjil"
      ? (refMonth >= 7 ? refYear : refYear - 1)
      : refYear - 1;
  }

  const start = semester === "ganjil" ? startYear + "-07-01" : (startYear + 1) + "-01-01";
  const end   = semester === "ganjil" ? startYear + "-12-31" : (startYear + 1) + "-06-30";

  return {
    semester:    semester,
    label:       semester === "ganjil" ? "Ganjil" : "Genap",
    tahunAjaran: startYear + "/" + (startYear + 1),
    startYear:   startYear,
    start:       start,
    end:         end
  };
}

/** Nilai jam dari sheet → "HH:mm". */
function toHHMM(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return pad2(v.getHours()) + ":" + pad2(v.getMinutes());
  }
  if (typeof v === "number") {
    const total = Math.round(v * 24 * 60);
    return pad2(Math.floor(total / 60) % 24) + ":" + pad2(total % 60);
  }
  const s = str(v);
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  return m ? pad2(m[1]) + ":" + m[2] : s;
}

// ============================================================
//  STATUS
// ============================================================

function normalizeStatus(v, fallback) {
  const s = str(v).toUpperCase();
  return STATUS_VALID[s] ? s : (fallback || "H");
}

function normalizeRole(v) {
  const r = str(v).toLowerCase();
  if (r === "wali_kelas" || r === "walikelas" || r === "wali kelas") return "wali";
  if (r === "kepala_sekolah" || r === "kepala sekolah" || r === "kepsek") return "kepsek";
  return r;
}

function normalizeKasusLevel(v) {
  const l = str(v).toLowerCase();
  if (l === "wali" || l === "wali_kelas" || l === "wali kelas") return "wali_kelas";
  if (l === "bk") return "bk";
  if (l === "kepsek" || l === "kepala_sekolah") return "kepsek";
  return "";
}

function jurusanOf(kelas) {
  const parts = str(kelas).split(/\s+/);
  return parts.length >= 2 ? parts[1] : "";
}

// ============================================================
//  CACHE (master data saja — data absensi tidak di-cache)
// ============================================================

function cacheGetJson(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function cachePutJson(key, value, ttl) {
  try {
    const raw = JSON.stringify(value);
    if (raw.length < 95000) {
      CacheService.getScriptCache().put(key, raw, ttl || CACHE_TTL);
    }
  } catch (e) { /* cache bersifat opsional */ }
}

function cacheVersion() {
  try {
    return CacheService.getScriptCache().get("dataVer") || "0";
  } catch (e) {
    return "0";
  }
}

/** Dipanggil setiap data master berubah (guru/siswa/kelas). */
function bumpCache() {
  try {
    const cache = CacheService.getScriptCache();
    const stamp = String(Date.now());
    cache.put("dataVer", stamp, CACHE_TTL);
    cache.put("absVer", stamp, CACHE_TTL);
  } catch (e) { /* abaikan */ }
}

function absCacheVersion() {
  try {
    return CacheService.getScriptCache().get("absVer") || "0";
  } catch (e) {
    return "0";
  }
}

/** Dipanggil setiap data absensi berubah (simpan/update/hapus). */
function bumpAbsensiCache() {
  try {
    CacheService.getScriptCache().put("absVer", String(Date.now()), CACHE_TTL);
  } catch (e) { /* abaikan */ }
}

// ============================================================
//  HELPER SHEET
// ============================================================

function ensureHeader(sh, header) {
  if (!header || !header.length) return;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    return;
  }
  const width = header.length;
  const cur = sh.getRange(1, 1, 1, width).getValues()[0];
  let missing = false;
  for (let i = 0; i < width; i++) {
    if (!str(cur[i])) { missing = true; break; }
  }
  if (!missing) return;
  const next = [];
  for (let i = 0; i < width; i++) next.push(str(cur[i]) || header[i] || "");
  sh.getRange(1, 1, 1, width).setValues([next]);
}

/**
 * appendRows(sh, rows, header, textCols)
 * textCols: indeks kolom (0-based) yang harus diformat teks, mis. NISN, agar
 * angka nol di depan tidak dibuang Google Sheets saat setValues().
 */
function appendRows(sh, rows, header, textCols) {
  if (!rows || !rows.length) return;
  if (header) ensureHeader(sh, header);
  const start = Math.max(sh.getLastRow() + 1, 2);
  if (Array.isArray(textCols) && textCols.length) {
    textCols.forEach(c => {
      const col = Number(c);
      if (isFinite(col) && col >= 0 && col < rows[0].length) {
        sh.getRange(start, col + 1, rows.length, 1).setNumberFormat("@");
      }
    });
  }
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

// ============================================================
//  ROUTER
// ============================================================

const GET_ACTIONS = {
  login:                   p => doLogin(p.username, p.password),
  getConfig:               () => getConfig(),
  getSiswa:                p => getSiswa(p.kelas),
  getJamTerisi:            p => getJamTerisi(p.tanggal, p.kelas),
  getKelas:                () => getKelas(),
  getJurusan:              () => getJurusan(),
  getGuru:                 () => getGuruList(),
  getWaliKelas:            p => getWaliKelas(p.kelas),
  getDashboardAdmin:       () => getDashboardAdmin(),
  getDashboardPiket:       p => getDashboardPiket(p.tanggal, p.kelas),
  getDashboardKepsek:      p => getDashboardKepsek(p.mode, p.tanggal, p.bulan, p.kelas, p.jurusan),
  getRiwayatAbsensi:       p => getRiwayatAbsensi(p),
  getDetailAbsensi:        p => getDetailAbsensi(p.id),
  getAbsensiGuru:          p => getAbsensiGuru(p.kelas, p.guru, p.bulan),
  getRekapBulanan:         p => getRekapBulanan(p.kelas, p.bulan),
  getMonitoringSiswa:      p => getMonitoringSiswa(p.nisn, p.bulan),
  getRekapGuruSemester:    p => getRekapGuruSemester(p.kelas, p.guru, p.semester, p.tahun, p.mapel, p.maks),
  getGuruData:             () => getGuruData(),
  getSiswaData:            p => getSiswaData(p.kelas),
  getVersion:              () => getVersion(),
  getKasusPembinaan:       p => getKasusPembinaan(p.status, p.kelas, p.role, p.kelas_wali, p.level),
  getPeringatanWaliKelas:  p => getPeringatanWaliKelas(p.kelas),
  sinkronKasusDariAbsensi: p => sinkronKasusDariAbsensi(p.role, p.kelas_wali, p.kelas, p.tanggal),
  getApelPagi:             p => getApelPagi(p.tanggal, p.kelas, p.bulan, p.nisn)
};

const POST_ACTIONS = {
  simpanAbsensi:          b => simpanAbsensi(b.data),
  uploadFoto:             b => uploadFoto(b.data),
  updateAbsensi:          b => updateAbsensi(b.data),
  hapusAbsensi:           b => hapusAbsensi(b.id),
  simpanGuru:             b => simpanGuru(b.data),
  hapusGuru:              b => hapusGuru(b.data || { nip: b.nip }),
  importGuru:             b => importGuru(b.data),
  simpanSiswa:            b => simpanSiswa(b.data),
  hapusSiswa:             b => hapusSiswa(b.data || { nisn: b.nisn }),
  importSiswa:            b => importSiswa(b.data),
  simpanKasusPembinaan:   b => simpanKasusPembinaan(b.data, b.role, b.kelas_wali),
  tutupKasusPembinaan:    b => tutupKasusPembinaan(b.id, b.alasan, b.role),
  catatTindakanKasus:     b => catatTindakanKasus(b.id, b.level, b.tindakan, b.catatan),
  escalateKasus:          b => escalateKasus(b.id, b.dariLevel, b.keLevel, b.catatan),
  simpanApelPagi:         b => simpanApelPagi(b.data, b.petugas),
  hapusApelPagi:          b => hapusApelPagi((b.data && b.data.id) || b.id)
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = str(p.action);
  const t0 = Date.now();
  const handler = GET_ACTIONS[action];
  if (!handler) {
    return outputJSON({ success: false, error: "Action tidak ditemukan: " + action });
  }
  try {
    const result = handler(p);
    return outputJSON(result || { success: false, error: "Tidak ada hasil" });
  } catch (err) {
    return outputJSON(fail(err));
  } finally {
    console.log("[GET " + action + "] " + (Date.now() - t0) + " ms");
  }
}

function doPost(e) {
  const t0 = Date.now();
  let action = "";
  try {
    const body = readPostBody(e);
    action = str(body.action);
    const handler = POST_ACTIONS[action];
    if (!handler) {
      return outputJSON({ success: false, error: "Action tidak ditemukan: " + action });
    }
    return outputJSON(handler(body) || { success: false, error: "Tidak ada hasil" });
  } catch (err) {
    return outputJSON(fail(err));
  } finally {
    console.log("[POST " + action + "] " + (Date.now() - t0) + " ms");
  }
}

function readPostBody(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error("Body request bukan JSON yang valid.");
    }
  }
  return (e && e.parameter) || {};
}

// ============================================================
//  LOGIN
//  Sheet Guru: [0]nip [1]nama [2]username [3]password
//              [4]role [5]mapel [6]kelas_wali
// ============================================================

function doLogin(username, password) {
  const u = str(username).toLowerCase();
  const p = str(password);
  if (!u || !p) {
    return { success: false, error: "Username dan password wajib diisi" };
  }

  const rows = getSheet(SHEET_GURU).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (str(r[2]).toLowerCase() !== u) continue;
    if (str(r[3]) !== p) continue;

    const nama = str(r[1]);
    return {
      success: true,
      user: {
        nip:        str(r[0]),
        nama_guru:  nama,
        nama:       nama,
        username:   str(r[2]).toLowerCase(),
        role:       normalizeRole(r[4]),
        mapel:      str(r[5]),
        kelas:      str(r[6]),   // kelas wali
        kelas_wali: str(r[6])
      }
    };
  }
  return { success: false, error: "Username atau password salah" };
}

// ============================================================
//  MASTER DATA
// ============================================================

function readKelasList() {
  const rows = getSheet(SHEET_KELAS).getDataRange().getValues();
  const out = [];
  const seen = {};
  for (let i = 1; i < rows.length; i++) {
    const k = str(rows[i][0]);
    if (k && !seen[k]) { seen[k] = true; out.push(k); }
  }
  return out;
}

function readSiswaMaster() {
  const rows = getSheet(SHEET_SISWA).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const nisn = str(rows[i][0]);
    if (!nisn) continue;
    out.push({
      nisn:       nisn,
      nama:       str(rows[i][1]),
      kelas:      str(rows[i][2]),
      jk:         str(rows[i][3]),
      no_hp_ortu: str(rows[i][4])
    });
  }
  return out;
}

/** Versi cache — menghemat pembacaan saat dashboard dipanggil berulang. */
function readSiswaMasterCached() {
  const key = "siswa:" + cacheVersion();
  const cached = cacheGetJson(key);
  if (cached) return cached;
  const data = readSiswaMaster();
  cachePutJson(key, data, CACHE_TTL);
  return data;
}

/** kelas[], guru[], mapel[], jamTersedia[] — di-cache 10 menit. */
function getConfig() {
  const key = "cfg:" + cacheVersion();
  const cached = cacheGetJson(key);
  if (cached) return cached;

  try {
    const kelas = readKelasList();

    const guruRows = getSheet(SHEET_GURU).getDataRange().getValues();
    const guru = [];
    for (let i = 1; i < guruRows.length; i++) {
      const n = str(guruRows[i][1]);
      if (n) guru.push(n);
    }

    const mapelRows = getSheet(SHEET_MAPEL).getDataRange().getValues();
    const mapel = [];
    for (let i = 1; i < mapelRows.length; i++) {
      const nama = str(mapelRows[i][1]);
      if (nama) mapel.push({ kode: str(mapelRows[i][0]), nama: nama });
    }

    const jamRows = getSheet(SHEET_JAM).getDataRange().getValues();
    const jamTersedia = [];
    for (let i = 1; i < jamRows.length; i++) {
      const no = toInt(jamRows[i][0]);
      if (no > 0) {
        jamTersedia.push({
          no_jam:  no,
          mulai:   toHHMM(jamRows[i][1]),
          selesai: toHHMM(jamRows[i][2])
        });
      }
    }

    const result = { success: true, kelas: kelas, guru: guru, mapel: mapel, jamTersedia: jamTersedia };
    cachePutJson(key, result, CACHE_TTL);
    return result;

  } catch (err) {
    return fail(err);
  }
}

function getKelas() {
  try {
    return { success: true, data: readKelasList() };
  } catch (err) {
    return fail(err);
  }
}

function getJurusan() {
  try {
    const rows = getSheet(SHEET_KELAS).getDataRange().getValues();
    const set = {};
    for (let i = 1; i < rows.length; i++) {
      const kls = str(rows[i][0]);
      if (!kls) continue;
      const jur = str(rows[i][1]) || jurusanOf(kls);
      if (jur) set[jur] = true;
    }
    return { success: true, data: Object.keys(set).sort() };
  } catch (err) {
    return fail(err);
  }
}

function getGuruList() {
  try {
    const rows = getSheet(SHEET_GURU).getDataRange().getValues();
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const nama = str(rows[i][1]);
      if (!nama) continue;
      data.push({ nip: str(rows[i][0]), nama: nama, mapel: str(rows[i][5]) });
    }
    return { success: true, data: data };
  } catch (err) {
    return fail(err);
  }
}

function getWaliKelas(kelas) {
  try {
    const target = str(kelas);
    if (!target) return { success: false, error: "Kelas wajib diisi" };

    const rows = getSheet(SHEET_GURU).getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const kls = str(rows[i][6]);
      if (kls !== target) continue;
      return {
        success: true,
        data: { nama: str(rows[i][1]), nip: str(rows[i][0]), kelas: kls }
      };
    }
    return { success: false, error: "Wali kelas tidak ditemukan" };
  } catch (err) {
    return fail(err);
  }
}

function getSiswa(kelas) {
  try {
    const filter = str(kelas);
    const semua = filter.toUpperCase() === "SEMUA";
    const rows = getSheet(SHEET_SISWA).getDataRange().getValues();
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const nisn = str(rows[i][0]);
      if (!nisn) continue;
      const kls = str(rows[i][2]);
      if (!semua && kls !== filter) continue;
      data.push({
        nisn:       nisn,
        nama_siswa: str(rows[i][1]),
        kelas:      kls,
        jk:         str(rows[i][3]),
        no_hp_ortu: str(rows[i][4])
      });
    }
    return { success: true, data: data };
  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  PEMBACAAN ABSENSI (streaming per potongan)
// ============================================================

/**
 * Membaca baris Absensi pada rentang tanggal [startKey, endKey] lalu
 * memanggil onChunk(values, firstRowNumber). Kosongkan start/end
 * untuk membaca semua data.
 *
 * Membaca kolom tanggal dulu (1 kolom) untuk menentukan blok baris,
 * jadi tidak perlu memuat seluruh sheet ke memori.
 */
/**
 * Indeks rentang baris per bulan ("YYYY-MM": [firstRow, lastRow]) yang di-cache
 * selama absVer belum berubah. Menghindari pemindaian puluhan ribu baris tanggal
 * berulang kali saat menarik rekap bulanan/harian.
 */
function readAbsensiMonthIndex(sh, last) {
  const key = "absIdx:" + absCacheVersion() + ":" + last;
  const cached = cacheGetJson(key);
  if (cached) return cached;

  const dates = sh.getRange(2, ABS.TGL + 1, last - 1, 1).getValues();
  const idx = {};
  for (let i = 0; i < dates.length; i++) {
    const k = dateKey(dates[i][0]);
    if (!k) continue;
    const ym = k.slice(0, 7);
    const rowNum = i + 2;
    if (!idx[ym]) idx[ym] = [rowNum, rowNum];
    else {
      if (rowNum < idx[ym][0]) idx[ym][0] = rowNum;
      if (rowNum > idx[ym][1]) idx[ym][1] = rowNum;
    }
  }
  cachePutJson(key, idx, CACHE_TTL);
  return idx;
}

function streamAbsensiRows(startKey, endKey, onChunk) {
  const sh = getSheet(SHEET_ABSENSI);
  const last = sh.getLastRow();
  if (last < 2) return;

  const lo = startKey || "";
  const hi = endKey || "";

  // Tanpa filter tanggal → langsung baca seluruh isi per potongan.
  if (!lo && !hi) {
    readAbsChunks(sh, 2, last - 1, onChunk);
    return;
  }

  const min = lo || "0000-00-00";
  const max = hi || "9999-99-99";
  const minYm = min.slice(0, 7);
  const maxYm = max.slice(0, 7);

  // Gunakan indeks bulan ter-cache untuk menyempitkan rentang baris yang dibaca.
  const idx = readAbsensiMonthIndex(sh, last);
  let scanFirst = last + 1;
  let scanLast = 0;
  Object.keys(idx).forEach(ym => {
    if (ym >= minYm && ym <= maxYm) {
      if (idx[ym][0] < scanFirst) scanFirst = idx[ym][0];
      if (idx[ym][1] > scanLast) scanLast = idx[ym][1];
    }
  });

  if (scanLast < scanFirst) return;

  const totalSpan = scanLast - scanFirst + 1;
  // Jika rentang bulan sudah kecil (<= 1 chunk), baca sekaligus dalam 1 RPC call.
  if (totalSpan <= CHUNK_ROWS) {
    readAbsChunks(sh, scanFirst, totalSpan, onChunk);
    return;
  }

  const dates = sh.getRange(scanFirst, ABS.TGL + 1, totalSpan, 1).getValues();
  const runs = [];
  let runStart = -1;
  for (let i = 0; i <= dates.length; i++) {
    let inside = false;
    if (i < dates.length) {
      const k = dateKey(dates[i][0]);
      inside = !!k && k >= min && k <= max;
    }
    if (inside) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      runs.push([scanFirst + runStart, i - runStart]);
      runStart = -1;
    }
  }

  // Gabungkan run berdekatan (celah <= 100 baris) agar hemat panggilan getRange().
  const merged = [];
  for (let i = 0; i < runs.length; i++) {
    const cur = runs[i];
    const prev = merged[merged.length - 1];
    if (prev && cur[0] - (prev[0] + prev[1]) <= 100) {
      prev[1] = (cur[0] + cur[1]) - prev[0];
    } else {
      merged.push([cur[0], cur[1]]);
    }
  }

  for (let i = 0; i < merged.length; i++) {
    readAbsChunks(sh, merged[i][0], merged[i][1], onChunk);
  }
}

function readAbsChunks(sh, firstRow, numRows, onChunk) {
  for (let offset = 0; offset < numRows; offset += CHUNK_ROWS) {
    const n = Math.min(CHUNK_ROWS, numRows - offset);
    const values = sh.getRange(firstRow + offset, 1, n, ABS_COLS).getValues();
    onChunk(values, firstRow + offset);
  }
}

function collectAbsensiRows(startKey, endKey) {
  const rows = [];
  const rowNumbers = [];
  streamAbsensiRows(startKey, endKey, (values, firstRow) => {
    for (let i = 0; i < values.length; i++) {
      rows.push(values[i]);
      rowNumbers.push(firstRow + i);
    }
  });
  return { rows: rows, rowNumbers: rowNumbers };
}

// ============================================================
//  JAM TERISI
// ============================================================

function getJamTerisi(tanggal, kelas) {
  try {
    const tgl = dateKey(tanggal);
    const kls = str(kelas);
    if (!tgl || !kls) return { success: true, jamTerisi: [] };

    const set = {};
    streamAbsensiRows(tgl, tgl, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== tgl) continue;
        if (str(r[ABS.KELAS]) !== kls) continue;
        set[toInt(r[ABS.JAM])] = true;
      }
    });

    const jamTerisi = Object.keys(set)
      .map(Number)
      .filter(j => j > 0)
      .sort((a, b) => a - b);

    return { success: true, jamTerisi: jamTerisi };
  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  SIMPAN ABSENSI
//  data: { tanggal, kelas, mapel, guru, jam_mulai, jam_selesai,
//          foto, detail: [{ nisn, nama_siswa, status }] }
// ============================================================

function simpanAbsensi(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const d = data || {};
    const tanggal    = dateKey(d.tanggal) || dateKey(new Date());
    const kelas      = str(d.kelas);
    const mapel      = str(d.mapel);
    const guru       = str(d.guru);
    const foto       = str(d.foto);
    const jamMulai   = toInt(d.jam_mulai);
    const jamSelesai = toInt(d.jam_selesai);

    if (!kelas) {
      return { success: false, error: "Kelas wajib diisi" };
    }
    if (jamMulai < 1 || jamSelesai < 1 || jamMulai > MAKS_JAM || jamSelesai > MAKS_JAM) {
      return { success: false, error: "Jam pelajaran tidak valid" };
    }
    if (jamSelesai < jamMulai) {
      return { success: false, error: "Jam selesai tidak boleh sebelum jam mulai" };
    }

    // ── Rapi & unik per NISN (status terburuk yang menang) ─────
    // detail[].perJam opsional: { "1": "I", "2": "H", ... } agar satu sesi
    // bisa menyimpan status berbeda per jam (izin/cabut hanya di jam tertentu).
    const detail = Array.isArray(d.detail) ? d.detail : [];
    const siswaMap = {};
    const siswaRows = [];
    let tanpaNisn = 0;

    detail.forEach(s => {
      const nisn = str(s && s.nisn);
      if (!nisn) { tanpaNisn++; return; }

      const st = normalizeStatus(s.status);
      const key = nisnKey(nisn) || nisn;

      const perJam = {};
      const pj = s && s.perJam;
      if (pj && typeof pj === "object") {
        Object.keys(pj).forEach(j => {
          const jam = toInt(j);
          if (jam >= 1 && jam <= MAKS_JAM) perJam[jam] = normalizeStatus(pj[j]);
        });
      }

      const existing = siswaMap[key];
      if (!existing) {
        siswaMap[key] = { nisn: nisn, nisnKey: key, nama: str(s.nama_siswa), status: st, perJam: perJam };
        siswaRows.push(siswaMap[key]);
      } else {
        // NISN ganda → pakai status terburuk, konsisten dengan rekap lain
        if (PRIOR[st] > PRIOR[existing.status]) existing.status = st;
        Object.keys(perJam).forEach(j => {
          if (!existing.perJam[j] || PRIOR[perJam[j]] > PRIOR[existing.perJam[j]]) {
            existing.perJam[j] = perJam[j];
          }
        });
      }
    });

    // Status harian (terburuk dari semua jam) untuk kasus otomatis.
    siswaRows.forEach(s => {
      let worst = s.status;
      Object.keys(s.perJam).forEach(j => {
        const v = s.perJam[j];
        if ((PRIOR[v] || 0) > (PRIOR[worst] || 0)) worst = v;
      });
      s.statusTerburuk = worst;
    });

    if (!siswaRows.length) {
      return { success: false, error: "Data siswa kosong" };
    }

    // ── Cek bentrok: satu kelas tidak boleh 2 sesi di jam sama ──
    const terisi = {};
    streamAbsensiRows(tanggal, tanggal, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== tanggal) continue;
        if (str(r[ABS.KELAS]) !== kelas) continue;
        terisi[toInt(r[ABS.JAM])] = true;
      }
    });

    for (let jam = jamMulai; jam <= jamSelesai; jam++) {
      if (terisi[jam]) {
        return { success: false, error: "Jam ke-" + jam + " kelas " + kelas + " sudah terisi" };
      }
    }

    // ── Susun baris lalu tulis sekali ────────────────────────
    const stamp = nowTimestamp();
    const javax = Utilities.getUuid();
    const rows = [];
    for (let jam = jamMulai; jam <= jamSelesai; jam++) {
      for (let i = 0; i < siswaRows.length; i++) {
        const s = siswaRows[i];
        const st = s.perJam[jam] || s.status;
        rows.push([
          javax, tanggal, jam, kelas, mapel, guru,
          s.nisn, s.nama, st, foto, stamp
        ]);
      }
    }

    const sh = getSheet(SHEET_ABSENSI);
    appendRows(sh, rows, ABS_HEADER, [ABS.NISN]);
    bumpAbsensiCache();

    // ── Kasus pembinaan otomatis (Alpha/Cabut ≥ 3 dalam semester) ──
    let kasusDibuat = 0;
    try {
      kasusDibuat = autoKasusSetelahAbsensi(kelas, tanggal, siswaRows.map(s => s.statusTerburuk || s.status));
    } catch (e) {
      console.log("[kasus-otomatis] " + (e && e.message ? e.message : e));
    }

    return {
      success: true,
      total: rows.length,
      sesi: (jamSelesai - jamMulai + 1),
      siswa: siswaRows.length,
      diabaikan: tanpaNisn,
      kasusDibuat: kasusDibuat
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  UPLOAD FOTO ke Google Drive
// ============================================================

function uploadFoto(data) {
  try {
    const base64 = str(data && data.base64);
    if (!base64) return { success: false, error: "Foto tidak ditemukan" };
    if (!/^data:image\//.test(base64)) {
      return { success: false, error: "Format foto tidak valid" };
    }

    const m = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mime = m ? m[1].toLowerCase() : "image/jpeg";
    const clean = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    const byteSize = Math.floor(clean.length * 3 / 4);
    if (!byteSize) return { success: false, error: "Foto kosong" };
    if (byteSize > MAKS_FOTO_BYTE) {
      return { success: false, error: "Ukuran foto terlalu besar (maks 6 MB)" };
    }

    const ext = mime.indexOf("png") >= 0 ? "png"
      : mime.indexOf("webp") >= 0 ? "webp"
      : "jpg";

    const folder = DriveApp.getFolderById(FOLDER_FOTO_ID);
    const fileName = "presensi_" + dateKey(new Date()) + "_" + Utilities.getUuid() + "." + ext;
    const blob = Utilities.newBlob(Utilities.base64Decode(clean), mime, fileName);
    const file = folder.createFile(blob);

    // Jangan gagalkan absensi hanya karena kebijakan sharing Drive.
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { /* abaikan */ }

    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      url: file.getUrl(),
      downloadUrl: "https://drive.google.com/uc?id=" + file.getId()
    };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  SESSION ID ("tanggal|kelas|mapel|guru" atau base64 JSON)
// ============================================================

function parseSessionId(rawId) {
  const raw = str(rawId);
  if (!raw) return null;

  const fromPipe = value => {
    const parts = String(value).split("|");
    if (parts.length < 2) return null;
    const out = {
      tanggal: dateKey(parts[0]),
      kelas:   str(parts[1]),
      mapel:   str(parts[2]),
      guru:    parts.slice(3).join("|").trim()
    };
    return out.tanggal ? out : null;
  };

  if (raw.indexOf("|") !== -1) return fromPipe(raw);

  const cleaned = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  try {
    const text = Utilities.newBlob(Utilities.base64Decode(cleaned)).getDataAsString("UTF-8");
    const obj = JSON.parse(text);
    if (obj && obj.tanggal) {
      return {
        tanggal: dateKey(obj.tanggal),
        kelas:   str(obj.kelas),
        mapel:   str(obj.mapel),
        guru:    str(obj.guru)
      };
    }
  } catch (e) { /* bukan base64 valid → coba format pipe */ }

  return fromPipe(raw);
}

// ============================================================
//  RIWAYAT ABSENSI (sesi unik, dibaca dari yang terbaru)
// ============================================================

function getRiwayatAbsensi(opts) {
  try {
    const o = opts || {};
    const filterTgl = dateKey(o.tanggal);
    const filterBulan = monthKey(o.bulan);
    const filterKelas = str(o.kelas);

    // limit=0 → ambil semua (bisa lambat pada data besar)
    let limit = Number(o.limit);
    if (o.limit === undefined || o.limit === null || o.limit === "" || isNaN(limit)) {
      limit = RIWAYAT_LIMIT_DEFAULT;
    }
    limit = Math.max(0, Math.min(10000, limit));

    const start = filterTgl || (filterBulan ? filterBulan + "-01" : "");
    const end   = filterTgl || (filterBulan ? monthEndKey(filterBulan) : "");

    const sh = getSheet(SHEET_ABSENSI);
    const last = sh.getLastRow();
    if (last < 2) return { success: true, data: [], total: 0, truncated: false };

    const sesi = {};
    let truncated = false;
    const t0 = Date.now();

    // Bila ada filter tanggal/bulan, baca blok yang relevan.
    // Bila tidak, baca mundur dari baris terakhir agar cepat.
    if (start || end) {
      streamAbsensiRows(start, end, values => {
        prosesRiwayat(values, sesi, filterTgl, filterBulan, filterKelas);
      });
    } else {
      for (let endRow = last; endRow >= 2; endRow -= CHUNK_ROWS) {
        const startRow = Math.max(2, endRow - CHUNK_ROWS + 1);
        const values = sh.getRange(startRow, 1, endRow - startRow + 1, ABS_COLS).getValues();
        prosesRiwayat(values, sesi, "", "", filterKelas);

        if (limit && Object.keys(sesi).length >= limit) {
          if (startRow > 2) truncated = true;
          break;
        }
        if (Date.now() - t0 > RIWAYAT_BUDGET_MS) {
          if (startRow > 2) truncated = true;
          break;
        }
      }
    }

    let data = Object.keys(sesi).map(k => sesi[k]);
    data.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
      return b.jam_mulai - a.jam_mulai;
    });

    const total = data.length;
    if (limit && data.length > limit) {
      data = data.slice(0, limit);
      truncated = true;
    }

    return { success: true, data: data, total: total, truncated: truncated };

  } catch (err) {
    return fail(err);
  }
}

function prosesRiwayat(values, sesi, filterTgl, filterBulan, filterKelas) {
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const tgl = dateKey(r[ABS.TGL]);
    if (!tgl) continue;
    if (filterTgl && tgl !== filterTgl) continue;
    if (filterBulan && tgl.slice(0, 7) !== filterBulan) continue;

    const kelas = str(r[ABS.KELAS]);
    if (filterKelas && kelas !== filterKelas) continue;

    const mapel = str(r[ABS.MAPEL]);
    const guru  = str(r[ABS.GURU]);
    const jam   = toInt(r[ABS.JAM]);
    const foto  = str(r[ABS.FOTO]);
    const key   = makeSessionId(tgl, kelas, mapel, guru);

    const s = sesi[key];
    if (!s) {
      sesi[key] = {
        id: key, tanggal: tgl, kelas: kelas, mapel: mapel, guru: guru,
        jam_mulai: jam, jam_selesai: jam, foto: foto
      };
    } else {
      if (jam < s.jam_mulai)   s.jam_mulai = jam;
      if (jam > s.jam_selesai) s.jam_selesai = jam;
      if (!s.foto && foto)     s.foto = foto;
    }
  }
}

/**
 * Buat ID sesi. Format pipe "tgl|kelas|mapel|guru" tidak ambigu selama
 * mapel/guru tidak mengandung "|". Kalau ada, pakai base64 JSON agar
 * parseSessionId bisa memisahkannya dengan benar.
 */
function makeSessionId(tgl, kelas, mapel, guru) {
  if (mapel.indexOf("|") !== -1 || guru.indexOf("|") !== -1) {
    return Utilities.base64Encode(JSON.stringify({ tanggal: tgl, kelas: kelas, mapel: mapel, guru: guru }));
  }
  return tgl + "|" + kelas + "|" + mapel + "|" + guru;
}

// ============================================================
//  DETAIL ABSENSI (1 sesi, 1 tanggal)
// ============================================================

function getDetailAbsensi(idEncoded) {
  try {
    const sesi = parseSessionId(idEncoded);
    if (!sesi || !sesi.tanggal) {
      return { success: false, error: "ID sesi tidak valid" };
    }

    const detail = [];
    streamAbsensiRows(sesi.tanggal, sesi.tanggal, (values, firstRow) => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== sesi.tanggal) continue;
        if (str(r[ABS.KELAS]) !== sesi.kelas) continue;
        if (str(r[ABS.MAPEL]) !== sesi.mapel) continue;
        if (str(r[ABS.GURU]) !== sesi.guru) continue;

        detail.push({
          rowIndex:   firstRow + i,
          jam:        toInt(r[ABS.JAM]),
          nisn:       str(r[ABS.NISN]),
          nama_siswa: str(r[ABS.NAMA]),
          status:     normalizeStatus(r[ABS.STATUS]),
          foto:       str(r[ABS.FOTO])
        });
      }
    });

    return {
      success: true,
      data: {
        id:       str(idEncoded),
        tanggal:  sesi.tanggal,
        kelas:    sesi.kelas,
        mapel:    sesi.mapel,
        guru:     sesi.guru,
        detail:   detail
      }
    };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  UPDATE ABSENSI (batch, satu kali tulis)
// ============================================================

function updateAbsensi(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const items = Array.isArray(data && data.detail) ? data.detail : [];
    if (!items.length) return { success: false, error: "Tidak ada data untuk diperbarui" };

    const sh = getSheet(SHEET_ABSENSI);
    const last = sh.getLastRow();

    const changes = {};
    items.forEach(item => {
      const row = toInt(item && item.rowIndex);
      if (row < 2 || row > last) return;
      changes[row] = { status: normalizeStatus(item.status), exp: item || {} };
    });

    const rowsToUpdate = Object.keys(changes).map(Number).sort((a, b) => a - b);
    if (!rowsToUpdate.length) {
      return { success: false, error: "Baris absensi tidak ditemukan" };
    }

    const min = rowsToUpdate[0];
    const max = rowsToUpdate[rowsToUpdate.length - 1];

    // ── Verifikasi identitas baris sebelum menulis ─────────────
    // Nomor baris bisa bergeser setelah sesi lain dihapus, jadi
    // nilai lama baris dicek ulang terhadap data yang dikirim
    // klien (nisn/tanggal/kelas/mapel/guru/jam).
    const current = sh.getRange(min, 1, max - min + 1, ABS_COLS).getValues();

    let ditolak = 0;
    const tersimpan = {};
    rowsToUpdate.forEach(row => {
      const r = current[row - min];
      const exp = changes[row].exp;

      const cek = [
        ["nisn",   str(r[ABS.NISN])],
        ["tanggal", dateKey(r[ABS.TGL])],
        ["kelas",  str(r[ABS.KELAS])],
        ["mapel",  str(r[ABS.MAPEL])],
        ["guru",   str(r[ABS.GURU])]
      ];
      for (let i = 0; i < cek.length; i++) {
        const k = cek[i][0];
        const expected = str(exp[k]);
        if (!expected) continue;
        // NISN dibandingkan dengan kunci ternormalisasi (nol depan aman).
        if (k === "nisn") {
          if (nisnKey(expected) !== nisnKey(cek[i][1])) { ditolak++; return; }
          continue;
        }
        if (expected !== cek[i][1]) { ditolak++; return; }
      }
      if (toInt(exp.jam) > 0 && toInt(exp.jam) !== toInt(r[ABS.JAM])) { ditolak++; return; }

      tersimpan[row] = {
        status: changes[row].status,
        kelas:  str(r[ABS.KELAS]),
        tanggal: dateKey(r[ABS.TGL])
      };
    });

    const validRows = Object.keys(tersimpan).map(Number).sort((a, b) => a - b);
    if (!validRows.length) {
      return { success: false, error: "Baris absensi tidak cocok dengan data yang diminta (mungkin sudah berubah)" };
    }

    const range = sh.getRange(min, ABS.STATUS + 1, max - min + 1, 1);
    const vals = range.getValues();

    validRows.forEach(row => {
      vals[row - min][0] = tersimpan[row].status;
    });
    range.setValues(vals);
    bumpAbsensiCache();

    // ── Sinkronkan kasus otomatis untuk kelas+tanggal terdampak ──
    let kasusDibuat = 0;
    try {
      const terdampak = {};
      Object.keys(tersimpan).forEach(row => {
        const t = tersimpan[row];
        if (t.status === "A" || t.status === "C") terdampak[t.kelas + "|" + t.tanggal] = t;
      });
      Object.keys(terdampak).forEach(k => {
        const t = terdampak[k];
        kasusDibuat += autoKasusSetelahAbsensi(t.kelas, t.tanggal, [t.status]);
      });
    } catch (e) {
      console.log("[kasus-otomatis-update] " + (e && e.message ? e.message : e));
    }

    return {
      success: true,
      updated: validRows.length,
      ditolak: ditolak,
      kasusDibuat: kasusDibuat
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  HAPUS ABSENSI (satu sesi, batch per blok)
// ============================================================

function hapusAbsensi(idEncoded) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const sesi = parseSessionId(idEncoded);
    if (!sesi || !sesi.tanggal) {
      return { success: false, error: "ID sesi tidak valid" };
    }

    const sh = getSheet(SHEET_ABSENSI);
    const rowsToDelete = [];

    streamAbsensiRows(sesi.tanggal, sesi.tanggal, (values, firstRow) => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== sesi.tanggal) continue;
        if (str(r[ABS.KELAS]) !== sesi.kelas) continue;
        if (str(r[ABS.MAPEL]) !== sesi.mapel) continue;
        if (str(r[ABS.GURU]) !== sesi.guru) continue;
        rowsToDelete.push(firstRow + i);
      }
    });

    if (!rowsToDelete.length) {
      return { success: false, error: "Data absensi tidak ditemukan" };
    }

    rowsToDelete.sort((a, b) => a - b);

    // Hapus dari bawah, gabungkan baris yang berurutan.
    let i = rowsToDelete.length - 1;
    while (i >= 0) {
      const end = rowsToDelete[i];
      let start = end;
      while (i - 1 >= 0 && rowsToDelete[i - 1] === start - 1) {
        i--;
        start = rowsToDelete[i];
      }
      sh.deleteRows(start, end - start + 1);
      i--;
    }
    bumpAbsensiCache();

    return { success: true, deleted: rowsToDelete.length };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  APEL PAGI (siswa terlambat)
//  Satu baris = satu siswa pada satu tanggal. Disimpan di sheet
//  terpisah agar rekap mapel & kasus otomatis tidak terpengaruh.
// ============================================================

function ensureApelSheet() {
  const ss = getSS();
  let sh = ss.getSheetByName(SHEET_APEL);
  if (!sh) {
    sh = ss.insertSheet(SHEET_APEL);
    __sheetCache[SHEET_APEL] = sh;
  }
  ensureHeader(sh, APEL_HEADER);
  return sh;
}

function jamSekarang() {
  const d = new Date();
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

/** "7.5" / "07:05" / "07:05:00" -> "07:05". Kosong -> jam sekarang. */
function normalisasiJamDatang(value) {
  const s = str(value);
  if (!s) return jamSekarang();

  const m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!m) return "";

  const jam = Number(m[1]);
  const menit = Number(m[2]);
  if (jam < 0 || jam > 23 || menit < 0 || menit > 59) return "";
  return pad2(jam) + ":" + pad2(menit);
}

/**
 * Baca catatan apel pagi.
 * - getApelPagi(tanggal, kelas)          -> satu tanggal (dipakai dashboard piket)
 * - getApelPagi("", kelas, "2026-08")    -> satu bulan (laporan orang tua)
 * - getApelPagi("", kelas, "2026-08", nisn) -> satu siswa pada bulan itu
 * Bila tanggal & bulan kosong, dipakai tanggal hari ini.
 */
function getApelPagi(tanggal, kelas, bulan, nisn) {
  try {
    const tgl = dateKey(tanggal);
    const bln = str(bulan).slice(0, 7);
    const blnValid = /^\d{4}-\d{2}$/.test(bln) ? bln : "";

    // Tanpa filter tanggal/bulan -> hari ini (perilaku lama dipertahankan).
    const tglFilter = tgl || (!blnValid ? dateKey(new Date()) : "");
    const filter = str(kelas);
    const semua = !filter || filter.toUpperCase() === "SEMUA";
    const filterNisn = str(nisn);

    const sh = ensureApelSheet();
    const last = sh.getLastRow();
    const data = [];

    if (last >= 2) {
      const values = sh.getRange(2, 1, last - 1, APEL_COLS).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const id = str(r[APEL.ID]);
        if (!id) continue;

        const tglBaris = dateKey(r[APEL.TGL]);
        if (tglFilter) {
          if (tglBaris !== tglFilter) continue;
        } else if (blnValid) {
          if (tglBaris.slice(0, 7) !== blnValid) continue;
        }

        const kls = str(r[APEL.KELAS]);
        if (!semua && kls !== filter) continue;

        const nisnBaris = str(r[APEL.NISN]);
        if (filterNisn && nisnKey(nisnBaris) !== nisnKey(filterNisn)) continue;

        data.push({
          id:          id,
          tanggal:     tglBaris,
          nisn:        nisnBaris,
          nama_siswa:  str(r[APEL.NAMA]),
          kelas:       kls,
          jam_datang:  str(r[APEL.JAM]),
          keterangan:  str(r[APEL.KET]),
          petugas:     str(r[APEL.PETUGAS]),
          timestamp:   str(r[APEL.TS])
        });
      }
    }

    data.sort((a, b) =>
      String(b.tanggal).localeCompare(String(a.tanggal)) ||
      String(a.jam_datang).localeCompare(String(b.jam_datang)) ||
      String(a.nama_siswa).localeCompare(String(b.nama_siswa))
    );

    return {
      success: true,
      tanggal: tglFilter,
      bulan: blnValid,
      nisn: filterNisn,
      total: data.length,
      data: data
    };

  } catch (err) {
    return fail(err);
  }
}

/**
 * data: { tanggal, kelas, jam_datang, keterangan, siswa: [{nisn, nama_siswa}] }
 * Siswa yang sudah tercatat pada tanggal yang sama dilewati (tidak duplikat).
 */
function simpanApelPagi(data, petugas) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(20000);

    const d = data || {};
    const tanggal = dateKey(d.tanggal) || dateKey(new Date());
    const kelas = str(d.kelas);
    const keterangan = str(d.keterangan);
    const petugasNama = str(petugas) || str(d.petugas);

    if (!kelas) {
      return { success: false, error: "Kelas wajib diisi" };
    }

    const daftar = Array.isArray(d.siswa)
      ? d.siswa
      : (Array.isArray(d.detail) ? d.detail : []);
    if (!daftar.length) {
      return { success: false, error: "Pilih minimal satu siswa" };
    }

    const jam = normalisasiJamDatang(d.jam_datang);
    if (!jam) {
      return { success: false, error: "Jam datang tidak valid (gunakan format HH:MM)" };
    }

    const sh = ensureApelSheet();

    // Kunci unik: tanggal + NISN (dinormalisasi agar nol depan tidak jadi masalah).
    const sudahAda = {};
    const last = sh.getLastRow();
    if (last >= 2) {
      const values = sh.getRange(2, 1, last - 1, APEL_COLS).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[APEL.TGL]) !== tanggal) continue;
        const nisn = nisnKey(str(r[APEL.NISN]));
        if (nisn) sudahAda[nisn] = true;
      }
    }

    const stamp = nowTimestamp();
    const rows = [];
    const dilewati = [];
    const terlihat = {};

    for (let i = 0; i < daftar.length; i++) {
      const item = daftar[i] || {};
      const nisn = str(item.nisn);
      if (!nisn) continue;
      const kunci = nisnKey(nisn) || nisn;

      if (sudahAda[kunci] || terlihat[kunci]) {
        dilewati.push(nisn);
        continue;
      }
      terlihat[kunci] = true;

      rows.push([
        Utilities.getUuid(),
        tanggal,
        nisn,
        str(item.nama_siswa) || str(item.nama),
        str(item.kelas) || kelas,
        jam,
        str(item.keterangan) || keterangan,
        petugasNama,
        stamp
      ]);
    }

    if (!rows.length) {
      return {
        success: true,
        total: 0,
        dilewati: dilewati.length,
        tanggal: tanggal,
        message: "Semua siswa sudah tercatat pada tanggal ini."
      };
    }

    appendRows(sh, rows, APEL_HEADER, [APEL.NISN]);

    return {
      success: true,
      total: rows.length,
      dilewati: dilewati.length,
      tanggal: tanggal,
      jam_datang: jam
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function hapusApelPagi(id) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const target = str(id);
    if (!target) return { success: false, error: "ID apel tidak valid" };

    const sh = ensureApelSheet();
    const last = sh.getLastRow();
    if (last < 2) return { success: false, error: "Data apel tidak ditemukan" };

    const ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (str(ids[i][0]) !== target) continue;
      sh.deleteRow(i + 2);
      return { success: true, deleted: 1 };
    }

    return { success: false, error: "Data apel tidak ditemukan" };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  ABSENSI GURU (rekap 1 status per siswa per hari)
//  Catatan: dulu mengirim SEMUA baris jam (bisa puluhan ribu).
//  Report hanya butuh status akhir per hari, jadi dikirim ringkas.
// ============================================================

function getAbsensiGuru(kelas, guru, bulan) {
  try {
    const filterKelas = str(kelas);
    const filterGuru  = str(guru);
    const bulanKey = monthKey(bulan);

    const cacheKey = "absGuru:" + absCacheVersion() + ":" + cacheVersion() + ":" + filterKelas + ":" + filterGuru + ":" + bulanKey;
    const cached = cacheGetJson(cacheKey);
    if (cached) return cached;

    const start = bulanKey ? bulanKey + "-01" : "";
    const end   = bulanKey ? monthEndKey(bulanKey) : "";

    const map = {};
    // Status harian (seluruh jam, semua guru) per siswa per tanggal.
    // Dipakai agar rekap bulanan = hitungan harian: Hadir hanya bila
    // semua jam hadir; bila ada Sakit/Izin/Alpha/Cabut, itu yang tampil.
    const hariMap = {};
    const nisnAsli = nisnMasterMap();

    streamAbsensiRows(start, end, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const tgl = dateKey(r[ABS.TGL]);
        if (!tgl) continue;
        if (bulanKey && tgl.slice(0, 7) !== bulanKey) continue;

        const kls = str(r[ABS.KELAS]);
        const gr  = str(r[ABS.GURU]);
        if (filterKelas && kls !== filterKelas) continue;

        const nisnRaw = str(r[ABS.NISN]);
        const nisn = nisnKey(nisnRaw);
        if (!nisn) continue;

        const st = normalizeStatus(r[ABS.STATUS]);
        const hk = nisn + "|" + tgl;
        if (!hariMap[hk] || PRIOR[st] > PRIOR[hariMap[hk]]) hariMap[hk] = st;

        if (filterGuru && gr !== filterGuru) continue;

        const key = nisn + "|" + tgl;
        const prev = map[key];

        if (!prev) {
          map[key] = {
            tanggal:    tgl,
            jam:        toInt(r[ABS.JAM]),
            kelas:      kls,
            mapel:      str(r[ABS.MAPEL]),
            guru:       gr,
            nisn:       nisnAsli[nisn] || nisnRaw,
            nama_siswa: str(r[ABS.NAMA]),
            status:     st
          };
        } else if (PRIOR[st] > PRIOR[prev.status]) {
          prev.status = st;
          // metadata mengikuti sesi yang menentukan status akhir
          prev.jam   = toInt(r[ABS.JAM]);
          prev.mapel = str(r[ABS.MAPEL]);
          prev.guru  = gr;
        }
      }
    });

    // Ganti status per sesi dengan status harian kelas.
    Object.keys(map).forEach(k => {
      if (hariMap[k]) map[k].status = hariMap[k];
    });

    const data = Object.keys(map)
      .map(k => map[k])
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nisn.localeCompare(b.nisn));

    const res = { success: true, data: data };
    cachePutJson(cacheKey, res, 300);
    return res;

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  REKAP GURU MAPEL PER SEMESTER — pertemuan 1..24
//  Satu "pertemuan" = satu sesi absensi (tanggal + mapel + guru)
//  pada satu kelas. Urut tanggal & jam, lalu diberi nomor.
// ============================================================

const MAKS_PERTEMUAN_SEMESTER = 24;

function getRekapGuruSemester(kelas, guru, semester, tahun, mapel, maks) {
  try {
    const filterKelas = str(kelas);
    const filterGuru  = str(guru);
    const filterMapel = str(mapel);
    if (!filterKelas) return { success: false, error: "Kelas wajib diisi" };

    const batas = Math.min(Math.max(toInt(maks) || MAKS_PERTEMUAN_SEMESTER, 1), MAKS_PERTEMUAN_SEMESTER);
    const info = semesterRange(semester, tahun, new Date());

    const sesiMap = {};
    const sesiList = [];
    const mapelSet = {};
    // Status harian (seluruh jam kelas itu, semua guru/mapel) per siswa.
    // Rekap semester = hitungan harian: Hadir hanya bila semua jam hadir;
    // bila ada Sakit/Izin/Alpha/Cabut, status itu yang ditampilkan.
    const hariMap = {};
    // NISN master (nol depan utuh) untuk ditampilkan walau sheet absensi
    // menyimpan NISN sebagai angka.
    const nisnAsli = {};
    readSiswaMasterCached().forEach(s => {
      const k = nisnKey(s.nisn);
      if (k && !nisnAsli[k]) nisnAsli[k] = s.nisn;
    });

    streamAbsensiRows(info.start, info.end, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const tgl = dateKey(r[ABS.TGL]);
        if (!tgl) continue;
        if (str(r[ABS.KELAS]) !== filterKelas) continue;

        const nisnRaw = str(r[ABS.NISN]);
        const nisn = nisnKey(nisnRaw);
        if (!nisn) continue;

        const st = normalizeStatus(r[ABS.STATUS]);
        const hk = nisn + "|" + tgl;
        if (!hariMap[hk] || PRIOR[st] > PRIOR[hariMap[hk]]) hariMap[hk] = st;

        const gr = str(r[ABS.GURU]);
        if (filterGuru && gr !== filterGuru) continue;

        const mp = str(r[ABS.MAPEL]);
        if (filterMapel && mp !== filterMapel) continue;
        if (mp) mapelSet[mp] = true;

        const jam = toInt(r[ABS.JAM]);
        // Kunci sesi: pakai UUID baris (satu kali simpan = satu pertemuan)
        // agar dua sesi mapel sama di tanggal sama tidak tergabung.
        const sid = str(r[ABS.ID]);
        const key = sid || (tgl + "|" + gr + "|" + mp);
        let sesi = sesiMap[key];
        if (!sesi) {
          sesi = {
            tanggal:    tgl,
            mapel:      mp,
            guru:       gr,
            jamMulai:   jam,
            jamSelesai: jam,
            siswa:      {}
          };
          sesiMap[key] = sesi;
          sesiList.push(sesi);
        } else {
          if (jam > 0 && (!sesi.jamMulai || jam < sesi.jamMulai)) sesi.jamMulai = jam;
          if (jam > sesi.jamSelesai) sesi.jamSelesai = jam;
        }

        // status sesi ini saja (cadangan bila status harian tidak ada)
        const prev = sesi.siswa[nisn];
        if (!prev) {
          sesi.siswa[nisn] = { nisn: nisnAsli[nisn] || nisnRaw, nama: str(r[ABS.NAMA]), status: st };
        } else if (PRIOR[st] > PRIOR[prev.status]) {
          prev.status = st;
        }
      }
    });

    sesiList.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      if (a.jamMulai !== b.jamMulai) return a.jamMulai - b.jamMulai;
      return a.mapel < b.mapel ? -1 : a.mapel > b.mapel ? 1 : 0;
    });

    const totalPertemuan = sesiList.length;
    const dipakai = sesiList.slice(0, batas);

    const siswaMap = {};
    const master = readSiswaMasterCached();
    for (let i = 0; i < master.length; i++) {
      const s = master[i];
      if (s.kelas !== filterKelas) continue;
      const k = nisnKey(s.nisn);
      if (!k) continue;
      siswaMap[k] = {
        nisn:   s.nisn,
        nama:   s.nama,
        status: {},
        totals: { H: 0, S: 0, I: 0, A: 0, C: 0 }
      };
    }

    for (let p = 0; p < dipakai.length; p++) {
      const sesi = dipakai[p];
      const no = p + 1;
      sesi.no = no;

      const daftar = Object.keys(sesi.siswa);
      for (let i = 0; i < daftar.length; i++) {
        const nisn = daftar[i];
        if (!siswaMap[nisn]) {
          siswaMap[nisn] = {
            nisn:   sesi.siswa[nisn].nisn || nisn,
            nama:   sesi.siswa[nisn].nama,
            status: {},
            totals: { H: 0, S: 0, I: 0, A: 0, C: 0 }
          };
        }
        // Status harian (semua jam) mengalahkan status sesi ini saja.
        const st = hariMap[nisn + "|" + sesi.tanggal] || sesi.siswa[nisn].status;
        siswaMap[nisn].status[no] = st;
      }
    }

    // Jumlah dihitung per hari: beberapa pertemuan pada tanggal yang sama
    // tidak dihitung berulang.
    Object.keys(siswaMap).forEach(k => {
      const s = siswaMap[k];
      const perHari = {};
      Object.keys(s.status).forEach(no => {
        const p = dipakai[Number(no) - 1];
        if (!p) return;
        const st = s.status[no];
        if (!perHari[p.tanggal] || PRIOR[st] > PRIOR[perHari[p.tanggal]]) {
          perHari[p.tanggal] = st;
        }
      });
      const totals = { H: 0, S: 0, I: 0, A: 0, C: 0 };
      Object.keys(perHari).forEach(d => {
        const st = perHari[d];
        if (totals[st] !== undefined) totals[st]++;
      });
      s.totals = totals;
      s.hari = Object.keys(perHari).length;
    });

    const siswa = Object.keys(siswaMap).map(k => siswaMap[k]);
    siswa.sort((a, b) => a.nama.localeCompare(b.nama));

    const pertemuan = dipakai.map((s, idx) => ({
      no:          idx + 1,
      tanggal:     s.tanggal,
      mapel:       s.mapel,
      jam_mulai:   s.jamMulai,
      jam_selesai: s.jamSelesai
    }));

    return {
      success:       true,
      kelas:         filterKelas,
      guru:          filterGuru,
      mapel:         filterMapel,
      semester:      info.semester,
      semesterLabel: info.label,
      tahunAjaran:   info.tahunAjaran,
      rangeStart:    info.start,
      rangeEnd:      info.end,
      maks:          batas,
      totalPertemuan: totalPertemuan,
      pertemuan:     pertemuan,
      siswa:         siswa,
      mapelList:     Object.keys(mapelSet).sort()
    };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  DASHBOARD PIKET
// ============================================================

function getDashboardPiket(tanggal, kelas) {
  try {
    const tgl = dateKey(tanggal) || dateKey(new Date());
    const filter = str(kelas);
    const semua = !filter || filter.toUpperCase() === "SEMUA";

    const siswaMaster = readSiswaMasterCached();
    const kelasList   = readKelasList();
    const targetKelas = semua ? kelasList : [filter];

    const jamRows = getSheet(SHEET_JAM).getDataRange().getValues();
    const jamTersedia = [];
    for (let i = 1; i < jamRows.length; i++) {
      const no = toInt(jamRows[i][0]);
      if (no > 0) jamTersedia.push(no);
    }
    jamTersedia.sort((a, b) => a - b);

    // Kelompokkan siswa per kelas sekali jalan
    const siswaPerKelas = {};
    siswaMaster.forEach(s => {
      if (!siswaPerKelas[s.kelas]) siswaPerKelas[s.kelas] = [];
      siswaPerKelas[s.kelas].push(s);
    });

    // Baris absensi hari itu, dikelompokkan per kelas
    const absPerKelas = {};
    streamAbsensiRows(tgl, tgl, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== tgl) continue;
        const kls = str(r[ABS.KELAS]);
        if (!absPerKelas[kls]) absPerKelas[kls] = [];
        absPerKelas[kls].push(r);
      }
    });

    const result = targetKelas.map(kls => {
      const siswaDiKelas = siswaPerKelas[kls] || [];
      const absDiKelas   = absPerKelas[kls]   || [];

      // Peta siswa → status per jam (kunci NISN dinormalisasi)
      const siswaPeta = {};
      siswaDiKelas.forEach(s => {
        const k = nisnKey(s.nisn);
        if (!k) return;
        siswaPeta[k] = { nisn: s.nisn, nama: s.nama, no_hp_ortu: s.no_hp_ortu || "", jam: {} };
      });

      const guruSesiMap = {};
      const jamInfo = {};
      const jamTerisiSet = {};

      for (let i = 0; i < absDiKelas.length; i++) {
        const r = absDiKelas[i];
        const nisn = nisnKey(str(r[ABS.NISN]));
        const jam  = toInt(r[ABS.JAM]);
        const st   = normalizeStatus(r[ABS.STATUS]);

        if (jam > 0) jamTerisiSet[jam] = true;
        if (siswaPeta[nisn]) siswaPeta[nisn].jam[jam] = st;

        const gr  = str(r[ABS.GURU]);
        const mpl = str(r[ABS.MAPEL]);
        const key = gr + "|" + mpl;

        if (!guruSesiMap[key]) {
          guruSesiMap[key] = { nama: gr, mapel: mpl, jam: {}, siswaPeta: {}, absenMap: {} };
        }
        const sesi = guruSesiMap[key];
        sesi.jam[jam] = true;

        const prev = sesi.siswaPeta[nisn];
        if (!prev || PRIOR[st] > PRIOR[prev]) sesi.siswaPeta[nisn] = st;

        if (st !== "H") {
          const namaSiswa = str(r[ABS.NAMA]) ||
            (siswaPeta[nisn] ? siswaPeta[nisn].nama : "") || "Siswa";
          const lama = sesi.absenMap[nisn];
          if (!lama || PRIOR[st] > PRIOR[lama.status]) {
            sesi.absenMap[nisn] = {
              nisn: (siswaPeta[nisn] ? siswaPeta[nisn].nisn : str(r[ABS.NISN])) || "",
              nama: namaSiswa,
              no_hp_ortu: siswaPeta[nisn] ? (siswaPeta[nisn].no_hp_ortu || "") : "",
              status: st,
              jam: jam
            };
          }
        }

        // Mapel & guru pengampu tiap jam, untuk kop tabel laporan harian.
        if (jam && !jamInfo[jam]) jamInfo[jam] = { mapel: mpl, guru: gr };
      }

      // Statistik kelas (prioritas C > A > S > I > H) + deteksi cabut antar-jam
      const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
      const siswaList = [];
      const cabutAntarJam = [];
      let terabsen = 0;

      siswaDiKelas.forEach(s => {
        const item = siswaPeta[nisnKey(s.nisn)] || { nisn: s.nisn, nama: s.nama, no_hp_ortu: s.no_hp_ortu || "", jam: {} };
        siswaList.push(item);
        const jamKeys = Object.keys(item.jam).map(Number).filter(n => n > 0).sort((a, b) => a - b);
        const values = jamKeys.map(k => item.jam[k]);
        if (!values.length) return; // belum diabsen
        terabsen++;

        let firstH = 0;
        const jamBolos = [];
        let bolosStatus = "";
        jamKeys.forEach(j => {
          const st = item.jam[j];
          if (st === "H" && !firstH) firstH = j;
          if (firstH && j > firstH && (st === "A" || st === "C")) {
            jamBolos.push(j);
            if (!bolosStatus || PRIOR[st] > PRIOR[bolosStatus]) bolosStatus = st;
          }
        });
        if (firstH && jamBolos.length) {
          cabutAntarJam.push({
            nisn: item.nisn,
            nama: item.nama,
            kelas: kls,
            no_hp_ortu: item.no_hp_ortu || "",
            jamHadir: firstH,
            jamBolos: jamBolos,
            status: bolosStatus
          });
        }

        if (values.indexOf("C") >= 0) { stat.C++; return; }
        if (values.indexOf("A") >= 0) { stat.A++; return; }
        if (values.indexOf("S") >= 0) { stat.S++; return; }
        if (values.indexOf("I") >= 0) { stat.I++; return; }
        stat.H++;
      });

      const jamTerisiKelas = Object.keys(jamTerisiSet).map(Number).filter(n => n > 0).sort((a, b) => a - b);

      const guruList = Object.keys(guruSesiMap).map(k => {
        const g = guruSesiMap[k];
        const gstat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
        let total = 0;
        Object.keys(g.siswaPeta).forEach(nisn => {
          const st = g.siswaPeta[nisn];
          if (gstat[st] !== undefined) { gstat[st]++; total++; }
        });
        const jamList = Object.keys(g.jam).map(Number).filter(n => n > 0).sort((a, b) => a - b);
        const absen = Object.keys(g.absenMap)
          .map(nisn => g.absenMap[nisn])
          .sort((a, b) => (PRIOR[b.status] || 0) - (PRIOR[a.status] || 0) ||
            String(a.nama).localeCompare(String(b.nama)));
        return {
          nama: g.nama,
          mapel: g.mapel,
          jam: jamList,
          totalSiswa: total,
          statistik: gstat,
          absen: absen,
          totalAbsen: absen.length
        };
      }).sort((a, b) => (a.jam[0] || 99) - (b.jam[0] || 99) || String(a.nama).localeCompare(String(b.nama)));

      const pelanggaran = stat.A + stat.C + stat.S + stat.I;
      const finalStatus = absDiKelas.length === 0 ? "belum"
        : pelanggaran > 3 ? "warning" : "hadir";

      return {
        kelas:         kls,
        statistik:     stat,
        finalStatus:   finalStatus,
        siswaList:     siswaList,
        guruList:      guruList,
        jamInfo:       jamInfo,
        jamTerisi:     jamTerisiKelas,
        cabutAntarJam: cabutAntarJam,
        totalSiswa:    siswaDiKelas.length,
        terabsen:      terabsen
      };
    });

    return { success: true, tanggal: tgl, jamTersedia: jamTersedia, data: result };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  DASHBOARD ADMIN
// ============================================================

function getDashboardAdmin() {
  try {
    const hariIni = dateKey(new Date());
    const siswaMaster = readSiswaMasterCached();
    const totalSiswa = siswaMaster.length;

    const guruRows = getSheet(SHEET_GURU).getDataRange().getValues();
    let totalGuru = 0;
    for (let i = 1; i < guruRows.length; i++) {
      if (str(guruRows[i][1])) totalGuru++;
    }

    // Status akhir per siswa hari ini
    const siswaHari = {};
    const kelasTerisiHari = {};
    let urutan = 0;

    streamAbsensiRows(hariIni, hariIni, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (dateKey(r[ABS.TGL]) !== hariIni) continue;
        urutan++;

        const kls = str(r[ABS.KELAS]);
        if (kls) kelasTerisiHari[kls] = true;

        const nisn = str(r[ABS.NISN]);
        if (!nisn) continue;

        const st = normalizeStatus(r[ABS.STATUS]);
        const rec = siswaHari[nisn];

        if (!rec) {
          siswaHari[nisn] = {
            siswa:   str(r[ABS.NAMA]),
            kelas:   kls,
            tanggal: hariIni,
            status:  st,
            urutan:  urutan
          };
        } else {
          if (PRIOR[st] > PRIOR[rec.status]) rec.status = st;
          rec.urutan = urutan; // aktivitas terakhir
        }
      }
    });

    const kelasList = readKelasList();
    const kelasBelumInput = kelasList.filter(k => !kelasTerisiHari[k]);
    let totalApelHariIni = 0;
    try {
      const apel = getApelPagi(hariIni, "SEMUA");
      if (apel && apel.success) totalApelHariIni = apel.total || 0;
    } catch (e) { /* abaikan */ }

    const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    const aktivitasAll = [];

    Object.keys(siswaHari).forEach(nisn => {
      const rec = siswaHari[nisn];
      stat[rec.status]++;

      const label = rec.status === "H" ? "Hadir"
        : rec.status === "A" ? "Alpha"
        : rec.status === "C" ? "Cabut"
        : rec.status === "S" ? "Sakit"
        : "Izin";

      aktivitasAll.push({
        siswa:   rec.siswa,
        kelas:   rec.kelas,
        tanggal: rec.tanggal,
        status:  label,
        urutan:  rec.urutan
      });
    });

    aktivitasAll.sort((a, b) => b.urutan - a.urutan);
    const aktivitas = aktivitasAll.slice(0, 10).map(a => ({
      siswa: a.siswa, kelas: a.kelas, tanggal: a.tanggal, status: a.status
    }));

    const hadirPersen = totalSiswa > 0
      ? Math.round((stat.H / totalSiswa) * 100)
      : 0;

    return {
      success: true,
      data: {
        totalSiswa:  totalSiswa,
        totalGuru:   totalGuru,
        hadirPersen:      hadirPersen,
        pelanggaran:      stat.A + stat.C,
        hadir:            stat.H,
        sakit:            stat.S,
        izin:             stat.I,
        alpha:            stat.A,
        cabut:            stat.C,
        totalKelas:       kelasList.length,
        kelasBelumInput:  kelasBelumInput,
        totalApelHariIni: totalApelHariIni,
        aktivitas:        aktivitas
      }
    };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  DASHBOARD KEPSEK
//  mode: harian | mingguan | bulanan | semester
// ============================================================

function getDashboardKepsek(mode, tanggal, bulan, filterKelas, filterJurusan) {
  try {
    mode = str(mode) || "harian";
    const tglRefKey = dateKey(tanggal) || dateKey(new Date());
    const refDate = parseDateKey(tglRefKey);

    const fKelas = str(filterKelas) || "SEMUA";
    const fJurusan = str(filterJurusan) || "SEMUA";

    const cacheKey = "kepsek:" + absCacheVersion() + ":" + cacheVersion() + ":" + mode + ":" + tglRefKey + ":" + str(bulan) + ":" + fKelas + ":" + fJurusan;
    const cached = cacheGetJson(cacheKey);
    if (cached) return cached;

    let tglStart = tglRefKey;
    let tglEnd = tglRefKey;

    if (mode === "mingguan") {
      const day = refDate.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Senin
      const mon = addDays(refDate, diff);
      const sun = addDays(mon, 6);
      tglStart = dateKey(mon);
      tglEnd = dateKey(sun);
    } else if (mode === "bulanan") {
      const ym = /^\d{4}-\d{2}$/.test(str(bulan)) ? str(bulan) : tglRefKey.slice(0, 7);
      tglStart = ym + "-01";
      tglEnd = monthEndKey(ym);
    } else if (mode === "semester") {
      const y = refDate.getFullYear();
      const m = refDate.getMonth() + 1;
      tglStart = m >= 7 ? y + "-07-01" : y + "-01-01";
      tglEnd   = m >= 7 ? y + "-12-31" : y + "-06-30";
    } else {
      mode = "harian";
    }

    if (!tglStart || !tglEnd || tglEnd < tglStart) {
      return { success: false, error: "Periode tidak valid" };
    }

    // Jendela trend: 12 bulan ke belakang dari awal periode.
    const startDate = parseDateKey(tglStart);
    const trendStart = dateKey(new Date(startDate.getFullYear(), startDate.getMonth() - 11, 1));
    const trendEnd = tglEnd > tglRefKey ? tglEnd : tglRefKey;

    const filteredRaw = [];       // baris periode terpilih
    const trendRaw = {};          // "bln|nisn|tgl" → status akhir

    streamAbsensiRows(trendStart, trendEnd, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const tgl = dateKey(r[ABS.TGL]);
        if (!tgl) continue;

        const nisn = str(r[ABS.NISN]);
        const kls  = str(r[ABS.KELAS]);
        const st   = normalizeStatus(r[ABS.STATUS]);

        // ── Trend (12 bulan, tanpa filter kelas) ──
        if (nisn) {
          const bln = tgl.slice(0, 7);
          const tk = bln + "|" + nisn + "|" + tgl;
          if (!trendRaw[tk]) trendRaw[tk] = st;
          else if (PRIOR[st] > PRIOR[trendRaw[tk]]) trendRaw[tk] = st;
        }

        // ── KPI periode terpilih ──
        if (tgl < tglStart || tgl > tglEnd) continue;
        if (fKelas !== "SEMUA" && kls !== fKelas) continue;
        if (fJurusan !== "SEMUA" && jurusanOf(kls) !== fJurusan) continue;

        filteredRaw.push({
          tgl:   tgl,
          nisn:  nisn,
          kelas: kls,
          nama:  str(r[ABS.NAMA]),
          status: st
        });
      }
    });

    // Satu status per siswa per hari
    const siswaHariMap = {};
    for (let i = 0; i < filteredRaw.length; i++) {
      const row = filteredRaw[i];
      if (!row.nisn) continue;
      const key = row.tgl + "|" + row.nisn;
      const prev = siswaHariMap[key];
      if (!prev) {
        siswaHariMap[key] = row;
      } else if (PRIOR[row.status] > PRIOR[prev.status]) {
        prev.status = row.status;
      }
    }

    const filtered = Object.keys(siswaHariMap).map(k => siswaHariMap[k]);

    const hpMap = {};
    readSiswaMasterCached().forEach(s => {
      const k = nisnKey(s.nisn);
      if (k && s.no_hp_ortu) hpMap[k] = s.no_hp_ortu;
    });

    const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    const kelasStat = {};
    const jurusanMap = {};
    const siswaCabutMap = {};

    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i];
      const kls = row.kelas;
      const st  = row.status;
      const jur = jurusanOf(kls) || "Lainnya";

      stat[st]++;

      if (!kelasStat[kls]) kelasStat[kls] = { H: 0, total: 0 };
      kelasStat[kls].total++;
      if (st === "H") kelasStat[kls].H++;

      if (!jurusanMap[jur]) jurusanMap[jur] = { H: 0, S: 0, I: 0, A: 0, C: 0, total: 0 };
      jurusanMap[jur][st]++;
      jurusanMap[jur].total++;

      if (st === "A" || st === "C") {
        const nk = nisnKey(row.nisn) || row.nisn;
        if (!siswaCabutMap[nk]) {
          siswaCabutMap[nk] = {
            nisn: row.nisn,
            nama: row.nama,
            kelas: kls,
            status: st,
            alpha: 0,
            cabut: 0,
            total: 0,
            no_hp_ortu: hpMap[nk] || ""
          };
        }
        const s = siswaCabutMap[nk];
        s.total++;
        if (st === "A") s.alpha++;
        if (st === "C") s.cabut++;
        if (PRIOR[st] > PRIOR[s.status]) s.status = st;
      }
    }

    const totalUnit = filtered.length;
    const hadirPersen = totalUnit > 0 ? Math.round((stat.H / totalUnit) * 100) : 0;

    const rankingKelas = Object.keys(kelasStat).map(k => {
      const v = kelasStat[k];
      return { kelas: k, hadir: v.total > 0 ? Math.round((v.H / v.total) * 100) : 0 };
    }).sort((a, b) => b.hadir - a.hadir || a.kelas.localeCompare(b.kelas));

    const grafikJurusan = Object.keys(jurusanMap).map(j => {
      const v = jurusanMap[j];
      return {
        jurusan: j,
        hadir: v.total > 0 ? Math.round((v.H / v.total) * 100) : 0,
        alpha: v.A,
        cabut: v.C
      };
    });

    const siswaCabut = Object.keys(siswaCabutMap)
      .map(k => siswaCabutMap[k])
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const peringatanDini = Object.keys(siswaCabutMap)
      .map(k => {
        const s = siswaCabutMap[k];
        return {
          nisn: s.nisn,
          nama: s.nama,
          kelas: s.kelas,
          alpha: s.alpha,
          cabut: s.cabut,
          total: s.total,
          level: s.total >= 3 ? "KRITIS" : "PERINGATAN",
          no_hp_ortu: s.no_hp_ortu || ""
        };
      })
      .filter(s => s.total >= 2)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // ── Trend bulanan & semester (satu kali loop) ──
    const trendMap = {};
    const semMap = {};
    const trendKeys = Object.keys(trendRaw);

    for (let i = 0; i < trendKeys.length; i++) {
      const bln = trendKeys[i].slice(0, 7);
      const st = trendRaw[trendKeys[i]];
      const y = bln.slice(0, 4);
      const m = Number(bln.slice(5, 7));
      const sem = m >= 7 ? y + " Ganjil" : y + " Genap";

      if (!trendMap[bln]) trendMap[bln] = { H: 0, total: 0 };
      trendMap[bln].total++;
      if (st === "H") trendMap[bln].H++;

      // key urut kronologis: Ganjil (Jul–Des tahun y) sebelum
      // Genap (Jan–Jun tahun y+1) yang datang sesudahnya
      if (!semMap[sem]) semMap[sem] = { H: 0, total: 0, sortKey: y + (m >= 7 ? "0" : "1") };
      semMap[sem].total++;
      if (st === "H") semMap[sem].H++;
    }

    const trendBulanan = Object.keys(trendMap)
      .sort((a, b) => a.localeCompare(b))
      .slice(-12)
      .map(bln => ({
        bulan: bln,
        persen: trendMap[bln].total > 0
          ? Math.round((trendMap[bln].H / trendMap[bln].total) * 100) : 0
      }));

    const trendSemester = Object.keys(semMap)
      .sort((a, b) => String(semMap[a].sortKey).localeCompare(String(semMap[b].sortKey)))
      .map(sem => ({
        semester: sem,
        hadir: semMap[sem].total > 0
          ? Math.round((semMap[sem].H / semMap[sem].total) * 100) : 0
      }));

    const res = {
      success: true,
      mode: mode,
      periode: { mulai: tglStart, selesai: tglEnd },
      totalUnit: totalUnit,
      kpi: {
        hadir: hadirPersen,
        alpha: stat.A,
        cabut: stat.C,
        sakit: stat.S,
        izin: stat.I
      },
      rankingKelas:   rankingKelas,
      grafikJurusan:  grafikJurusan,
      siswaCabut:     siswaCabut,
      peringatanDini: peringatanDini,
      trendBulanan:   trendBulanan,
      trendSemester:  trendSemester
    };
    cachePutJson(cacheKey, res, 180);
    return res;

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  KASUS PEMBINAAN
//  Kolom: [0]id [1]tanggal [2]nisn [3]nama_siswa [4]kelas
//         [5]jenis [6]keterangan [7]status [8]alasan_penutupan
//         [9]tanggal_ditutup [10]created_at [11]level
//         [12]tindakan_wali [13]tindakan_bk [14]tindakan_kepsek
//         [15]escalated_to [16]catatan_wali [17]catatan_bk
// ============================================================

function ensureKasusSheet() {
  const ss = getSS();
  let sh = ss.getSheetByName(SHEET_KASUS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_KASUS);
    __sheetCache[SHEET_KASUS] = sh;
  }
  ensureHeader(sh, KASUS_HEADER);
  return sh;
}

function getKasusPembinaan(filterStatus, filterKelas, role, kelasWali, filterLevel) {
  try {
    const sh = ensureKasusSheet();

    const statusFilter = str(filterStatus);
    const kelasFilter  = str(filterKelas);
    const levelFilter  = normalizeKasusLevel(filterLevel);
    const roleNorm     = normalizeKasusLevel(role) || str(role).toLowerCase();
    const kelasWaliStr = str(kelasWali);

    // Wali kelas SELALU dibatasi kelasnya sendiri (fail-closed).
    // Kalau kelas walinya tidak diketahui, jangan tampilkan kasus
    // sekolah — sebelumnya justru menampilkan semua kelas.
    if (roleNorm === "wali_kelas" && !kelasWaliStr) {
      return { success: false, error: "Kelas wali tidak diketahui" };
    }

    const all = sh.getDataRange().getValues();
    const hpMap = {};
    readSiswaMasterCached().forEach(s => {
      const k = nisnKey(s.nisn);
      if (k && s.no_hp_ortu) hpMap[k] = s.no_hp_ortu;
    });

    const rows = [];
    for (let i = 1; i < all.length; i++) {
      const r = all[i];
      const id = str(r[0]);
      if (!id) continue;

      const status = str(r[7]) || "Open";
      const kelas  = str(r[4]);
      const level  = normalizeKasusLevel(r[11]) || "wali_kelas";

      if (statusFilter && statusFilter !== "SEMUA" && status !== statusFilter) continue;
      if (kelasFilter && kelasFilter !== "SEMUA" && kelas !== kelasFilter) continue;
      if (levelFilter && level !== levelFilter) continue;
      if (roleNorm === "wali_kelas" && kelas !== kelasWaliStr) continue;

      const nisnVal = str(r[2]);
      rows.push({
        id:               id,
        tanggal:          dateKey(r[1]) || str(r[1]),
        nisn:             nisnVal,
        nama_siswa:       str(r[3]),
        kelas:            kelas,
        no_hp_ortu:       hpMap[nisnKey(nisnVal)] || "",
        jenis:            str(r[5]),
        keterangan:       str(r[6]),
        status:           status,
        alasan_penutupan: str(r[8]),
        tanggal_ditutup:  str(r[9]),
        created_at:       str(r[10]),
        level:            level,
        tindakan_wali:    str(r[12]),
        tindakan_bk:      str(r[13]),
        tindakan_kepsek:  str(r[14]),
        escalated_to:     str(r[15]),
        catatan_wali:     str(r[16]),
        catatan_bk:       str(r[17])
      });
    }

    return { success: true, data: rows };

  } catch (err) {
    return fail(err);
  }
}

function getPeringatanWaliKelas(kelasWali) {
  try {
    const target = str(kelasWali);
    // tanpa kelas wali → jangan hitung seluruh sekolah
    if (!target) return { success: false, error: "Kelas wali tidak diketahui" };

    const sh = ensureKasusSheet();
    const all = sh.getDataRange().getValues();
    const peringatan = [];

    for (let i = 1; i < all.length; i++) {
      const r = all[i];
      if (!str(r[0])) continue;
      if (str(r[7]) !== "Open") continue;
      if ((normalizeKasusLevel(r[11]) || "wali_kelas") !== "wali_kelas") continue;

      const kelas = str(r[4]);
      if (kelas !== target) continue;

      peringatan.push({
        id:         str(r[0]),
        nisn:       str(r[2]),
        nama:       str(r[3]),
        nama_siswa: str(r[3]),
        kelas:      kelas,
        jenis:      str(r[5]),
        tanggal:    dateKey(r[1]) || str(r[1])
      });
    }

    return { success: true, peringatan: peringatan.length, data: peringatan };

  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  KASUS OTOMATIS DARI ABSENSI
//  Siswa dengan 3× Alpha ATAU 3× Cabut dalam satu semester
//  otomatis dibuatkan kasus pembinaan (level wali kelas, Open).
// ============================================================

const AMBANG_KASUS_OTOMATIS = 3;

/** Hitung hari Alpha/Cabut per siswa pada rentang tanggal. */
function hitungKarakterAbsensi(startKey, endKey, filterKelas) {
  const targetKelas = str(filterKelas);
  const harian = {};
  const nisnAsli = nisnMasterMap();

  streamAbsensiRows(startKey, endKey, values => {
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const tgl = dateKey(r[ABS.TGL]);
      if (!tgl) continue;
      const kelas = str(r[ABS.KELAS]);
      if (targetKelas && kelas !== targetKelas) continue;
      const nisnRaw = str(r[ABS.NISN]);
      const nisn = nisnKey(nisnRaw);
      if (!nisn) continue;

      const key = nisn + "|" + tgl;
      const st = normalizeStatus(r[ABS.STATUS]);
      const prev = harian[key];
      if (!prev) {
        harian[key] = {
          nisn: nisnAsli[nisn] || nisnRaw,
          nama: str(r[ABS.NAMA]),
          kelas: kelas,
          tanggal: tgl,
          status: st
        };
      } else if (PRIOR[st] > PRIOR[prev.status]) {
        prev.status = st;
      }
    }
  });

  const perSiswa = {};
  Object.keys(harian).forEach(k => {
    const d = harian[k];
    if (!perSiswa[d.nisn]) {
      perSiswa[d.nisn] = { nisn: d.nisn, nama: d.nama, kelas: d.kelas, alpa: 0, cabut: 0 };
    }
    if (d.status === "A") perSiswa[d.nisn].alpa++;
    if (d.status === "C") perSiswa[d.nisn].cabut++;
  });

  return perSiswa;
}

/** Buat baris kasus untuk siswa yang melewati ambang (tanpa duplikat). */
function buatKasusOtomatisDariHitung(perSiswa, info) {
  const kandidat = [];
  Object.keys(perSiswa).forEach(nisn => {
    const s = perSiswa[nisn];
    if (s.alpa >= AMBANG_KASUS_OTOMATIS || s.cabut >= AMBANG_KASUS_OTOMATIS) kandidat.push(s);
  });
  if (!kandidat.length) return { dibuat: 0, kandidat: 0, data: [] };

  const sh = ensureKasusSheet();
  const all = sh.getDataRange().getValues();
  const sudah = {};

  // Dedeup per semester: hitungan Alpha/Cabut dihitung per semester,
  // jadi kasus semester lalu (meski masih Open) tidak boleh memblokir
  // kasus baru semester berjalan.
  for (let i = 1; i < all.length; i++) {
    const r = all[i];
    const nisn = str(r[2]);
    if (!nisn) continue;
    const created = dateKey(r[10]);
    if (created && created >= info.start && created <= info.end) {
      sudah[nisnKey(nisn) + "|" + str(r[5]).toLowerCase()] = true;
    }
  }

  const rows = [];
  const dibuat = [];

  kandidat.forEach(s => {
    // siswa bisa dapat dua kasus sekaligus bila melewati ambang keduanya
    const jenisList = [];
    if (s.alpa  >= AMBANG_KASUS_OTOMATIS) jenisList.push("Alpha");
    if (s.cabut >= AMBANG_KASUS_OTOMATIS) jenisList.push("Cabut");

    jenisList.forEach(jenis => {
      const kunci = nisnKey(s.nisn) + "|" + jenis.toLowerCase();
      if (sudah[kunci]) return;
      sudah[kunci] = true;

      const ket = "Otomatis dari absensi: " + s.alpa + "× Alpha, " + s.cabut +
        "× Cabut (" + info.label + " " + info.tahunAjaran + ")";

      rows.push([
        Utilities.getUuid(), dateKey(new Date()), s.nisn, s.nama, s.kelas, jenis, ket, "Open",
        "", "", nowTimestamp(), "wali_kelas", "", "", "", "", "", ""
      ]);
      dibuat.push({ nisn: s.nisn, nama: s.nama, kelas: s.kelas, jenis: jenis, alpa: s.alpa, cabut: s.cabut });
    });
  });

  if (rows.length) appendRows(sh, rows, KASUS_HEADER, [2]);

  return { dibuat: rows.length, kandidat: kandidat.length, data: dibuat };
}

/** Dipanggil setelah simpan absensi — hanya bila ada A atau C. */
function autoKasusSetelahAbsensi(kelas, tanggal, statuses) {
  let adaAC = false;
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === "A" || statuses[i] === "C") { adaAC = true; break; }
  }
  if (!adaAC) return 0;

  const info = semesterRange("", "", tanggal);
  const perSiswa = hitungKarakterAbsensi(info.start, info.end, kelas);
  return buatKasusOtomatisDariHitung(perSiswa, info).dibuat;
}

/**
 * Sinkronkan kasus dari data absensi.
 * role wali_kelas → kelas wali saja. BK/Kepsek boleh pilih satu kelas
 * (kalau kosong = semua kelas, bisa lambat).
 */
function sinkronKasusDariAbsensi(role, kelasWali, kelas, tanggalRef) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const level = normalizeKasusLevel(role) || str(role).toLowerCase();
    let targetKelas = "";

    if (level === "wali_kelas") {
      targetKelas = str(kelasWali);
      if (!targetKelas) return { success: false, error: "Kelas wali tidak diketahui" };
    } else {
      targetKelas = str(kelas);
    }

    const info = semesterRange("", "", tanggalRef);
    const perSiswa = hitungKarakterAbsensi(info.start, info.end, targetKelas);
    const hasil = buatKasusOtomatisDariHitung(perSiswa, info);

    return {
      success:       true,
      dibuat:        hasil.dibuat,
      kandidat:      hasil.kandidat,
      semester:      info.label,
      tahunAjaran:   info.tahunAjaran,
      rangeStart:    info.start,
      rangeEnd:      info.end,
      data:          hasil.data
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function simpanKasusPembinaan(data, role, kelasWali) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const d = data || {};
    const tanggal = dateKey(d.tanggal) || dateKey(new Date());
    const nisn    = str(d.nisn);
    const nama    = str(d.nama_siswa || d.nama);
    const kelas   = str(d.kelas);
    const jenis   = str(d.jenis) || "Alpha";
    const ket     = str(d.keterangan);

    if (!nisn || !kelas) {
      return { success: false, error: "NISN dan kelas wajib diisi" };
    }

    const level = normalizeKasusLevel(role) || "wali_kelas";
    const wali  = str(kelasWali);

    if (level === "wali_kelas") {
      // fail-closed: wali wajib punya kelas wali
      if (!wali) return { success: false, error: "Kelas wali tidak diketahui" };
      if (kelas !== wali) {
        return { success: false, error: "Anda hanya dapat menambah kasus untuk kelas wali Anda" };
      }
    }

    const sh = ensureKasusSheet();
    const id = Utilities.getUuid();
    const row = [
      id, tanggal, nisn, nama, kelas, jenis, ket, "Open",
      "", "", nowTimestamp(), level, "", "", "", "", "", ""
    ];

    appendRows(sh, [row], KASUS_HEADER, [2]);
    return { success: true, id: id };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function cariBarisKasus(sh, id) {
  const all = sh.getDataRange().getValues();
  for (let i = 1; i < all.length; i++) {
    if (str(all[i][0]) === id) return i + 1;
  }
  return -1;
}

function catatTindakanKasus(id, level, tindakan, catatan) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const kasusId = str(id);
    if (!kasusId) return { success: false, error: "ID kasus wajib diisi" };

    const lvl = normalizeKasusLevel(level);
    if (!lvl) return { success: false, error: "Level tidak valid" };

    const sh = ensureKasusSheet();
    const row = cariBarisKasus(sh, kasusId);
    if (row < 1) return { success: false, error: "Kasus tidak ditemukan" };

    const isi = str(tindakan);
    const cat = str(catatan);

    if (lvl === "wali_kelas") {
      sh.getRange(row, 13).setValue(isi);
      sh.getRange(row, 17).setValue(cat);
    } else if (lvl === "bk") {
      sh.getRange(row, 14).setValue(isi);
      sh.getRange(row, 18).setValue(cat);
    } else {
      sh.getRange(row, 15).setValue(cat ? isi + " — " + cat : isi);
    }

    return { success: true };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function escalateKasus(id, dariLevel, keLevel, catatan) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const kasusId = str(id);
    if (!kasusId) return { success: false, error: "ID kasus wajib diisi" };

    const dari = normalizeKasusLevel(dariLevel);
    const ke   = normalizeKasusLevel(keLevel);
    const valid = (dari === "wali_kelas" && ke === "bk") || (dari === "bk" && ke === "kepsek");
    if (!valid) {
      return { success: false, error: "Eskalasi hanya boleh: wali_kelas → bk → kepsek" };
    }

    const sh = ensureKasusSheet();
    const row = cariBarisKasus(sh, kasusId);
    if (row < 1) return { success: false, error: "Kasus tidak ditemukan" };

    // ── Validasi status sebelum menulis ──
    const nowLevel  = normalizeKasusLevel(sh.getRange(row, 12).getValue()) || "wali_kelas";
    const nowStatus = str(sh.getRange(row, 8).getValue()) || "Open";

    if (nowStatus !== "Open") {
      return { success: false, error: "Kasus sudah ditutup dan tidak bisa diubah" };
    }
    if (nowLevel !== dari) {
      return { success: false, error: "Level kasus saat ini \"" + nowLevel + "\", bukan \"" + dari + "\"" };
    }

    sh.getRange(row, 12).setValue(ke);
    sh.getRange(row, 16).setValue(ke);

    const cat = str(catatan);
    if (cat) {
      // Jangan menimpa catatan sebelumnya — tambahkan sebagai baris baru.
      const col = dari === "wali_kelas" ? 17 : 18;
      const prev = str(sh.getRange(row, col).getValue());
      sh.getRange(row, col).setValue(prev ? prev + "\n" + cat : cat);
    }

    return { success: true };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function tutupKasusPembinaan(id, alasan, role) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const kasusId = str(id);
    if (!kasusId) return { success: false, error: "ID kasus wajib diisi" };

    const sh = ensureKasusSheet();
    const row = cariBarisKasus(sh, kasusId);
    if (row < 1) return { success: false, error: "Kasus tidak ditemukan" };

    // Kasus yang sudah ditutup tidak ditimpa lagi (alasan/tanggal ditutup
    // milik penutup pertama tetap terjaga).
    if (str(sh.getRange(row, 8).getValue()) === "Ditutup") {
      return { success: false, error: "Kasus sudah ditutup sebelumnya" };
    }

    sh.getRange(row, 8).setValue("Ditutup");
    sh.getRange(row, 9).setValue(str(alasan));
    sh.getRange(row, 10).setValue(nowTimestamp());

    return { success: true, closedBy: normalizeKasusLevel(role) || str(role) };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  DATA GURU — CRUD + IMPORT
// ============================================================

function getGuruData() {
  try {
    const rows = getSheet(SHEET_GURU).getDataRange().getValues();
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const nip = str(r[0]);
      const nama = str(r[1]);
      if (!nip && !nama) continue;
      data.push({
        rowIndex:    i + 1,
        nip:         nip,
        nama:        nama,
        username:    str(r[2]),
        role:        normalizeRole(r[4]),
        mapel:       str(r[5]),
        kelas_wali:  str(r[6]),
        hasPassword: Boolean(str(r[3]))
      });
    }
    return { success: true, data: data };
  } catch (err) {
    return fail(err);
  }
}

function simpanGuru(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const d = data || {};
    const nip         = str(d.nip);
    const nama        = str(d.nama || d.nama_guru);
    const username    = str(d.username).toLowerCase();
    const password    = str(d.password);
    const role        = normalizeRole(d.role || "guru");
    const mapel       = str(d.mapel);
    const kelasWali   = str(d.kelas_wali);
    const originalNip = str(d.originalNip);

    if (!nip)  return { success: false, error: "NIP wajib diisi" };
    if (!nama) return { success: false, error: "Nama guru wajib diisi" };
    if (ROLE_VALID.indexOf(role) === -1) {
      return { success: false, error: "Role tidak valid: " + role };
    }
    if (role === "wali" && !kelasWali) {
      return { success: false, error: "Wali kelas wajib memilih kelas" };
    }

    const sh = getSheet(SHEET_GURU);
    ensureHeader(sh, HEADERS[SHEET_GURU]);
    const values = sh.getDataRange().getValues();

    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (originalNip && str(values[i][0]) === originalNip) { targetRow = i; break; }
    }

    if (originalNip && targetRow === -1) {
      return { success: false, error: "Guru dengan NIP " + originalNip + " tidak ditemukan" };
    }

    const isUpdate = targetRow !== -1;

    for (let i = 1; i < values.length; i++) {
      if (i === targetRow) continue;
      if (str(values[i][0]) === nip) {
        return { success: false, error: "NIP " + nip + " sudah terdaftar" };
      }
    }

    const uname = username || nip;
    for (let i = 1; i < values.length; i++) {
      if (i === targetRow) continue;
      if (str(values[i][2]).toLowerCase() === uname) {
        return { success: false, error: "Username " + uname + " sudah dipakai guru lain" };
      }
    }

    let finalPassword;
    if (isUpdate) {
      finalPassword = str(values[targetRow][3]);
      if (password) finalPassword = password;
    } else {
      finalPassword = password || DEFAULT_PASSWORD;
    }

    const row = [nip, nama, uname, finalPassword, role, mapel, kelasWali];

    if (isUpdate) {
      sh.getRange(targetRow + 1, 1, 1, row.length).setValues([row]);
    } else {
      appendRows(sh, [row], HEADERS[SHEET_GURU]);
    }

    bumpCache();

    return {
      success: true,
      mode: isUpdate ? "update" : "insert",
      nip: nip,
      usedDefaultPassword: !isUpdate && !password,
      defaultPassword: !isUpdate && !password ? DEFAULT_PASSWORD : ""
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function hapusGuru(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const nip = str(data && data.nip);
    if (!nip) return { success: false, error: "NIP wajib diisi" };

    const sh = getSheet(SHEET_GURU);
    const values = sh.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (str(values[i][0]) === nip) {
        sh.deleteRow(i + 1);
        bumpCache();
        return { success: true, deleted: nip };
      }
    }
    return { success: false, error: "Guru dengan NIP " + nip + " tidak ditemukan" };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function importGuru(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const rows    = (data && data.rows) || [];
    const replace = str(data && data.mode) === "replace";

    if (!rows.length) return { success: false, error: "Tidak ada baris untuk diimport" };
    if (rows.length > 1000) return { success: false, error: "Maksimal 1000 baris per import" };

    const sh = getSheet(SHEET_GURU);
    ensureHeader(sh, HEADERS[SHEET_GURU]);
    const existing = sh.getDataRange().getValues();

    // Peta NIP → data lama + pemilik username
    const map = {};
    const pemilikUsername = {};

    if (!replace) {
      for (let i = 1; i < existing.length; i++) {
        const nip = str(existing[i][0]);
        if (!nip) continue;
        map[nip] = {
          nip: nip,
          nama: str(existing[i][1]),
          username: str(existing[i][2]),
          password: str(existing[i][3]),
          role: normalizeRole(existing[i][4]),
          mapel: str(existing[i][5]),
          kelas_wali: str(existing[i][6])
        };
        const u = str(existing[i][2]).toLowerCase();
        if (u) pemilikUsername[u] = nip;
      }
    }

    const errors = [];
    let added = 0, updated = 0, skipped = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx] || {};
      const nip      = str(r.nip);
      const nama     = str(r.nama || r.nama_guru);
      const username = str(r.username || nip).toLowerCase();
      const password = str(r.password);
      const role     = normalizeRole(r.role || "guru");
      const mapel    = str(r.mapel);
      const kelasWali = str(r.kelas_wali || r.kelas);

      if (!nip || !nama) {
        skipped++;
        if (errors.length < 25) errors.push("Baris " + (idx + 2) + ": NIP/nama kosong");
        continue;
      }
      if (ROLE_VALID.indexOf(role) === -1) {
        skipped++;
        if (errors.length < 25) {
          errors.push("Baris " + (idx + 2) + ": role \"" + role + "\" tidak valid (admin/kepsek/piket/guru/wali)");
        }
        continue;
      }
      if (role === "wali" && !kelasWali && !(map[nip] && map[nip].kelas_wali)) {
        skipped++;
        if (errors.length < 25) errors.push("Baris " + (idx + 2) + ": wali kelas wajib punya kelas_wali");
        continue;
      }
      if (!username) {
        skipped++;
        if (errors.length < 25) errors.push("Baris " + (idx + 2) + ": username kosong");
        continue;
      }
      if (pemilikUsername[username] && pemilikUsername[username] !== nip) {
        skipped++;
        if (errors.length < 25) {
          errors.push("Baris " + (idx + 2) + ": username \"" + username + "\" sudah dipakai NIP " + pemilikUsername[username]);
        }
        continue;
      }

      const lama = map[nip];
      pemilikUsername[username] = nip;

      // kelas_wali dipakai role wali & admin; kalau baris import tidak
      // menyebutkannya, pertahankan nilai lama (jangan dikosongkan).
      const perluKelasWali = role === "wali" || role === "admin";
      const kelasWaliAkhir = perluKelasWali ? (kelasWali || (lama ? lama.kelas_wali : "")) : "";

      if (lama) updated++; else added++;
      map[nip] = {
        nip: nip,
        nama: nama,
        username: username,
        password: password || (lama ? lama.password : DEFAULT_PASSWORD),
        role: role,
        mapel: mapel,
        kelas_wali: kelasWaliAkhir
      };
    }

    const finalRows = Object.keys(map).map(k => {
      const g = map[k];
      return [g.nip, g.nama, g.username, g.password, g.role, g.mapel, g.kelas_wali];
    });

    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, 7).clearContent();
    if (finalRows.length) sh.getRange(2, 1, finalRows.length, 7).setValues(finalRows);

    bumpCache();

    return {
      success: true,
      added: added,
      updated: updated,
      skipped: skipped,
      total: finalRows.length,
      errors: errors
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  DATA SISWA — CRUD + IMPORT
// ============================================================

function getSiswaData(kelas) {
  try {
    const filter = str(kelas);
    const rows = getSheet(SHEET_SISWA).getDataRange().getValues();
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const nisn = str(r[0]);
      if (!nisn) continue;
      const kls = str(r[2]);
      if (filter && kls !== filter) continue;
      data.push({
        rowIndex:   i + 1,
        nisn:       nisn,
        nama:       str(r[1]),
        kelas:      kls,
        jk:         str(r[3]),
        no_hp_ortu: str(r[4])
      });
    }

    return { success: true, data: data };
  } catch (err) {
    return fail(err);
  }
}

function simpanSiswa(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const d = data || {};
    const nisn         = str(d.nisn);
    const nama         = str(d.nama || d.nama_siswa);
    const kelas        = str(d.kelas);
    const jk           = str(d.jk).toUpperCase();
    const noHpOrtu     = str(d.no_hp_ortu || d.no_hp || d.no_wa);
    const originalNisn = str(d.originalNisn);

    if (!nisn)  return { success: false, error: "NISN wajib diisi" };
    if (!nama)  return { success: false, error: "Nama siswa wajib diisi" };
    if (!kelas) return { success: false, error: "Kelas wajib dipilih" };
    if (jk && jk !== "L" && jk !== "P") {
      return { success: false, error: "Jenis kelamin harus L atau P" };
    }

    const sh = getSheet(SHEET_SISWA);
    ensureHeader(sh, HEADERS[SHEET_SISWA]);
    const values = sh.getDataRange().getValues();

    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (originalNisn && str(values[i][0]) === originalNisn) { targetRow = i; break; }
    }

    if (originalNisn && targetRow === -1) {
      return { success: false, error: "Siswa dengan NISN " + originalNisn + " tidak ditemukan" };
    }

    const isUpdate = targetRow !== -1;

    for (let i = 1; i < values.length; i++) {
      if (i === targetRow) continue;
      if (str(values[i][0]) === nisn) {
        return { success: false, error: "NISN " + nisn + " sudah terdaftar" };
      }
    }

    const row = [nisn, nama, kelas, jk, noHpOrtu];

    if (isUpdate) {
      sh.getRange(targetRow + 1, 1, 1, 1).setNumberFormat("@");
      sh.getRange(targetRow + 1, 5, 1, 1).setNumberFormat("@");
      sh.getRange(targetRow + 1, 1, 1, row.length).setValues([row]);
    } else {
      appendRows(sh, [row], HEADERS[SHEET_SISWA], [0, 4]);
    }

    tambahKelasBaru([kelas]);
    bumpCache();

    return { success: true, mode: isUpdate ? "update" : "insert", nisn: nisn };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

function hapusSiswa(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const nisn = str(data && data.nisn);
    if (!nisn) return { success: false, error: "NISN wajib diisi" };

    const sh = getSheet(SHEET_SISWA);
    const values = sh.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (str(values[i][0]) === nisn) {
        sh.deleteRow(i + 1);
        bumpCache();
        return { success: true, deleted: nisn };
      }
    }
    return { success: false, error: "Siswa dengan NISN " + nisn + " tidak ditemukan" };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

/** Tambahkan banyak kelas sekaligus (bukan satu per satu). */
function tambahKelasBaru(daftarKelas) {
  const sh = getSheet(SHEET_KELAS);
  ensureHeader(sh, HEADERS[SHEET_KELAS]);

  const existing = {};
  readKelasList().forEach(k => { existing[k] = true; });

  const rows = [];
  const added = [];

  (daftarKelas || []).forEach(k => {
    const key = str(k);
    if (!key || existing[key]) return;
    existing[key] = true;
    added.push(key);
    rows.push([key, jurusanOf(key)]);
  });

  if (rows.length) appendRows(sh, rows, HEADERS[SHEET_KELAS]);
  return added;
}

function importSiswa(data) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const rows    = (data && data.rows) || [];
    const replace = str(data && data.mode) === "replace";

    if (!rows.length) return { success: false, error: "Tidak ada baris untuk diimport" };
    if (rows.length > 2000) return { success: false, error: "Maksimal 2000 baris per import" };

    const sh = getSheet(SHEET_SISWA);
    ensureHeader(sh, HEADERS[SHEET_SISWA]);
    const existing = sh.getDataRange().getValues();

    const map = {};
    if (!replace) {
      for (let i = 1; i < existing.length; i++) {
        const nisn = str(existing[i][0]);
        if (!nisn) continue;
        map[nisn] = {
          nisn: nisn,
          nama: str(existing[i][1]),
          kelas: str(existing[i][2]),
          jk: str(existing[i][3]),
          no_hp_ortu: str(existing[i][4])
        };
      }
    }

    const errors = [];
    const kelasBaru = {};
    let added = 0, updated = 0, skipped = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx] || {};
      const nisn  = str(r.nisn);
      const nama  = str(r.nama || r.nama_siswa);
      const kelas = str(r.kelas);
      const jk    = str(r.jk).toUpperCase();
      const noHp  = str(r.no_hp_ortu || r.no_hp || r.no_wa);

      if (!nisn || !nama || !kelas) {
        skipped++;
        if (errors.length < 25) errors.push("Baris " + (idx + 2) + ": NISN/nama/kelas kosong");
        continue;
      }
      if (jk && jk !== "L" && jk !== "P") {
        skipped++;
        if (errors.length < 25) {
          errors.push("Baris " + (idx + 2) + ": jenis kelamin harus L/P (diisi \"" + jk + "\")");
        }
        continue;
      }

      const lama = map[nisn];
      if (lama) {
        // Jangan hitung dobel bila NISN sama muncul 2x di file.
        if (!lama._dariFile) updated++;
      } else {
        added++;
      }

      map[nisn] = {
        nisn: nisn,
        nama: nama,
        kelas: kelas,
        jk: jk,
        no_hp_ortu: noHp || (lama ? lama.no_hp_ortu : ""),
        _dariFile: true
      };
      kelasBaru[kelas] = true;
    }

    const finalRows = Object.keys(map).map(k => {
      const s = map[k];
      return [s.nisn, s.nama, s.kelas, s.jk, s.no_hp_ortu || ""];
    });

    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), 5)).clearContent();
    if (finalRows.length) {
      sh.getRange(2, 1, finalRows.length, 1).setNumberFormat("@");
      sh.getRange(2, 5, finalRows.length, 1).setNumberFormat("@");
      sh.getRange(2, 1, finalRows.length, 5).setValues(finalRows);
    }

    const newKelas = tambahKelasBaru(Object.keys(kelasBaru));
    bumpCache();

    return {
      success: true,
      added: added,
      updated: updated,
      skipped: skipped,
      total: finalRows.length,
      newKelas: newKelas,
      errors: errors
    };

  } catch (err) {
    return fail(err);
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* abaikan */ } }
  }
}

// ============================================================
//  REKAP BULANAN CEPAT (1 request untuk 1 bulan penuh)
// ============================================================

function getRekapBulanan(kelas, bulan) {
  try {
    const filterKelas = str(kelas);
    if (!filterKelas) return { success: false, error: "Kelas wajib diisi" };

    const ym = monthKey(bulan) || dateKey(new Date()).slice(0, 7);
    const cacheKey = "rekapBln:" + absCacheVersion() + ":" + cacheVersion() + ":" + filterKelas + ":" + ym;
    const cached = cacheGetJson(cacheKey);
    if (cached) return cached;

    const start = ym + "-01";
    const end = monthEndKey(ym);

    const master = readSiswaMasterCached();
    const siswaMap = {};
    master.forEach(s => {
      if (s.kelas !== filterKelas) return;
      const k = nisnKey(s.nisn);
      if (!k) return;
      siswaMap[k] = {
        nisn: s.nisn,
        nama: s.nama,
        jk: s.jk || "",
        no_hp_ortu: s.no_hp_ortu || "",
        hari: {},
        totals: { H: 0, S: 0, I: 0, A: 0, C: 0 }
      };
    });

    const dateSet = {};
    const absenDateSet = {};

    streamAbsensiRows(start, end, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const tgl = dateKey(r[ABS.TGL]);
        if (!tgl || tgl < start || tgl > end) continue;
        if (str(r[ABS.KELAS]) !== filterKelas) continue;

        const nisnRaw = str(r[ABS.NISN]);
        const nk = nisnKey(nisnRaw);
        if (!nk) continue;

        dateSet[tgl] = true;
        const st = normalizeStatus(r[ABS.STATUS]);
        if (st !== "H") absenDateSet[tgl] = true;

        if (!siswaMap[nk]) {
          siswaMap[nk] = {
            nisn: nisnRaw,
            nama: str(r[ABS.NAMA]) || "Siswa",
            jk: "",
            no_hp_ortu: "",
            hari: {},
            totals: { H: 0, S: 0, I: 0, A: 0, C: 0 }
          };
        }
        const prev = siswaMap[nk].hari[tgl];
        if (!prev || PRIOR[st] > PRIOR[prev]) siswaMap[nk].hari[tgl] = st;
      }
    });

    const dates = Object.keys(dateSet).sort();
    const datesWithAbsen = Object.keys(absenDateSet).sort();

    const siswa = Object.keys(siswaMap).map(k => {
      const s = siswaMap[k];
      const totals = { H: 0, S: 0, I: 0, A: 0, C: 0 };
      dates.forEach(d => {
        const st = s.hari[d];
        if (st && totals[st] !== undefined) totals[st]++;
      });
      s.totals = totals;
      return s;
    }).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

    const res = {
      success: true,
      kelas: filterKelas,
      bulan: ym,
      dates: dates,
      datesWithAbsen: datesWithAbsen,
      siswa: siswa
    };
    cachePutJson(cacheKey, res, 300);
    return res;
  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  MONITORING DETAIL PER SISWA (bulanan + semester + apel + kasus)
// ============================================================

function getMonitoringSiswa(nisn, bulan) {
  try {
    const rawNisn = str(nisn);
    const targetKey = nisnKey(rawNisn);
    if (!targetKey) return { success: false, error: "NISN wajib diisi" };

    const ym = monthKey(bulan) || dateKey(new Date()).slice(0, 7);
    const bStart = ym + "-01";
    const bEnd = monthEndKey(ym);

    const refDate = parseDateKey(bStart) || new Date();
    const semInfo = semesterRange("", "", refDate);
    const scanStart = semInfo.start < bStart ? semInfo.start : bStart;
    const scanEnd = semInfo.end > bEnd ? semInfo.end : bEnd;

    let profil = null;
    const master = readSiswaMasterCached();
    for (let i = 0; i < master.length; i++) {
      if (nisnKey(master[i].nisn) === targetKey) {
        profil = master[i];
        break;
      }
    }

    const hariBulan = {};
    const hariSemester = {};

    streamAbsensiRows(scanStart, scanEnd, values => {
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const tgl = dateKey(r[ABS.TGL]);
        if (!tgl || tgl < scanStart || tgl > scanEnd) continue;
        if (nisnKey(str(r[ABS.NISN])) !== targetKey) continue;

        if (!profil) {
          profil = {
            nisn: str(r[ABS.NISN]),
            nama: str(r[ABS.NAMA]),
            kelas: str(r[ABS.KELAS]),
            jk: "",
            no_hp_ortu: ""
          };
        }

        const st = normalizeStatus(r[ABS.STATUS]);
        const jam = toInt(r[ABS.JAM]);
        const mapel = str(r[ABS.MAPEL]);
        const guru = str(r[ABS.GURU]);

        if (tgl >= semInfo.start && tgl <= semInfo.end) {
          if (!hariSemester[tgl] || PRIOR[st] > PRIOR[hariSemester[tgl]]) {
            hariSemester[tgl] = st;
          }
        }

        if (tgl >= bStart && tgl <= bEnd) {
          if (!hariBulan[tgl]) {
            hariBulan[tgl] = { tanggal: tgl, status: st, jam: {}, detail: [] };
          }
          if (PRIOR[st] > PRIOR[hariBulan[tgl].status]) hariBulan[tgl].status = st;
          if (jam > 0) hariBulan[tgl].jam[jam] = st;
          hariBulan[tgl].detail.push({ jam: jam, mapel: mapel, guru: guru, status: st });
        }
      }
    });

    if (!profil) {
      return { success: false, error: "Data siswa tidak ditemukan" };
    }

    const statBulan = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    const riwayatBulan = Object.keys(hariBulan).sort((a, b) => b.localeCompare(a)).map(tgl => {
      const h = hariBulan[tgl];
      if (statBulan[h.status] !== undefined) statBulan[h.status]++;
      h.detail.sort((a, b) => a.jam - b.jam);
      return h;
    });

    const statSemester = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    Object.keys(hariSemester).forEach(tgl => {
      const st = hariSemester[tgl];
      if (statSemester[st] !== undefined) statSemester[st]++;
    });

    // Apel pagi bulan ini + semester
    const apelBulan = [];
    let totalApelSemester = 0;
    try {
      const shApel = ensureApelSheet();
      const lastApel = shApel.getLastRow();
      if (lastApel >= 2) {
        const vals = shApel.getRange(2, 1, lastApel - 1, APEL_COLS).getValues();
        for (let i = 0; i < vals.length; i++) {
          const r = vals[i];
          if (nisnKey(str(r[APEL.NISN])) !== targetKey) continue;
          const tgl = dateKey(r[APEL.TGL]);
          if (!tgl) continue;
          if (tgl >= semInfo.start && tgl <= semInfo.end) totalApelSemester++;
          if (tgl >= bStart && tgl <= bEnd) {
            apelBulan.push({
              id: str(r[APEL.ID]),
              tanggal: tgl,
              jam_datang: str(r[APEL.JAM]),
              keterangan: str(r[APEL.KET]),
              petugas: str(r[APEL.PETUGAS])
            });
          }
        }
      }
      apelBulan.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    } catch (e) { /* abaikan */ }

    // Kasus pembinaan
    const kasus = [];
    try {
      const shKasus = ensureKasusSheet();
      const allKasus = shKasus.getDataRange().getValues();
      for (let i = 1; i < allKasus.length; i++) {
        const r = allKasus[i];
        if (!str(r[0])) continue;
        if (nisnKey(str(r[2])) !== targetKey) continue;
        kasus.push({
          id: str(r[0]),
          tanggal: dateKey(r[1]) || str(r[1]),
          jenis: str(r[5]),
          keterangan: str(r[6]),
          status: str(r[7]) || "Open",
          level: normalizeKasusLevel(r[11]) || "wali_kelas"
        });
      }
      kasus.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    } catch (e) { /* abaikan */ }

    return {
      success: true,
      bulan: ym,
      semesterLabel: semInfo.label,
      tahunAjaran: semInfo.tahunAjaran,
      siswa: profil,
      statBulan: statBulan,
      statSemester: statSemester,
      riwayatBulan: riwayatBulan,
      apelBulan: apelBulan,
      totalApelSemester: totalApelSemester,
      kasus: kasus
    };
  } catch (err) {
    return fail(err);
  }
}

// ============================================================
//  VERSI & UTILITAS PEMELIHARAAN
// ============================================================

function getVersion() {
  return {
    success: true,
    version: "v9",
    perSiswaPerHari: true,
    fitur: [
      "baca-absensi-per-tanggal",
      "cache-master-data",
      "hapus-batch",
      "validasi-bentrok-jadwal",
      "header-kasus-18-kolom",
      "rekap-guru-per-semester-24-pertemuan",
      "kasus-otomatis-alpha-cabut-3",
      "apel-pagi",
      "apel-bulanan",
      "piket-per-guru",
      "jam-info-harian",
      "nisn-normalisasi",
      "absensi-per-jam",
      "rekap-harian-konsisten",
      "rekap-bulanan-cepat",
      "monitoring-siswa",
      "no-hp-ortu",
      "ews-dini",
      "cabut-antar-jam"
    ]
  };
}

/** Jalankan sekali dari editor untuk membuat/memperbaiki semua sheet. */
function setupSpreadsheet() {
  const ss = getSS();
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    ensureHeader(sh, HEADERS[name]);
  });
  SpreadsheetApp.flush();
  return { success: true, message: "Semua sheet & header siap." };
}

/**
 * MANUAL — pindahkan absensi lebih lama dari N bulan ke spreadsheet arsip,
 * lalu hapus dari sheet utama. Jalankan dari editor Apps Script.
 *
 * Contoh: arsipkanAbsensiLama(12)
 *
 * PENTING: data yang diarsipkan tidak lagi muncul di dashboard/riwayat.
 * Buka spreadsheet arsip untuk melihatnya.
 */
function arsipkanAbsensiLama(bulanSimpan) {
  const bulan = Number(bulanSimpan || 12);
  if (!(bulan > 0)) throw new Error("bulanSimpan harus lebih besar dari 0");

  const now = new Date();
  const batas = dateKey(new Date(now.getFullYear(), now.getMonth() - bulan, 1));

  const sh = getSheet(SHEET_ABSENSI);
  const last = sh.getLastRow();
  if (last < 2) return { moved: 0, batas: batas };

  const dates = sh.getRange(2, ABS.TGL + 1, last - 1, 1).getValues();

  let jumlah = 0;
  for (let i = 0; i < dates.length; i++) {
    const k = dateKey(dates[i][0]);
    if (k && k < batas) jumlah = i + 1;
    else break; // data tersusun kronologis
  }
  if (!jumlah) return { moved: 0, batas: batas };

  const arsip = getArsipSheet();

  // Tulis dulu ke arsip, baru hapus sumber (aman bila gagal di tengah).
  for (let offset = 0; offset < jumlah; offset += CHUNK_ROWS) {
    const n = Math.min(CHUNK_ROWS, jumlah - offset);
    const values = sh.getRange(2 + offset, 1, n, ABS_COLS).getValues();
    const startRow = Math.max(arsip.getLastRow() + 1, 2);
    arsip.getRange(startRow, 1, n, ABS_COLS).setValues(values);
  }
  SpreadsheetApp.flush();

  sh.deleteRows(2, jumlah);

  return { moved: jumlah, batas: batas, arsip: arsip.getParent().getUrl() };
}

function getArsipSheet() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = ARSIP_SPREADSHEET_ID || props.getProperty("ARSIP_SPREADSHEET_ID");

  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create("Arsip Presensi " + dateKey(new Date()));
    props.setProperty("ARSIP_SPREADSHEET_ID", ss.getId());
  }

  let sh = ss.getSheetByName(SHEET_ABSENSI);
  if (!sh) sh = ss.insertSheet(SHEET_ABSENSI);
  ensureHeader(sh, ABS_HEADER);
  return sh;
}

// ============================================================
//  TEST (jalankan dari editor)
// ============================================================

function testLogin() {
  Logger.log(JSON.stringify(doLogin("admin", "admin123")));
}

function testGetConfig() {
  Logger.log(JSON.stringify(getConfig()));
}

function testDashboardAdmin() {
  Logger.log(JSON.stringify(getDashboardAdmin()).slice(0, 2000));
}

function testDashboardPiket() {
  const today = dateKey(new Date());
  Logger.log(JSON.stringify(getDashboardPiket(today, "SEMUA")).slice(0, 2000));
}

function testDashboardKepsek() {
  Logger.log(JSON.stringify(getDashboardKepsek("harian", dateKey(new Date()), "", "SEMUA", "SEMUA")).slice(0, 2000));
}

function testRiwayat() {
  Logger.log(JSON.stringify(getRiwayatAbsensi({ limit: 5 })).slice(0, 2000));
}
