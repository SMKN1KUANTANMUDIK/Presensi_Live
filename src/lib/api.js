/**
 * api.js — Konektor Google Apps Script
 * Satu-satunya tempat untuk mengubah URL backend.
 */

export const GAS_URL =
  'https://script.google.com/macros/s/AKfycbyQ2zcEWonrxEzfG0v844_7Oj5wN_qHRVUwULEO5NG7gjR_wTTjK4j0C435TcG5Hsk/exec';

const TIMEOUT_MS = 20000;
const LONG_TIMEOUT_MS = 60000;

async function request(params, { method = 'GET', body, timeoutMs = TIMEOUT_MS } = {}) {
  const qs = Object.entries(params || {})
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
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });

    const text = await res.text();
    if (!text || !text.trim()) throw new Error('Server tidak mengirim data (respons kosong).');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Respons server bukan JSON yang valid.');
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Koneksi timeout — server tidak merespons.');
    if (err instanceof TypeError) throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const get = (params) => request(params, { method: 'GET' });
const post = (action, data = {}) => request({}, { method: 'POST', body: { action, data } });

export const api = {
  getVersion: () => get({ action: 'getVersion' }).catch(() => ({ success: false, version: 'v1' })),

  // auth
  login: (username, password) => get({ action: 'login', username, password }),

  // referensi
  getConfig: () => get({ action: 'getConfig' }),
  getKelas: () => get({ action: 'getKelas' }),
  getJurusan: () => get({ action: 'getJurusan' }),
  getGuru: () => get({ action: 'getGuru' }),
  getWaliKelas: (kelas) => get({ action: 'getWaliKelas', kelas }),

  // data master (admin)
  getGuruData: () => get({ action: 'getGuruData' }),
  getSiswaData: (kelas) => get({ action: 'getSiswaData', kelas }),
  simpanGuru: (data) => post('simpanGuru', data),
  hapusGuru: (nip) => post('hapusGuru', { nip }),
  importGuru: (payload) => post('importGuru', payload),
  simpanSiswa: (data) => post('simpanSiswa', data),
  hapusSiswa: (nisn) => post('hapusSiswa', { nisn }),
  importSiswa: (payload) => post('importSiswa', payload),

  // siswa & jam
  getSiswa: (kelas) => get({ action: 'getSiswa', kelas }),
  getJamTerisi: (tanggal, kelas) => get({ action: 'getJamTerisi', tanggal, kelas }),

  // input
  simpanAbsensi: (data) => post('simpanAbsensi', data),
  uploadFoto: (base64) => post('uploadFoto', { base64 }),

  // dashboard
  getDashboardAdmin: () => get({ action: 'getDashboardAdmin' }),
  getDashboardPiket: (tanggal, kelas = 'SEMUA') => get({ action: 'getDashboardPiket', tanggal, kelas }),
  getDashboardKepsek: (mode, tanggal, bulan, kelas = 'SEMUA', jurusan = 'SEMUA') =>
    get({ action: 'getDashboardKepsek', mode, tanggal, bulan, kelas, jurusan }),

  // riwayat & report
  getRiwayatAbsensi: () => get({ action: 'getRiwayatAbsensi' }),
  getDetailAbsensi: (id) => get({ action: 'getDetailAbsensi', id }),
  getAbsensiGuru: (kelas, guru, bulan) => get({ action: 'getAbsensiGuru', kelas, guru, bulan }),
  getRekapGuruSemester: (kelas, guru, semester, tahun, mapel = '', maks = 24) =>
    request(
      { action: 'getRekapGuruSemester', kelas, guru, semester, tahun, mapel, maks },
      { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }
    ),

  // kasus pembinaan
  getKasusPembinaan: (params) => get({ action: 'getKasusPembinaan', ...params }),
  sinkronKasusAbsensi: (params) =>
    request({ action: 'sinkronKasusDariAbsensi', ...params }, { method: 'GET', timeoutMs: LONG_TIMEOUT_MS }),

  // edit & hapus
  updateAbsensi: (detail) => post('updateAbsensi', { detail }),
  hapusAbsensi: (id) => request({}, { method: 'POST', body: { action: 'hapusAbsensi', id } }),
};

export default api;
