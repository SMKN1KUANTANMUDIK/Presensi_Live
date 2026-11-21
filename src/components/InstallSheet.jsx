import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Info,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { Badge, Button, Sheet } from './ui';
import { installGuide, usePWA } from '../lib/pwa';
import { useToast } from '../lib/toast';

function DiagnosticRow({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <span
        className={`text-right text-[12px] font-bold ${
          ok === true ? 'text-emerald-600 dark:text-emerald-400' : ok === false ? 'text-rose-600 dark:text-rose-400' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function InstallSheet({ open, onClose }) {
  const { env, mode, canPrompt, promptInstall, sw } = usePWA();
  const toast = useToast();
  const [showDiag, setShowDiag] = useState(false);
  const guide = installGuide({ mode, env });

  const toneIcon =
    guide.tone === 'warning' ? TriangleAlert : guide.tone === 'success' ? CheckCircle2 : Info;
  const Icon = toneIcon;

  const toneCls =
    guide.tone === 'warning'
      ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
      : guide.tone === 'success'
        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
        : 'bg-brand-soft text-brand';

  const copyUrl = async () => {
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Alamat aplikasi disalin');
    } catch {
      toast.error('Gagal menyalin alamat');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Pasang aplikasi"
      size="md"
      footer={
        canPrompt ? (
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              const result = await promptInstall();
              if (result === 'accepted') {
                toast.success('Aplikasi berhasil dipasang');
                onClose?.();
              }
            }}
          >
            <Download className="size-4" /> Pasang sekarang
          </Button>
        ) : (
          <Button size="lg" variant="outline" className="w-full" onClick={copyUrl}>
            <Copy className="size-4" /> Salin alamat aplikasi
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-sunken/40 p-4">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${toneCls}`}>
            <Icon className="size-5" />
          </span>
          <div>
            <h4 className="text-[14.5px] font-extrabold text-ink">{guide.title}</h4>
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-muted">{guide.intro}</p>
          </div>
        </div>

        <ol className="space-y-3">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-extrabold text-white">
                {i + 1}
              </span>
              <p className="pt-0.5 text-[13px] font-semibold leading-relaxed text-ink">{step}</p>
            </li>
          ))}
        </ol>

        {mode !== 'installed' && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-sunken/40 px-3.5 py-2.5">
            <Smartphone className="size-4 shrink-0 text-muted" />
            <code className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-muted">
              {window.location.origin + window.location.pathname}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold text-brand hover:bg-brand-soft"
            >
              Salin
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setShowDiag((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-[12.5px] font-extrabold text-ink">
              <ShieldAlert className="size-4 text-muted" />
              Diagnostik instalasi
            </span>
            <ChevronDown
              className={`size-4 text-muted transition-transform ${showDiag ? 'rotate-180' : ''}`}
            />
          </button>

          {showDiag && (
            <div className="border-t border-line px-4 pb-2">
              <DiagnosticRow
                label="Alamat"
                value={env.protocol.replace(':', '')}
                ok={env.protocol === 'https:' || env.localhost}
              />
              <DiagnosticRow label="Konteks aman" value={env.secure ? 'ya' : 'tidak'} ok={env.secure} />
              <DiagnosticRow
                label="Service worker"
                value={
                  !sw.supported ? 'tidak didukung' : sw.registered ? `aktif${sw.scope ? ` (${new URL(sw.scope).pathname})` : ''}` : 'gagal/tidak aktif'
                }
                ok={sw.registered}
              />
              <DiagnosticRow label="Mode tampilan" value={env.standalone ? 'standalone' : 'browser'} />
              <DiagnosticRow
                label="Prompt install"
                value={canPrompt ? 'tersedia' : 'tidak tersedia'}
                ok={canPrompt}
              />
              <DiagnosticRow label="Browser" value={`${env.browser} · ${env.platform}`} />
              <DiagnosticRow label="Konteks" value={mode} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {env.secure ? <Badge tone="success">HTTPS aman</Badge> : <Badge tone="danger">Bukan HTTPS</Badge>}
          {sw.registered ? <Badge tone="success">Offline siap</Badge> : <Badge tone="warning">Offline belum aktif</Badge>}
          {env.standalone ? <Badge tone="brand">Mode aplikasi</Badge> : null}
        </div>
      </div>
    </Sheet>
  );
}
