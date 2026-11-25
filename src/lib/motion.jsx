import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  animate as motionAnimate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { cn } from './utils';

/* =========================================================
   Lenis smooth-scroll provider (dengan fallback aman)
========================================================= */
const LenisCtx = createContext(null);
let lenisInstance = null;

export function useLenis() {
  return useContext(LenisCtx)?.lenis || null;
}

export function MotionProvider({ children }) {
  const [lenis, setLenis] = useState(null);

  useEffect(() => {
    let rafId;
    let destroyed = false;
    let inst = null;
    (async () => {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReduced) return; // hormati preferensi aksesibilitas
      try {
        const { default: Lenis } = await import('lenis');
        if (destroyed) return;
        inst = new Lenis({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
          smoothWheel: true,
          syncTouch: false,
        });
        lenisInstance = inst;
        window.__lenis = inst; // expose untuk ScrollToTop
        const raf = (time) => {
          inst?.raf(time);
          rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);
        setLenis(inst);
      } catch {
        /* Lenis gagal dimuat — browser scroll native tetap bekerja */
      }
    })();
    return () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      inst?.destroy?.();
      lenisInstance = null;
      window.__lenis = null;
    };
  }, []);

  const scrollTo = useCallback((target, opts = {}) => {
    if (lenisInstance) lenisInstance.scrollTo(target, { offset: -16, ...opts });
    else {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      (el instanceof Element ? el : window).scrollIntoView?.({ behavior: 'smooth' });
    }
  }, []);

  const value = useMemo(() => ({ lenis, scrollTo }), [lenis, scrollTo]);

  return <LenisCtx.Provider value={value}>{children}</LenisCtx.Provider>;
}

/* =========================================================
   GSAP hooks — load lazily, dispose otomatis
========================================================= */
let gsapPromise = null;
async function loadGsap() {
  if (!gsapPromise) {
    gsapPromise = import('gsap').then((m) => {
      const gsap = m.gsap ?? m.default;
      gsap.defaults({ ease: 'power3.out', duration: 0.6 });
      return gsap;
    });
  }
  return gsapPromise;
}

/**
 * Jalankan animasi GSAP pada saat mount / saat elemen masuk viewport.
 * @param {Function} setup  (gsap, ctx) => timeline | void
 * @param {Array}    deps   dependensi untuk re-run
 * @param {Object}   opts   { inViewport?: boolean, once?: boolean, amount?: number }
 */
export function useGsap(setup, deps = [], opts = {}) {
  const { inViewport = false, once = true, amount = 0.25 } = opts;
  const ref = useRef(null);
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;

    let gsap;
    let tween;
    let observer;
    let cancelled = false;

    const run = async () => {
      gsap = await loadGsap();
      if (cancelled || !ref.current) return;
      tween = gsap.context(() => setupRef.current(gsap), ref.current);
    };

    if (inViewport) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            run();
            if (once) observer.disconnect();
          }
        },
        { threshold: amount }
      );
      observer.observe(el);
    } else {
      run();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      tween?.revert?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/** Parallax halus untuk elemen dekoratif (background orb, grid, dsb.) */
export function useGsapParallax(strength = 40, opts = {}) {
  const { scale = 1, rotate = 0, rotateStrength = 0 } = opts;
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;

    let cleanup;
    (async () => {
      const gsap = await loadGsap();
      if (!ref.current) return;
      const q = gsap.utils;
      const move = (e) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        gsap.to(el, {
          x: dx * strength,
          y: dy * strength,
          rotation: rotate + dy * rotateStrength,
          scale,
          duration: 1.4,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };
      window.addEventListener('pointermove', move, { passive: true });
      cleanup = () => window.removeEventListener('pointermove', move);
    })();
    return () => cleanup?.();
  }, [strength, scale, rotate, rotateStrength]);

  return ref;
}

/** SplitText sederhana per baris (fallback ringan, tanpa plugin berbayar) */
export function useTextReveal(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    (async () => {
      const gsap = await loadGsap();
      if (!ref.current) return;
      gsap.fromTo(
        el.querySelectorAll('[data-reveal]'),
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay }
      );
    })();
  }, [delay]);
  return ref;
}

/* =========================================================
   Motion components — dipakai lintas halaman
========================================================= */

/** Wrapper animasi masuk. `animation` = 'rise' | 'fade' | 'scale' | 'slideLeft' | 'blur' */
export function Reveal({
  children,
  animation = 'rise',
  delay = 0,
  duration = 0.55,
  className,
  as: Tag = motion.div,
  ...rest
}) {
  const reduce = useReducedMotion();
  const variants = {
    rise: { opacity: 0, y: 18 },
    fade: { opacity: 0 },
    scale: { opacity: 0, scale: 0.94 },
    slideLeft: { opacity: 0, x: 24 },
    blur: { opacity: 0, filter: 'blur(6px)', y: 8 },
  };
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      initial={variants[animation]}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Container yang stagger anak-anaknya (pola dashboard grid) */
export function Stagger({ children, className, gap = 0.07, delayChildren = 0.05, as: Tag = motion.div, ...rest }) {
  const reduce = useReducedMotion();
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };
  const kids = reduce
    ? children
    : Array.isArray(children)
      ? children.map((child, i) =>
          child ? (
            <Tag key={child.key ?? i} className="contents">
              {/* biome-ignore: pattern wrapper */}
              <motion.div variants={item} className="h-full">
                {child}
              </motion.div>
            </Tag>
          ) : null
        )
      : children;
  return (
    <Tag variants={container} initial="hidden" animate="show" className={className} {...rest}>
      {kids}
    </Tag>
  );
}

/** Kartu interaktif dengan tilt 3D halus mengikuti pointer (GSAP quickTo) */
export function TiltCard({ children, className, max = 8, glare = true, ...rest }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return undefined;
    let cleanup;
    let tweenVars = {};
    (async () => {
      const gsap = await loadGsap();
      if (!ref.current) return;
      const rX = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power2.out' });
      const rY = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power2.out' });
      const glareEl = glare ? el.querySelector('[data-tilt-glare]') : null;
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        rY(px * max * 2);
        rX(-py * max * 2);
        if (glareEl) {
          gsap.to(glareEl, {
            opacity: 0.5,
            xPercent: px * 120,
            yPercent: py * 120,
            duration: 0.5,
            overwrite: 'auto',
          });
        }
      };
      const onLeave = () => {
        rX(0);
        rY(0);
        if (glareEl) gsap.to(glareEl, { opacity: 0, duration: 0.4 });
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      gsap.set(el, { transformPerspective: 800 });
      cleanup = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    })();
    return () => cleanup?.();
  }, [max, glare, reduce]);

  return (
    <div ref={ref} className={cn('relative [transform-style:preserve-3d] will-change-transform', className)} {...rest}>
      {children}
      {glare && (
        <span
          data-tilt-glare
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-[inherit] opacity-0"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.35), transparent 70%)',
            borderRadius: 'inherit',
          }}
        />
      )}
    </div>
  );
}

/** Nomor statistik animasi count-up (Motion) */
export function CountUp({ value = 0, duration = 1.1, format, className }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 24, mass: 0.8 });
  const [display, setDisplay] = useState(0);
  const inViewRef = useRef(null);
  const inView = useInView(inViewRef, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setDisplay(Number(value) || 0);
      return undefined;
    }
    if (inView) mv.set(Number(value) || 0);
  }, [inView, value, mv, reduce]);

  useEffect(() => spring.on('change', (v) => setDisplay(v)), [spring]);
  const text = useMemo(
    () => (typeof format === 'function' ? format(display) : Math.round(display).toLocaleString('id-ID')),
    [display, format]
  );
  return (
    <span ref={inViewRef} className={cn('tabular-nums', className)}>
      {text}
    </span>
  );
}

/* =========================================================
   Scroll progress bar (atas layar, Motion)
========================================================= */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? h.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[95] h-[2.5px] origin-left bg-gradient-to-r from-brand via-sky-400 to-violet-500"
      style={{ scaleX: p }}
      initial={{ opacity: 0 }}
      animate={{ opacity: p > 0.005 ? 1 : 0 }}
    />
  );
}

/* =========================================================
   Magnetic button — menoleh ke arah pointer
========================================================= */
export function Magnetic({ children, strength = 0.35, className, ...rest }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return undefined;
    let cleanup;
    (async () => {
      const gsap = await loadGsap();
      if (!ref.current) return;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power2.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power2.out' });
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      cleanup = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    })();
    return () => cleanup?.();
  }, [strength, reduce]);
  return (
    <div ref={ref} className={cn('inline-block will-change-transform', className)} {...rest}>
      {children}
    </div>
  );
}

export { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, motionAnimate };
