import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  LogOut,
  Moon,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../lib/theme';
import { hariEfektifBulan, labelLibur, liburInfo, liburNasionalBulan } from '../lib/libur';
import { cn, formatBulan, formatTanggal, monthISO, STATUS, todayISO, TONE } from '../lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton } from '../components/ui';

const SESI_KEY = 'presensi-ortu-sesi';
const KUNCI_KEY = 'presensi-ortu-kunci';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 1000;
const MAX_FAIL = 5;

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const normText = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function readSesi() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESI_KEY) || 'null');
    if (!raw || !raw.nisn || !raw.exp || raw.exp < Date.now()) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveSesi(data) {
  const payload = { ...data, exp: Date.now() + REMEMBER_MS };
  try {
    localStorage.setItem(SESI_KEY, JSON.stringify(payload));
  } catch {
    /* abaikan */
  }
  return payload;
}

function updateStoredSesi(next) {
  try {
    if (localStorage.getItem(SESI_KEY)) {
      localStorage.setItem(SESI_KEY, JSON.stringify({ ...next, exp: next.exp || Date.now() + REMEMBER_MS }));
    }
  } catch {
    /* abaikan */
  }
}

function clearSesi() {
  try {
    localStorage.removeItem(SESI_KEY);
  } catch {
    /* abaikan */
  }
}

function readLock() {
  try {
    const raw = JSON.parse(localStorage.getItem(KUNCI_KEY) || 'null');
    if (raw && typeof raw.gagal === 'number') return raw;
  } catch {
    /* abaikan */
  }
  return null;
}

function recordFail() {
  const nextCount = (readLock()?.gagal || 0) + 1;
  const payload = nextCount >= MAX_FAIL ? { gagal: 0, until: Date.now() + COOLDOWN_MS } : { gagal: nextCount, until: 0 };
  try {
    localStorage.setItem(KUNCI_KEY, JSON.stringify(payload));
  } catch {
    /* abaikan */
  }
  return payload;
}

function clearLock() {
  try {
    localStorage.removeItem(KUNCI_KEY);
  } catch {
    /* abaikan */
  }
}

function initials(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

export default function PortalOrtu() {
  const { dark, toggle } = useTheme();
  const [sesi, setSesi] = useState(() => readSesi());
  const [tab, setTab] = useState('nisn'); // 'nisn' | 'nama'
  const [inputVal, setInputVal] = useState('');
  const [kelas, setKelas] = useState('');
  const [ingat, setIngat] = useState(true);
  const [kelasList, setKelasList] = useState([]);
  const [pilihan, setPilihan] = useState([]);
  const [selectToken, setSelectToken] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [lockState, setLockState] = useState(() => readLock());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [bulan, setBulan] = useState(() => monthISO());
  const [loading, setLoading] = useState(false);
  const [dataBulan, setDataBulan] = useState({ stat: { H: 0, S: 0, I: 0, A: 0, C: 0 }, riwayat: [], todayStatus: null });
  const [apel, setApel] = useState({ supported: true, list: [], hariIni: null });
  const [kasusOpen, setKasusOpen] = useState(0);

  const locked = Boolean(lockState && lockState.until > nowMs);
  const sisaDetik = locked ? Math.ceil((lockState.until - nowMs) / 1000) : 0;

  useEffect(() => {
    if (!locked) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  useEffect(() => {
    api
      .getKelas()
      .then((res) => setKelasList(res?.data || []))
      .catch(() => {});
  }, []);

  const muatData = useCallback(async () => {
    if (!sesi) return;
    setLoading(true);
    try {
      const today = todayISO();

      const applyUnified = (res) => {
        const stat = res.statBulan || { H: 0, S: 0, I: 0, A: 0, C: 0 };
        const riwayat = (res.riwayatBulan || []).map((r) => {
          const firstDetail = Array.isArray(r.detail) && r.detail[0] ? r.detail[0] : {};
          const jamNums = Object.keys(r.jam || {}).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
          return {
            tanggal: r.tanggal,
            status: r.status,
            mapel: firstDetail.mapel || '',
            jam: jamNums.length ? jamNums.join(', ') : '',
          };
        });
        const todayRow = riwayat.find((r) => r.tanggal === today);
        setDataBulan({ stat, riwayat, todayStatus: todayRow ? todayRow.status : null });

        const apelList = res.apelBulan || [];
        const hariIni = apelList.find((a) => a.tanggal === today) || null;
        setApel({ supported: true, list: apelList, hariIni });
        const openK = (res.kasus || []).filter((k) => k.status === 'Open').length;
        setKasusOpen(openK);
      };

      let activeToken = sesi.parentToken || '';
      if (activeToken) {
        let unified = await api.getPortalOrtu(bulan, activeToken).catch(() => null);
        if (unified?.code === 'UNAUTHORIZED') {
          const refreshed = await api.cariSiswaOrtu(sesi.kelas, 'nisn', sesi.nisn).catch(() => null);
          if (refreshed?.success && refreshed.token) {
            activeToken = refreshed.token;
            const nextSesi = { ...sesi, parentToken: activeToken };
            updateStoredSesi(nextSesi);
            setSesi(nextSesi);
            unified = await api.getPortalOrtu(bulan, activeToken).catch(() => null);
          }
        }
        if (unified?.success) {
          applyUnified(unified);
          return;
        }
        if (unified && !/Action tidak ditemukan/i.test(unified.error || '')) {
          return;
        }
      }

      // Fallback untuk backend v8/v9 yang belum mendukung getPortalOrtu
      const [absRes, piketToday, apelRes, kasusRes] = await Promise.all([
        api.getAbsensiGuru(sesi.kelas, '', bulan).catch(() => null),
        api.getDashboardPiket(today, sesi.kelas).catch(() => null),
        api.getApelPagi('', sesi.kelas, bulan, sesi.nisn).catch(() => null),
        api.getKasusPembinaan({ status: 'Open', kelas: sesi.kelas }).catch(() => null),
      ]);

      const keyTarget = String(sesi.nisn).replace(/^0+/, '');
      const rows = (absRes?.data || []).filter((r) => String(r.nisn).replace(/^0+/, '') === keyTarget);
      const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
      rows.forEach((r) => {
        if (stat[r.status] !== undefined) stat[r.status] += 1;
      });
      const riwayat = [...rows].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      const todayRow = piketToday?.data?.[0]?.siswaList?.find(
        (s) => String(s.nisn).replace(/^0+/, '') === keyTarget
      );
      let todayStatus = null;
      if (todayRow?.jam) {
        const vals = Object.values(todayRow.jam);
        if (vals.includes('C')) todayStatus = 'C';
        else if (vals.includes('A')) todayStatus = 'A';
        else if (vals.includes('S')) todayStatus = 'S';
        else if (vals.includes('I')) todayStatus = 'I';
        else if (vals.length) todayStatus = 'H';
      }

      setDataBulan({ stat, riwayat, todayStatus });

      if (apelRes?.success && apelRes.bulan === bulan) {
        const list = apelRes.data || [];
        const hariIni = list.find((a) => a.tanggal === today) || null;
        setApel({ supported: true, list, hariIni });
      } else {
        setApel({ supported: false, list: [], hariIni: null });
      }

      const openK = (kasusRes?.data || []).filter((k) => String(k.nisn).replace(/^0+/, '') === keyTarget).length;
      setKasusOpen(openK);
    } finally {
      setLoading(false);
    }
  }, [sesi, bulan]);

  useEffect(() => {
    if (sesi) muatData();
  }, [sesi, muatData]);

  const masuk = async (e) => {
    e.preventDefault();
    if (checking || locked) return;
    setError('');
    setPilihan([]);
    setSelectToken('');
    if (!kelas) return setError('Pilih kelas anak terlebih dahulu.');
    if (!inputVal.trim()) return setError(tab === 'nisn' ? 'Masukkan NISN anak.' : 'Masukkan nama anak.');

    setChecking(true);
    try {
      const cariRes = await api.cariSiswaOrtu(kelas, tab, inputVal.trim());
      if (cariRes && !/Action tidak ditemukan/i.test(cariRes.error || '')) {
        if (cariRes.code === 'RATE_LIMITED') {
          setError(cariRes.error || 'Terlalu banyak percobaan gagal. Coba lagi beberapa saat.');
          return;
        }
        if (!cariRes.success) {
          const nextLock = recordFail();
          setLockState(nextLock);
          setNowMs(Date.now());
          setError(cariRes.error || 'Siswa tidak ditemukan di kelas tersebut. Periksa kembali NISN/nama dan kelas.');
          return;
        }
        clearLock();
        setLockState(null);

        const matches = cariRes.matches || [];
        if (matches.length > 1) {
          setSelectToken(cariRes.selectToken || '');
          setPilihan(matches);
          return;
        }
        const m = cariRes.siswa || matches[0];
        const target = {
          nisn: m.nisn,
          nama: m.nama_siswa || m.nama,
          kelas: m.kelas || kelas,
          parentToken: cariRes.token || '',
        };
        setSesi(ingat ? saveSesi(target) : target);
        return;
      }

      // Fallback untuk backend v8/v9
      const res = await api.getSiswa(kelas);
      const list = res?.data || [];
      let matches = [];
      if (tab === 'nisn') {
        const key = onlyDigits(inputVal).replace(/^0+/, '');
        matches = list.filter((s) => onlyDigits(s.nisn).replace(/^0+/, '') === key);
      } else {
        const q = normText(inputVal);
        matches = list.filter((s) => normText(s.nama_siswa || s.nama).includes(q));
      }

      if (!matches.length) {
        const nextLock = recordFail();
        setLockState(nextLock);
        setNowMs(Date.now());
        setError('Siswa tidak ditemukan di kelas tersebut. Periksa kembali NISN/nama dan kelas.');
        return;
      }

      clearLock();
      setLockState(null);

      if (matches.length > 1) {
        setPilihan(matches);
        return;
      }

      const target = {
        nisn: matches[0].nisn,
        nama: matches[0].nama_siswa || matches[0].nama,
        kelas: matches[0].kelas || kelas,
      };
      const nextSesi = ingat ? saveSesi(target) : target;
      setSesi(nextSesi);
    } catch (err) {
      setError(err.message || 'Gagal memverifikasi data siswa.');
    } finally {
      setChecking(false);
    }
  };

  const pilihKandidat = async (s) => {
    setError('');
    if (selectToken) {
      setChecking(true);
      try {
        const res = await api.pilihSiswaOrtu(selectToken, s.nisn);
        if (!res?.success) throw new Error(res?.error || 'Pilihan siswa kedaluwarsa, silakan cari ulang.');
        const m = res.siswa || s;
        const target = {
          nisn: m.nisn,
          nama: m.nama_siswa || m.nama,
          kelas: m.kelas || kelas,
          parentToken: res.token || '',
        };
        setSesi(ingat ? saveSesi(target) : target);
        setPilihan([]);
        setSelectToken('');
      } catch (err) {
        setError(err.message || 'Gagal memilih siswa.');
      } finally {
        setChecking(false);
      }
      return;
    }
    const target = { nisn: s.nisn, nama: s.nama_siswa || s.nama, kelas: s.kelas || kelas };
    setSesi(ingat ? saveSesi(target) : target);
    setPilihan([]);
  };

  const keluar = () => {
    clearSesi();
    setSesi(null);
    setInputVal('');
    setPilihan([]);
  };

  const today = todayISO();
  const liburHariIni = useMemo(() => liburInfo(today), [today]);
  const liburBulanIni = useMemo(() => liburNasionalBulan(bulan), [bulan]);
  const hariEfektif = useMemo(() => hariEfektifBulan(bulan), [bulan]);

  const totalBulan =
    dataBulan.stat.H + dataBulan.stat.S + dataBulan.stat.I + dataBulan.stat.A + dataBulan.stat.C;
  const persenBulan = totalBulan ? Math.round((dataBulan.stat.H / totalBulan) * 100) : 0;
  const acBulan = dataBulan.stat.A + dataBulan.stat.C;

  return (
    <div className="min-h-dvh bg-canvas px-4 py-5 pb-safe">
      <div className="mx-auto max-w-lg space-y-3">
        {/* topbar */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] font-bold text-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Login Guru
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label="Ubah tema"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        {!sesi ? (
          <Card className="animate-rise p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <img src="./logo_sekolah.webp" alt="Logo" className="size-12 rounded-2xl bg-white p-1.5 ring-1 ring-line" />
              <div>
                <h1 className="text-[17px] font-extrabold text-ink">Portal Orang Tua / Wali</h1>
                <p className="text-[12px] font-medium text-muted">Pantau kehadiran & keterlambatan anak</p>
              </div>
            </div>

            <div className="mt-4 flex gap-1 rounded-xl bg-sunken p-1">
              {[
                { key: 'nisn', label: 'NISN Anak' },
                { key: 'nama', label: 'Nama Anak' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setError('');
                    setPilihan([]);
                  }}
                  className={cn(
                    'min-h-9 flex-1 rounded-lg text-[12px] font-extrabold transition',
                    tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            {locked && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                Terlalu banyak percobaan gagal. Coba lagi dalam {sisaDetik} detik.
              </div>
            )}

            <form onSubmit={masuk} className="mt-4 space-y-3">
              <Field label={tab === 'nisn' ? 'NISN Anak' : 'Nama Lengkap / Panggilan Anak'}>
                <Input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  inputMode={tab === 'nisn' ? 'numeric' : 'text'}
                  placeholder={tab === 'nisn' ? 'Contoh: 0098873773' : 'Contoh: Aditya Pratama'}
                />
              </Field>

              <Field label="Kelas Anak">
                <Select value={kelas} onChange={(e) => setKelas(e.target.value)}>
                  <option value="">Pilih kelas</option>
                  {kelasList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>

              <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={ingat}
                  onChange={(e) => setIngat(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Ingat perangkat ini selama 30 hari
              </label>

              <Button type="submit" size="lg" className="w-full" loading={checking} disabled={locked}>
                <Search className="size-4" /> Lihat Kehadiran
              </Button>
            </form>

            {pilihan.length > 1 && (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <p className="text-[12px] font-extrabold text-ink">Pilih salah satu siswa yang cocok:</p>
                {pilihan.map((s) => (
                  <button
                    key={s.nisn}
                    type="button"
                    onClick={() => pilihKandidat(s)}
                    className="flex w-full items-center justify-between rounded-2xl border border-line bg-sunken/40 p-3 text-left transition hover:border-brand hover:bg-brand-soft"
                  >
                    <div>
                      <p className="text-[13px] font-extrabold text-ink">{s.nama_siswa || s.nama}</p>
                      <p className="text-[11px] font-semibold text-muted">NISN {s.nisn}</p>
                    </div>
                    <Badge tone="brand">Pilih</Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <>
            {/* Profil anak */}
            <Card className="animate-rise p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-sm font-extrabold text-brand">
                  {initials(sesi.nama)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-extrabold text-ink">{sesi.nama}</p>
                  <p className="truncate text-[11.5px] font-semibold text-muted">
                    NISN {sesi.nisn} · {sesi.kelas}
                  </p>
                </div>
                <Button variant="outline" size="icon" onClick={muatData} aria-label="Segarkan">
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                </Button>
                <Button variant="ghost" size="icon" onClick={keluar} aria-label="Keluar">
                  <LogOut className="size-4 text-rose-500" />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sunken/50 px-3 py-2.5">
                <div>
                  <p className="text-[10.5px] font-bold uppercase text-muted">Status Hari Ini ({formatTanggal(today, { withDay: false })})</p>
                  <p className="text-[13px] font-extrabold text-ink">
                    {liburHariIni.libur
                      ? labelLibur(today)
                      : dataBulan.todayStatus
                        ? STATUS.find((x) => x.key === dataBulan.todayStatus)?.label
                        : 'Belum diabsen'}
                  </p>
                </div>
                {apel.hariIni && <Badge tone="warning">Terlambat {apel.hariIni.jam_datang}</Badge>}
              </div>
            </Card>

            {/* Peringatan */}
            {(acBulan >= 3 || kasusOpen > 0) && (
              <Card className="border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-700 dark:text-rose-300">
                <div className="flex items-start gap-2.5 text-[12px] font-semibold">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-extrabold">Perhatian Pembinaan</p>
                    <p className="mt-0.5 text-[11.5px]">
                      {acBulan >= 3 ? `Tercatat ${acBulan}× Alpha/Cabut bulan ini. ` : ''}
                      {kasusOpen > 0 ? `Ada ${kasusOpen} kasus pembinaan terbuka di sekolah.` : ''}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Rekap Bulanan */}
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[13.5px] font-extrabold text-ink">Rekap {formatBulan(bulan)}</h2>
                  <p className="text-[11px] font-semibold text-muted">{hariEfektif} hari efektif · {persenBulan}% hadir</p>
                </div>
                <input
                  type="month"
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="h-9 rounded-xl border border-line bg-sunken/50 px-2.5 text-[12px] font-bold text-ink"
                />
              </div>

              {loading ? (
                <Skeleton className="mt-3 h-20 rounded-2xl" />
              ) : (
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {STATUS.map((s) => {
                    const t = TONE[s.tone];
                    return (
                      <div key={s.key} className="rounded-xl bg-sunken/60 py-2 text-center">
                        <span className={cn('text-[10px] font-extrabold uppercase', t.text)}>{s.label}</span>
                        <p className="mt-0.5 text-[14px] font-extrabold tabular-nums text-ink">
                          {dataBulan.stat[s.key] || 0}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Keterlambatan apel pagi */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                  <Clock3 className="size-4 text-amber-500" /> Keterlambatan (Apel Pagi)
                </p>
                {apel.supported ? (
                  <Badge tone={apel.list.length ? 'warning' : 'neutral'}>{apel.list.length}× bulan ini</Badge>
                ) : (
                  <Badge tone="neutral">Belum tersedia</Badge>
                )}
              </div>
              {!apel.supported ? (
                <p className="mt-2 text-[11.5px] font-medium text-muted">
                  Data keterlambatan apel pagi belum aktif di server.
                </p>
              ) : apel.list.length === 0 ? (
                <p className="mt-2 text-[11.5px] font-medium text-muted">Tidak ada catatan terlambat bulan ini.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line/70">
                  {apel.list.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-1.5 text-[11.5px]">
                      <div>
                        <p className="font-bold text-ink">{formatTanggal(a.tanggal)}</p>
                        {a.keterangan && <p className="text-[10.5px] text-muted">{a.keterangan}</p>}
                      </div>
                      <Badge tone="warning">{a.jam_datang}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Riwayat harian */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <CalendarDays className="size-4 text-brand" />
                <h2 className="text-[13px] font-extrabold text-ink">Riwayat Harian</h2>
              </div>
              {loading ? (
                <div className="p-4">
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              ) : dataBulan.riwayat.length === 0 ? (
                <EmptyState icon={School} title="Belum ada data absensi" description="Belum ada catatan kehadiran di bulan ini." className="py-8" />
              ) : (
                <ul className="divide-y divide-line/70">
                  {dataBulan.riwayat.map((r) => {
                    const stObj = STATUS.find((x) => x.key === r.status) || STATUS[0];
                    const t = TONE[stObj.tone];
                    return (
                      <li key={r.tanggal} className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-ink">{formatTanggal(r.tanggal)}</p>
                          <p className="truncate text-[10.5px] font-medium text-muted">
                            {r.mapel || '—'} {r.jam ? `· Jam ${r.jam}` : ''}
                          </p>
                        </div>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold', t.badge)}>
                          {stObj.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {liburBulanIni.length > 0 && (
              <Card className="p-4">
                <p className="mb-1.5 text-[12px] font-extrabold text-ink">Hari Libur Nasional ({formatBulan(bulan)})</p>
                <ul className="space-y-1 text-[11px] font-medium text-muted">
                  {liburBulanIni.map((l) => (
                    <li key={l.tanggal}>
                      <b className="text-ink">{formatTanggal(l.tanggal, { withDay: false })}</b> — {l.nama}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
