import { parseISO } from './utils.js';

export const LIBUR_NASIONAL_2026 = {
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
  '2026-02-16': 'Cuti Bersama Tahun Baru Imlek',
  '2026-02-17': 'Tahun Baru Imlek',
  '2026-03-18': 'Cuti Bersama Hari Suci Nyepi',
  '2026-03-19': 'Hari Suci Nyepi',
  '2026-03-20': 'Cuti Bersama Idul Fitri',
  '2026-03-21': 'Hari Raya Idul Fitri',
  '2026-03-22': 'Hari Raya Idul Fitri',
  '2026-03-23': 'Cuti Bersama Idul Fitri',
  '2026-03-24': 'Cuti Bersama Idul Fitri',
  '2026-04-03': 'Wafat Isa Almasih',
  '2026-04-05': 'Paskah',
  '2026-05-01': 'Hari Buruh',
  '2026-05-14': 'Kenaikan Isa Almasih',
  '2026-05-15': 'Cuti Bersama Kenaikan Isa Almasih',
  '2026-05-27': 'Idul Adha',
  '2026-05-28': 'Cuti Bersama Idul Adha',
  '2026-05-31': 'Hari Waisak',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam',
  '2026-08-17': 'Hari Kemerdekaan',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-24': 'Cuti Bersama Hari Natal',
  '2026-12-25': 'Hari Natal',
};

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const pad2 = (n) => String(n).padStart(2, '0');

function toISO(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function liburInfo(tanggal) {
  const d = tanggal instanceof Date ? tanggal : parseISO(String(tanggal || ''));
  if (!d || Number.isNaN(d.getTime())) return { libur: false, alasan: '', nama: '' };
  const nasional = LIBUR_NASIONAL_2026[toISO(d)];
  if (nasional) return { libur: true, alasan: 'nasional', nama: nasional };
  const day = d.getDay();
  if (day === 6) return { libur: true, alasan: 'sabtu', nama: HARI[day] };
  if (day === 0) return { libur: true, alasan: 'minggu', nama: HARI[day] };
  return { libur: false, alasan: '', nama: '' };
}

export function labelLibur(tanggal) {
  const info = liburInfo(tanggal);
  if (!info.libur) return '';
  return info.alasan === 'nasional' ? info.nama : `Libur ${info.nama}`;
}

export function hariEfektifBulan(bulan) {
  const [y, m] = String(bulan || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return 0;
  const days = new Date(y, m, 0).getDate();
  let count = 0;
  for (let i = 1; i <= days; i += 1) {
    if (!liburInfo(`${y}-${pad2(m)}-${pad2(i)}`).libur) count += 1;
  }
  return count;
}

export function liburNasionalBulan(bulan) {
  const prefix = `${bulan}-`;
  return Object.keys(LIBUR_NASIONAL_2026)
    .filter((t) => t.startsWith(prefix))
    .sort()
    .map((tanggal) => ({ tanggal, nama: LIBUR_NASIONAL_2026[tanggal] }));
}
