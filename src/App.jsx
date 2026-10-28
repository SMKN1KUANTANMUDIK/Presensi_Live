import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';

import { AuthProvider, homeForRole, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { PWAProvider, usePWA } from './lib/pwa';

import AppShell from './components/AppShell';
import InstallSheet from './components/InstallSheet';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InputAbsensi from './pages/InputAbsensi';
import Piket from './pages/Piket';
import Riwayat from './pages/Riwayat';
import Guru from './pages/Guru';
import Siswa from './pages/Siswa';
import Kepsek from './pages/Kepsek';
import Report from './pages/Report';
import OrangTua from './pages/OrangTua';
import Install from './pages/Install';

/* ---------------- guard ---------------- */
function Guard({ roles, children }) {
  const { user, role } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(role)) return <Navigate to={homeForRole(user)} replace />;
  return children;
}

function Landing() {
  const { user } = useAuth();
  return <Navigate to={user ? homeForRole(user) : '/login'} replace />;
}

/* ---------------- update bar ---------------- */
function UpdateBar() {
  const { updateReady, applyUpdate } = usePWA();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (updateReady) setHidden(false);
  }, [updateReady]);

  if (!updateReady || hidden) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[130] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-float">
      <RefreshCw className="size-4 shrink-0 text-brand" />
      <p className="flex-1 text-[12.5px] font-semibold text-ink">Versi baru tersedia.</p>
      <button
        type="button"
        onClick={applyUpdate}
        className="rounded-lg bg-brand px-2.5 py-1 text-[11.5px] font-extrabold text-white"
      >
        Muat ulang
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Tutup"
        className="grid size-7 place-items-center rounded-lg text-muted hover:bg-sunken"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ---------------- layout wrapper ---------------- */
function Shell({ children, onOpenInstall }) {
  return (
    <AppShell onOpenInstall={onOpenInstall}>
      {children}
    </AppShell>
  );
}

function AppRoutes() {
  const [installOpen, setInstallOpen] = useState(false);
  const openInstall = () => setInstallOpen(true);

  return (
    <>
      <UpdateBar />

      <Routes>
        <Route path="/login" element={<Login onOpenInstall={openInstall} />} />
        <Route path="/install" element={<Install onOpenInstall={openInstall} />} />

        <Route path="/" element={<Landing />} />

        <Route
          path="/dashboard"
          element={
            <Guard roles={['admin']}>
              <Shell onOpenInstall={openInstall}>
                <Dashboard />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/input"
          element={
            <Guard roles={['guru', 'wali', 'admin']}>
              <Shell onOpenInstall={openInstall}>
                <InputAbsensi />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/piket"
          element={
            <Guard roles={['piket', 'admin']}>
              <Shell onOpenInstall={openInstall}>
                <Piket />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/guru"
          element={
            <Guard roles={['admin']}>
              <Shell onOpenInstall={openInstall}>
                <Guru />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/siswa"
          element={
            <Guard roles={['admin']}>
              <Shell onOpenInstall={openInstall}>
                <Siswa />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/riwayat"
          element={
            <Guard roles={['admin']}>
              <Shell onOpenInstall={openInstall}>
                <Riwayat />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/kepsek"
          element={
            <Guard roles={['kepsek']}>
              <Shell onOpenInstall={openInstall}>
                <Kepsek />
              </Shell>
            </Guard>
          }
        />
        <Route
          path="/report"
          element={
            <Guard roles={['guru', 'wali', 'admin']}>
              <Shell onOpenInstall={openInstall}>
                <Report />
              </Shell>
            </Guard>
          }
        />
        <Route path="/orangtua" element={
          <Guard roles={['guru', 'wali', 'admin']}>
            <Shell onOpenInstall={openInstall}>
              <OrangTua />
            </Shell>
          </Guard>
        } />

        <Route path="*" element={<Landing />} />
      </Routes>

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PWAProvider>
          <AuthProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </AuthProvider>
        </PWAProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
