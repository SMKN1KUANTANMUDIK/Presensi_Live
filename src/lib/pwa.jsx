import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PWAContext = createContext(null);

/**
 * PWAProvider — hanya mendaftarkan Service Worker dan mendeteksi update versi baru.
 * Pemasangan aplikasi ke perangkat diserahkan sepenuhnya ke menu/prompt bawaan browser.
 */
export function PWAProvider({ children }) {
  const [sw, setSw] = useState({
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    registered: false,
    scope: '',
    state: 'idle',
  });
  const [updateReady, setUpdateReady] = useState(false);
  const regRef = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return undefined;

    let cancelled = false;
    let intervalId = null;
    let onVisibility = null;

    const register = async () => {
      try {
        const swUrl = new URL('sw.js', document.baseURI).href;
        const reg = await navigator.serviceWorker.register(swUrl, {
          scope: './',
          updateViaCache: 'none',
        });
        if (cancelled) return;
        regRef.current = reg;
        setSw({ supported: true, registered: true, scope: reg.scope, state: 'active' });

        const watch = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        };

        watch(reg.installing);
        reg.addEventListener('updatefound', () => watch(reg.installing));
        if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);

        intervalId = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        onVisibility = () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisibility);
      } catch (err) {
        if (!cancelled) {
          setSw({
            supported: true,
            registered: false,
            scope: '',
            state: 'error',
            error: err?.message || String(err),
          });
        }
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = regRef.current?.waiting;
    if (!waiting) {
      if (typeof window.__presensiHardReload === 'function') window.__presensiHardReload();
      else window.location.reload();
      return;
    }
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', reloadOnce, { once: true });
    waiting.postMessage('SKIP_WAITING');
    setTimeout(reloadOnce, 1200);
  }, []);

  const value = useMemo(
    () => ({
      sw,
      updateReady,
      applyUpdate,
    }),
    [sw, updateReady, applyUpdate]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA harus dipakai di dalam PWAProvider');
  return ctx;
}
