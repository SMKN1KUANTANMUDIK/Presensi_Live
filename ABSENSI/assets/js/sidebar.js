/* =====================================================
  SIDEBAR — Role-aware nav builder
  Call buildSidebar(activeHref) after DOM ready.
===================================================== */

const SIDEBAR_ICONS = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  input:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  report:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  piket:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  kepsek:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  riwayat:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  logout:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
};

// Menu definitions per role
// admin   : akses semua halaman
// kepsek  : hanya kepsek.html
// piket   : hanya piket.html
// guru    : hanya input.html & report.html
// wali    : hanya input.html & report.html
const MENUS = {
  admin: [
    { href: 'admin.html',   icon: 'dashboard', label: 'Dashboard' },
    { href: 'input.html',   icon: 'input',     label: 'Input Absensi' },
    { href: 'report.html',  icon: 'report',    label: 'Report Absensi' },
    { href: 'piket.html',   icon: 'piket',     label: 'Dashboard Piket' },
    { href: 'kepsek.html',  icon: 'kepsek',    label: 'Dashboard Kepsek' },
    { href: 'riwayat.html', icon: 'riwayat',   label: 'Riwayat Absensi' },
  ],
  kepsek: [
    { href: 'kepsek.html',  icon: 'kepsek',    label: 'Dashboard Kepsek' },
  ],
  piket: [
    { href: 'piket.html',   icon: 'piket',     label: 'Dashboard Piket' },
  ],
  guru: [
    { href: 'input.html',   icon: 'input',     label: 'Input Absensi' },
    { href: 'report.html',  icon: 'report',    label: 'Report Absensi' },
  ],
  wali: [
    { href: 'input.html',   icon: 'input',     label: 'Input Absensi' },
    { href: 'report.html',  icon: 'report',    label: 'Report Absensi' },
  ],
};

function buildSidebar(activeHref) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role = user ? String(user.role || '').trim().toLowerCase() : 'guru';

  const menus = MENUS[role] || MENUS.guru;

  nav.innerHTML = '<span class="sidebar-section-label">Menu</span>' +
    menus.map(m => `
      <a href="${m.href}" class="sidebar-link${m.href === activeHref ? ' active' : ''}">
        ${SIDEBAR_ICONS[m.icon] || ''}
        ${m.label}
      </a>
    `).join('');

  // Fill user info
  if (user) {
    const nama = user.nama_guru || user.nama || user.username || '-';
    const roleLabel = {
      admin: 'Administrator',
      kepsek: 'Kepala Sekolah',
      piket: 'Petugas Piket',
      guru: 'Guru Mapel',
      wali: 'Wali Kelas'
    }[role] || (user.role || '-');
    const avatar = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    const roleEl = document.getElementById('sidebarRole');
    if (avatar) avatar.textContent = nama[0].toUpperCase();
    if (nameEl) nameEl.textContent = nama;
    if (roleEl) roleEl.textContent = roleLabel;
  }
}

function logoutAll() {
  if (!confirm('Yakin ingin logout?')) return;
  localStorage.removeItem('isLogin');
  localStorage.removeItem('user');
  localStorage.removeItem('userData');
  location.href = 'index.html';
}
