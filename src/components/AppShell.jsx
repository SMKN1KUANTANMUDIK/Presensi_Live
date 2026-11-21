import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  WifiOff,
} from 'lucide-react';
import { useAuth, displayName, roleLabel } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useToast } from '../lib/toast';
import { cn, initials } from '../lib/utils';
import { Sheet } from './ui';
import HelpSheet from './HelpSheet';

const ICONS = {
  dashboard: LayoutDashboard,
  input: ClipboardList,
  report: BarChart3,
  piket: ShieldCheck,
  kepsek: GraduationCap,
  riwayat: History,
  guru: UserCog,
  siswa: Users,
  kasus: ShieldAlert,
  orangtua: UserCheck,
};

const NAV = {
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/input', label: 'Input Absensi', icon: 'input' },
    { to: '/siswa', label: 'Data Siswa', icon: 'siswa' },
    { to: '/guru', label: 'Data Guru', icon: 'guru' },
    { to: '/riwayat', label: 'Riwayat', icon: 'riwayat' },
    { to: '/piket', label: 'Piket', icon: 'piket' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/kasus', label: 'Kasus Pembinaan', icon: 'kasus' },
  ],
  kepsek: [
    { to: '/kepsek', label: 'Dashboard', icon: 'kepsek' },
    { to: '/kasus', label: 'Kasus Pembinaan', icon: 'kasus' },
  ],
  piket: [{ to: '/piket', label: 'Dashboard Piket', icon: 'piket' }],
  guru: [
    { to: '/input', label: 'Input Absensi', icon: 'input' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/orangtua', label: 'Monitoring Siswa', icon: 'orangtua' },
  ],
  wali: [
    { to: '/input', label: 'Input Absensi', icon: 'input' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/orangtua', label: 'Monitoring Siswa', icon: 'orangtua' },
    { to: '/kasus', label: 'Kasus Pembinaan', icon: 'kasus' },
  ],
};

const TITLES = {
  '/dashboard': 'Dashboard',
  '/input': 'Input Absensi',
  '/piket': 'Dashboard Piket',
  '/riwayat': 'Riwayat Absensi',
  '/kepsek': 'Dashboard Kepala Sekolah',
  '/report': 'Rekap & Cetak',
  '/guru': 'Data Guru',
  '/siswa': 'Data Siswa',
  '/kasus': 'Kasus Pembinaan',
  '/orangtua': 'Monitoring Siswa',
};

export default function AppShell({ children }) {
  const { user, role, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    const onOff = () => setOffline(true);
    const onOn = () => {
      setOffline(false);
      toast.success('Koneksi internet tersambung kembali.');
    };
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    return () => {
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
    };
  }, [toast]);

  const items = NAV[role] || NAV.guru;
  const mobilePrimary = items.slice(0, 4);
  const title = TITLES[location.pathname] || 'Presensi';

  const userName = displayName(user);
  const userRole = roleLabel(user);

  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const Avatar = useMemo(
    () => (
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-[12px] font-extrabold text-white shadow-sm">
        {initials(userName)}
      </span>
    ),
    [userName]
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ============ SIDEBAR (desktop) ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/85 px-3 py-5 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-2">
          <img
            src="./logo_sekolah.webp"
            alt="Logo SMKN 1 Kuantan Mudik"
            className="size-10 shrink-0 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-line"
          />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-tight tracking-tight text-ink">Presensi Live</p>
            <p className="truncate text-[11px] font-semibold text-muted">SMKN 1 Kuantan Mudik</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-0.5">
          <p className="px-2 pb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted/70">Menu Utama</p>
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold transition-all duration-150 active:scale-[.98]',
                    isActive
                      ? 'bg-gradient-to-r from-brand to-blue-600 text-white shadow-[0_10px_24px_-12px_var(--brand)]'
                      : 'text-muted hover:bg-sunken hover:text-ink'
                  )
                }
              >
                <Icon className="size-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft/60 px-3 py-2.5 text-[13px] font-extrabold text-brand transition hover:bg-brand-soft active:scale-[.98]"
          >
            <HelpCircle className="size-[18px]" />
            Panduan halaman ini
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-bold text-muted transition hover:bg-sunken hover:text-ink"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {dark ? 'Mode terang' : 'Mode gelap'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-sunken/50 px-2.5 py-2.5 text-left transition hover:border-brand/35 hover:bg-sunken active:scale-[.98]"
        >
          {Avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-extrabold text-ink">{userName}</p>
            <p className="truncate text-[11px] font-semibold text-muted">{userRole}</p>
          </div>
        </button>
      </aside>

      {/* ============ TOPBAR (mobile) ============ */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 pt-safe">
          <img
            src="./logo_sekolah.webp"
            alt="Logo"
            className="size-9 shrink-0 rounded-xl bg-white p-0.5 shadow-xs ring-1 ring-line"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-ink">{title}</p>
            <p className="truncate text-[11px] font-semibold text-muted">
              {userName} · {userRole}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Panduan halaman ini"
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-brand/25 bg-brand-soft/70 px-2.5 text-[11.5px] font-extrabold text-brand transition active:scale-95"
          >
            <HelpCircle className="size-4" />
            <span>Bantuan</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Ubah tema"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted transition active:scale-95"
          >
            {dark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
          </button>
        </div>
      </header>

      {/* ============ OFFLINE BANNER ============ */}
      {offline && (
        <div className="lg:pl-64">
          <div className="animate-rise mx-auto max-w-6xl px-3 pt-3 sm:px-5 lg:px-8">
            <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-3.5 py-2.5 text-[12px] font-bold text-amber-800 dark:text-amber-200">
              <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Sedang tidak ada koneksi internet. Sambungkan WiFi atau data seluler untuk menyimpan data.</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ CONTENT ============ */}
      <main className="lg:pl-64">
        <div
          key={location.pathname}
          className="animate-page mx-auto w-full max-w-6xl px-3 pb-nav pt-3 sm:px-5 lg:px-8 lg:pb-10 lg:pt-8"
        >
          {children}
        </div>
      </main>

      {/* ============ BOTTOM NAV (mobile) ============ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe shadow-[0_-8px_24px_-16px_rgba(15,23,42,.22)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-center px-1">
          {mobilePrimary.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-w-0 max-w-[120px] flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold transition-colors active:scale-95',
                    isActive ? 'text-brand' : 'text-muted'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-8 w-11 place-items-center rounded-xl transition-all duration-150',
                        isActive && 'scale-105 bg-brand-soft shadow-xs'
                      )}
                    >
                      <Icon className="size-[19px]" strokeWidth={isActive ? 2.5 : 2} />
                    </span>
                    <span className="max-w-full truncate px-0.5">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="relative flex min-w-0 max-w-[120px] flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold text-muted transition active:scale-95"
          >
            <span className="grid h-8 w-11 place-items-center rounded-xl">
              <MoreHorizontal className="size-[19px]" />
            </span>
            <span className="truncate px-0.5">Menu</span>
          </button>
        </div>
      </nav>

      {/* ============ MENU SHEET ============ */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu & Pengaturan" size="sm">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold transition active:scale-[.98]',
                    isActive ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-sunken'
                  )
                }
              >
                <Icon className="size-[18px]" />
                {item.label}
              </NavLink>
            );
          })}

          <div className="my-2 border-t border-line" />

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setHelpOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft/60 px-3 py-3 text-[14px] font-extrabold text-brand transition hover:bg-brand-soft"
          >
            <HelpCircle className="size-[18px]" />
            Panduan cara pakai
          </button>

          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold text-ink transition hover:bg-sunken"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setAccountOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold text-ink transition hover:bg-sunken"
          >
            <UserRound className="size-[18px]" />
            Akun &amp; Keluar
          </button>
        </div>
      </Sheet>

      {/* ============ HELP & ACCOUNT SHEETS ============ */}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} pathname={location.pathname} />

      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Akun Saya" size="sm">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-sunken/40 p-3.5">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 text-sm font-extrabold text-white shadow-sm">
            {initials(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-extrabold text-ink">{userName}</p>
            <p className="truncate text-[12px] font-semibold text-muted">{userRole}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={doLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3.5 text-[14px] font-extrabold text-rose-600 transition hover:bg-rose-500/15 active:scale-[.98] dark:text-rose-400"
        >
          <LogOut className="size-[18px]" /> Keluar dari akun
        </button>
      </Sheet>
    </div>
  );
}
