import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  UserX,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { cn, formatBulan, formatTanggal, monthISO } from '../lib/utils';
import { pesanPeringatanDini } from '../lib/whatsapp';
import { Badge, Button, Card, CardHeader, EmptyState, Select, Skeleton, Stat } from '../components/ui';
import WaButton from '../components/WaButton';
import StudentMonitorSheet from '../components/StudentMonitorSheet';
import SearchSuggest from '../components/SearchSuggest';

/* ---------------- chart kecil (SVG, tanpa library) ---------------- */

function Donut({ parts, centerValue, centerLabel = 'Hadir', size = 140, thickness = 16 }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-sunken" strokeWidth={thickness} />
          {parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="currentColor"
                className={p.cls}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.22, 1, 0.36, 1), stroke-dashoffset 500ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {centerValue !== undefined && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[20px] font-extrabold leading-none tabular-nums text-ink">{centerValue}</span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{centerLabel}</span>
          </div>
        )}
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[12px] font-bold">
            <span className={cn('size-2.5 rounded-full bg-current', p.cls)} />
            <span className="flex-1 text-muted">{p.label}</span>
            <span className="tabular-nums text-ink">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ data, valueKey = 'hadir', labelKey = 'jurusan' }) {
  const max = Math.max(100, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        return (
          <li key={i}>
            <div className="mb-1 flex items-center justify-between text-[12px] font-bold">
              <span className="truncate text-muted">{d[labelKey] || '—'}</span>
              <span className="tabular-nums text-ink">{v}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
              <div
                className="animate-bar h-full rounded-full bg-gradient-to-r from-brand to-violet-500"
                style={{ width: `${Math.max(3, (v / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Sparkline({ data, valueKey = 'persen', labelKey = 'bulan' }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 100);
  const min = Math.min(...data.map((d) => Number(d[valueKey]) || 0), 0);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100;
    const y = 100 - ((Number(d[valueKey]) - min) / span) * 90 - 5;
    return `${x},${y}`;
  });

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full">
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${pts.join(' ')} 100,100`} fill="url(#spark)" />
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-muted">
        {data.map((d, i) => (
          <span key={i} className="truncate">
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- halaman ---------------- */

import { todayISO } from '../lib/utils';

const MODES = [
  { key: 'harian', label: 'Harian' },
  { key: 'mingguan', label: 'Mingguan' },
  { key: 'bulanan', label: 'Bulanan' },
  { key: 'semester', label: 'Semester' },
];

export default function Kepsek() {
  const toast = useToast();
  const [mode, setMode] = useState('harian');
  const [tanggal, setTanggal] = useState(todayISO());
  const [bulan, setBulan] = useState(monthISO());
  const [kelas, setKelas] = useState('SEMUA');
  const [kelasList, setKelasList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monitorSiswa, setMonitorSiswa] = useState(null);
  const [rawanQuery, setRawanQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardKepsek(mode, tanggal, bulan, kelas, 'SEMUA');
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat dashboard');
      setData(res);
    } catch (err) {
      setData(null);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, tanggal, bulan, kelas, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getKelas();
        setKelasList(res?.data || res?.kelas || []);
      } catch {
        /* opsional */
      }
    })();
  }, []);

  const kpi = data?.kpi || {};
  const ranking = data?.rankingKelas || [];
  const jurusan = data?.grafikJurusan || [];
  const trend = data?.trendBulanan || [];
  const semester = data?.trendSemester || [];
  const rawan = data?.peringatanDini?.length ? data.peringatanDini : data?.siswaCabut || [];

  const rawanSuggestions = useMemo(
    () =>
      rawan.map((s) => {
        const total = s.total || 0;
        return {
          value: s.nama || '',
          label: s.nama || 'Siswa',
          sub: `${s.kelas} · ${total}× Alpha/Cabut`,
          badge: total >= 3 ? 'Pembinaan' : 'Pantau',
          badgeTone: total >= 3 ? 'danger' : 'warning',
          keywords: `${s.nisn || ''} ${s.kelas || ''}`,
          raw: s,
        };
      }),
    [rawan]
  );

  const filteredRawan = useMemo(() => {
    const q = rawanQuery.trim().toLowerCase();
    if (!q) return rawan;
    return rawan.filter(
      (s) =>
        String(s.nama || '').toLowerCase().includes(q) ||
        String(s.kelas || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q)
    );
  }, [rawan, rawanQuery]);

  const insight = useMemo(() => {
    const list = [];
    if (jurusan.length) {
      const worst = [...jurusan].sort((a, b) => (b.alpha || 0) - (a.alpha || 0))[0];
      if (worst && (worst.alpha || 0) > 0) list.push(`Jurusan ${worst.jurusan} memiliki alpha tertinggi.`);
    }
    list.push(
      Number(kpi.hadir || 0) >= 90
        ? 'Kehadiran sekolah dalam kondisi baik.'
        : 'Kehadiran sekolah perlu perhatian.'
    );
    const kritis = rawan.filter((s) => (s.total || 0) >= 3).length;
    const dini = rawan.filter((s) => (s.total || 0) === 2).length;
    if (kritis) list.push(`${kritis} siswa mencapai ambang kritis (≥ 3× Alpha/Cabut).`);
    if (dini) list.push(`${dini} siswa masuk peringatan dini (2× Alpha/Cabut).`);
    if (ranking.length) list.push(`Kelas terbaik: ${ranking[0].kelas}.`);
    return list;
  }, [jurusan, kpi.hadir, ranking, rawan]);

  return (
    <div className="space-y-3">
      {/* filter */}
      <Card className="animate-rise p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
            <GraduationCap className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Dashboard Kepala Sekolah</h1>
            <p className="text-[11.5px] font-semibold text-muted">
              {mode === 'harian' ? formatTanggal(tanggal) : mode === 'bulanan' ? formatBulan(bulan) : `Mode ${mode}`}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="mt-3 flex gap-1 rounded-2xl bg-sunken p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={cn(
                'flex-1 rounded-xl py-1.5 text-[12px] font-extrabold transition',
                mode === m.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {mode === 'harian' && (
            <div className="relative col-span-2 sm:col-span-1">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-9 pr-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </div>
          )}
          {mode === 'bulanan' && (
            <input
              type="month"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="col-span-2 h-10 rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface sm:col-span-1"
            />
          )}
          <Select value={kelas} onChange={(e) => setKelas(e.target.value)} className={cn('h-10 text-[12.5px]', mode !== 'harian' && mode !== 'bulanan' && 'col-span-2')}>
            <option value="SEMUA">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-3xl" />)
        ) : (
          <>
            <Stat icon={TrendingUp} label="Kehadiran" value={`${kpi.hadir || 0}%`} hint="Rata-rata periode" tone="success" />
            <Stat icon={UserX} label="Alpha" value={kpi.alpha || 0} hint="Tanpa keterangan" tone="danger" />
            <Stat icon={AlertTriangle} label="Cabut" value={kpi.cabut || 0} hint="Keluar saat KBM" tone="violet" />
            <Stat icon={Award} label="Kelas terbaik" value={ranking[0]?.kelas || '—'} hint="Peringkat 1" tone="warning" />
          </>
        )}
      </div>

      {insight.length > 0 && (
        <Card className="animate-rise border-brand/20 bg-brand-soft/40 p-4">
          <ul className="space-y-1.5">
            {insight.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] font-semibold leading-relaxed text-ink">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                {text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* charts */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader title="Distribusi kehadiran" subtitle="Periode terpilih" className="!px-0 !pt-0" />
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-32 rounded-2xl" />
            ) : (
              (() => {
                const nonHadir =
                  (Number(kpi.sakit) || 0) +
                  (Number(kpi.izin) || 0) +
                  (Number(kpi.alpha) || 0) +
                  (Number(kpi.cabut) || 0);
                const totalUnit = Number(data?.totalUnit) || 0;
                const hadirCount = totalUnit > 0 ? Math.max(0, totalUnit - nonHadir) : Number(kpi.hadir) || 0;
                return (
                  <Donut
                    centerValue={`${kpi.hadir || 0}%`}
                    centerLabel="Hadir"
                    parts={[
                      { label: 'Hadir', value: hadirCount, cls: 'text-emerald-500' },
                      { label: 'Sakit', value: Number(kpi.sakit) || 0, cls: 'text-amber-500' },
                      { label: 'Izin', value: Number(kpi.izin) || 0, cls: 'text-sky-500' },
                      { label: 'Alpha', value: Number(kpi.alpha) || 0, cls: 'text-rose-500' },
                      { label: 'Cabut', value: Number(kpi.cabut) || 0, cls: 'text-violet-500' },
                    ]}
                  />
                );
              })()
            )}
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader title="Kehadiran per jurusan" subtitle="Persentase hadir" className="!px-0 !pt-0" />
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-32 rounded-2xl" />
            ) : jurusan.length ? (
              <Bars data={jurusan} />
            ) : (
              <EmptyState icon={TrendingUp} title="Belum ada data jurusan" className="py-6" />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader title="Tren bulanan" subtitle="Persentase kehadiran" className="!px-0 !pt-0" />
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : trend.length ? (
              <Sparkline data={trend} />
            ) : (
              <EmptyState icon={TrendingUp} title="Belum ada tren" className="py-6" />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader title="Per semester" subtitle="Rata-rata kehadiran" className="!px-0 !pt-0" />
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : semester.length ? (
              <Sparkline data={semester} valueKey="hadir" labelKey="semester" />
            ) : (
              <EmptyState icon={TrendingUp} title="Belum ada data semester" className="py-6" />
            )}
          </div>
        </Card>
      </div>

      {/* ranking + rawan */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Peringkat kelas" subtitle="Berdasarkan kehadiran" icon={Award} />
          <div className="mt-3 border-t border-line/70">
            {ranking.length === 0 ? (
              <EmptyState icon={Award} title="Belum ada peringkat" className="py-8" />
            ) : (
              <ul className="divide-y divide-line/70">
                {ranking.slice(0, 8).map((r, i) => (
                  <li key={r.kelas || i} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        'grid size-7 place-items-center rounded-lg text-[11px] font-extrabold',
                        i === 0
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-sunken text-muted'
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{r.kelas}</span>
                    <span className="text-[12px] font-extrabold tabular-nums text-muted">
                      {r.hadir != null ? `${r.hadir}%` : r.persen != null ? `${r.persen}%` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Peringatan Dini & Siswa Rawan" subtitle="Alpha / cabut terbanyak (≥ 2×)" icon={AlertTriangle} />
          {rawan.length > 0 && (
            <div className="px-4 pt-3">
              <SearchSuggest
                value={rawanQuery}
                onChange={setRawanQuery}
                onSelect={(opt) => {
                  const s = opt.raw;
                  setRawanQuery(s?.nama || opt.label);
                  if (s) {
                    setMonitorSiswa({
                      nisn: s.nisn,
                      nama: s.nama,
                      kelas: s.kelas,
                      no_hp_ortu: s.no_hp_ortu,
                    });
                  }
                }}
                options={rawanSuggestions}
                placeholder="Cari siswa rawan atau kelas…"
                hintTitle="Siswa rawan tersedia"
                size="sm"
                showToggle
              />
            </div>
          )}
          <div className="mt-3 border-t border-line/70">
            {filteredRawan.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title={rawan.length ? 'Siswa tidak ditemukan' : 'Tidak ada siswa rawan'}
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-line/70">
                {filteredRawan.slice(0, 12).map((s, i) => {
                  const total = s.total || 0;
                  const level = total >= 3 ? 'Perlu Pembinaan' : total >= 2 ? 'Perlu Dipantau' : 'Pantau';
                  const tone = total >= 3 ? 'danger' : total >= 2 ? 'warning' : 'info';
                  const waText = pesanPeringatanDini({
                    nama: s.nama,
                    nisn: s.nisn,
                    kelas: s.kelas,
                    alpha: s.alpha ?? (s.status === 'A' ? total : 0),
                    cabut: s.cabut ?? (s.status === 'C' ? total : 0),
                    periode: mode === 'bulanan' ? formatBulan(bulan) : `Periode ${mode}`,
                    pengirim: 'Kepala Sekolah',
                  });
                  return (
                    <li key={s.nisn || i} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-sunken/35">
                      <button
                        type="button"
                        onClick={() =>
                          setMonitorSiswa({
                            nisn: s.nisn,
                            nama: s.nama,
                            kelas: s.kelas,
                            no_hp_ortu: s.no_hp_ortu,
                          })
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-[13px] font-bold text-ink hover:text-brand">{s.nama}</p>
                        <p className="truncate text-[11px] font-semibold text-muted">
                          {s.kelas} · {total}×{' '}
                          {s.alpha != null ? `(${s.alpha} Alpha, ${s.cabut} Cabut)` : s.status || 'Alpha'}
                        </p>
                      </button>
                      <Badge tone={tone}>{level}</Badge>
                      <WaButton size="xs" phone={s.no_hp_ortu} message={waText} label="WA" />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <StudentMonitorSheet
        open={Boolean(monitorSiswa)}
        siswa={monitorSiswa}
        onClose={() => setMonitorSiswa(null)}
      />
    </div>
  );
}
