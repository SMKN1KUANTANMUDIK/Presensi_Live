import { useEffect } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

/* ---------------------------------------------------------
   Card
--------------------------------------------------------- */
export function Card({ as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={cn(
        'rounded-3xl border border-line bg-surface shadow-card',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs font-medium text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------
   Button
--------------------------------------------------------- */
const BTN_VARIANTS = {
  primary:
    'bg-brand text-white shadow-[0_10px_24px_-12px_var(--brand)] hover:brightness-110 active:brightness-95',
  soft: 'bg-brand-soft text-brand hover:bg-brand/15',
  outline: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  light: 'bg-white text-brand hover:bg-white/90 shadow-lg',
};

const BTN_SIZES = {
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-2xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-2xl px-5 text-[15px]',
  icon: 'size-10 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-bold transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   Form controls
--------------------------------------------------------- */
export function Field({ label, hint, children, className, htmlFor }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[12.5px] font-bold text-ink/80">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="text-[11.5px] font-medium text-muted">{hint}</p> : null}
    </div>
  );
}

export const controlCls =
  'w-full rounded-xl border border-line bg-sunken/50 px-3.5 text-sm font-semibold text-ink outline-none transition ' +
  'placeholder:font-medium placeholder:text-muted/80 ' +
  'focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10 disabled:opacity-60';

export function Input({ className, ...rest }) {
  return <input {...rest} className={cn(controlCls, 'h-11', className)} />;
}

export function Select({ className, containerClassName, children, ...rest }) {
  return (
    <div className={cn('relative w-full', containerClassName)}>
      <select {...rest} className={cn(controlCls, 'h-11 appearance-none pr-9', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/* ---------------------------------------------------------
   Badge
--------------------------------------------------------- */
export function Badge({ tone = 'neutral', className, children }) {
  const tones = {
    neutral: 'bg-sunken text-muted',
    brand: 'bg-brand-soft text-brand',
    success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
    info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold leading-none',
        tones[tone] || tones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------
   States
--------------------------------------------------------- */
export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

export function Spinner({ className }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon ? (
        <span className="mb-4 grid size-14 place-items-center rounded-3xl bg-sunken text-muted">
          <Icon className="size-7" />
        </span>
      ) : null}
      <p className="text-sm font-extrabold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------
   Sheet / Modal (bottom sheet di HP, dialog di desktop)
--------------------------------------------------------- */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'animate-rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-float',
          'sm:max-h-[88dvh] sm:rounded-3xl',
          widths[size]
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="text-base font-extrabold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-sunken hover:text-ink"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line bg-surface px-5 py-3 pb-safe">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Stat tile
--------------------------------------------------------- */
export function Stat({ icon: Icon, label, value, hint, tone = 'brand', className }) {
  const tones = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
    danger: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
    info: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  };

  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', tones[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase leading-tight tracking-wide text-muted">{label}</p>
          <p className="mt-1 text-[22px] font-extrabold leading-none tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-muted">{hint}</p> : null}
        </div>
      </div>
    </Card>
  );
}
