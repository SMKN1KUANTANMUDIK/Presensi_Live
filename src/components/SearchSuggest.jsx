import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';

const BADGE_TONES = {
  neutral: 'bg-sunken text-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
  danger: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
};

function normalizeOption(opt) {
  if (typeof opt === 'string' || typeof opt === 'number') {
    const s = String(opt);
    return {
      value: s,
      label: s,
      sub: '',
      badge: '',
      badgeTone: 'neutral',
      group: '',
      keywords: '',
      disabled: false,
      selected: false,
      raw: opt,
    };
  }
  return {
    value: String(opt?.value ?? opt?.label ?? ''),
    label: String(opt?.label ?? opt?.value ?? ''),
    sub: opt?.sub != null ? String(opt.sub) : '',
    badge: opt?.badge != null ? String(opt.badge) : '',
    badgeTone: opt?.badgeTone || 'neutral',
    group: opt?.group != null ? String(opt.group) : '',
    keywords: opt?.keywords != null ? String(opt.keywords) : '',
    disabled: Boolean(opt?.disabled),
    selected: Boolean(opt?.selected),
    raw: opt?.raw ?? opt,
  };
}

function Highlight({ text, query }) {
  const q = String(query || '').trim();
  const s = String(text || '');
  if (!q) return s;
  const lower = s.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return s;
  return (
    <>
      {s.slice(0, idx)}
      <mark className="rounded bg-brand/15 px-0.5 font-extrabold text-brand">{s.slice(idx, idx + q.length)}</mark>
      {s.slice(idx + q.length)}
    </>
  );
}

const SIZE_CLS = {
  sm: 'h-9 pl-9 pr-8 text-[12px]',
  md: 'h-10 pl-9 pr-8 text-[12.5px]',
  lg: 'h-11 pl-10 pr-9 text-[13.5px]',
};

/**
 * SearchSuggest — Input pencarian dengan daftar rekomendasi data tersedia.
 * Dirender melalui Portal ke document.body sehingga tidak pernah terpotong
 * oleh overflow-hidden pada Card atau Sheet.
 */
export default function SearchSuggest({
  value = '',
  onChange,
  onSelect,
  options = [],
  placeholder = 'Cari data…',
  emptyText = 'Tidak ada data yang cocok',
  hintTitle = 'Rekomendasi tersedia',
  maxItems = 10,
  size = 'md',
  clearOnSelect = false,
  showToggle = false,
  disabled = false,
  className = '',
  inputClassName = '',
  icon: Icon = Search,
  id,
  ariaLabel,
}) {
  const autoId = useId();
  const listId = `${id || autoId}-listbox`;
  const wrapRef = useRef(null);
  const portalRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState(null);

  const normalized = useMemo(() => (options || []).map(normalizeOption), [options]);

  const matched = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) {
      return {
        items: normalized.slice(0, maxItems),
        total: normalized.length,
      };
    }

    const prefix = [];
    const contains = [];
    for (let i = 0; i < normalized.length; i++) {
      const o = normalized[i];
      const lbl = String(o.label || '').toLowerCase();
      const sub = String(o.sub || '').toLowerCase();
      const kw = String(o.keywords || '').toLowerCase();
      const val = String(o.value || '').toLowerCase();

      if (lbl.startsWith(q) || val.startsWith(q)) {
        prefix.push(o);
      } else if (lbl.includes(q) || sub.includes(q) || kw.includes(q) || val.includes(q)) {
        contains.push(o);
      }
    }

    const all = [...prefix, ...contains];
    return {
      items: all.slice(0, maxItems),
      total: all.length,
    };
  }, [normalized, value, maxItems]);

  const updatePos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const dropUp = spaceBelow < 210 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(280, Math.max(140, (dropUp ? spaceAbove : spaceBelow) - 16));
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: Math.min(r.width, window.innerWidth - 16),
      top: dropUp ? undefined : r.bottom + 6,
      bottom: dropUp ? window.innerHeight - r.top + 6 : undefined,
      maxHeight,
      dropUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePos();
    const onScrollOrResize = () => updatePos();
    const onDocDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown, { passive: true });
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [open, updatePos, listId]);

  useEffect(() => {
    setActiveIdx(0);
  }, [value, open]);

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    if (onSelect) {
      onSelect(opt);
    } else {
      onChange?.(opt.value);
    }
    if (clearOnSelect) {
      onChange?.('');
    } else if (onSelect && !clearOnSelect) {
      // onSelect bisa memilih sendiri apakah mengubah value; biarkan default tetap sinkron bila tidak di-override
    }
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matched.items.length) {
        setActiveIdx((i) => (i + 1) % matched.items.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matched.items.length) {
        setActiveIdx((i) => (i - 1 + matched.items.length) % matched.items.length);
      }
    } else if (e.key === 'Enter' && matched.items[activeIdx]) {
      e.preventDefault();
      pick(matched.items[activeIdx]);
    }
  };

  const hasOptions = normalized.length > 0;
  const showDropdown = open && !disabled && (hasOptions || Boolean(String(value || '').trim()));

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <Icon
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted',
          size === 'lg' ? 'left-3.5 size-4' : 'left-3 size-4'
        )}
      />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel || placeholder}
        autoComplete="off"
        disabled={disabled}
        value={value}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange?.(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border border-line bg-sunken/50 font-semibold text-ink outline-none transition',
          'placeholder:font-medium placeholder:text-muted/70',
          'focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10 disabled:opacity-60',
          SIZE_CLS[size] || SIZE_CLS.md,
          inputClassName
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.('');
            inputRef.current?.focus();
          }}
          aria-label="Bersihkan pencarian"
          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      ) : showToggle && hasOptions ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          aria-label="Tampilkan pilihan"
          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink"
        >
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      ) : null}

      {showDropdown && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              id={listId}
              role="listbox"
              data-suggest-portal={listId}
              style={{
                position: 'fixed',
                left: pos.left,
                width: pos.width,
                top: pos.top,
                bottom: pos.bottom,
                zIndex: 140,
              }}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line/70 bg-sunken/40 px-3 py-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <Sparkles className="size-3 text-brand" />
                  {String(value || '').trim() ? 'Hasil cocok' : hintTitle}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted">
                  {matched.items.length < matched.total
                    ? `${matched.items.length} dari ${matched.total}`
                    : `${matched.total} data`}
                </span>
              </div>

              {matched.items.length === 0 ? (
                <div className="px-3.5 py-4 text-center text-[12px] font-semibold text-muted">{emptyText}</div>
              ) : (
                <ul
                  style={{ maxHeight: pos.maxHeight }}
                  className="divide-y divide-line/50 overflow-y-auto overscroll-contain"
                >
                  {matched.items.map((opt, idx) => {
                    const isActive = idx === activeIdx;
                    return (
                      <li key={`${opt.group}-${opt.value}-${idx}`} role="option" aria-selected={isActive}>
                        <button
                          type="button"
                          disabled={opt.disabled}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(opt)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                            opt.disabled
                              ? 'cursor-not-allowed opacity-50'
                              : isActive
                                ? 'bg-brand-soft/65'
                                : 'hover:bg-sunken/70'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-bold text-ink">
                              <Highlight text={opt.label} query={value} />
                            </p>
                            {opt.sub ? (
                              <p className="truncate text-[10.5px] font-semibold text-muted">
                                <Highlight text={opt.sub} query={value} />
                              </p>
                            ) : null}
                          </div>
                          {opt.selected ? (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                              <Check className="size-3" /> Dipilih
                            </span>
                          ) : opt.badge ? (
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                                BADGE_TONES[opt.badgeTone] || BADGE_TONES.neutral
                              )}
                            >
                              {opt.badge}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
