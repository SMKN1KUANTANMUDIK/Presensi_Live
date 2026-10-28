import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Clock,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import {
  cn,
  formatTanggal,
  hitungStatSiswa,
  STATUS,
  statusHari,
  TONE,
  todayISO,
} from '../lib/utils';
import { Badge, Button, Card, EmptyState, Select, Sheet, Skeleton } from '../components/ui';

const JAM_COLS = Array.from({ length: 11 }, (_, i) => i + 1);

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
  const [tanggal, setTanggal] = useState(todayISO());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kelasFilter, setKelasFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(
    async (date = tanggal) => {
      setLoading(true);
      try {
        const res = await api.getDashboardPiket(date, 'SEMUA');
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat data piket');
        setData(res.data || []);
      } catch (err) {
        setData([]);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [tanggal, toast]
  );

  useEffect(() => {
    load(tanggal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  const kelasList = useMemo(
    () => [...new Set(data.map((d) => d.kelas))].sort((a, b) => String(a).localeCompare(String(b))),
    [data]
  );

  const rows = useMemo(() => {
    const list = data
      .map((item) => {
        const stat = hitungStatSiswa(item.siswaList);
        const guruList = item.guruList || [];
        const belum = guruList.length === 0;
        const pelanggaran = stat.A + stat.C + stat.S + stat.I;
        return { ...item, stat, guruList, belum, pelanggaran };
      })
      .sort((a, b) => b.pelanggaran - a.pelanggaran || String(a.kelas).localeCompare(String(b.kelas)));

    return kelasFilter ? list.filter((r) => r.kelas === kelasFilter) : list;
  }, [data, kelasFilter]);

  const summary = useMemo(() => {
    const s = { hadir: 0, si: 0, alpha: 0, belum: 0 };
    rows.forEach((r) => {
      s.hadir += r.stat.H;
      s.si += r.stat.S + r.stat.I;
      s.alpha += r.stat.A + r.stat.C;
      if (r.belum) s.belum += 1;
    });
    return s;
  }, [rows]);

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
              <p className="text-[11.5px] font-semibold text-muted">{formatTanggal(tanggal)}</p>
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
            <Button variant="outline" size="icon" onClick={() => load()} aria-label="Muat ulang">
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* summary */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Hadir', value: summary.hadir, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'S/I', value: summary.si, cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'A/C', value: summary.alpha, cls: 'text-rose-600 dark:text-rose-400' },
            { label: 'Belum', value: summary.belum, cls: 'text-violet-600 dark:text-violet-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-sunken/40 px-2 py-2 text-center">
              <p className={cn('text-lg font-extrabold leading-none tabular-nums', s.cls)}>{s.value}</p>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Select value={kelasFilter} onChange={(e) => setKelasFilter(e.target.value)} className="h-10 flex-1 text-[12.5px]">
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* kelas cards */}
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
            description="Belum ada kelas yang diabsen pada tanggal ini."
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
            const status = item.belum ? 'belum' : item.pelanggaran > 3 ? 'warning' : 'hadir';
            const toneCls =
              status === 'belum'
                ? 'border-violet-500/30'
                : status === 'warning'
                  ? 'border-amber-500/40'
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
                  <Badge tone={status === 'belum' ? 'violet' : status === 'warning' ? 'warning' : 'success'}>
                    {status === 'belum' ? 'Belum diabsen' : status === 'warning' ? 'Perlu perhatian' : 'Aman'}
                  </Badge>
                </div>

                <div className="mt-3 flex gap-1 px-4">
                  {STATUS.map((s) => (
                    <StatPill key={s.key} status={s} value={item.stat[s.key]} />
                  ))}
                </div>

                {item.guruList.length > 0 && (
                  <div className="mt-3 space-y-1 px-4">
                    {item.guruList.slice(0, 3).map((g, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-sunken/50 px-2.5 py-1.5">
                        <Clock className="size-3 shrink-0 text-muted" />
                        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">{g.nama || '—'}</p>
                        <span className="shrink-0 text-[10px] font-extrabold text-muted">{g.totalSiswa || 0} siswa</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDetail(item)}
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
        onClose={() => setDetail(null)}
        title={detail ? `Detail — ${detail.kelas}` : ''}
        size="xl"
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{formatTanggal(tanggal)}</Badge>
              <Badge tone="success">
                <CircleCheck className="size-3" /> {hitungStatSiswa(detail.siswaList).H} hadir
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] border-collapse">
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
                  </tr>
                </thead>
                <tbody>
                  {(detail.siswaList || []).map((s, i) => (
                    <tr key={s.nisn || i} className="border-t border-line/60">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-[12px] font-bold text-ink">
                        {s.nama}
                      </td>
                      {JAM_COLS.map((j) => {
                        const st = s.jam?.[j];
                        const tone = st ? TONE[STATUS.find((x) => x.key === st)?.tone || 'hadir'] : null;
                        return (
                          <td key={j} className="px-1 py-1.5 text-center">
                            {st ? (
                              <span className={cn('inline-grid size-5 place-items-center rounded-md text-[10px] font-extrabold', tone.soft, tone.text)}>
                                {st}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted/40">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
