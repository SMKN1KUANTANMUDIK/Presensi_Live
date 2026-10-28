import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  Download,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Moon,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth, displayName, roleLabel } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { usePWA } from '../lib/pwa';
import { cn, initials } from '../lib/utils';
import { Sheet } from './ui';
import InstallPopup from './InstallPopup';

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
  ],
  kepsek: [{ to: '/kepsek', label: 'Dashboard', icon: 'kepsek' }],
  piket: [{ to: '/piket', label: 'Dashboard Piket', icon: 'piket' }],
  guru: [
    { to: '/input', label: 'Input Absensi', icon: 'input' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/orangtua', label: 'Kehadiran Anak', icon: 'orangtua' },
  ],
  wali: [
    { to: '/input', label: 'Input Absensi', icon: 'input' },
    { to: '/report', label: 'Report', icon: 'report' },
    { to: '/orangtua', label: 'Kehadiran Anak', icon: 'orangtua' },
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
  '/orangtua': 'Kehadiran Anak',
  '/install': 'Pasang Aplikasi',
};

export default function AppShell({ children, onOpenInstall }) {
  const { user, role, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { installed } = usePWA();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const items = NAV[role] || NAV.guru;
  const kelasWali = user?.kelas_wali || user?.kelas || '';
  const kasusHref =
    role === 'admin'
      ? 'kasus.html?role=bk'
      : role === 'kepsek'
        ? 'kasus.html?role=kepsek'
        : role === 'wali'
          ? `kasus.html?role=wali_kelas${kelasWali ? `&kelas=${encodeURIComponent(kelasWali)}` : ''}`
          : '';
  const mobilePrimary = items.slice(0, 4);
  const hasMore = items.length > 4;
  const title = TITLES[location.pathname] || 'Presensi';

  const userName = displayName(user);
  const userRole = roleLabel(user);

  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const Avatar = useMemo(
    () => (
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-[12px] font-extrabold text-white">
        {initials(userName)}
      </span>
    ),
    [userName]
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ============ SIDEBAR (desktop) ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/80 px-3 py-5 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 text-white shadow-[0_10px_24px_-12px_var(--brand)]">
            <GraduationCap className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-tight tracking-tight text-ink">Presensi</p>
            <p className="truncate text-[11px] font-semibold text-muted">SMKN 1 Kuantan Mudik</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <p className="px-2 pb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted/70">Menu</p>
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold transition',
                    isActive
                      ? 'bg-brand text-white shadow-[0_10px_24px_-14px_var(--brand)]'
                      : 'text-muted hover:bg-sunken hover:text-ink'
                  )
                }
              >
                <Icon className="size-[18px] shrink-0" />
                {item.label}
              </NavLink>
            );
          })}

          {kasusHref && (
            <a
              href={kasusHref}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold text-muted transition hover:bg-sunken hover:text-ink"
            >
              <ShieldAlert className="size-[18px] shrink-0" />
              Kasus Pembinaan
            </a>
          )}
        </nav>

        <div className="space-y-1 border-t border-line pt-3">
          {!installed && (
            <button
              type="button"
              onClick={onOpenInstall}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-[13px] font-bold text-muted transition hover:border-brand hover:text-brand"
            >
              <Download className="size-[18px]" />
              Pasang aplikasi
            </button>
          )}
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
          className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-sunken/50 px-2.5 py-2.5 text-left transition hover:bg-sunken"
        >
          {Avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-extrabold text-ink">{userName}</p>
            <p className="truncate text-[11px] font-semibold text-muted">{userRole}</p>
          </div>
        </button>
      </aside>

      {/* ============ TOPBAR (mobile) ============ */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 pt-safe">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-white">
            <GraduationCap className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-ink">{title}</p>
            <p className="truncate text-[11px] font-semibold text-muted">
              {userName} · {userRole}
            </p>
          </div>
          {!installed && (
            <button
              type="button"
              onClick={onOpenInstall}
              aria-label="Pasang aplikasi"
              className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted transition active:scale-95"
            >
              <Download className="size-[17px]" />
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
      </header>

      {/* ============ CONTENT ============ */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-3 pb-nav pt-3 sm:px-5 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </div>
      </main>

      {/* ============ BOTTOM NAV (mobile) ============ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-center">
          {mobilePrimary.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-w-[68px] max-w-[124px] flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition',
                    isActive ? 'text-brand' : 'text-muted'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-8 w-12 place-items-center rounded-xl transition',
                        isActive && 'bg-brand-soft'
                      )}
                    >
                      <Icon className="size-[19px]" strokeWidth={isActive ? 2.6 : 2} />
                    </span>
                    <span className="truncate px-1">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="relative flex min-w-[68px] max-w-[124px] flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold text-muted"
          >
            <span className="grid h-8 w-12 place-items-center rounded-xl">
              <MoreHorizontal className="size-[19px]" />
            </span>
            <span>Lainnya</span>
          </button>
        </div>
      </nav>

      {/* ============ MENU SHEET ============ */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" size="sm">
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
                    'flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold transition',
                    isActive ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-sunken'
                  )
                }
              >
                <Icon className="size-[18px]" />
                {item.label}
              </NavLink>
            );
          })}

          {kasusHref && (
            <a
              href={kasusHref}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold text-ink transition hover:bg-sunken"
            >
              <ShieldAlert className="size-[18px]" />
              Kasus Pembinaan
            </a>
          )}

          {!installed && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenInstall?.();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold text-ink transition hover:bg-sunken"
            >
              <Download className="size-[18px]" />
              Pasang aplikasi
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-bold text-ink transition hover:bg-sunken"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {dark ? 'Mode terang' : 'Mode gelap'}
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
            Akun saya
          </button>
        </div>
      </Sheet>

      {/* ============ ACCOUNT SHEET ============ */}
      <InstallPopup onOpenInstall={onOpenInstall} />

      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Akun" size="sm">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-sunken/40 p-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 text-sm font-extrabold text-white">
            {initials(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-extrabold text-ink">{userName}</p>
            <p className="truncate text-[12px] font-semibold text-muted">{userRole}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={doLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-[14px] font-extrabold text-rose-600 transition hover:bg-rose-500/15 dark:text-rose-400"
        >
          <LogOut className="size-[18px]" /> Keluar dari akun
        </button>
      </Sheet>
    </div>
  );
}
