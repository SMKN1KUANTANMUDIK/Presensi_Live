import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { invalidateClientCache, setTokenGetter, setUnauthorizedHandler } from './api';
import { useToast } from './toast';

const AuthContext = createContext(null);

const KEYS = {
  login: 'isLogin',
  user: 'user',
  userData: 'userData',
  token: 'authToken',
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
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem(KEYS.login) ? readUser() : null;
    } catch {
      return null;
    }
  });
  const tokenRef = useRef(readToken());

  const clearLocalAuth = useCallback(() => {
    tokenRef.current = '';
    localStorage.removeItem(KEYS.login);
    localStorage.removeItem(KEYS.user);
    localStorage.removeItem(KEYS.userData);
    localStorage.removeItem(KEYS.token);
    invalidateClientCache();
    setUser(null);
  }, []);

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
    tokenRef.current = nextToken;
    localStorage.setItem(KEYS.login, '1');
    localStorage.setItem(KEYS.user, JSON.stringify(nextUser));
    localStorage.setItem(KEYS.userData, JSON.stringify(nextUser));
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
