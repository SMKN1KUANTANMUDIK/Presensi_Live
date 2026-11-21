import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlarmClock,
  ArrowRight,
  ClipboardList,
  GraduationCap,
  History,
  Percent,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { angka, cn, formatTanggal, todayISO } from '../lib/utils';
import { Badge, Card, CardHeader, EmptyState, Skeleton, Stat } from '../components/ui';

function statusTone(status) {
  const s = String(status || 'H').trim().toLowerCase();
  if (s.startsWith('a')) return 'danger';
  if (s.startsWith('s')) return 'warning';
  if (s.startsWith('i')) return 'info';
  if (s.startsWith('c')) return 'violet';
  return 'success';
}

function sapaanWaktu() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

const QUICK = [
  { to: '/input', label: 'Input absensi', desc: 'Catat kehadiran siswa per kelas', icon: ClipboardList, tone: 'bg-brand-soft text-brand' },
  { to: '/piket', label: 'Monitoring piket', desc: 'Pantau kelas, apel & kirim WA', icon: ShieldCheck, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  { to: '/kasus', label: 'Kasus pembinaan', desc: 'Tindak lanjuti siswa 3× Alpha/Cabut', icon: ShieldAlert, tone: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  { to: '/riwayat', label: 'Riwayat & Edit', desc: 'Perbaiki atau hapus data absensi', icon: History, tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  { to: '/siswa', label: 'Data siswa', desc: 'Kelola daftar siswa & nomor WA ortu', icon: Users, tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  { to: '/guru', label: 'Data guru', desc: 'Atur akun login & peran guru', icon: UserCog, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
];

function MiniRing({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className="absolute text-[13px] font-extrabold tabular-nums text-white">{pct}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { name } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.getDashboardAdmin();
        if (!alive) return;
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat dashboard');
        setData(res.data || {});
      } catch (err) {
        if (alive) toast.error(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  const d = data || {};
  const belumInput = d.kelasBelumInput || [];

  return (
    <div className="space-y-3.5">
      {/* hero */}
      <Card className="animate-rise relative overflow-hidden border-0 bg-gradient-to-br from-blue-600 via-brand to-indigo-600 p-5 text-white shadow-[0_18px_40px_-20px_var(--brand)] sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(80% 60% at 100% 0%, #fff 0%, transparent 60%), radial-gradient(60% 60% at 0% 100%, #fff 0%, transparent 60%)',
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            {!loading && <MiniRing value={d.hadirPersen} />}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">
                {sapaanWaktu()} · Admin
              </p>
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">
                Halo, {name.split(' ')[0]}
              </h1>
              <p className="mt-0.5 text-[12.5px] font-medium text-white/85">{formatTanggal(todayISO())}</p>
            </div>
          </div>
          <Link
            to="/input"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-brand shadow-md transition hover:bg-white/95 active:scale-[.97]"
          >
            Input absensi <ArrowRight className="size-4" />
          </Link>
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-3xl" />)
        ) : (
          <>
            <Stat className="animate-rise stagger-1" icon={Users} label="Total siswa" value={angka(d.totalSiswa)} hint="Terdaftar aktif" tone="brand" />
            <Stat className="animate-rise stagger-2" icon={Percent} label="Kehadiran" value={`${d.hadirPersen || 0}%`} hint="Hari ini" tone="success" />
            <Stat className="animate-rise stagger-3" icon={GraduationCap} label="Total guru" value={angka(d.totalGuru)} hint="Guru & staf" tone="info" />
            <Stat className="animate-rise stagger-4" icon={ShieldAlert} label="Alpha & Cabut" value={angka(d.pelanggaran)} hint="Perlu perhatian hari ini" tone="danger" />
          </>
        )}
      </div>

      {/* status monitoring hari ini */}
      {!loading && (belumInput.length > 0 || d.totalApelHariIni != null) && (
        <Card className="animate-rise stagger-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlarmClock className="size-4 text-amber-500" />
              <p className="text-[13.5px] font-extrabold text-ink">Status Kelas Hari Ini</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.totalApelHariIni != null && (
                <Badge tone={d.totalApelHariIni > 0 ? 'warning' : 'neutral'}>
                  Terlambat apel: {d.totalApelHariIni}
                </Badge>
              )}
              {d.totalKelas > 0 && (
                <Badge tone={belumInput.length > 0 ? 'violet' : 'success'}>
                  {belumInput.length > 0 ? `${belumInput.length} kelas belum diabsen` : 'Semua kelas sudah diabsen'}
                </Badge>
              )}
            </div>
          </div>

          {belumInput.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {belumInput.slice(0, 12).map((k) => (
                <span key={k} className="rounded-lg bg-sunken px-2.5 py-1 text-[11px] font-bold text-muted">
                  {k}
                </span>
              ))}
              {belumInput.length > 12 && (
                <Link to="/piket" className="rounded-lg bg-brand-soft px-2.5 py-1 text-[11px] font-extrabold text-brand transition hover:bg-brand/15">
                  +{belumInput.length - 12} kelas lainnya di Piket →
                </Link>
              )}
            </div>
          )}
        </Card>
      )}

      {/* quick actions */}
      <div>
        <p className="mb-2 px-1 text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
          Pilih menu yang ingin dibuka
        </p>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {QUICK.map((q, idx) => (
            <Link
              key={q.to}
              to={q.to}
              className={cn(
                'animate-rise group flex flex-col gap-2 rounded-3xl border border-line bg-surface p-4 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-float active:scale-[.98]',
                `stagger-${Math.min(idx + 1, 6)}`
              )}
            >
              <span className={cn('grid size-10 place-items-center rounded-2xl transition-transform duration-150 group-hover:scale-105', q.tone)}>
                <q.icon className="size-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-extrabold text-ink">{q.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] font-medium leading-snug text-muted">{q.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* activity */}
      <Card className="animate-rise overflow-hidden">
        <CardHeader title="Aktivitas terbaru" subtitle="Catatan kehadiran siswa yang baru masuk hari ini" icon={Activity} />
        <div className="mt-3 border-t border-line/70">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : (d.aktivitas || []).length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada absensi hari ini" description="Catatan absensi yang masuk hari ini akan langsung tampil di sini." />
          ) : (
            <ul className="divide-y divide-line/70">
              {d.aktivitas.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken/35">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-[12px] font-extrabold text-muted">
                    {(item.siswa || '?')[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">{item.siswa || '—'}</p>
                    <p className="truncate text-[11px] font-semibold text-muted">
                      {item.kelas || '—'} · {item.tanggal || '—'}
                    </p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{item.status || 'Hadir'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
