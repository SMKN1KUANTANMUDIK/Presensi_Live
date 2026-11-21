/** utils.js — helper kecil yang dipakai lintas halaman */

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const STATUS = [
  { key: 'H', label: 'Hadir', short: 'H', tone: 'hadir' },
  { key: 'S', label: 'Sakit', short: 'S', tone: 'sakit' },
  { key: 'I', label: 'Izin', short: 'I', tone: 'izin' },
  { key: 'A', label: 'Alpha', short: 'A', tone: 'alpha' },
  { key: 'C', label: 'Cabut', short: 'C', tone: 'cabut' },
];

export const STATUS_MAP = Object.fromEntries(STATUS.map((s) => [s.key, s]));

/** Kelas Tailwind untuk tiap status (light + dark) */
export const TONE = {
  hadir: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    ring: 'ring-emerald-500/30',
    solid: 'bg-emerald-500 text-white',
    border: 'border-emerald-500',
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-400/15',
  },
  sakit: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-500/10 dark:bg-amber-400/10',
    ring: 'ring-amber-500/30',
    solid: 'bg-amber-500 text-white',
    border: 'border-amber-500',
    badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 dark:bg-amber-400/15',
  },
  izin: {
    dot: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-400',
    soft: 'bg-sky-500/10 dark:bg-sky-400/10',
    ring: 'ring-sky-500/30',
    solid: 'bg-sky-500 text-white',
    border: 'border-sky-500',
    badge: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 dark:bg-sky-400/15',
  },
  alpha: {
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-500/10 dark:bg-rose-400/10',
    ring: 'ring-rose-500/30',
    solid: 'bg-rose-500 text-white',
    border: 'border-rose-500',
    badge: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 dark:bg-rose-400/15',
  },
  cabut: {
    dot: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
    soft: 'bg-violet-500/10 dark:bg-violet-400/10',
    ring: 'ring-violet-500/30',
    solid: 'bg-violet-500 text-white',
    border: 'border-violet-500',
    badge: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 dark:bg-violet-400/15',
  },
};

/* ---------------- tanggal ---------------- */

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthISO() {
  return todayISO().slice(0, 7);
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function parseISO(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatTanggal(value, { withDay = true } = {}) {
  const d = value instanceof Date ? value : parseISO(String(value).slice(0, 10));
  if (!d || Number.isNaN(d.getTime())) return '—';
  const base = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${HARI[d.getDay()]}, ${base}` : base;
}

export function formatBulan(value) {
  const [y, m] = String(value || '').split('-').map(Number);
  if (!y || !m) return '—';
  return `${BULAN[m - 1]} ${y}`;
}

export function formatJam(value) {
  const m = String(value ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : String(value ?? '');
}

/* ---------------- status ---------------- */

/** Status akhir satu siswa dalam sehari — prioritas C > A > S > I > H */
export function statusHari(jamObj) {
  const values = Object.values(jamObj || {});
  if (!values.length) return null;
  if (values.includes('C')) return 'C';
  if (values.includes('A')) return 'A';
  if (values.includes('S')) return 'S';
  if (values.includes('I')) return 'I';
  return 'H';
}

export function hitungStatSiswa(siswaList) {
  const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
  (siswaList || []).forEach((s) => {
    const st = statusHari(s.jam);
    if (st) stat[st] += 1;
  });
  return stat;
}

export function angka(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('id-ID') : '0';
}

/** Ambil inisial dari nama */
export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
}
