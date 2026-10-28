import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  Info,
  MonitorSmartphone,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { installGuide, usePWA } from '../lib/pwa';
import { useToast } from '../lib/toast';
import { Badge, Button, Card } from '../components/ui';

export default function Install() {
  const { env, mode, canPrompt, promptInstall, sw } = usePWA();
  const toast = useToast();
  const guide = installGuide({ mode, env });

  const rows = [
    {
      label: 'Alamat halaman',
      value:
        env.protocol === 'https:' ? 'HTTPS' : env.localhost ? 'HTTP (localhost)' : env.protocol.replace(':', '').toUpperCase(),
      ok: env.protocol === 'https:' || env.localhost,
    },
    { label: 'Konteks aman (secure)', value: env.secure ? 'Ya' : 'Tidak', ok: env.secure },
    { label: 'Service worker', value: sw.registered ? 'Aktif' : sw.supported ? 'Tidak aktif' : 'Tidak didukung', ok: sw.registered },
    { label: 'Mode tampilan', value: env.standalone ? 'Standalone' : 'Browser' },
    { label: 'Prompt instalasi', value: canPrompt ? 'Tersedia' : 'Tidak tersedia', ok: canPrompt },
    { label: 'Browser terdeteksi', value: `${env.browser} · ${env.platform}` },
    { label: 'Kondisi', value: mode },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      toast.success('Alamat disalin');
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6 pb-safe">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      <Card className="animate-rise overflow-hidden">
        <div className="bg-gradient-to-br from-brand to-violet-600 px-5 py-6 text-white">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
            <Download className="size-6" />
          </span>
          <h1 className="mt-3 text-[22px] font-extrabold leading-tight tracking-tight">Pasang Presensi</h1>
          <p className="mt-1 text-[13px] font-medium text-white/80">
            Seperti aplikasi biasa — tanpa Play Store, bisa dibuka offline.
          </p>
          {canPrompt && (
            <Button
              variant="light"
              className="mt-4"
              size="md"
              onClick={async () => {
                const r = await promptInstall();
                if (r === 'accepted') toast.success('Aplikasi berhasil dipasang');
              }}
            >
              <Download className="size-4" /> Pasang sekarang
            </Button>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              {guide.tone === 'warning' ? <TriangleAlert className="size-[18px]" /> : <Info className="size-[18px]" />}
            </span>
            <div>
              <h2 className="text-[14.5px] font-extrabold text-ink">{guide.title}</h2>
              <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-muted">{guide.intro}</p>
            </div>
          </div>

          <ol className="mt-4 space-y-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-extrabold text-white">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-[13px] font-semibold leading-relaxed text-ink">{step}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-sunken/40 px-3.5 py-2.5">
            <code className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-muted">
              {window.location.origin + window.location.pathname}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold text-brand hover:bg-brand-soft"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* diagnostics */}
      <Card className="animate-rise mt-3 p-4">
        <h2 className="flex items-center gap-2 text-[13.5px] font-extrabold text-ink">
          <ShieldCheck className="size-4 text-muted" /> Diagnostik instalasi
        </h2>
        <div className="mt-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 border-b border-line/70 py-2 last:border-0">
              <span className="text-[12px] font-semibold text-muted">{r.label}</span>
              <span
                className={`text-right text-[12px] font-bold ${
                  r.ok === true
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : r.ok === false
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-ink'
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={env.secure ? 'success' : 'danger'}>
            {env.secure ? <CheckCircle2 className="size-3" /> : <TriangleAlert className="size-3" />}
            {env.secure ? 'HTTPS aman' : 'Belum HTTPS'}
          </Badge>
          <Badge tone={sw.registered ? 'success' : 'warning'}>
            <WifiOff className="size-3" /> {sw.registered ? 'Offline siap' : 'Offline belum aktif'}
          </Badge>
          <Badge tone="brand">
            <MonitorSmartphone className="size-3" /> {env.standalone ? 'Mode aplikasi' : 'Mode browser'}
          </Badge>
          {env.standalone && (
            <Badge tone="success">
              <BadgeCheck className="size-3" /> Terpasang
            </Badge>
          )}
        </div>
      </Card>

      <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-muted">
        Install hanya tersedia lewat <b>HTTPS</b> atau <b>localhost</b>. Ini aturan browser, bukan batasan aplikasi.
      </p>
    </div>
  );
}
