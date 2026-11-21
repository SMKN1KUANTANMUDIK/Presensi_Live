import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';

import { AuthProvider, homeForRole, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { PWAProvider, usePWA } from './lib/pwa';

import AppShell from './components/AppShell';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const InputAbsensi = lazy(() => import('./pages/InputAbsensi'));
const Piket = lazy(() => import('./pages/Piket'));
const Riwayat = lazy(() => import('./pages/Riwayat'));
const Guru = lazy(() => import('./pages/Guru'));
const Siswa = lazy(() => import('./pages/Siswa'));
const Kepsek = lazy(() => import('./pages/Kepsek'));
const Report = lazy(() => import('./pages/Report'));
const OrangTua = lazy(() => import('./pages/OrangTua'));
const PortalOrtu = lazy(() => import('./pages/PortalOrtu'));
const Kasus = lazy(() => import('./pages/Kasus'));

function PageFallback() {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center p-6 text-[13px] font-bold text-muted">
      Memuat halaman…
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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
        className="min-h-9 rounded-lg bg-brand px-3 py-1 text-[11.5px] font-extrabold text-white"
      >
        Muat ulang
      </button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Tutup"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/* ---------------- layout wrapper ---------------- */
function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <UpdateBar />

      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ortu" element={<PortalOrtu />} />

          <Route path="/" element={<Landing />} />

          <Route
            path="/dashboard"
            element={
              <Guard roles={['admin']}>
                <Shell>
                  <Dashboard />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/input"
            element={
              <Guard roles={['guru', 'wali', 'admin']}>
                <Shell>
                  <InputAbsensi />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/piket"
            element={
              <Guard roles={['piket', 'admin']}>
                <Shell>
                  <Piket />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/guru"
            element={
              <Guard roles={['admin']}>
                <Shell>
                  <Guru />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/siswa"
            element={
              <Guard roles={['admin']}>
                <Shell>
                  <Siswa />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/riwayat"
            element={
              <Guard roles={['admin']}>
                <Shell>
                  <Riwayat />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/kepsek"
            element={
              <Guard roles={['kepsek']}>
                <Shell>
                  <Kepsek />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/report"
            element={
              <Guard roles={['guru', 'wali', 'admin']}>
                <Shell>
                  <Report />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/kasus"
            element={
              <Guard roles={['admin', 'kepsek', 'wali']}>
                <Shell>
                  <Kasus />
                </Shell>
              </Guard>
            }
          />
          <Route
            path="/orangtua"
            element={
              <Guard roles={['guru', 'wali', 'admin']}>
                <Shell>
                  <OrangTua />
                </Shell>
              </Guard>
            }
          />

          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
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
