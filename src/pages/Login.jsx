import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { homeForRole, useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Button } from '../components/ui';

export default function Login({ onOpenInstall }) {
  const { login, user } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(homeForRole(user), { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const next = await login(username, password);
      const target = location.state?.from || homeForRole(next);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Gagal masuk. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* -------- panel brand (desktop) -------- */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(120% 90% at 0% 0%, #1d4ed8 0%, transparent 55%), radial-gradient(100% 80% at 100% 100%, #6d28d9 0%, transparent 60%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-wide text-white">SMKN 1 KUANTAN MUDIK</p>
            <p className="text-[11.5px] font-medium text-white/60">Sistem Monitoring Presensi</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-tight text-white">
            Absensi kelas,
            <br />
            <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">
              selesai dalam hitungan detik.
            </span>
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-white/70">
            Catat kehadiran per kelas dan mata pelajaran, pantau realtime, dan cetak rekap — semuanya dari
            satu aplikasi.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: CheckCircle2, text: 'Input kehadiran 5 status dengan sekali ketuk' },
              { icon: ShieldCheck, text: 'Hak akses terpisah: admin, piket, guru, wali kelas' },
              { icon: WifiOff, text: 'Tetap terbuka saat offline — bisa dipasang seperti aplikasi' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[13.5px] font-medium text-white/80">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4 text-sky-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11.5px] font-medium text-white/40">
          © 2026 SMKN 1 Kuantan Mudik · by Waldo Guntala, S.Kom
        </p>
      </div>

      {/* -------- form -------- */}
      <div className="relative flex flex-1 flex-col px-5 pb-8 pt-safe sm:px-8">
        <div className="flex items-center justify-end gap-2 py-3">
          {onOpenInstall && (
            <button
              type="button"
              onClick={onOpenInstall}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[12px] font-bold text-muted transition hover:text-brand"
            >
              <Download className="size-4" /> Pasang
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label="Ubah tema"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted transition active:scale-95"
          >
            {dark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center pb-10">
          <div className="animate-rise">
            <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-left">
              <img
                src="./logo_sekolah.png"
                alt="Logo SMKN 1 Kuantan Mudik"
                className="mb-4 size-20 rounded-3xl bg-white p-2 shadow-[0_18px_40px_-20px_rgba(37,99,235,.65)] ring-1 ring-line"
              />
              <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">
                Selamat datang
              </h2>
              <p className="mt-1 text-[13.5px] font-medium text-muted">
                Masuk untuk mencatat kehadiran siswa
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-500 text-[11px] font-extrabold text-white">
                  !
                </span>
                <p className="text-[12.5px] font-semibold leading-relaxed text-rose-700 dark:text-rose-300">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-ink/80">Username</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-4 text-[14px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-ink/80">Password</span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-12 text-[14px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-sunken"
                  >
                    {showPass ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </span>
              </label>

              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                Masuk
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <p className="mt-5 text-center text-[11.5px] font-medium leading-relaxed text-muted">
              Lupa password? Hubungi administrator sekolah.
            </p>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted/80 lg:hidden">
              © 2026 SMKN 1 Kuantan Mudik
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
