import { useEffect, useState } from 'react';
import { Download, Smartphone, Sparkles, WifiOff } from 'lucide-react';
import { usePWA } from '../lib/pwa';
import { Button, Sheet } from './ui';

const KEY = 'presensi-install-popup-v1';

/**
 * Pop-up ajakan memasang aplikasi.
 * - Hanya muncul di ponsel (mobile), sekali saja.
 * - Tidak pernah muncul lagi bila aplikasi sudah terpasang.
 * - Pengguna bisa menutup permanen; akses manual tetap ada di menu "Pasang aplikasi".
 */
export default function InstallPopup({ onOpenInstall }) {
  const { installed, mode, canPrompt, promptInstall } = usePWA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (installed || mode === 'installed') return undefined;
    if (mode === 'file' || mode === 'insecure') return undefined;
    if (!window.matchMedia('(max-width: 1023px)').matches) return undefined;
    try {
      if (localStorage.getItem(KEY)) return undefined;
    } catch {
      return undefined;
    }
    const timer = setTimeout(() => setOpen(true), 2600);
    return () => clearTimeout(timer);
  }, [installed, mode]);

  const remember = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    remember();
    setOpen(false);
  };

  const install = async () => {
    if (!canPrompt) {
      setOpen(false);
      onOpenInstall?.();
      return;
    }
    setBusy(true);
    try {
      const res = await promptInstall();
      if (res !== 'dismissed') remember();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (installed) return null;

  return (
    <Sheet open={open} onClose={close} title="Pasang Presensi" size="sm">
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <img src="./icons/icon-192.png" alt="" className="size-16 rounded-3xl shadow-lg" />
            <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-brand text-white">
              <Download className="size-3.5" />
            </span>
          </div>
          <h3 className="mt-3 text-[17px] font-extrabold tracking-tight text-ink">Pasang di layar utama</h3>
          <p className="mt-1 max-w-[280px] text-[12.5px] font-medium leading-relaxed text-muted">
            Buka Presensi seperti aplikasi biasa — tanpa mengetik alamat, tetap ringan, dan bisa dibuka
            walau sinyal lemah.
          </p>
        </div>

        <ul className="space-y-2">
          {[
            { icon: Smartphone, text: 'Ikon di layar utama, sekali ketuk langsung terbuka' },
            { icon: Sparkles, text: 'Tampilan penuh tanpa bilah browser' },
            { icon: WifiOff, text: 'Halaman terakhir tetap bisa dibuka saat offline' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 rounded-xl bg-sunken/60 px-3 py-2">
              <Icon className="size-4 shrink-0 text-brand" />
              <span className="text-[12px] font-semibold text-ink">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button size="lg" loading={busy} onClick={install}>
            <Download className="size-4" /> {canPrompt ? 'Pasang sekarang' : 'Lihat cara pasang'}
          </Button>
          <button
            type="button"
            onClick={close}
            className="w-full rounded-xl py-2 text-[12.5px] font-bold text-muted transition hover:text-ink"
          >
            Nanti saja
          </button>
        </div>


      </div>
    </Sheet>
  );
}
