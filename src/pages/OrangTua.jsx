import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  School,
  ShieldCheck,
  User,
  UserCheck,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, formatTanggal, formatBulan, STATUS, TONE, todayISO } from '../lib/utils';
import { Badge, Button, Card, EmptyState, Field, Select, Skeleton } from '../components/ui';

/* =========================================================
   OrangTua — akses orang tua / wali murid (read-only)
   Dipakai dengan role guru/wali/admin (sama seperti Input Absensi).
   Tidak ada login terpisah — ambil data dari auth yang aktif.
   Default kelas diambil dari kelas_wali milik user login.
========================================================== */

export default function OrangTua() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* data anak terpilih */
  const [anak, setAnak] = useState(null); // { nisn, nama, kelas }
  const [siswaList, setSiswaList] = useState([]);
  const [statusHariIni, setStatusHariIni] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [ringkasan, setRingkasan] = useState({ H: 0, S: 0, I: 0, A: 0, C: 0 });
  const [kasusOpen, setKasusOpen] = useState(0);
  const [tanggalPilih, setTanggalPilih] = useState(todayISO());

  const statusAkhir = (jamObj) => {
    const values = Object.values(jamObj || {});
    if (!values.length) return null;
    if (values.includes('C')) return 'C';
    if (values.includes('A')) return 'A';
    if (values.includes('S')) return 'S';
    if (values.includes('I')) return 'I';
    return 'H';
  };

  const { user } = useAuth();
  const kelasWali = user?.kelas_wali || user?.kelas || '';

  // Muat daftar siswa kelas wali saat pertama kali dimuat
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!kelasWali) return;
      try {
        const res = await api.getSiswa(kelasWali);
        if (!alive) return;
        if (res?.success) setSiswaList(res.data || []);
      } catch {
        /* abaikan */
      }
    })();
    return () => {
      alive = false;
    };
  }, [kelasWali]);

  const muatDashboard = useCallback(async () => {
    if (!anak) return;
    setLoading(true);
    setError('');
    try {
      // status hari ini
      const today = todayISO();
      const resToday = await api.getDashboardPiket(today, anak.kelas);
      const dataToday = resToday?.data?.[0];
      const siswaToday = dataToday?.siswaList?.find((s) => String(s.nisn) === String(anak.nisn));
      setStatusHariIni(siswaToday ? statusAkhir(siswaToday.jam) : null);

      // riwayat 7 hari terakhir + ringkasan
      const riwayat7 = [];
      const stat = { H: 0, S: 0, I: 0, A: 0, C: 0 };
      const d = new Date();
      for (let i = 0; i < 7; i++) {
        const t = new Date(d.getTime() - i * 86400000);
        const tgl = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        try {
          const res = await api.getDashboardPiket(tgl, anak.kelas);
          const data = res?.data?.[0];
          const s = data?.siswaList?.find((x) => String(x.nisn) === String(anak.nisn));
          const st = s ? statusAkhir(s.jam) : null;
          riwayat7.push({ tanggal: tgl, status: st, hadir: s ? s.jam : {} });
          if (st) stat[st] = (stat[st] || 0) + 1;
        } catch {
          /* skip hari tanpa data */
        }
      }
      setRiwayat(riwayat7.reverse());
      setRingkasan(stat);

      // kasus pembinaan open untuk anak ini
      try {
        const res = await api.getKasusPembinaan({ status: 'Open', kelas: anak.kelas });
        const data = res?.data || [];
        setKasusOpen(data.filter((k) => String(k.nisn) === String(anak.nisn)).length);
      } catch {
        setKasusOpen(0);
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat data kehadiran.');
    } finally {
      setLoading(false);
    }
  }, [anak]);

  /* pilih anak dari daftar siswa kelas wali */
  const pilihAnak = (s) => {
    setAnak({ nisn: s.nisn, nama: s.nama_siswa || s.nama, kelas: s.kelas });
    muatDashboard();
  };

  /* =========================================================
     TAMPILAN
  ========================================================= */
  const stNow = statusHariIni;
  const toneNow = stNow ? TONE[(STATUS.find((s) => s.key === stNow) || STATUS[0]).tone] : TONE.hadir;
  const labelNow = stNow ? (STATUS.find((s) => s.key === stNow) || STATUS[0]).label : '—';
  const total7 = riwayat.length;
  const hadir7 = ringkasan.H;
  const persen7 = total7 ? Math.round((hadir7 / total7) * 100) : 0;

  const initials = (name) =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?';

  if (loading && !anak) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Skeleton className="h-64 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => setAnak(null)}>
          <ChevronLeft className="size-3.5" /> Pilih anak lain
        </Button>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            <ShieldCheck className="size-3.5" /> Orang Tua
          </Badge>
          <Button variant="soft" size="sm" onClick={muatDashboard}>
            <Clock className="size-3.5" /> Segarkan
          </Button>
        </div>
      </div>

      {/* pilih anak (jika belum ada) */}
      {!anak && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-[13px] font-extrabold text-ink mb-3">Pilih Anak</h3>
          <p className="text-[12px] text-muted mb-3">
            Pilih salah satu siswa di kelas Anda untuk melihat riwayat kehadirannya.
          </p>
          {siswaList.length === 0 ? (
            <EmptyState
              icon={User}
              title="Belum ada data siswa"
              description="Kelas Anda belum memiliki data siswa."
            />
          ) : (
            <div className="space-y-2">
              {siswaList.map((s) => (
                <button
                  key={s.nisn}
                  type="button"
                  onClick={() => pilihAnak(s)}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-brand-soft hover:border-brand"
                >
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-ink">{s.nama_siswa || s.nama}</p>
                    <p className="text-[11px] font-semibold text-muted">NISN {s.nisn}</p>
                  </div>
                  <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand font-bold">
                    {initials(s.nama_siswa || s.nama)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* dashboard anak */}
      {anak && (
        <>
          {/* profil anak */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand font-extrabold">
                {initials(anak.nama)}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-ink">{anak.nama}</p>
                <p className="text-[11px] font-semibold text-muted">
                  NISN {anak.nisn} · Kelas {anak.kelas}
                </p>
              </div>
              <div className="text-right">
                <Badge tone="neutral">
                  {labelNow}
                </Badge>
                <p className="mt-1 text-[10px] text-muted">Hari ini</p>
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
          </Card>

          {/* ringkasan 7 hari */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-extrabold text-ink">Ringkasan 7 Hari Terakhir</h3>
              <span className="text-[11px] font-bold text-brand">{persen7}% hadir</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {STATUS.map((s) => {
                const t = TONE[s.tone];
                const v = ringkasan[s.key] || 0;
                return (
                  <div key={s.key} className="rounded-2xl border p-2 text-center">
                    <span className={cn('size-1.5 rounded-full', t.dot)} />
                    <p className="text-[10px] font-extrabold text-muted">{s.short}</p>
                    <p className="text-[11px] font-bold">{v}</p>
                  </div>
                );
              })}
            </div>
            {kasusOpen > 0 && (
              <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-200/50 px-3 py-2">
                <div className="flex items-center gap-2 text-[11.5px] font-semibold text-rose-700">
                  <AlertTriangle className="size-4" />
                  Terdapat <span className="font-extrabold">{kasusOpen}</span> kasus pembinaan terbuka.
                </div>
              </div>
            )}
          </Card>

          {/* riwayat harian */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="size-4 text-muted" />
              <h3 className="text-[13px] font-extrabold text-ink">Riwayat Kehadiran</h3>
            </div>
            <Field label="Pilih tanggal">
              <input
                type="date"
                value={tanggalPilih}
                onChange={(e) => setTanggalPilih(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[13px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </Field>
            <div className="mt-3 rounded-xl border border-line overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-[10.5px] font-semibold text-muted">Tanggal</th>
                    <th className="px-4 py-2 text-[10.5px] font-semibold text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayat.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted">
                        Belum ada data absensi.
                      </td>
                    </tr>
                  ) : (
                    riwayat.map((r) => {
                      const st = r.status;
                      const t = st ? TONE[(STATUS.find((x) => x.key === st) || STATUS[0]).tone] : TONE.hadir;
                      const isSelected = r.tanggal === tanggalPilih;
                      return (
                        <tr
                          key={r.tanggal}
                          className={cn('border-b border-line/60 hover:bg-sunken/40 transition', isSelected ? 'bg-slate-50' : '')}
                        >
                          <td className="px-4 py-2.5 text-[11.5px] font-semibold text-ink">
                            {formatTanggal(r.tanggal, { withDay: true })}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold',
                                st
                                  ? cn('border-transparent', t.soft, t.text)
                                  : 'border-line bg-surface text-muted'
                              )}
                            >
                              <span className={cn('size-1.5 rounded-full', t.dot)} />
                              {st ? (STATUS.find((x) => x.key === st) || STATUS[0]).label : 'Belum absen'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {riwayat.length > 0 && tanggalPilih && (
              <div className="mt-3 rounded-xl border border-line p-3 bg-slate-50">
                <p className="text-[11px] font-semibold text-muted">Detail pada {formatTanggal(tanggalPilih)}</p>
                <p className="text-[12px] text-ink">
                  {riwayat.find((r) => r.tanggal === tanggalPilih)?.status
                    ? (STATUS.find((x) => x.key === riwayat.find((r) => r.tanggal === tanggalPilih).status) || STATUS[0]).label
                    : 'Belum ada data absensi.'
                }</p>
              </div>
            )}
          </Card>

          <p className="text-center text-[11px] text-muted mt-4">
            Data kehadiran {anak.nama} di SMK Negeri 1 Kuantan Mudik — hanya-baca untuk wali murid.
          </p>
        </>
      )}
    </div>
  );
}
