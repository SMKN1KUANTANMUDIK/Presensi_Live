import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    ring: 'ring-emerald-500/30',
    iconCls: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    ring: 'ring-rose-500/30',
    iconCls: 'text-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'ring-amber-500/30',
    iconCls: 'text-amber-500',
  },
  info: {
    icon: Info,
    ring: 'ring-sky-500/30',
    iconCls: 'text-sky-500',
  },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, variant = 'info', duration = 3800) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-3), { id, message, variant }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast,
      success: (m, d) => toast(m, 'success', d),
      error: (m, d) => toast(m, 'error', d),
      info: (m, d) => toast(m, 'info', d),
      warning: (m, d) => toast(m, 'warning', d),
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-end sm:px-6 lg:bottom-6">
        {items.map((t) => {
          const v = VARIANTS[t.variant] || VARIANTS.info;
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-float ring-1 backdrop-blur ${v.ring}`}
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${v.iconCls}`} />
              <p className="flex-1 text-[13.5px] font-semibold leading-snug text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-mr-1 -mt-1 rounded-lg p-1 text-muted transition hover:bg-sunken hover:text-ink"
                aria-label="Tutup notifikasi"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return ctx;
}
