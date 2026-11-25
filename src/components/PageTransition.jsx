import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/**
 * Pembungkus konten halaman dengan transisi antar-route:
 * konten lama keluar (fade + sedikit y), konten baru masuk
 * (rise + blur-in) — dikoordinasikan AnimatePresence mode="wait".
 */
export function PageTransition({ children }) {
  const location = useLocation();
  const reduce = useReducedMotion();

  if (reduce) return <div key={location.pathname}>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
