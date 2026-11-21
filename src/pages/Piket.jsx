import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Clock,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { labelLibur, liburInfo } from '../lib/libur';
import { pesanAbsenSiswa, pesanTerlambatApel } from '../lib/whatsapp';
import { cn, formatTanggal, hitungStatSiswa, STATUS, TONE, todayISO } from '../lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Sheet, Skeleton } from '../components/ui';
import WaButton from '../components/WaButton';
import StudentMonitorSheet from '../components/StudentMonitorSheet';
import SearchSuggest from '../components/SearchSuggest';

const JAM_COLS = Array.from({ length: 11 }, (_, i) => i + 1);
const DEFAULT_JAM = Array.from({ length: 10 }, (_, i) => i + 1);

function jamSekarang() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isMissingAction(err) {
  return /Action tidak ditemukan/i.test(err?.message || '');
}

function StatPill({ status, value }) {
  const tone = TONE[status.tone];
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-sunken/60 py-1.5">
      <span className={cn('text-[10px] font-extrabold uppercase', tone.text)}>{status.short}</span>
      <span className="text-[13px] font-extrabold tabular-nums text-ink">{value}</span>
    </div>
  );
}

export default function Piket() {
  const toast = useToast();
  const { name } = useAuth();

  const [tanggal, setTanggal] = useState(todayISO());
  const [data, setData] = useState([]);
  const [jamSekolah, setJamSekolah] = useState(DEFAULT_JAM);
  const [loading, setLoading] = useState(true);
  const [kelasFilter, setKelasFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'kosong' | 'perhatian'
  const [piketQuery, setPiketQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailQuery, setDetailQuery] = useState('');
  const [monitorSiswa, setMonitorSiswa] = useState(null);

  // Apel pagi
  const [apelList, setApelList] = useState([]);
  const [apelLoading, setApelLoading] = useState(true);
  const [apelSupported, setApelSupported] = useState(true);
  const [apelOpen, setApelOpen] = useState(false);
  const [apelKelasList, setApelKelasList] = useState([]);
  const [apelKelas, setApelKelas] = useState('');
  const [apelSiswa, setApelSiswa] = useState([]);
  const [apelSiswaLoading, setApelSiswaLoading] = useState(false);
  const [apelQuery, setApelQuery] = useState('');
  const [apelSelected, setApelSelected] = useState([]);
  const [apelJam, setApelJam] = useState('');
  const [apelKet, setApelKet] = useState('');
  const [apelSaving, setApelSaving] = useState(false);
  const [confirmApel, setConfirmApel] = useState(null);
  const [deletingApel, setDeletingApel] = useState(false);

  const load = useCallback(
    async (date = tanggal) => {
      setLoading(true);
      try {
        const res = await api.getDashboardPiket(date, 'SEMUA');
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat data piket');
        setData(res.data || []);
        if (Array.isArray(res.jamTersedia) && res.jamTersedia.length) {
          setJamSekolah(res.jamTersedia);
        }
      } catch (err) {
        setData([]);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [tanggal, toast]
  );

  const loadApel = useCallback(
    async (date = tanggal) => {
      setApelLoading(true);
      try {
        const res = await api.getApelPagi(date, 'SEMUA');
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat data apel pagi');
        setApelList(res.data || []);
        setApelSupported(true);
      } catch (err) {
        setApelList([]);
        if (isMissingAction(err)) setApelSupported(false);
        else toast.error(err.message || 'Gagal memuat data apel pagi');
      } finally {
        setApelLoading(false);
      }
    },
    [tanggal, toast]
  );

  useEffect(() => {
    load(tanggal);
    loadApel(tanggal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  const libur = useMemo(() => liburInfo(tanggal), [tanggal]);
  const sudahApelNisn = useMemo(() => new Set(apelList.map((a) => String(a.nisn))), [apelList]);

  useEffect(() => {
    if (!apelOpen || !apelKelas) return undefined;
    let alive = true;
    setApelSiswaLoading(true);
    setApelSiswa([]);
    setApelSelected([]);
    api
      .getSiswa(apelKelas)
      .then((res) => {
        if (alive) setApelSiswa(res?.data || []);
      })
      .catch((err) => {
        if (alive) {
          setApelSiswa([]);
          toast.error(err.message || 'Gagal memuat daftar siswa');
        }
      })
      .finally(() => {
        if (alive) setApelSiswaLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apelOpen, apelKelas, toast]);

  const filteredApelSiswa = useMemo(() => {
    const q = apelQuery.trim().toLowerCase();
    if (!q) return apelSiswa;
    return apelSiswa.filter(
      (s) => String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').includes(q)
    );
  }, [apelSiswa, apelQuery]);

  const apelSiswaSuggestions = useMemo(
    () =>
      apelSiswa.map((s) => {
        const nisn = String(s.nisn);
        const nama = s.nama_siswa || s.nama || '';
        const done = sudahApelNisn.has(nisn);
        const selected = apelSelected.includes(nisn);
        return {
          value: nama,
          label: nama,
          sub: `NISN ${nisn}${done ? ' · sudah tercatat hari ini' : ''}`,
          badge: done ? 'Tercatat' : 'Pilih',
          badgeTone: done ? 'neutral' : 'brand',
          disabled: done,
          selected,
          keywords: nisn,
          raw: s,
        };
      }),
    [apelSiswa, sudahApelNisn, apelSelected]
  );

  const openApelModal = async () => {
    if (!apelSupported) return;
    setApelOpen(true);
    setApelQuery('');
    setApelSelected([]);
    setApelKet('');
    setApelJam(jamSekarang());
    if (apelKelasList.length) {
      setApelKelas((prev) => (apelKelasList.includes(prev) ? prev : apelKelasList[0]));
    } else {
      try {
        const res = await api.getKelas();
        const list = res?.data || [];
        setApelKelasList(list);
        setApelKelas(list[0] || '');
      } catch (err) {
        toast.error(err.message || 'Gagal memuat daftar kelas');
      }
    }
  };

  const toggleApelSiswa = (nisn) => {
    const k = String(nisn);
    setApelSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const simpanApel = async () => {
    if (apelSaving) return;
    if (!apelSelected.length) return toast.warning('Pilih minimal satu siswa yang terlambat.');
    if (!apelJam) return toast.warning('Isi jam datang siswa.');
    setApelSaving(true);
    try {
      const siswaPayload = apelSiswa
        .filter((s) => apelSelected.includes(String(s.nisn)))
        .map((s) => ({ nisn: s.nisn, nama_siswa: s.nama_siswa || s.nama, kelas: s.kelas || apelKelas }));
      const res = await api.simpanApelPagi(
        {
          tanggal,
          kelas: apelKelas,
          jam_datang: apelJam,
          keterangan: apelKet.trim(),
          petugas: name,
          siswa: siswaPayload,
        },
        name
      );
      if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan data apel pagi');
      if (res.total > 0) {
        toast.success(`${res.total} siswa tercatat apel pagi${res.dilewati ? `, ${res.dilewati} sudah ada` : ''}.`);
      } else {
        toast.info(res.message || 'Semua siswa sudah tercatat.');
      }
      setApelOpen(false);
      loadApel(tanggal);
    } catch (err) {
      if (isMissingAction(err)) {
        setApelSupported(false);
        setApelOpen(false);
      }
      toast.error(err.message || 'Gagal menyimpan data apel pagi');
    } finally {
      setApelSaving(false);
    }
  };

  const hapusApel = async () => {
    if (!confirmApel || deletingApel) return;
    setDeletingApel(true);
    try {
      const res = await api.hapusApelPagi(confirmApel.id);
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus catatan apel');
      setApelList((prev) => prev.filter((x) => x.id !== confirmApel.id));
      setConfirmApel(null);
      toast.success('Catatan apel pagi dihapus.');
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus catatan apel');
    } finally {
      setDeletingApel(false);
    }
  };

  const kelasList = useMemo(
    () => [...new Set(data.map((d) => d.kelas))].sort((a, b) => String(a).localeCompare(String(b))),
    [data]
  );

  // Hitung jam tertinggi yang sudah diisi hari ini secara sekolah agar deteksi jam kosong realistis
  const maxJamAktif = useMemo(() => {
    let mx = 0;
    data.forEach((item) => {
      (item.jamTerisi || []).forEach((j) => {
        if (j > mx) mx = j;
      });
      (item.guruList || []).forEach((g) => {
        (g.jam || []).forEach((j) => {
          if (j > mx) mx = j;
        });
      });
    });
    return Math.min(Math.max(mx, 4), jamSekolah.length ? Math.max(...jamSekolah) : 10);
  }, [data, jamSekolah]);

  const rows = useMemo(() => {
    const list = data
      .map((item) => {
        const stat = hitungStatSiswa(item.siswaList);
        const guruList = item.guruList || [];
        const belum = guruList.length === 0;
        const pelanggaran = stat.A + stat.C + stat.S + stat.I;

        // Jam terisi kelas (fallback dari guruList.jam jika server v8)
        const terisiSet = new Set(item.jamTerisi || []);
        if (!terisiSet.size) {
          guruList.forEach((g) => (g.jam || []).forEach((j) => terisiSet.add(Number(j))));
        }
        const jamPantau = jamSekolah.filter((j) => j <= maxJamAktif);
        const jamKosong = jamPantau.filter((j) => !terisiSet.has(j));

        // Deteksi cabut antar-jam (fallback client-side bila server masih v8)
        let cabutAntarJam = item.cabutAntarJam;
        if (!Array.isArray(cabutAntarJam)) {
          cabutAntarJam = [];
          (item.siswaList || []).forEach((s) => {
            const jKeys = Object.keys(s.jam || {})
              .map(Number)
              .filter((n) => n > 0)
              .sort((a, b) => a - b);
            let firstH = 0;
            const bolos = [];
            let worst = '';
            jKeys.forEach((j) => {
              const st = s.jam[j];
              if (st === 'H' && !firstH) firstH = j;
              if (firstH && j > firstH && (st === 'A' || st === 'C')) {
                bolos.push(j);
                if (st === 'C' || !worst) worst = st;
              }
            });
            if (firstH && bolos.length) {
              cabutAntarJam.push({
                nisn: s.nisn,
                nama: s.nama,
                kelas: item.kelas,
                no_hp_ortu: s.no_hp_ortu || '',
                jamHadir: firstH,
                jamBolos: bolos,
                status: worst,
              });
            }
          });
        }

        return {
          ...item,
          stat,
          guruList,
          belum,
          pelanggaran,
          terisiSet,
          jamPantau,
          jamKosong,
          cabutAntarJam,
        };
      })
      .sort(
        (a, b) =>
          b.cabutAntarJam.length - a.cabutAntarJam.length ||
          b.pelanggaran - a.pelanggaran ||
          b.jamKosong.length - a.jamKosong.length ||
          String(a.kelas).localeCompare(String(b.kelas))
      );

    return list.filter((r) => {
      if (kelasFilter && r.kelas !== kelasFilter) return false;
      if (statusFilter === 'kosong') return r.belum || r.jamKosong.length > 0;
      if (statusFilter === 'perhatian') return r.pelanggaran > 0 || r.cabutAntarJam.length > 0;
      return true;
    });
  }, [data, kelasFilter, statusFilter, jamSekolah, maxJamAktif]);

  const summary = useMemo(() => {
    const s = { hadir: 0, si: 0, alpha: 0, belum: 0, jamKosong: 0 };
    rows.forEach((r) => {
      s.hadir += r.stat.H;
      s.si += r.stat.S + r.stat.I;
      s.alpha += r.stat.A + r.stat.C;
      if (r.belum) s.belum += 1;
      if (!r.belum && r.jamKosong.length > 0) s.jamKosong += 1;
    });
    return s;
  }, [rows]);

  const cabutAlerts = useMemo(
    () => rows.flatMap((r) => r.cabutAntarJam || []),
    [rows]
  );

  const sesiGuru = useMemo(() => {
    const list = [];
    rows.forEach((k) => {
      (k.guruList || []).forEach((g) => {
        const absen = Array.isArray(g.absen) ? g.absen : [];
        list.push({
          key: `${k.kelas}|${g.nama}|${g.mapel}`,
          kelas: k.kelas,
          nama: g.nama,
          mapel: g.mapel,
          jam: Array.isArray(g.jam) ? g.jam : [],
          statistik: g.statistik || { H: 0, S: 0, I: 0, A: 0, C: 0 },
          absen,
          detailTersedia: Array.isArray(g.absen),
          totalAbsen: Array.isArray(g.absen) ? absen.length : null,
        });
      });
    });
    return list.sort(
      (a, b) =>
        (a.jam[0] || 99) - (b.jam[0] || 99) ||
        String(a.kelas).localeCompare(String(b.kelas)) ||
        String(a.nama).localeCompare(String(b.nama))
    );
  }, [rows]);

  const totalGuruAbsen = useMemo(() => sesiGuru.reduce((acc, g) => acc + (g.totalAbsen ?? 0), 0), [sesiGuru]);
  const guruDetailReady = sesiGuru.length > 0 && sesiGuru.every((g) => g.detailTersedia);

  const noHpByNisn = useMemo(() => {
    const m = new Map();
    data.forEach((k) => {
      (k.siswaList || []).forEach((s) => {
        if (s.nisn && s.no_hp_ortu) m.set(String(s.nisn), s.no_hp_ortu);
      });
    });
    return m;
  }, [data]);

  const piketSuggestions = useMemo(() => {
    const out = [];
    data.forEach((item) => {
      const stat = hitungStatSiswa(item.siswaList);
      const belum = !(item.guruList || []).length;
      out.push({
        value: item.kelas,
        label: item.kelas,
        sub: belum
          ? 'Belum ada absensi hari ini'
          : `Hadir ${stat.H} · S/I ${stat.S + stat.I} · A/C ${stat.A + stat.C}`,
        badge: 'Kelas',
        badgeTone: belum ? 'warning' : 'brand',
        group: 'kelas',
        raw: { kind: 'kelas', item },
      });
    });
    data.forEach((item) => {
      (item.siswaList || []).forEach((s) => {
        out.push({
          value: s.nama || '',
          label: s.nama || 'Siswa',
          sub: `${item.kelas} · NISN ${s.nisn || '—'}`,
          badge: 'Siswa',
          badgeTone: 'violet',
          group: 'siswa',
          keywords: `${s.nisn || ''} ${item.kelas}`,
          raw: { kind: 'siswa', item, siswa: s },
        });
      });
    });
    return out;
  }, [data]);

  const detailSiswaFiltered = useMemo(() => {
    const list = detail?.siswaList || [];
    const q = detailQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) => String(s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').toLowerCase().includes(q)
    );
  }, [detail, detailQuery]);

  const detailSiswaSuggestions = useMemo(
    () =>
      (detail?.siswaList || []).map((s) => ({
        value: s.nama || '',
        label: s.nama || 'Siswa',
        sub: `NISN ${s.nisn || '—'}`,
        badge: s.no_hp_ortu ? 'Ada WA' : '',
        badgeTone: 'success',
        keywords: String(s.nisn || ''),
      })),
    [detail]
  );

  return (
    <div className="space-y-3">
      {/* header */}
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-[18px]" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Dashboard Piket</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <p className="text-[11.5px] font-semibold text-muted">{formatTanggal(tanggal)}</p>
                {libur.libur && <Badge tone="violet">Libur</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-10 rounded-xl border border-line bg-sunken/50 pl-9 pr-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                load();
                loadApel();
              }}
              aria-label="Muat ulang"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* summary */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Hadir', value: summary.hadir, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/[0.06] border-emerald-500/20' },
            { label: 'Sakit / Izin', value: summary.si, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/[0.06] border-amber-500/20' },
            { label: 'Alpha / Cabut', value: summary.alpha, cls: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/[0.06] border-rose-500/20' },
            {
              label: summary.jamKosong > 0 ? 'Belum / Kosong' : 'Belum Absen',
              value: summary.belum + summary.jamKosong,
              cls: 'text-violet-600 dark:text-violet-400',
              bg: 'bg-violet-500/[0.06] border-violet-500/20',
            },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-2xl border px-2.5 py-2.5 text-center', s.bg)}>
              <p className={cn('text-xl font-extrabold leading-none tabular-nums', s.cls)}>{s.value}</p>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SearchSuggest
            value={piketQuery}
            onChange={(v) => {
              setPiketQuery(v);
              if (!v) setKelasFilter('');
            }}
            onSelect={(opt) => {
              const raw = opt.raw;
              if (raw?.kind === 'kelas') {
                setKelasFilter(raw.item.kelas);
                setPiketQuery(raw.item.kelas);
              } else if (raw?.kind === 'siswa') {
                setPiketQuery('');
                setDetail(raw.item);
                setDetailQuery(raw.siswa?.nama || '');
              }
            }}
            options={piketSuggestions}
            placeholder="Cari kelas atau siswa…"
            hintTitle="Kelas & siswa hari ini"
            showToggle
          />

          <Select
            value={kelasFilter}
            onChange={(e) => {
              setKelasFilter(e.target.value);
              setPiketQuery('');
            }}
            className="h-10 text-[12.5px]"
          >
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>

          <div className="flex gap-1 rounded-xl bg-sunken p-1">
            {[
              { key: '', label: 'Semua' },
              { key: 'kosong', label: 'Jam kosong' },
              { key: 'perhatian', label: 'Ada absen' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'min-h-8 flex-1 rounded-lg px-2 text-[11.5px] font-extrabold transition',
                  statusFilter === f.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Deteksi cabut antar-jam */}
      {cabutAlerts.length > 0 && (
        <Card className="animate-rise border-rose-500/35 bg-rose-500/[0.04] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-extrabold text-rose-700 dark:text-rose-300">
                Terindikasi Cabut Antar-Jam ({cabutAlerts.length} siswa)
              </h2>
              <p className="text-[11px] font-semibold text-muted">
                Siswa sempat hadir di jam awal lalu tercatat Alpha/Cabut pada jam berikutnya.
              </p>
            </div>
          </div>

          <ul className="mt-3 divide-y divide-rose-500/15">
            {cabutAlerts.map((a) => (
              <li key={`${a.kelas}-${a.nisn}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => setMonitorSiswa({ nisn: a.nisn, nama: a.nama, kelas: a.kelas, no_hp_ortu: a.no_hp_ortu })}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[12.5px] font-extrabold text-ink hover:text-brand">
                    {a.nama} · <span className="text-muted">{a.kelas}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Hadir Jam {a.jamHadir} → {a.status === 'C' ? 'Cabut' : 'Alpha'} Jam {a.jamBolos.join(', ')}
                  </p>
                </button>
                <WaButton
                  size="xs"
                  phone={a.no_hp_ortu}
                  message={pesanAbsenSiswa({
                    nama: a.nama,
                    kelas: a.kelas,
                    tanggal,
                    status: a.status,
                    jamList: a.jamBolos,
                  })}
                  label="WA Ortu"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Apel Pagi */}
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <AlarmClock className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-[14px] font-extrabold tracking-tight text-ink">Apel Pagi — Siswa Terlambat</h2>
              <p className="text-[11px] font-semibold text-muted">
                {apelLoading
                  ? 'Memuat…'
                  : apelSupported
                    ? apelList.length
                      ? `${apelList.length} siswa tercatat`
                      : 'Belum ada siswa terlambat'
                    : 'Belum aktif di server'}
              </p>
            </div>
          </div>

          <Button variant="soft" size="sm" onClick={openApelModal} disabled={loading || !apelSupported}>
            <Plus className="size-4" /> Catat siswa
          </Button>
        </div>

        {!apelLoading && !apelSupported && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Pencatatan apel pagi belum aktif di server. Deploy ulang <span className="font-extrabold">kode.gs</span>{' '}
              lewat Apps Script, lalu muat ulang halaman ini.
            </span>
          </div>
        )}

        {libur.libur && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-violet-700 dark:text-violet-300">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {labelLibur(tanggal)} — apel pagi biasanya tidak diperlukan.
          </p>
        )}

        {apelLoading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : apelList.length === 0 ? (
          apelSupported && (
            <p className="mt-3 rounded-xl bg-sunken/50 px-3 py-3 text-center text-[11.5px] font-semibold text-muted">
              Belum ada siswa terlambat yang dicatat pada tanggal ini.
            </p>
          )
        ) : (
          <ul className="mt-3 divide-y divide-line/70">
            {apelList.map((item) => {
              const noHp = noHpByNisn.get(String(item.nisn)) || '';
              return (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <span className="grid h-8 min-w-[3.25rem] shrink-0 place-items-center rounded-xl bg-amber-500/12 px-1.5 text-[10.5px] font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
                    {item.jam_datang || '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-extrabold text-ink">{item.nama_siswa || 'Siswa'}</p>
                    <p className="truncate text-[10.5px] font-semibold text-muted">
                      {item.kelas}
                      {item.keterangan ? ` · ${item.keterangan}` : ''}
                      {item.petugas ? ` · Petugas: ${item.petugas}` : ''}
                    </p>
                  </div>
                  <WaButton
                    size="xs"
                    phone={noHp}
                    message={pesanTerlambatApel({
                      nama: item.nama_siswa,
                      kelas: item.kelas,
                      tanggal,
                      jamDatang: item.jam_datang,
                      keterangan: item.keterangan,
                    })}
                    label="WA"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmApel(item)}
                    aria-label={`Hapus catatan ${item.nama_siswa || 'siswa'}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Absensi per Guru */}
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
              <BookOpen className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-[14px] font-extrabold tracking-tight text-ink">Absensi per Guru</h2>
              <p className="text-[11px] font-semibold text-muted">
                {loading
                  ? 'Memuat…'
                  : sesiGuru.length
                    ? guruDetailReady
                      ? `${sesiGuru.length} sesi · ${totalGuruAbsen} siswa tidak hadir`
                      : `${sesiGuru.length} sesi · rincian belum tersedia`
                    : 'Belum ada sesi yang diinput guru'}
              </p>
            </div>
          </div>
          <Badge tone="neutral">{formatTanggal(tanggal)}</Badge>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : sesiGuru.length === 0 ? (
          <p className="mt-3 rounded-xl bg-sunken/50 px-3 py-3 text-center text-[11.5px] font-semibold text-muted">
            Belum ada guru yang menginput absensi pada tanggal ini.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line/70">
            {sesiGuru.map((g) => (
              <li key={g.key} className="py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-lg bg-sunken px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-muted">
                    {g.jam.length ? `Jam ${g.jam.join(', ')}` : 'Jam —'}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-ink">
                    {g.mapel || 'Mata pelajaran'}
                  </p>
                  <Badge tone="neutral">{g.kelas}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[10.5px] font-semibold text-muted">
                  {g.nama || 'Guru'} · {g.statistik.H || 0} hadir ·{' '}
                  {g.detailTersedia ? `${g.totalAbsen} tidak hadir` : 'rincian belum tersedia'}
                </p>

                {g.detailTersedia && g.absen.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.absen.map((a) => {
                      const stObj = STATUS.find((x) => x.key === a.status);
                      const tone = TONE[stObj?.tone || 'alpha'];
                      const noHp = a.no_hp_ortu || noHpByNisn.get(String(a.nisn)) || '';
                      return (
                        <div
                          key={`${g.key}-${a.nisn}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10.5px] font-bold',
                            tone.soft,
                            tone.text
                          )}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setMonitorSiswa({ nisn: a.nisn, nama: a.nama, kelas: g.kelas, no_hp_ortu: noHp })
                            }
                            className="max-w-[9rem] truncate hover:underline"
                            title={`${a.nama} — ${stObj?.label || a.status}`}
                          >
                            {a.nama}
                          </button>
                          <b className="tabular-nums">{a.status}</b>
                          <WaButton
                            size="xs"
                            phone={noHp}
                            message={pesanAbsenSiswa({
                              nama: a.nama,
                              kelas: g.kelas,
                              tanggal,
                              status: a.status,
                              jamList: g.jam,
                              mapel: g.mapel,
                            })}
                            label=""
                            className="!min-h-6 !px-1.5"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {g.detailTersedia && g.absen.length === 0 && (
                  <p className="mt-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Semua siswa hadir
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* kelas cards */}
      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-bold text-muted">
          <span>Daftar Kelas ({rows.length})</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-emerald-500/35" /> Sudah diabsen
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-line-strong" /> Belum diabsen
            </span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CircleSlash}
            title="Belum ada data absensi"
            description="Tidak ada kelas yang cocok dengan filter pada tanggal ini."
            action={
              <Button variant="soft" onClick={() => load()}>
                <RefreshCw className="size-4" /> Muat ulang
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => {
            const status = item.belum
              ? 'belum'
              : item.cabutAntarJam.length > 0 || item.pelanggaran > 3
                ? 'warning'
                : item.jamKosong.length > 0
                  ? 'kosong'
                  : 'hadir';
            const toneCls =
              status === 'belum'
                ? 'border-violet-500/30'
                : status === 'warning'
                  ? 'border-amber-500/40'
                  : status === 'kosong'
                    ? 'border-sky-500/35'
                    : 'border-emerald-500/25';

            return (
              <Card key={item.kelas} className={cn('animate-rise overflow-hidden border', toneCls)}>
                <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-xl bg-sunken text-muted">
                      <Users className="size-4" />
                    </span>
                    <div>
                      <p className="text-[14px] font-extrabold leading-tight text-ink">{item.kelas}</p>
                      <p className="text-[10.5px] font-semibold text-muted">{(item.siswaList || []).length} siswa</p>
                    </div>
                  </div>
                  <Badge
                    tone={
                      status === 'belum'
                        ? 'violet'
                        : status === 'warning'
                          ? 'warning'
                          : status === 'kosong'
                            ? 'info'
                            : 'success'
                    }
                  >
                    {status === 'belum'
                      ? 'Belum diabsen'
                      : status === 'warning'
                        ? 'Perlu perhatian'
                        : status === 'kosong'
                          ? `${item.jamKosong.length} jam kosong`
                          : 'Aman'}
                  </Badge>
                </div>

                {/* Progres jam pelajaran */}
                <div className="mt-2.5 flex flex-wrap gap-1 px-4" title="Status input per jam pelajaran">
                  {item.jamPantau.map((j) => {
                    const filled = item.terisiSet.has(j);
                    return (
                      <span
                        key={j}
                        className={cn(
                          'inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-md px-1 text-[9.5px] font-extrabold tabular-nums',
                          filled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-sunken text-muted/70'
                        )}
                      >
                        J{j}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex gap-1 px-4">
                  {STATUS.map((s) => (
                    <StatPill key={s.key} status={s} value={item.stat[s.key]} />
                  ))}
                </div>

                {item.guruList.length > 0 && (
                  <div className="mt-3 space-y-1 px-4">
                    {item.guruList.slice(0, 3).map((g, i) => {
                      const nAbsen = Array.isArray(g.absen) ? g.absen.length : null;
                      return (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-sunken/50 px-2.5 py-1.5">
                          <Clock className="size-3 shrink-0 text-muted" />
                          <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                            {g.mapel || g.nama || '—'}
                            <span className="font-semibold text-muted">
                              {g.nama && g.mapel ? ` · ${g.nama}` : ''}
                              {Array.isArray(g.jam) && g.jam.length ? ` · J${g.jam.join(',')}` : ''}
                            </span>
                          </p>
                          <span
                            className={cn(
                              'shrink-0 text-[10px] font-extrabold',
                              nAbsen === null
                                ? 'text-muted'
                                : nAbsen > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {nAbsen === null ? `${g.totalSiswa || 0} siswa` : `${nAbsen} absen`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDetailQuery('');
                    setDetail(item);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1 border-t border-line/70 py-2.5 text-[12px] font-extrabold text-brand transition hover:bg-brand-soft/50"
                >
                  Detail siswa <ChevronRight className="size-3.5" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* detail sheet */}
      <Sheet
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setDetailQuery('');
        }}
        title={detail ? `Detail — ${detail.kelas}` : ''}
        size="xl"
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{formatTanggal(tanggal)}</Badge>
                <Badge tone="success">
                  <CircleCheck className="size-3" /> {hitungStatSiswa(detail.siswaList).H} hadir
                </Badge>
              </div>
              <SearchSuggest
                value={detailQuery}
                onChange={setDetailQuery}
                options={detailSiswaSuggestions}
                placeholder="Cari nama atau NISN siswa…"
                hintTitle={`Siswa ${detail.kelas}`}
                size="sm"
                className="w-full sm:w-64"
              />
            </div>

            <p className="text-[11px] font-semibold text-muted sm:hidden">
              ← Geser tabel ke kanan untuk melihat Jam 1–11 &amp; tombol WA →
            </p>
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[680px] border-collapse">
                <thead className="bg-sunken/60">
                  <tr>
                    <th className="sticky left-0 z-10 bg-sunken/60 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-muted">
                      Nama
                    </th>
                    {JAM_COLS.map((j) => (
                      <th key={j} className="px-1 py-2 text-[10.5px] font-extrabold text-muted">
                        {j}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-[10.5px] font-extrabold text-muted">WA</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSiswaFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={JAM_COLS.length + 2} className="px-4 py-6 text-center text-[12px] font-semibold text-muted">
                        Tidak ada siswa yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : detailSiswaFiltered.map((s, i) => {
                    const jamNonH = JAM_COLS.filter((j) => s.jam?.[j] && s.jam[j] !== 'H');
                    const worst = jamNonH.length
                      ? jamNonH.reduce((acc, j) => {
                          const cur = s.jam[j];
                          const p = { C: 5, A: 4, S: 3, I: 2, H: 1 };
                          return (p[cur] || 0) > (p[acc] || 0) ? cur : acc;
                        }, 'H')
                      : 'H';
                    return (
                      <tr key={s.nisn || i} className="border-t border-line/60">
                        <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-[12px] font-bold text-ink">
                          <button
                            type="button"
                            onClick={() =>
                              setMonitorSiswa({
                                nisn: s.nisn,
                                nama: s.nama,
                                kelas: detail.kelas,
                                no_hp_ortu: s.no_hp_ortu,
                              })
                            }
                            className="text-left hover:text-brand"
                          >
                            {s.nama}
                          </button>
                        </td>
                        {JAM_COLS.map((j) => {
                          const st = s.jam?.[j];
                          const tone = st ? TONE[STATUS.find((x) => x.key === st)?.tone || 'hadir'] : null;
                          return (
                            <td key={j} className="px-1 py-1.5 text-center">
                              {st ? (
                                <span
                                  className={cn(
                                    'inline-grid size-5 place-items-center rounded-md text-[10px] font-extrabold',
                                    tone.soft,
                                    tone.text
                                  )}
                                >
                                  {st}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted/40">·</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-right">
                          {worst !== 'H' ? (
                            <WaButton
                              size="xs"
                              phone={s.no_hp_ortu}
                              message={pesanAbsenSiswa({
                                nama: s.nama,
                                kelas: detail.kelas,
                                tanggal,
                                status: worst,
                                jamList: jamNonH,
                              })}
                              label=""
                              className="!min-h-7 !px-2"
                            />
                          ) : (
                            <span className="text-[10px] text-muted/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Sheet>

      {/* modal apel pagi */}
      <Sheet
        open={apelOpen}
        onClose={() => setApelOpen(false)}
        title="Catat Apel Pagi"
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11.5px] font-semibold text-muted">{apelSelected.length} siswa dipilih</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setApelOpen(false)}>
                Batal
              </Button>
              <Button onClick={simpanApel} loading={apelSaving} disabled={!apelSelected.length || !apelKelas}>
                Simpan
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{formatTanggal(tanggal)}</Badge>
            <Badge tone="neutral">Petugas: {name || '-'}</Badge>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Kelas" htmlFor="apel-kelas">
              <Select
                id="apel-kelas"
                value={apelKelas}
                onChange={(e) => setApelKelas(e.target.value)}
                disabled={!apelKelasList.length}
                className="h-11 text-[12.5px]"
              >
                {!apelKelasList.length && <option value="">Memuat kelas…</option>}
                {apelKelasList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jam datang" htmlFor="apel-jam" hint="Otomatis jam sekarang, bisa diubah.">
              <Input id="apel-jam" type="time" value={apelJam} onChange={(e) => setApelJam(e.target.value)} />
            </Field>
          </div>

          <Field label="Keterangan (opsional)" htmlFor="apel-ket">
            <Input
              id="apel-ket"
              value={apelKet}
              onChange={(e) => setApelKet(e.target.value)}
              maxLength={120}
              placeholder="Contoh: terlambat 15 menit, ban sepeda bocor"
            />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-ink/80">Pilih siswa</p>
              <p className="text-[11px] font-semibold text-muted">{apelSelected.length} dipilih</p>
            </div>
            <SearchSuggest
              value={apelQuery}
              onChange={setApelQuery}
              onSelect={(opt) => {
                const nisn = String(opt.raw?.nisn || '');
                if (nisn && !sudahApelNisn.has(nisn)) {
                  toggleApelSiswa(nisn);
                }
              }}
              clearOnSelect
              options={apelSiswaSuggestions}
              placeholder="Cari & ketuk nama atau NISN untuk pilih cepat…"
              hintTitle={apelKelas ? `Siswa kelas ${apelKelas}` : 'Daftar siswa'}
              showToggle
            />

            <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line">
              {apelSiswaLoading ? (
                <div className="space-y-1.5 p-2">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ) : filteredApelSiswa.length === 0 ? (
                <p className="p-4 text-center text-[12px] font-semibold text-muted">
                  {apelKelas ? 'Siswa tidak ditemukan.' : 'Pilih kelas terlebih dahulu.'}
                </p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {filteredApelSiswa.map((s) => {
                    const nisn = String(s.nisn);
                    const done = sudahApelNisn.has(nisn);
                    const checked = apelSelected.includes(nisn);
                    return (
                      <li key={nisn}>
                        <label
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2',
                            done ? 'opacity-55' : 'cursor-pointer hover:bg-sunken/60'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={done || checked}
                            disabled={done}
                            onChange={() => toggleApelSiswa(nisn)}
                            className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-bold text-ink">
                              {s.nama_siswa || s.nama}
                            </span>
                            <span className="block text-[10.5px] font-semibold text-muted">
                              NISN {s.nisn}
                              {done ? ' · sudah tercatat' : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {sudahApelNisn.size > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-sunken/60 px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Siswa yang sudah tercatat pada tanggal ini otomatis dilewati.
            </p>
          )}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(confirmApel)}
        onClose={() => setConfirmApel(null)}
        title="Hapus catatan terlambat?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmApel(null)}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" loading={deletingApel} onClick={hapusApel}>
              Ya, hapus
            </Button>
          </div>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-muted">
          Catatan keterlambatan apel pagi untuk <b className="text-ink">{confirmApel?.nama_siswa || 'siswa ini'}</b> (
          {confirmApel?.kelas || '—'}) akan dihapus.
        </p>
      </Sheet>

      <StudentMonitorSheet
        open={Boolean(monitorSiswa)}
        siswa={monitorSiswa}
        onClose={() => setMonitorSiswa(null)}
      />
    </div>
  );
}
