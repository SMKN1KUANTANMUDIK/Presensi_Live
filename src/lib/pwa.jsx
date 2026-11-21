import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PWAContext = createContext(null);

const DISMISS_KEY = 'presensi-install-dismissed';
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'edge';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/OculusBrowser/.test(ua)) return 'oculus';
  if (/FxiOS|Firefox/.test(ua)) return 'firefox';
  if (/CriOS|Chrome/.test(ua)) return 'chrome';
  if (/Safari/.test(ua)) return 'safari';
  return 'other';
}

function detectPlatform(ua) {
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux/.test(ua)) return 'desktop';
  return 'unknown';
}

const IN_APP = ['FBAN', 'FBAV', 'Instagram', 'Line/', 'WhatsApp', 'MicroMessenger', 'Snapchat', 'TikTok', 'musical_ly', '; wv)', 'Twitter'];

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_TTL;
  } catch {
    return false;
  }
}

export function PWAProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [sw, setSw] = useState({ supported: 'serviceWorker' in navigator, registered: false, scope: '', state: 'idle' });
  const [updateReady, setUpdateReady] = useState(false);
  const regRef = useRef(null);

  const env = useMemo(() => {
    const ua = navigator.userAgent || '';
    return {
      protocol: window.location.protocol,
      secure: window.isSecureContext,
      standalone: installed,
      platform: detectPlatform(ua),
      browser: detectBrowser(ua),
      inApp: IN_APP.some((t) => ua.includes(t)),
      swSupported: 'serviceWorker' in navigator,
      localhost: /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname),
    };
  }, [installed]);

  const mode = useMemo(() => {
    if (installed) return 'installed';
    if (env.protocol === 'file:') return 'file';
    if (!env.secure) return 'insecure';
    if (env.inApp) return 'inapp';
    if (deferred) return 'ready';
    return 'manual';
  }, [installed, env, deferred]);

  /* ---------- service worker ---------- */
  useEffect(() => {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;

    let cancelled = false;

    const register = async () => {
      try {
        const swUrl = new URL('sw.js', document.baseURI).href;
        const reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
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

        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      } catch (err) {
        if (!cancelled) {
          setSw({ supported: true, registered: false, scope: '', state: 'error', error: err?.message || String(err) });
        }
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- install prompt ---------- */
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMode = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    mq.addEventListener?.('change', onMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener?.('change', onMode);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (installed) return 'installed';
    if (!deferred) return 'unavailable';
    const evt = deferred;
    setDeferred(null);
    evt.prompt();
    const choice = await evt.userChoice;
    return choice?.outcome || 'dismissed';
  }, [deferred, installed]);

  const dismissBanner = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const applyUpdate = useCallback(() => {
    regRef.current?.waiting?.postMessage('SKIP_WAITING');
    setTimeout(() => window.location.reload(), 400);
  }, []);

  const showBanner = mode === 'ready' && !dismissed && !installed;

  const value = useMemo(
    () => ({
      env,
      mode,
      installed,
      canPrompt: Boolean(deferred),
      showBanner,
      promptInstall,
      dismissBanner,
      sw,
      updateReady,
      applyUpdate,
    }),
    [env, mode, installed, deferred, showBanner, promptInstall, dismissBanner, sw, updateReady, applyUpdate]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA harus dipakai di dalam PWAProvider');
  return ctx;
}

/* ---------------------------------------------------------
   Panduan install per kondisi
--------------------------------------------------------- */
export function installGuide({ mode, env }) {
  const appUrl = window.location.origin + window.location.pathname;

  if (mode === 'installed') {
    return {
      tone: 'success',
      title: 'Aplikasi sudah terpasang',
      intro: 'Anda sedang membuka Presensi dalam mode aplikasi (standalone).',
      steps: ['Ikon Presensi tersedia di layar utama / menu aplikasi perangkat Anda.'],
    };
  }

  if (mode === 'file') {
    return {
      tone: 'warning',
      title: 'Halaman dibuka sebagai file',
      intro: 'Alamat saat ini dimulai dengan file:// — browser memblokir pemasangan aplikasi dari file lokal.',
      steps: [
        'Jalankan server lokal di folder aplikasi: npm run serve (atau npm run dev).',
        'Buka http://localhost:8080 di Chrome/Edge.',
        'Klik tombol Pasang yang muncul di bilah alamat atau di aplikasi.',
        'Untuk dipakai di HP, unggah hasil build (folder dist) ke hosting HTTPS.',
      ],
    };
  }

  if (mode === 'insecure') {
    return {
      tone: 'warning',
      title: 'Koneksi belum HTTPS',
      intro: `Alamat ${window.location.host} belum memakai HTTPS, sehingga browser tidak mengizinkan pemasangan aplikasi.`,
      steps: [
        'Unggah folder dist ke hosting HTTPS gratis: Netlify, Vercel, Cloudflare Pages, atau GitHub Pages.',
        'Atau gunakan terowongan HTTPS seperti Cloudflare Tunnel untuk uji di HP.',
        'Buka alamat HTTPS tersebut, lalu klik Pasang.',
      ],
    };
  }

  if (mode === 'inapp') {
    return {
      tone: 'warning',
      title: 'Buka di browser asli',
      intro: 'Halaman ini dibuka dari dalam aplikasi lain (WhatsApp, Instagram, Facebook, dsb). Browser bawaan aplikasi tidak bisa memasang PWA.',
      steps: [
        'Ketuk menu ⋮ di pojok kanan atas.',
        'Pilih “Buka di browser” / “Open in Chrome”.',
        'Setelah terbuka di Chrome, klik Pasang.',
      ],
    };
  }

  if (env.platform === 'ios') {
    return {
      tone: 'info',
      title: 'Pasang di iPhone / iPad',
      intro: 'Safari tidak menampilkan tombol install otomatis. Gunakan menu Bagikan.',
      steps: [
        'Pastikan halaman dibuka di Safari (bukan Chrome atau browser dalam aplikasi).',
        'Ketuk tombol Bagikan (kotak dengan panah ke atas).',
        'Pilih “Tambah ke Layar Utama”.',
        'Ketuk “Tambah”.',
      ],
    };
  }

  if (env.browser === 'firefox') {
    return {
      tone: 'info',
      title: 'Gunakan Chrome atau Edge',
      intro: 'Firefox belum mendukung pemasangan aplikasi web (PWA) di desktop.',
      steps: [
        'Buka alamat ini di Chrome atau Microsoft Edge.',
        'Klik ikon install di bilah alamat, atau menu ⋮ → Install.',
        'Klik Install pada dialog yang muncul.',
      ],
    };
  }

  const desktop = env.platform === 'desktop';
  return {
    tone: 'info',
    title: 'Pasang aplikasi Presensi',
    intro: 'Aplikasi bisa dipasang seperti aplikasi biasa — tanpa Play Store, langsung dari browser.',
    steps: desktop
      ? [
          'Klik ikon install (monitor dengan panah) di ujung kanan bilah alamat.',
          'Atau menu ⋮ → Simpan dan bagikan → Install halaman sebagai aplikasi.',
          'Klik Install pada dialog yang muncul.',
        ]
      : [
          'Ketuk menu ⋮ di pojok kanan atas Chrome.',
          'Pilih “Install aplikasi” atau “Tambahkan ke layar utama”.',
          'Ketuk Install / Tambah.',
        ],
    url: appUrl,
  };
}
