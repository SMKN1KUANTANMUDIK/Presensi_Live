/**
 * whatsapp.js — Integrasi WhatsApp gratis (https://wa.me/) tanpa API berbayar.
 * Membuka aplikasi WhatsApp / WhatsApp Web dengan pesan terisi otomatis.
 */

import { formatTanggal, STATUS_MAP } from './utils.js';

const NAMA_SEKOLAH = 'SMKN 1 Kuantan Mudik';

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

/** Format tampilan nomor WA yang rapi (+62...) atau null */
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

export function pesanAbsenSiswa({ nama, kelas, tanggal, status, jamList, mapel }) {
  const stLabel = STATUS_MAP[status]?.label || status || 'Tidak Hadir';
  const tgl = tanggal ? formatTanggal(tanggal) : 'hari ini';
  const jamInfo = Array.isArray(jamList) && jamList.length ? `Jam ke-${jamList.join(', ')}` : '';
  const detailMapel = [mapel, jamInfo].filter(Boolean).join(' · ');

  return [
    `Assalamu'alaikum Wr. Wb.`,
    `Yth. Bapak/Ibu Orang Tua/Wali dari *${nama}* (${kelas}),`,
    ``,
    `Kami dari ${NAMA_SEKOLAH} menginformasikan bahwa ananda pada ${tgl} tercatat dengan status: *${stLabel}*${detailMapel ? ` (${detailMapel})` : ''}.`,
    ``,
    `Mohon konfirmasi dan perhatian Bapak/Ibu agar kehadiran ananda tetap terpantau.`,
    `Terima kasih.`,
  ].join('\n');
}

export function pesanTerlambatApel({ nama, kelas, tanggal, jamDatang, keterangan }) {
  const tgl = tanggal ? formatTanggal(tanggal) : 'hari ini';
  return [
    `Assalamu'alaikum Wr. Wb.`,
    `Yth. Bapak/Ibu Orang Tua/Wali dari *${nama}* (${kelas}),`,
    ``,
    `Kami dari Tim Piket ${NAMA_SEKOLAH} menginformasikan bahwa ananda tercatat *terlambat apel pagi* pada ${tgl}${jamDatang ? ` pukul ${jamDatang} WIB` : ''}${keterangan ? ` (${keterangan})` : ''}.`,
    ``,
    `Mohon kerja sama Bapak/Ibu untuk mengingatkan ananda agar berangkat lebih awal.`,
    `Terima kasih.`,
  ].join('\n');
}

export function pesanPeringatanDini({ nama, kelas, alpha = 0, cabut = 0, kasusOpen = 0, periode }) {
  const total = Number(alpha) + Number(cabut);
  return [
    `Assalamu'alaikum Wr. Wb.`,
    `Yth. Bapak/Ibu Orang Tua/Wali dari *${nama}* (${kelas}),`,
    ``,
    `Berdasarkan monitoring kehadiran ${NAMA_SEKOLAH}${periode ? ` (${periode})` : ''}, ananda telah tercatat:`,
    `- Alpha: *${alpha}×*`,
    `- Cabut: *${cabut}×*`,
    kasusOpen > 0 ? `- Kasus pembinaan terbuka: *${kasusOpen}*` : null,
    ``,
    total >= 3
      ? `Catatan ini telah mencapai ambang pembinaan (≥ 3×). Kami mengharapkan kerja sama Bapak/Ibu untuk pembinaan bersama pihak sekolah.`
      : `Mohon perhatian dan pendampingan Bapak/Ibu agar ketidakhadiran tidak berlanjut ke tahap pembinaan.`,
    `Terima kasih.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function pesanRekapSiswa({ nama, kelas, periode, stat = {}, terlambat = 0 }) {
  const total = (stat.H || 0) + (stat.S || 0) + (stat.I || 0) + (stat.A || 0) + (stat.C || 0);
  const persen = total ? Math.round(((stat.H || 0) / total) * 100) : 0;
  return [
    `Assalamu'alaikum Wr. Wb.`,
    `Rekap Kehadiran Siswa — ${NAMA_SEKOLAH}`,
    `Nama: *${nama}*`,
    `Kelas: *${kelas}*`,
    periode ? `Periode: ${periode}` : null,
    ``,
    `Kehadiran: *${persen}%* (${stat.H || 0}/${total} hari tercatat)`,
    `Hadir: ${stat.H || 0} | Sakit: ${stat.S || 0} | Izin: ${stat.I || 0} | Alpha: ${stat.A || 0} | Cabut: ${stat.C || 0}`,
    `Terlambat apel: ${terlambat}×`,
    ``,
    `Terima kasih atas perhatian Bapak/Ibu.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
