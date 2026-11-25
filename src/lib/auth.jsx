import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { invalidateClientCache, setTokenGetter, setUnauthorizedHandler } from './api';
import { useToast } from './toast';

const AuthContext = createContext(null);

/** Batas waktu tidak aktif sebelum otomatis harus login ulang (30 menit) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;

const KEYS = {
  login: 'isLogin',
  user: 'user',
  userData: 'userData',
  token: 'authToken',
  lastActive: 'authLastActive',
};

function readUser() {
  try {
    const raw = localStorage.getItem(KEYS.userData) || localStorage.getItem(KEYS.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readToken() {
  try {
    return localStorage.getItem(KEYS.token) || '';
  } catch {
    return '';
  }
}

function readLastActive() {
  try {
    return Number(localStorage.getItem(KEYS.lastActive) || 0);
  } catch {
    return 0;
  }
}

function writeLastActive(ts = Date.now()) {
  try {
    localStorage.setItem(KEYS.lastActive, String(ts));
  } catch {
    /* abaikan */
  }
}

function removeStoredAuth() {
  try {
    localStorage.removeItem(KEYS.login);
    localStorage.removeItem(KEYS.user);
    localStorage.removeItem(KEYS.userData);
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.lastActive);
  } catch {
    /* abaikan */
  }
}

function loadInitialSession() {
  try {
    if (!localStorage.getItem(KEYS.login)) {
      return { user: null, token: '', expiredOnBoot: false };
    }
    const u = readUser();
    if (!u) {
      removeStoredAuth();
      return { user: null, token: '', expiredOnBoot: false };
    }
    const last = readLastActive();
    // Jika sesi lama belum punya cap waktu atau sudah melewati batas tidak aktif → wajib login ulang
    if (!last || Date.now() - last >= IDLE_TIMEOUT_MS) {
      const oldToken = readToken();
      removeStoredAuth();
      return { user: null, token: '', expiredOnBoot: true, oldToken };
    }
    return { user: u, token: readToken(), expiredOnBoot: false };
  } catch {
    return { user: null, token: '', expiredOnBoot: false };
  }
}

export function normalizeRole(user) {
  return String(user?.role || '').trim().toLowerCase();
}

export function displayName(user) {
  if (!user) return 'Pengguna';
  return user.nama || user.nama_guru || user.username || 'Pengguna';
}

export function roleLabel(user) {
  const role = normalizeRole(user);
  return (
    {
      admin: 'Administrator',
      kepsek: 'Kepala Sekolah',
      piket: 'Petugas Piket',
      guru: 'Guru Mata Pelajaran',
      wali: 'Wali Kelas',
    }[role] ||
    user?.role ||
    'Pengguna'
  );
}

/** Halaman awal sesuai role */
export function homeForRole(user) {
  const role = normalizeRole(user);
  if (role === 'kepsek') return '/kepsek';
  if (role === 'piket') return '/piket';
  if (role === 'guru' || role === 'wali') return '/input';
  if (role === 'admin') return '/dashboard';
  return '/login';
}

export function AuthProvider({ children }) {
  const toast = useToast();
  const bootRef = useRef(null);
  if (!bootRef.current) {
    bootRef.current = loadInitialSession();
  }

  const [user, setUser] = useState(() => bootRef.current.user);
  const tokenRef = useRef(bootRef.current.token);
  const lastWriteRef = useRef(0);

  const clearLocalAuth = useCallback(() => {
    tokenRef.current = '';
    removeStoredAuth();
    invalidateClientCache();
    setUser(null);
  }, []);

  const expireByInactivity = useCallback(() => {
    const prevToken = tokenRef.current || readToken();
    if (prevToken) {
      api.logout(prevToken);
    }
    clearLocalAuth();
    toast.warning('Sesi otomatis keluar karena tidak aktif selama 30 menit. Silakan masuk kembali.');
  }, [clearLocalAuth, toast]);

  // Beri info jika sesi lama kedaluwarsa saat aplikasi baru dibuka kembali
  useEffect(() => {
    if (bootRef.current?.expiredOnBoot) {
      const oldTok = bootRef.current.oldToken;
      bootRef.current.expiredOnBoot = false;
      bootRef.current.oldToken = '';
      if (oldTok) {
        api.logout(oldTok);
      }
      toast.info('Sesi sebelumnya telah berakhir karena tidak aktif. Silakan masuk kembali.');
    }
  }, [toast]);

  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
    setUnauthorizedHandler((msg) => {
      if (!tokenRef.current && !localStorage.getItem(KEYS.login)) return;
      clearLocalAuth();
      toast.warning(msg || 'Sesi berakhir. Silakan masuk kembali.');
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearLocalAuth, toast]);

  // Pantau aktivitas pengguna & auto-logout saat tidak aktif (termasuk saat kembali dari background HP)
  useEffect(() => {
    if (!user) return undefined;

    const checkExpired = () => {
      const last = readLastActive();
      if (!last || Date.now() - last >= IDLE_TIMEOUT_MS) {
        expireByInactivity();
        return true;
      }
      return false;
    };

    const recordActivity = () => {
      // Cek kedaluwarsa TERLEBIH DAHULU sebelum memperbarui waktu aktif!
      if (checkExpired()) return;
      const now = Date.now();
      if (now - lastWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeLastActive(now);
      }
    };

    const onVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!checkExpired()) {
        const now = Date.now();
        lastWriteRef.current = now;
        writeLastActive(now);
      }
    };

    const onStorage = (e) => {
      if (e.key === KEYS.login && !e.newValue) {
        tokenRef.current = '';
        invalidateClientCache();
        setUser(null);
      }
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('pageshow', onVisibilityOrFocus);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    const timer = setInterval(checkExpired, IDLE_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('pageshow', onVisibilityOrFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      clearInterval(timer);
    };
  }, [user, expireByInactivity]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(String(username || '').trim(), String(password || ''));
    if (!res || !res.success) {
      throw new Error(res?.error || res?.message || 'Username atau password salah.');
    }
    const payload = res.user || res.data || res;
    const nextUser = {
      ...payload,
      username: payload.username || username,
      nama: payload.nama || payload.nama_guru || payload.username || username,
    };
    const nextToken = String(res.token || payload.token || '');
    const now = Date.now();
    tokenRef.current = nextToken;
    lastWriteRef.current = now;
    localStorage.setItem(KEYS.login, '1');
    localStorage.setItem(KEYS.user, JSON.stringify(nextUser));
    localStorage.setItem(KEYS.userData, JSON.stringify(nextUser));
    writeLastActive(now);
    if (nextToken) localStorage.setItem(KEYS.token, nextToken);
    else localStorage.removeItem(KEYS.token);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    if (tokenRef.current) {
      api.logout();
    }
    clearLocalAuth();
  }, [clearLocalAuth]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      role: normalizeRole(user),
      name: displayName(user),
      roleText: roleLabel(user),
      login,
      logout,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
