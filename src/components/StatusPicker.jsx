import { useRef } from 'react';
import { AlertTriangle, CheckCircle2, FileText, LogOut, Thermometer } from 'lucide-react';
import { cn, STATUS, TONE } from '../lib/utils';

const ICONS = {
  H: CheckCircle2,
  S: Thermometer,
  I: FileText,
  A: AlertTriangle,
  C: LogOut,
};

/**
 * StatusPicker — pemilih kehadiran 5 status.
 * Dipakai di kartu siswa (mobile) dan tabel (desktop).
 */
export default function StatusPicker({
  value = 'H',
  onChange,
  size = 'md',
  label,
  className,
}) {
  const groupRef = useRef(null);

  const onKeyDown = (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = STATUS.findIndex((s) => s.key === value);
    let next = idx;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx + STATUS.length - 1) % STATUS.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % STATUS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = STATUS.length - 1;
    onChange?.(STATUS[next].key);
    groupRef.current?.querySelectorAll('button')[next]?.focus();
  };

  const sm = size === 'sm';

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label || 'Status kehadiran'}
      onKeyDown={onKeyDown}
      className={cn(
        'grid grid-cols-5 gap-1 rounded-2xl bg-sunken/80 p-1',
        sm && 'gap-0.5 rounded-xl p-0.5',
        className
      )}
    >
      {STATUS.map((s) => {
        const Icon = ICONS[s.key];
        const tone = TONE[s.tone];
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.label}
            title={s.label}
            onClick={() => onChange?.(s.key)}
            className={cn(
              'group relative flex flex-col items-center justify-center gap-0.5 rounded-xl font-extrabold transition-all duration-150',
              'active:scale-[.96]',
              sm ? 'h-8 text-[10.5px]' : 'h-12 text-[11px]',
              active
                ? cn(tone.soft, tone.text, 'ring-1 shadow-sm', tone.ring)
                : 'text-muted hover:bg-surface hover:text-ink'
            )}
          >
            <Icon
              className={cn(
                'transition-transform duration-150',
                sm ? 'size-3.5' : 'size-[17px]',
                active && 'scale-110'
              )}
              strokeWidth={active ? 2.6 : 2.1}
            />
            <span className={cn('leading-none', active && 'font-extrabold')}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
