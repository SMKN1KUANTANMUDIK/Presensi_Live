/**
 * api.js — Konektor Google Apps Script
 * Satu-satunya tempat untuk mengubah URL backend.
 */

export const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzjuoBgMlKE2BVUEU3pwZwWGMyITWZUIaq4f8gWx0fGG7dlS6bWUCKqsIWiZJkVDq8/exec';

const TIMEOUT_MS = 20000;
const LONG_TIMEOUT_MS = 60000;
const CLIENT_CACHE_TTL_MS = 3 * 60 * 1000;

let tokenGetter = () => '';
let unauthorizedHandler = null;

export function setTokenGetter(fn) {
  tokenGetter = typeof fn === 'function' ? fn : () => '';
}

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

const memCache = new Map();
const inflight = new Map();

export function invalidateClientCache(prefix = '') {
  if (!prefix) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

function cachedGet(cacheKey, fetcher, ttlMs = CLIENT_CACHE_TTL_MS) {
  const hit = memCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) {
    return Promise.resolve(hit.value);
  }
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }
  const promise = fetcher()
    .then((res) => {
      if (res?.success) {
        memCache.set(cacheKey, { at: Date.now(), value: res });
      }
      return res;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });
  inflight.set(cacheKey, promise);
  return promise;
}

async function request(params, { method = 'GET', body, timeoutMs = TIMEOUT_MS, skipAuth = false } = {}) {
  const token = skipAuth ? '' : String(tokenGetter?.() || '').trim();
  const finalParams =
    method === 'GET' && token && !(params && params.token)
      ? { ...(params || {}), token }
      : params;
  const finalBody =
    method === 'POST' && body && typeof body === 'object' && token && !body.token
      ? { ...body, token }
      : body;

  const qs = Object.entries(finalParams || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = GAS_URL + (method === 'GET' && qs ? `?${qs}` : '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      // text/plain menghindari preflight CORS di Apps Script
      headers: method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      body: method === 'POST' ? JSON.stringify(finalBody) : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });

    const text = await res.text();
    if (!text || !text.trim()) throw new Error('Server tidak mengirim data (respons kosong).');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Respons server bukan JSON yang valid.');
    }

    if (!skipAuth && parsed?.code === 'UNAUTHORIZED') {
      unauthorizedHandler?.(parsed.error || 'Sesi berakhir. Silakan masuk kembali.');
    }
    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Koneksi timeout — server tidak merespons.');
    if (err instanceof TypeError) throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const get = (params, opts) => request(params, { method: 'GET', ...(opts || {}) });
const post = (action, data = {}, opts) =>
  request({}, { method: 'POST', body: { action, data }, ...(opts || {}) });
const postRaw = (payload, opts) => request({}, { method: 'POST', body: payload, ...(opts || {}) });

export const api = {
  getVersion: () =>
    cachedGet('version', () => get({ action: 'getVersion' }, { skipAuth: true }), 5 * 60 * 1000).catch(() => ({
      success: false,
      version: 'v1',
    })),

  // auth
  login: async (username, password) => {
    invalidateClientCache();
    const res = await postRaw({ action: 'login', username, password }, { skipAuth: true });
    if (res && !res.success && /Action tidak ditemukan/i.test(res.error || '')) {
      return get({ action: 'login', username, password }, { skipAuth: true });
    }
    return res;
  },
  logout: () => {
    invalidateClientCache();
    return postRaw({ action: 'logout' }).catch(() => null);
  },

  // portal orang tua
  cariSiswaOrtu: (kelas, mode, query) =>
    postRaw({ action: 'cariSiswaOrtu', kelas, mode, query }, { skipAuth: true }),
  pilihSiswaOrtu: (selectToken, nisn) =>
    postRaw({ action: 'pilihSiswaOrtu', selectToken, nisn }, { skipAuth: true }),
  getPortalOrtu: (bulan, parentToken) =>
    request(
      { action: 'getPortalOrtu', bulan, token: parentToken },
      { method: 'GET', skipAuth: true, timeoutMs: LONG_TIMEOUT_MS }
    ),

  // referensi (di-cache di memori + deduplikasi in-flight)
  getConfig: () => cachedGet('config', () => get({ action: 'getConfig' })),
  getKelas: () => cachedGet('kelas', () => get({ action: 'getKelas' }, { skipAuth: true })),
  getJurusan: () => cachedGet('jurusan', () => get({ action: 'getJurusan' })),
  getGuru: () => cachedGet('guru', () => get({ action: 'getGuru' })),
  getWaliKelas: (kelas) => get({ action: 'getWaliKelas', kelas }),

  // data master (admin)
  getGuruData: () => cachedGet('guruData', () => get({ action: 'getGuruData' })),
  getSiswaData: (kelas = '') =>
    cachedGet(`siswaData:${kelas}`, () => get({ action: 'getSiswaData', kelas })),
  simpanGuru: async (data) => {
    const res = await post('simpanGuru', data);
    if (res?.success) invalidateClientCache();
    return res;
  },
  hapusGuru: async (nip) => {
    const res = await post('hapusGuru', { nip });
    if (res?.success) invalidateClientCache();
    return res;
  },
  importGuru: async (payload) => {
    const res = await post('importGuru', payload);
    if (res?.success) invalidateClientCache();
    return res;
  },
  simpanSiswa: async (data) => {
    const res = await post('simpanSiswa', data);
    if (res?.success) invalidateClientCache();
    return res;
  },
  hapusSiswa: async (nisn) => {
    const res = await post('hapusSiswa', { nisn });
    if (res?.success) invalidateClientCache();
    return res;
  },
  importSiswa: async (payload) => {
    const res = await post('importSiswa', payload);
    if (res?.success) invalidateClientCache();
    return res;
  },

  // siswa & jam
  getSiswa: (kelas) => cachedGet(`siswa:${kelas || ''}`, () => get({ action: 'getSiswa', kelas })),
  getJamTerisi: (tanggal, kelas) => get({ action: 'getJamTerisi', tanggal, kelas }),

  // input
  simpanAbsensi: async (data) => {
    const res = await post('simpanAbsensi', data);
    if (res?.success) invalidateClientCache();
    return res;
  },
  uploadFoto: (base64) => post('uploadFoto', { base64 }),

  // dashboard
  getDashboardAdmin: () => get({ action: 'getDashboardAdmin' }),
  getDashboardPiket: (tanggal, kelas = 'SEMUA') =>
    cachedGet(
      `dashPiket:${tanggal || ''}:${kelas || 'SEMUA'}`,
      () => get({ action: 'getDashboardPiket', tanggal, kelas }),
      60 * 1000
    ),
  getDashboardKepsek: (mode, tanggal, bulan, kelas = 'SEMUA', jurusan = 'SEMUA') =>
    get({ action: 'getDashboardKepsek', mode, tanggal, bulan, kelas, jurusan }),

  // apel pagi (keterlambatan)
  getApelPagi: (tanggal = '', kelas = 'SEMUA', bulan = '', nisn = '') =>
    get({ action: 'getApelPagi', tanggal, kelas, bulan, nisn }),
  simpanApelPagi: async (data, petugas = '') => {
    const res = await postRaw({ action: 'simpanApelPagi', data, petugas });
    if (res?.success) invalidateClientCache();
    return res;
  },
  hapusApelPagi: async (id) => {
    const res = await postRaw({ action: 'hapusApelPagi', id });
    if (res?.success) invalidateClientCache();
    return res;
  },

  // riwayat, report & monitoring
  getRiwayatAbsensi: (params = {}) =>
    request({ action: 'getRiwayatAbsensi', ...params }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),
  getDetailAbsensi: (id) =>
    request({ action: 'getDetailAbsensi', id }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),
  getAbsensiGuru: (kelas, guru, bulan) =>
    cachedGet(
      `absGuru:${kelas || ''}:${guru || ''}:${bulan || ''}`,
      () => get({ action: 'getAbsensiGuru', kelas, guru, bulan }),
      60 * 1000
    ),
  getRekapBulanan: (kelas, bulan) =>
    cachedGet(
      `rekapBln:${kelas || ''}:${bulan || ''}`,
      () => request({ action: 'getRekapBulanan', kelas, bulan }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),
      60 * 1000
    ),
  getMonitoringSiswa: (nisn, bulan = '') =>
    request({ action: 'getMonitoringSiswa', nisn, bulan }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),
  getRekapGuruSemester: (kelas, guru, semester, tahun, mapel = '', maks = 24) =>
    cachedGet(
      `rekapSem:${kelas || ''}:${guru || ''}:${semester || ''}:${tahun || ''}:${mapel || ''}:${maks}`,
      () =>
        request(
          { action: 'getRekapGuruSemester', kelas, guru, semester, tahun, mapel, maks },
          { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }
        ),
      60 * 1000
    ),

  // kasus pembinaan
  getKasusPembinaan: (params) => get({ action: 'getKasusPembinaan', ...params }),
  getPeringatanWaliKelas: (kelas_wali) => get({ action: 'getPeringatanWaliKelas', kelas_wali }),
  sinkronKasusAbsensi: (params) =>
    request({ action: 'sinkronKasusDariAbsensi', ...params }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),
  simpanKasusPembinaan: async (data, role, kelas_wali = '') => {
    const res = await postRaw({ action: 'simpanKasusPembinaan', data, role, kelas_wali });
    if (res?.success) invalidateClientCache();
    return res;
  },
  catatTindakanKasus: async (id, level, tindakan, catatan = '') => {
    const res = await postRaw({ action: 'catatTindakanKasus', id, level, tindakan, catatan });
    if (res?.success) invalidateClientCache();
    return res;
  },
  escalateKasus: async (id, dariLevel, keLevel, catatan = '') => {
    const res = await postRaw({ action: 'escalateKasus', id, dariLevel, keLevel, catatan });
    if (res?.success) invalidateClientCache();
    return res;
  },
  tutupKasusPembinaan: async (id, alasan, role) => {
    const res = await postRaw({ action: 'tutupKasusPembinaan', id, alasan, role });
    if (res?.success) invalidateClientCache();
    return res;
  },

  // edit & hapus
  updateAbsensi: async (detail) => {
    const res = await post('updateAbsensi', { detail });
    if (res?.success) invalidateClientCache();
    return res;
  },
  hapusAbsensi: async (id) => {
    const res = await postRaw({ action: 'hapusAbsensi', id });
    if (res?.success) invalidateClientCache();
    return res;
  },
};

export default api;
