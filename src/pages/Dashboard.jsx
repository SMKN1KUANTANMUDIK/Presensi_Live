import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlarmClock,
  ArrowRight,
  ClipboardList,
  GraduationCap,
  History,
  Percent,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { angka, cn, formatTanggal, todayISO } from '../lib/utils';
import { Badge, Card, CardHeader, EmptyState, Skeleton, Stat } from '../components/ui';
import { Reveal, CountUp, useGsap, useGsapParallax, TiltCard } from '../lib/motion';

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

/* SVG ring kehadiran */
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
          cx="32" cy="32" r={r} fill="none" stroke="#ffffff" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className="absolute text-[13px] font-extrabold tabular-nums text-white">{pct}%</span>
    </div>
  );
}

/* Bola dekoratif parallax di hero */
function HeroOrb({ className }) {
  const ref = useGsapParallax(28, { scale: 1 });
  return <span ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute rounded-full blur-3xl', className)} />;
}

export default function Dashboard() {
  const { name } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const reduce = useReducedMotion();

  /* GSAP untuk animasi stat cards */
  const statsRef = useGsap(
    (gsap) => {
      if (loading) return;
      gsap.from('.stat-card', {
        y: 24,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'expo.out',
        clearProps: 'all',
      });
    },
    [loading],
    { inViewport: false }
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
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
    return () => { alive = false; };
  }, [toast, refreshTick]);

  const d = data || {};
  const belumInput = d.kelasBelumInput || [];
  const firstName = String(name || 'Admin').trim().split(/\s+/)[0] || 'Admin';

  /* variasi Motion */
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: (i) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <div className="space-y-3.5">

      {/* ============ HERO ============ */}
      <Reveal animation="rise" delay={0}>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-600 via-brand to-indigo-600 p-5 text-white shadow-[0_18px_40px_-20px_var(--brand)] sm:p-6">
          {/* Orbs */}
          <HeroOrb className="size-72 -right-16 -top-16 bg-sky-400/30" />
          <HeroOrb className="size-56 -bottom-12 left-10 bg-violet-500/20" />

          {/* Grid overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              {!loading && <MiniRing value={d.hadirPersen} />}
              <div className="min-w-0">
                <motion.p
                  initial={reduce ? undefined : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="text-[11px] font-bold uppercase tracking-widest text-white/75"
                >
                  {sapaanWaktu()} · Admin
                </motion.p>
                <motion.h1
                  initial={reduce ? undefined : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.55, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-0.5 truncate text-[21px] font-extrabold leading-tight tracking-tight sm:text-[26px]"
                >
                  Halo, {firstName}
                </motion.h1>
                <motion.p
                  initial={reduce ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.18 }}
                  className="mt-0.5 text-[12.5px] font-medium text-white/85"
                >
                  {formatTanggal(todayISO())}
                </motion.p>
              </div>
            </div>
            <motion.div
              initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <button
                type="button"
                onClick={() => setRefreshTick((n) => n + 1)}
                aria-label="Segarkan dashboard"
                className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-95"
              >
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              </button>
              <Link
                to="/input"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-brand shadow-md transition hover:bg-white/95 active:scale-[.97] sm:flex-initial"
              >
                Input absensi <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>
        </Card>
      </Reveal>

      {/* ============ STATS ============ */}
      <div ref={statsRef} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-3xl" />)
        ) : (
          <>
            {[
              { icon: Users, label: 'Total siswa', value: d.totalSiswa, hint: 'Terdaftar aktif', tone: 'brand' },
              { icon: Percent, label: 'Kehadiran', value: d.hadirPersen, hint: 'Hari ini', tone: 'success', pct: true },
              { icon: GraduationCap, label: 'Total guru', value: d.totalGuru, hint: 'Guru & staf', tone: 'info' },
              { icon: ShieldAlert, label: 'Alpha & Cabut', value: d.pelanggaran, hint: 'Perlu perhatian hari ini', tone: 'danger' },
            ].map((s, i) => (
              <div key={s.label} className="stat-card">
                <Stat
                  icon={s.icon}
                  label={s.label}
                  value={
                    <CountUp value={s.pct ? (s.value || 0) : (s.value || 0)} format={s.pct ? (v) => `${Math.round(v)}%` : undefined} />
                  }
                  hint={s.hint}
                  tone={s.tone}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* ============ STATUS KELAS ============ */}
      <AnimatePresence>
        {!loading && (belumInput.length > 0 || d.totalApelHariIni != null) && (
          <motion.div
            key="status-kelas"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="p-4">
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
                    <Link
                      key={k}
                      to="/piket"
                      className="rounded-lg bg-sunken px-2.5 py-1 text-[11px] font-bold text-muted transition hover:bg-brand-soft hover:text-brand"
                    >
                      {k}
                    </Link>
                  ))}
                  {belumInput.length > 12 && (
                    <Link to="/piket" className="rounded-lg bg-brand-soft px-2.5 py-1 text-[11px] font-extrabold text-brand transition hover:bg-brand/15">
                      +{belumInput.length - 12} kelas lainnya di Piket →
                    </Link>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ QUICK ACTIONS ============ */}
      <div>
        <Reveal animation="fade" delay={0.1}>
          <p className="mb-2 px-1 text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
            Pilih menu yang ingin dibuka
          </p>
        </Reveal>
        <motion.div
          className="grid grid-cols-2 gap-2.5 lg:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
        >
          {QUICK.map((q, idx) => (
            <motion.div
              key={q.to}
              custom={idx}
              variants={cardVariants}
            >
              <TiltCard
                className="h-full"
                max={6}
                glare={!reduce}
              >
                <Link
                  to={q.to}
                  className="group flex h-full flex-col gap-2 rounded-3xl border border-line bg-surface p-4 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-float active:scale-[.98]"
                >
                  <span className={cn('grid size-10 place-items-center rounded-2xl transition-transform duration-150 group-hover:scale-110', q.tone)}>
                    <q.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-extrabold text-ink">{q.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] font-medium leading-snug text-muted">{q.desc}</p>
                  </div>
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ============ ACTIVITY ============ */}
      <Reveal animation="rise" delay={0.2}>
        <Card className="overflow-hidden">
          <CardHeader
            title="Aktivitas terbaru"
            subtitle="Catatan kehadiran siswa yang baru masuk hari ini"
            icon={Activity}
          />
          <div className="mt-3 border-t border-line/70">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
              </div>
            ) : (d.aktivitas || []).length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Belum ada absensi hari ini"
                description="Catatan absensi yang masuk hari ini akan langsung tampil di sini."
              />
            ) : (
              <motion.ul
                className="divide-y divide-line/70"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
              >
                {d.aktivitas.map((item, i) => (
                  <motion.li
                    key={i}
                    variants={{
                      hidden: { opacity: 0, x: -12 },
                      show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
                    }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken/35"
                  >
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
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
