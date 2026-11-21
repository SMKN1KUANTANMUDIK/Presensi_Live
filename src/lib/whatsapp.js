/**
 * whatsapp.js — Integrasi WhatsApp gratis (https://wa.me/) tanpa API berbayar.
 * Membuka aplikasi WhatsApp / WhatsApp Web dengan pesan resmi sekolah yang rapi.
 */

import { formatTanggal, STATUS_MAP } from './utils.js';

const NAMA_SEKOLAH = 'SMK Negeri 1 Kuantan Mudik';
const NAMA_SEKOLAH_UPPER = 'SMK NEGERI 1 KUANTAN MUDIK';
const GARIS = '━━━━━━━━━━━━━━━━━━━━━━';

const STATUS_FORMAL = {
  H: 'Hadir',
  S: 'Sakit',
  I: 'Izin',
  A: 'Tanpa Keterangan (Alpha)',
  C: 'Meninggalkan Pelajaran (Cabut)',
};

/**
 * Normalisasi nomor HP Indonesia ke format internasional tanpa '+' (628...).
 * Mengembalikan '' jika nomor kosong atau terlalu pendek.
 */
export function normalizeWaPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 9 ? digits : '';
}

/** Format tampilan nomor WA yang rapi (+62...) atau '' */
export function formatWaDisplay(raw) {
  const norm = normalizeWaPhone(raw);
  return norm ? `+${norm}` : '';
}

/**
 * Buat URL https://wa.me/.
 * Jika phone kosong, tetap mengembalikan https://wa.me/?text=... agar
 * guru/piket bisa memilih kontak orang tua langsung di WhatsApp.
 */
export function buildWaUrl(phone, text) {
  const norm = normalizeWaPhone(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return norm ? `https://wa.me/${norm}${query}` : `https://wa.me/${query}`;
}

/** Buka WhatsApp di tab/aplikasi baru */
export function openWhatsApp(phone, text) {
  const url = buildWaUrl(phone, text);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

function formatJamRange(jamList) {
  if (!Array.isArray(jamList) || !jamList.length) return '';
  const nums = [...new Set(jamList.map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
  if (!nums.length) return '';
  if (nums.length === 1) return `Jam ke-${nums[0]}`;
  const contiguous = nums.every((n, i) => n === nums[0] + i);
  if (contiguous) return `Jam ke-${nums[0]} s.d. ${nums[nums.length - 1]}`;
  return `Jam ke-${nums.join(', ')}`;
}

function portalOrtuLink() {
  try {
    if (typeof window === 'undefined') return '';
    const { protocol, hostname, origin, pathname } = window.location || {};
    if (protocol !== 'https:' || hostname === 'localhost' || hostname === '127.0.0.1') return '';
    const cleanPath = pathname.endsWith('/') ? pathname : pathname.replace(/\/[^/]*$/, '/');
    return `${origin}${cleanPath}#/ortu`;
  } catch {
    return '';
  }
}

function formatKop(judul) {
  return [`*${judul}*`, `*${NAMA_SEKOLAH_UPPER}*`, GARIS];
}

function formatSapaan(nama) {
  return [
    `Assalamu'alaikum Warahmatullahi Wabarakatuh.`,
    ``,
    `Yth. Bapak/Ibu Orang Tua/Wali Murid`,
    `dari Ananda *${nama || 'Siswa'}*`,
    `di Tempat`,
  ];
}

function formatPenutup({ pengirim, detailPengirim, sertakanPortal = true } = {}) {
  const portal = sertakanPortal ? portalOrtuLink() : '';
  return [
    `Demikian informasi ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.`,
    ``,
    `Wassalamu'alaikum Warahmatullahi Wabarakatuh.`,
    ``,
    `Hormat kami,`,
    `*${pengirim || NAMA_SEKOLAH}*`,
    pengirim && pengirim !== NAMA_SEKOLAH ? NAMA_SEKOLAH : null,
    detailPengirim ? `(${detailPengirim})` : null,
    portal ? `` : null,
    portal ? `_Pantau kehadiran ananda secara mandiri melalui Portal Orang Tua:_` : null,
    portal || null,
  ].filter((line) => line !== null);
}

export function pesanAbsenSiswa({
  nama,
  nisn,
  kelas,
  tanggal,
  status,
  jamList,
  jamHadir,
  mapel,
  guru,
  pengirim,
}) {
  const stCode = String(status || '').trim().toUpperCase();
  const stLabel = STATUS_FORMAL[stCode] || STATUS_MAP[stCode]?.label || status || 'Tidak Hadir';
  const tgl = tanggal ? formatTanggal(tanggal) : 'hari ini';
  const jamInfo = formatJamRange(jamList);

  let tindakLanjut =
    'Mohon konfirmasi dan perhatian Bapak/Ibu agar kehadiran ananda dalam kegiatan belajar mengajar dapat terus terpantau dengan baik.';
  if (stCode === 'S') {
    tindakLanjut =
      'Kami mendoakan semoga ananda segera diberikan kesembuhan dan dapat kembali mengikuti kegiatan belajar mengajar seperti biasa. Apabila terdapat surat keterangan dari orang tua atau dokter, mohon berkenan menyampaikannya kepada Wali Kelas.';
  } else if (stCode === 'I') {
    tindakLanjut =
      'Pemberitahuan ini kami sampaikan sebagai konfirmasi kehadiran ananda. Apabila izin tersebut belum disertai keterangan resmi kepada Wali Kelas, mohon berkenan mengonfirmasi kembali.';
  } else if (stCode === 'A') {
    tindakLanjut =
      'Hingga saat ini pihak sekolah belum menerima keterangan resmi atas ketidakhadiran ananda. Mohon konfirmasi serta perhatian Bapak/Ibu agar kehadiran ananda dapat terus terpantau dengan baik.';
  } else if (stCode === 'C') {
    tindakLanjut = jamHadir
      ? `Berdasarkan pemantauan sekolah, ananda sempat hadir pada Jam ke-${jamHadir}, namun tidak berada di kelas pada jam pelajaran berikutnya tanpa keterangan/izin. Mohon perhatian dan kerja sama Bapak/Ibu untuk melakukan pembinaan bersama demi kedisiplinan ananda.`
      : 'Ananda tercatat meninggalkan kelas pada saat kegiatan belajar mengajar berlangsung tanpa izin. Mohon perhatian dan kerja sama Bapak/Ibu untuk melakukan pembinaan bersama demi kedisiplinan ananda.';
  }

  const jabatan = pengirim || (guru ? 'Guru Mata Pelajaran' : 'Tim Monitoring Presensi');

  return [
    ...formatKop('PEMBERITAHUAN KEHADIRAN SISWA'),
    ``,
    ...formatSapaan(nama),
    ``,
    `Dengan hormat,`,
    `Melalui pesan ini kami menyampaikan informasi kehadiran putra/putri Bapak/Ibu pada kegiatan belajar mengajar di ${NAMA_SEKOLAH} dengan rincian sebagai berikut:`,
    ``,
    `• Nama Siswa: *${nama || '-'}*`,
    nisn ? `• NISN: ${nisn}` : null,
    kelas ? `• Kelas: ${kelas}` : null,
    `• Hari, Tanggal: ${tgl}`,
    mapel ? `• Mata Pelajaran: ${mapel}` : null,
    jamInfo ? `• Jam Pelajaran: ${jamInfo}` : null,
    `• Status Kehadiran: *${stLabel}*`,
    ``,
    tindakLanjut,
    ``,
    ...formatPenutup({
      pengirim: jabatan,
      detailPengirim: guru || '',
    }),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function pesanTerlambatApel({ nama, nisn, kelas, tanggal, jamDatang, keterangan, petugas }) {
  const tgl = tanggal ? formatTanggal(tanggal) : 'hari ini';
  const jamWib = jamDatang ? `${String(jamDatang).replace(':', '.')} WIB` : '';

  return [
    ...formatKop('PEMBERITAHUAN KETERLAMBATAN SISWA'),
    ``,
    ...formatSapaan(nama),
    ``,
    `Dengan hormat,`,
    `Melalui pesan ini kami menginformasikan bahwa putra/putri Bapak/Ibu tercatat hadir terlambat pada kegiatan apel pagi di ${NAMA_SEKOLAH} dengan rincian sebagai berikut:`,
    ``,
    `• Nama Siswa: *${nama || '-'}*`,
    nisn ? `• NISN: ${nisn}` : null,
    kelas ? `• Kelas: ${kelas}` : null,
    `• Hari, Tanggal: ${tgl}`,
    jamWib ? `• Waktu Kedatangan: *${jamWib}*` : null,
    keterangan ? `• Keterangan: ${keterangan}` : null,
    ``,
    `Sehubungan dengan hal tersebut, kami mohon kerja sama Bapak/Ibu untuk mengingatkan serta mendampingi ananda agar dapat hadir tepat waktu sebelum kegiatan sekolah dimulai.`,
    ``,
    ...formatPenutup({
      pengirim: 'Tim Piket',
      detailPengirim: petugas ? `Petugas Piket: ${petugas}` : '',
    }),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function pesanPeringatanDini({
  nama,
  nisn,
  kelas,
  alpha = 0,
  cabut = 0,
  kasusOpen = 0,
  periode,
  keterangan,
  pengirim,
}) {
  const a = Number(alpha) || 0;
  const c = Number(cabut) || 0;
  const total = a + c;
  const kritis = total >= 3 || kasusOpen > 0;

  return [
    ...formatKop(kritis ? 'PEMBERITAHUAN PEMBINAAN KEDISIPLINAN' : 'PERINGATAN DINI KEHADIRAN SISWA'),
    ``,
    ...formatSapaan(nama),
    ``,
    `Dengan hormat,`,
    `Berdasarkan hasil pemantauan kehadiran di ${NAMA_SEKOLAH}, kami perlu menyampaikan catatan kedisiplinan putra/putri Bapak/Ibu dengan rincian sebagai berikut:`,
    ``,
    `• Nama Siswa: *${nama || '-'}*`,
    nisn ? `• NISN: ${nisn}` : null,
    kelas ? `• Kelas: ${kelas}` : null,
    periode ? `• Periode Pemantauan: ${periode}` : null,
    `• Tanpa Keterangan (Alpha): *${a} kali*`,
    `• Meninggalkan Pelajaran (Cabut): *${c} kali*`,
    kasusOpen > 0 ? `• Catatan Kasus Pembinaan Aktif: *${kasusOpen} kasus*` : null,
    keterangan ? `• Keterangan: ${keterangan}` : null,
    ``,
    kritis
      ? `Catatan ketidakhadiran tersebut telah mencapai ambang pembinaan sekolah (≥ 3 kali). Kami sangat mengharapkan kerja sama dan komunikasi Bapak/Ibu bersama Wali Kelas serta Guru BK untuk melakukan pembinaan terbaik bagi ananda.`
      : `Kami mohon perhatian dan pendampingan Bapak/Ibu di rumah agar ketidakhadiran ananda dapat segera diperbaiki dan tidak berlanjut ke tahap pembinaan sekolah.`,
    ``,
    ...formatPenutup({
      pengirim: pengirim || 'Wali Kelas / Tim Pembinaan',
    }),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function pesanRekapSiswa({ nama, nisn, kelas, periode, stat = {}, terlambat = 0, pengirim }) {
  const h = Number(stat.H) || 0;
  const s = Number(stat.S) || 0;
  const i = Number(stat.I) || 0;
  const a = Number(stat.A) || 0;
  const c = Number(stat.C) || 0;
  const t = Number(terlambat) || 0;
  const total = h + s + i + a + c;
  const persen = total ? Math.round((h / total) * 100) : 0;

  let evaluasi =
    'Kami mengharapkan kerja sama Bapak/Ibu untuk terus memantau kehadiran dan kedisiplinan ananda di sekolah.';
  if (total > 0 && persen >= 90 && a + c === 0) {
    evaluasi =
      'Kehadiran ananda pada periode ini tercatat sangat baik. Kami mengucapkan terima kasih atas dukungan dan pendampingan Bapak/Ibu.';
  } else if (total > 0 && persen < 75) {
    evaluasi =
      'Persentase kehadiran ananda pada periode ini memerlukan perhatian khusus. Kami mohon kerja sama Bapak/Ibu untuk berkoordinasi dengan Wali Kelas demi kelancaran belajar ananda.';
  }

  return [
    ...formatKop('LAPORAN REKAPITULASI KEHADIRAN SISWA'),
    ``,
    ...formatSapaan(nama),
    ``,
    `Dengan hormat,`,
    `Berikut kami sampaikan laporan rekapitulasi kehadiran putra/putri Bapak/Ibu selama mengikuti kegiatan belajar mengajar di ${NAMA_SEKOLAH}:`,
    ``,
    `• Nama Siswa: *${nama || '-'}*`,
    nisn ? `• NISN: ${nisn}` : null,
    kelas ? `• Kelas: ${kelas}` : null,
    periode ? `• Periode: ${periode}` : null,
    ``,
    `*Ringkasan Kehadiran:*`,
    `• Persentase Hadir: *${persen}%* (${h} dari ${total} hari tercatat)`,
    `• Hadir: ${h} hari`,
    `• Sakit: ${s} hari`,
    `• Izin: ${i} hari`,
    `• Tanpa Keterangan (Alpha): ${a} hari`,
    `• Meninggalkan Pelajaran (Cabut): ${c} hari`,
    `• Keterlambatan Apel Pagi: ${t} kali`,
    ``,
    evaluasi,
    ``,
    ...formatPenutup({
      pengirim: pengirim || 'Wali Kelas / Guru',
    }),
  ]
    .filter((line) => line !== null)
    .join('\n');
}
