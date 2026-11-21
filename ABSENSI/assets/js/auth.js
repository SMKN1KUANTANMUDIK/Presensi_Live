/* =====================================================
  AUTH — Role-based Access Control
  Reads from localStorage "user" (set by login.js)
===================================================== */

(function() {

  const isLogin = localStorage.getItem('isLogin');
  if (!isLogin) {
    location.href = 'index.html';
    return;
  }

  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role = user ? String(user.role || '').trim().toLowerCase() : '';

  const page = location.pathname.split('/').pop();

  // ── Page access rules ──────────────────────────────
  // admin      : semua halaman
  // kepsek     : kepsek.html saja
  // piket      : piket.html saja
  // guru/wali  : input.html, report.html saja

  // ── Page access rules ──────────────────────────────
  // admin      : admin.html, riwayat.html (dan bisa akses semua)
  // kepsek     : kepsek.html SAJA
  // piket      : piket.html SAJA
  // guru/wali  : input.html, report.html SAJA

  const adminOnly  = ['admin.html', 'riwayat.html'];
  const kepsekOnly = ['kepsek.html'];
  const piketOnly  = ['piket.html'];
  const guruOnly   = ['input.html', 'report.html'];

  // Halaman yang tidak boleh diakses kepsek
  const blockedForKepsek = ['admin.html', 'riwayat.html', 'piket.html', 'input.html', 'report.html'];
  // Halaman yang tidak boleh diakses piket
  const blockedForPiket  = ['admin.html', 'riwayat.html', 'kepsek.html', 'input.html', 'report.html'];
  // Halaman yang tidak boleh diakses guru/wali
  const blockedForGuru   = ['admin.html', 'riwayat.html', 'kepsek.html', 'piket.html'];

  function deny() {
    alert('Akses ditolak. Role Anda: ' + (role || 'tidak dikenali'));
    // Redirect ke halaman sesuai role
    if (role === 'kepsek') { location.href = 'kepsek.html'; }
    else if (role === 'piket') { location.href = 'piket.html'; }
    else if (role === 'guru' || role === 'wali') { location.href = 'input.html'; }
    else { location.href = 'index.html'; }
  }

  if (adminOnly.includes(page) && role !== 'admin') {
    deny(); return;
  }

  if (kepsekOnly.includes(page) && role !== 'kepsek') {
    deny(); return;
  }

  if (piketOnly.includes(page) && role !== 'piket' && role !== 'admin') {
    deny(); return;
  }

  if (guruOnly.includes(page) && !['guru', 'wali', 'admin'].includes(role)) {
    deny(); return;
  }

  // Blokir kepsek dari halaman lain
  if (role === 'kepsek' && blockedForKepsek.includes(page)) {
    deny(); return;
  }

  // Blokir piket dari halaman lain
  if (role === 'piket' && blockedForPiket.includes(page)) {
    deny(); return;
  }

  // Blokir guru/wali dari halaman lain
  if ((role === 'guru' || role === 'wali') && blockedForGuru.includes(page)) {
    deny(); return;
  }

})();
