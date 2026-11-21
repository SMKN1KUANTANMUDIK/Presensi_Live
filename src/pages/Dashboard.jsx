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

const QUICK = [
  { to: '/input', label: 'Input absensi', desc: 'Catat kehadiran kelas', icon: ClipboardList, tone: 'bg-brand-soft text-brand' },
  { to: '/piket', label: 'Monitoring piket', desc: 'Pantau kelas, apel & WA', icon: ShieldCheck, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  { to: '/kasus', label: 'Kasus pembinaan', desc: 'Tindak lanjuti siswa 3× A/C', icon: ShieldAlert, tone: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  { to: '/riwayat', label: 'Riwayat', desc: 'Edit & hapus data absensi', icon: History, tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  { to: '/siswa', label: 'Data siswa', desc: 'Kelola siswa & WA ortu', icon: Users, tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  { to: '/guru', label: 'Data guru', desc: 'Kelola akun & role guru', icon: UserCog, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
];

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
    <div className="space-y-3">
      {/* hero */}
      <Card className="animate-rise relative overflow-hidden border-0 bg-gradient-to-br from-brand via-brand to-violet-600 p-5 text-white sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(80% 60% at 100% 0%, #fff 0%, transparent 60%), radial-gradient(60% 60% at 0% 100%, #fff 0%, transparent 60%)',
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold uppercase tracking-widest text-white/70">Dashboard admin</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">
              Halo, {name.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-[12.5px] font-medium text-white/80">{formatTanggal(todayISO())}</p>
          </div>
          <Link
            to="/input"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/25 active:scale-[.98]"
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
            <Stat icon={Users} label="Total siswa" value={angka(d.totalSiswa)} hint="Siswa aktif" tone="brand" />
            <Stat icon={Percent} label="Kehadiran" value={`${d.hadirPersen || 0}%`} hint="Hari ini" tone="success" />
            <Stat icon={GraduationCap} label="Total guru" value={angka(d.totalGuru)} hint="Guru aktif" tone="info" />
            <Stat icon={ShieldAlert} label="Pelanggaran" value={angka(d.pelanggaran)} hint="Alpha & Cabut hari ini" tone="danger" />
          </>
        )}
      </div>

      {/* status monitoring hari ini */}
      {!loading && (belumInput.length > 0 || d.totalApelHariIni != null) && (
        <Card className="animate-rise p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlarmClock className="size-4 text-amber-500" />
              <p className="text-[13px] font-extrabold text-ink">Monitoring Hari Ini</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.totalApelHariIni != null && (
                <Badge tone={d.totalApelHariIni > 0 ? 'warning' : 'neutral'}>
                  Apel terlambat: {d.totalApelHariIni}
                </Badge>
              )}
              {d.totalKelas > 0 && (
                <Badge tone={belumInput.length > 0 ? 'violet' : 'success'}>
                  {belumInput.length > 0 ? `${belumInput.length} kelas belum input` : 'Semua kelas sudah input'}
                </Badge>
              )}
            </div>
          </div>

          {belumInput.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {belumInput.slice(0, 12).map((k) => (
                <span key={k} className="rounded-lg bg-sunken px-2 py-1 text-[11px] font-bold text-muted">
                  {k}
                </span>
              ))}
              {belumInput.length > 12 && (
                <Link to="/piket" className="rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-extrabold text-brand">
                  +{belumInput.length - 12} kelas di Piket →
                </Link>
              )}
            </div>
          )}
        </Card>
      )}

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {QUICK.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="group flex flex-col gap-2 rounded-3xl border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
          >
            <span className={cn('grid size-9 place-items-center rounded-xl', q.tone)}>
              <q.icon className="size-[18px]" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink">{q.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-muted">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* activity */}
      <Card className="animate-rise overflow-hidden">
        <CardHeader title="Aktivitas terbaru" subtitle="Absensi yang baru masuk" icon={Activity} />
        <div className="mt-3 border-t border-line/70">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : (d.aktivitas || []).length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada aktivitas" description="Data absensi terbaru akan muncul di sini." />
          ) : (
            <ul className="divide-y divide-line/70">
              {d.aktivitas.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
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
