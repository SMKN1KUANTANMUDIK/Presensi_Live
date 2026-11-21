import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Tangani kegagalan preload chunk Vite saat versi baru baru saja di-deploy
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const last = Number(sessionStorage.getItem('presensi-auto-recover') || 0);
    if (Date.now() - last < 30000) return;
    sessionStorage.setItem('presensi-auto-recover', String(Date.now()));
  } catch {
    /* abaikan */
  }
  if (typeof window.__presensiHardReload === 'function') {
    window.__presensiHardReload();
  } else {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
