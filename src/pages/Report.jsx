import { useEffect, useState } from 'react';
import { BarChart3, FileText, Printer, RefreshCw, School } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import {
  cn,
  formatBulan,
  formatTanggal,
  monthISO,
  STATUS,
  statusHari,
  TONE,
  todayISO,
} from '../lib/utils';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, Skeleton } from '../components/ui';

const MODES = [
  { key: 'harian', label: 'Harian' },
  { key: 'bulanan', label: 'Bulanan' },
  { key: 'guru', label: 'Per guru' },
];

const SEMESTERS = [
  { key: 'ganjil', label: 'Ganjil (Jul–Des)' },
  { key: 'genap', label: 'Genap (Jan–Jun)' },
];

const MAKS_PERTEMUAN = 24;

const semesterSekarang = () => (new Date().getMonth() + 1 >= 7 ? 'ganjil' : 'genap');
const tahunAjaranSekarang = () => {
  const now = new Date();
  return String(now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1);
};

const SIG_ROLES = [
  { key: 'wali', label: 'Wali Kelas' },
  { key: 'guru', label: 'Guru Mata Pelajaran' },
  { key: 'kepsek', label: 'Kepala Sekolah' },
  { key: 'piket', label: 'Petugas Piket' },
  { key: 'admin', label: 'Administrator' },
];

function KopSurat() {
  return (
    <div className="kop-surat mb-4">
      <div className="flex items-start gap-3 border-b-3 border-slate-900 pb-2">
        <img
          src="./logo_riau.png"
          alt=""
          className="size-16 object-contain sm:size-20"
        />
        <div className="flex-1 text-center leading-tight">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900">
            Pemerintah Provinsi Riau
          </p>
          <p className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900 leading-tight">
            SMK Negeri 1 Kuantan Mudik
          </p>
          <p className="mt-0.5 text-[9px] font-medium text-slate-700 leading-relaxed">
            Alamat : JL. Air Panas Alam Pulau Binjai Kode Pos 29564 ·
            Email. Smkn1kuantanmudik@gmail.com ·
            Telepon:
          </p>
          <p className="text-[9px] font-medium text-slate-700 leading-relaxed">
            NSS : 3220914013 &nbsp;&nbsp; NPSN : 10495021
          </p>
        </div>
        <img
          src="./logo_sekolah.png"
          alt=""
          className="size-16 object-contain sm:size-20"
        />
      </div>
    </div>
  );
}

function TandaTangan({ jabatan, nama, nip }) {
  return (
    <div className="mt-8 flex justify-end">
      <div className="text-center text-[11px] font-medium text-slate-800">
        <p>Lubuk Jambi, {formatTanggal(todayISO(), { withDay: false })}</p>
        <p>Mengetahui,</p>
        <p className="font-bold">{jabatan}</p>
        <div className="h-14" />
        <p className="font-extrabold underline">{nama}</p>
        <p>NIP. {nip || '—'}</p>
      </div>
    </div>
  );
}

export default function Report() {
  const { user, name, role } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState('harian');
  const [guruPeriode, setGuruPeriode] = useState('bulanan');
  const [kelasList, setKelasList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [kelas, setKelas] = useState(user?.kelas || user?.kelas_wali || '');
  const [guru, setGuru] = useState(role === 'guru' ? name : '');
  const [mapel, setMapel] = useState('');
  const [semester, setSemester] = useState(semesterSekarang());
  const [tahun, setTahun] = useState(tahunAjaranSekarang());
  const [tanggal, setTanggal] = useState(todayISO());
  const [bulan, setBulan] = useState(monthISO());

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  /* ---------- penanda tangan ---------- */
  const isAdmin = role === 'admin';
  const [sigRole, setSigRole] = useState(role === 'guru' ? 'guru' : 'wali');
  const [sigNama, setSigNama] = useState('');
  const [sigNip, setSigNip] = useState('');

  const chooseSigRole = async (next) => {
    setSigRole(next);
    setSigNama('');
    setSigNip('');
    try {
      if (next === 'wali') {
        const res = await api.getGuruData();
        const found = (res?.data || []).find(
          (g) =>
            g.role === 'wali' &&
            (g.kelas_wali === kelas || String(g.kelas_wali || '').startsWith(`${kelas} `))
        );
        if (found) {
          setSigNama(found.nama || '');
          setSigNip(found.nip || '');
        }
      } else if (next === 'guru') {
        const target = result?.guru || guru || name;
        const found = guruList.find((g) => g.nama === target);
        setSigNama(target || '');
        setSigNip(found?.nip || '');
      } else if (next === 'kepsek' || next === 'piket') {
        const res = await api.getGuruData();
        const found = (res?.data || []).find((g) => g.role === next);
        if (found) {
          setSigNama(found.nama || '');
          setSigNip(found.nip || '');
        }
      } else {
        setSigNama(name || '');
        setSigNip(user?.nip || '');
      }
    } catch {
      /* biarkan kosong agar admin mengisi manual */
    }
  };

  const sigLabel = isAdmin
    ? SIG_ROLES.find((r) => r.key === sigRole)?.label || 'Wali Kelas'
    : role === 'guru'
      ? 'Guru Mata Pelajaran'
      : role === 'kepsek'
        ? 'Kepala Sekolah'
        : role === 'piket'
          ? 'Petugas Piket'
          : 'Wali Kelas';
  const signatureName = isAdmin
    ? sigNama || name
    : role === 'guru' && (result?.mode === 'guru' || result?.mode === 'guru-semester')
      ? result.guru
      : name;
  const signatureNip = isAdmin ? sigNip || user?.nip : user?.nip;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getConfig();
        if (res?.success) {
          setKelasList(res.kelas || []);
          setMapelList((res.mapel || []).map((m) => (typeof m === 'string' ? m : m.nama)).filter(Boolean));
        }
      } catch {
        /* ignore */
      }
    })();
    (async () => {
      try {
        const res = await api.getGuru();
        setGuruList(res?.data || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const generate = async () => {
    if (!kelas) return toast.warning('Pilih kelas terlebih dahulu.');
    setLoading(true);
    setProgress('');
    try {
      if (mode === 'harian') {
        const res = await api.getDashboardPiket(tanggal, kelas);
        const data = res?.data?.[0];
        if (!res?.success || !data?.siswaList?.length) throw new Error('Data absensi harian tidak ditemukan.');
        setResult({ mode, kelas, tanggal, data });
      } else if (mode === 'guru' && guruPeriode === 'semester') {
        if (!guru) throw new Error('Pilih guru terlebih dahulu.');
        const res = await api.getRekapGuruSemester(kelas, guru, semester, tahun, mapel, MAKS_PERTEMUAN);
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat rekap semester.');
        if (!res.pertemuan?.length) throw new Error('Belum ada pertemuan pada semester ini.');
        setResult({
          mode: 'guru-semester',
          kelas: res.kelas,
          guru: res.guru,
          mapel: res.mapel,
          semesterLabel: res.semesterLabel,
          tahunAjaran: res.tahunAjaran,
          rangeStart: res.rangeStart,
          rangeEnd: res.rangeEnd,
          maks: res.maks || MAKS_PERTEMUAN,
          totalPertemuan: res.totalPertemuan,
          pertemuan: res.pertemuan,
          siswa: res.siswa || [],
        });
      } else if (mode === 'guru') {
        if (!guru) throw new Error('Pilih guru terlebih dahulu.');
        const res = await api.getAbsensiGuru(kelas, guru, bulan);
        if (!res?.success || !res.data?.length) throw new Error('Data absensi guru tidak ditemukan.');
        const dates = [...new Set(res.data.map((d) => d.tanggal))].sort();
        const siswaMap = new Map();
        res.data.forEach((d) => {
          if (!siswaMap.has(d.nisn)) siswaMap.set(d.nisn, { nisn: d.nisn, nama: d.nama_siswa });
        });
        setResult({ mode, kelas, bulan, guru, dates, siswa: [...siswaMap.values()], rows: res.data });
      } else {
        const [y, m] = bulan.split('-').map(Number);
        const days = new Date(y, m, 0).getDate();
        const dates = Array.from({ length: days }, (_, i) => `${bulan}-${String(i + 1).padStart(2, '0')}`);

        const collected = [];
        for (let i = 0; i < dates.length; i += 1) {
          setProgress(`Memuat ${i + 1}/${dates.length} hari…`);
          try {
            const res = await api.getDashboardPiket(dates[i], kelas);
            if (res?.success && res.data?.[0]) collected.push({ tanggal: dates[i], data: res.data[0] });
          } catch {
            /* skip hari kosong */
          }
        }
        const withData = collected.filter((c) => (c.data.siswaList || []).length);
        if (!withData.length) throw new Error('Tidak ada data pada bulan ini.');
        const siswa = withData[0].data.siswaList || [];
        setResult({ mode: 'bulanan', kelas, bulan, dates: withData.map((c) => c.tanggal), siswa, collected: withData });
      }
      toast.success('Rekap siap dicetak');
    } catch (err) {
      setResult(null);
      toast.error(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const print = () => window.print();

  /* ---------- render tabel harian ---------- */
  const tabelHarian = () => {
    if (!result || result.mode !== 'harian') return null;
    const siswa = result.data.siswaList || [];
    const totals = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    siswa.forEach((s) => {
      const st = statusHari(s.jam);
      if (st) totals[st] += 1;
    });

    return (
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-1.5 py-1 text-left">No</th>
            <th className="border border-slate-300 px-1.5 py-1 text-left">Nama siswa</th>
            {Array.from({ length: 11 }, (_, i) => (
              <th key={i} className="border border-slate-300 px-1 py-1">
                {i + 1}
              </th>
            ))}
            <th className="border border-slate-300 px-1.5 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {siswa.map((s, i) => {
            const akhir = statusHari(s.jam);
            const tone = TONE[STATUS.find((x) => x.key === akhir)?.tone || 'hadir'];
            return (
              <tr key={s.nisn || i}>
                <td className="border border-slate-300 px-1.5 py-0.5 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-1.5 py-0.5 font-semibold">{s.nama}</td>
                {Array.from({ length: 11 }, (_, j) => {
                  const st = s.jam?.[j + 1];
                  return (
                    <td
                      key={j}
                      className={cn(
                        'border border-slate-300 px-1 py-0.5 text-center font-bold',
                        st && st !== 'H' ? tone.text : 'text-slate-500'
                      )}
                    >
                      {st ? (st === 'H' ? '✓' : st) : '·'}
                    </td>
                  );
                })}
                <td className="border border-slate-300 px-1 py-0.5 text-center font-extrabold">
                  {akhir ? (akhir === 'H' ? 'Hadir' : STATUS.find((x) => x.key === akhir)?.label) : '—'}
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-50 font-extrabold">
            <td className="border border-slate-300 px-1.5 py-1 text-right" colSpan={13}>
              Total
            </td>
            <td className="border border-slate-300 px-1 py-1 text-center text-[10px]">
              H={totals.H} S={totals.S} I={totals.I} A={totals.A} C={totals.C}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  /* ---------- render matriks (bulanan / guru) ---------- */
  const tabelMatriks = () => {
    if (!result || result.mode === 'harian') return null;

    const mapStatus = (nisn, tgl) => {
      if (result.mode === 'guru') {
        const rows = result.rows.filter((r) => String(r.nisn) === String(nisn) && r.tanggal === tgl);
        if (!rows.length) return null;
        const prior = { C: 5, A: 4, S: 3, I: 2, H: 1 };
        return rows.reduce((acc, r) => ((prior[r.status] || 0) > (prior[acc] || 0) ? r.status : acc), 'H');
      }
      const day = result.collected.find((c) => c.tanggal === tgl);
      const siswa = day?.data?.siswaList?.find((s) => String(s.nisn) === String(nisn));
      return siswa ? statusHari(siswa.jam) : null;
    };

    const dates = result.dates;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-1 py-1">No</th>
              <th className="border border-slate-300 px-1.5 py-1 text-left">Nama siswa</th>
              {dates.map((d) => (
                <th key={d} className="border border-slate-300 px-0.5 py-1 text-[9px]">
                  {String(d).slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.siswa.map((s, i) => (
              <tr key={s.nisn || i}>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-1.5 py-0.5 font-semibold">{s.nama || s.nama_siswa}</td>
                {dates.map((d) => {
                  const st = mapStatus(s.nisn, d);
                  return (
                    <td key={d} className="border border-slate-300 px-0.5 py-0.5 text-center font-bold">
                      {st ? (st === 'H' ? '✓' : st) : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* ---------- render matriks per semester (pertemuan 1..24) ---------- */
  const tabelSemester = () => {
    if (result?.mode !== 'guru-semester') return null;

    const pertemuan = result.pertemuan || [];
    const maks = Math.max(result.maks || MAKS_PERTEMUAN, pertemuan.length);
    const kolom = Array.from({ length: maks }, (_, i) => pertemuan[i] || null);
    const ringkas = ['H', 'S', 'I', 'A', 'C'];
    const tone = (st) =>
      st === 'A' || st === 'C' ? 'text-red-600' : st === 'S' || st === 'I' ? 'text-amber-600' : 'text-slate-700';

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[8px] leading-tight">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="border border-slate-300 px-1 py-1">No</th>
              <th rowSpan={2} className="border border-slate-300 px-1.5 py-1 text-left">Nama siswa</th>
              <th colSpan={maks} className="border border-slate-300 px-1 py-1">
                Pertemuan
              </th>
              <th colSpan={ringkas.length} className="border border-slate-300 px-1 py-1">
                Jumlah
              </th>
            </tr>
            <tr className="bg-slate-50">
              {kolom.map((p, i) => (
                <th
                  key={i}
                  title={p ? `${formatTanggal(p.tanggal)} · ${p.mapel}` : ''}
                  className="border border-slate-300 px-0.5 py-1 text-[7px] font-bold"
                >
                  {i + 1}
                  {p ? (
                    <span className="block text-[6px] font-medium text-slate-500">
                      {String(p.tanggal).slice(8)}/{String(p.tanggal).slice(5, 7)}
                    </span>
                  ) : null}
                </th>
              ))}
              {ringkas.map((k) => (
                <th key={k} className="border border-slate-300 px-0.5 py-1 text-[7px] font-bold">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.siswa.map((s, i) => (
              <tr key={s.nisn || i}>
                <td className="border border-slate-300 px-1 py-0.5 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-1.5 py-0.5 font-semibold">{s.nama}</td>
                {kolom.map((p, j) => {
                  const st = p ? s.status?.[p.no] : null;
                  return (
                    <td
                      key={j}
                      className={cn(
                        'border border-slate-300 px-0.5 py-0.5 text-center font-bold',
                        st ? tone(st) : 'text-slate-300'
                      )}
                    >
                      {st ? (st === 'H' ? '✓' : st) : '·'}
                    </td>
                  );
                })}
                {ringkas.map((k) => (
                  <td
                    key={k}
                    className={cn(
                      'border border-slate-300 px-0.5 py-0.5 text-center font-bold',
                      (k === 'A' || k === 'C') && s.totals?.[k] ? 'text-red-600' : ''
                    )}
                  >
                    {s.totals?.[k] || 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-1.5 text-[8.5px] font-semibold text-slate-600">
          Pertemuan 1–{pertemuan.length} dari {result.totalPertemuan} pertemuan · semester {result.semesterLabel}{' '}
          {result.tahunAjaran}
          {result.totalPertemuan > pertemuan.length
            ? ` (ditampilkan maksimal ${maks} pertemuan pertama)`
            : ''}
        </p>
      </div>
    );
  };

  const title =
    result?.mode === 'harian'
      ? 'REKAP ABSENSI HARIAN'
      : result?.mode === 'guru-semester'
        ? 'REKAP ABSENSI GURU MAPEL PER SEMESTER'
        : result?.mode === 'guru'
          ? 'REKAP ABSENSI GURU MAPEL'
          : 'REKAP ABSENSI BULANAN';

  const subtitle = result
    ? result.mode === 'harian'
      ? `${result.data.mapel ? `${result.data.mapel} — ` : ''}Kelas ${result.kelas} · ${formatTanggal(result.tanggal)}`
      : result.mode === 'guru-semester'
        ? `Kelas ${result.kelas} · Semester ${result.semesterLabel} ${result.tahunAjaran} · Guru: ${result.guru}${
            result.mapel ? ` · ${result.mapel}` : ''
          }`
        : result.mode === 'guru'
          ? `Kelas ${result.kelas} · ${formatBulan(result.bulan)} · Guru: ${result.guru}`
          : `Kelas ${result.kelas} · ${formatBulan(result.bulan)}`
    : '';

  return (
    <div className="space-y-3">
      {/* form */}
      <Card className="no-print p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
            <BarChart3 className="size-[18px]" />
          </span>
          <div>
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Rekap &amp; Cetak</h1>
            <p className="text-[11.5px] font-semibold text-muted">Laporan siap cetak (A4)</p>
          </div>
        </div>

        <div className="mt-3 flex gap-1 rounded-2xl bg-sunken p-1 sm:max-w-md">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMode(m.key);
                setResult(null);
              }}
              className={cn(
                'flex-1 rounded-xl py-1.5 text-[12px] font-extrabold transition',
                mode === m.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Kelas">
            <Select value={kelas} onChange={(e) => setKelas(e.target.value)} className="h-10 text-[12.5px]">
              <option value="">Pilih kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>

          {mode === 'harian' ? (
            <Field label="Tanggal">
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </Field>
          ) : mode === 'guru' && guruPeriode === 'semester' ? (
            <>
              <Field label="Semester">
                <Select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="h-10 text-[12.5px]"
                >
                  {SEMESTERS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tahun ajaran" className="col-span-2">
                <Select value={tahun} onChange={(e) => setTahun(e.target.value)} className="h-10 text-[12.5px]">
                  {[-2, -1, 0, 1].map((n) => {
                    const t = String(Number(tahunAjaranSekarang()) - 1 + n);
                    return (
                      <option key={t} value={t}>
                        {t}/{Number(t) + 1}
                      </option>
                    );
                  })}
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Bulan">
              <input
                type="month"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </Field>
          )}

          {mode === 'guru' && (
            <>
              <Field label="Periode laporan" className="col-span-2">
                <div className="flex gap-1 rounded-xl bg-sunken p-1">
                  {[
                    { key: 'bulanan', label: 'Bulanan' },
                    { key: 'semester', label: 'Semester (pertemuan 1–24)' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setGuruPeriode(p.key);
                        setResult(null);
                      }}
                      className={cn(
                        'flex-1 rounded-lg py-1.5 text-[11.5px] font-extrabold transition',
                        guruPeriode === p.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>

              {guruPeriode === 'semester' && (
                <Field label="Mata pelajaran" className="col-span-2">
                  <Select value={mapel} onChange={(e) => setMapel(e.target.value)} className="h-10 text-[12.5px]">
                    <option value="">Semua mapel</option>
                    {mapelList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Guru" className="col-span-2">
                <Select value={guru} onChange={(e) => setGuru(e.target.value)} className="h-10 text-[12.5px]">
                  <option value="">Pilih guru</option>
                  {guruList.map((g) => (
                    <option key={g.nama} value={g.nama}>
                      {g.nama}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>

        <Button className="mt-3 w-full" onClick={generate} loading={loading}>
          {!loading && <FileText className="size-4" />}
          {progress || 'Tampilkan rekap'}
        </Button>

        {isAdmin && (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-sunken/30 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted">
              Tanda tangan laporan
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Cetak sebagai" className="col-span-2">
                <Select
                  value={sigRole}
                  onChange={(e) => chooseSigRole(e.target.value)}
                  className="h-10 text-[12.5px]"
                >
                  {SIG_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nama penanda tangan" className="col-span-2">
                <input
                  value={sigNama}
                  onChange={(e) => setSigNama(e.target.value)}
                  placeholder={name || 'Nama lengkap'}
                  className="h-10 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
                />
              </Field>
              <Field label="NIP penanda tangan" className="col-span-2">
                <input
                  value={sigNip}
                  onChange={(e) => setSigNip(e.target.value)}
                  placeholder={user?.nip || '-'}
                  className="h-10 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
                />
              </Field>
            </div>
          </div>
        )}
      </Card>

      {/* preview */}
      {loading && mode === 'bulanan' ? (
        <Card className="p-4">
          <Skeleton className="h-64 rounded-2xl" />
        </Card>
      ) : !result ? (
        <Card className="no-print">
          <EmptyState
            icon={FileText}
            title="Belum ada rekap"
            description="Pilih kelas dan periode, lalu tekan Tampilkan rekap."
          />
        </Card>
      ) : (
        <Card
          className={cn(
            'print-sheet overflow-hidden p-4 sm:p-6',
            result.mode === 'guru-semester' && 'print-landscape'
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                <School className="size-3" /> {result.kelas}
              </Badge>
              <Badge tone="neutral">
                {result.mode === 'harian'
                  ? formatTanggal(result.tanggal)
                  : result.mode === 'guru-semester'
                    ? `${result.semesterLabel} ${result.tahunAjaran}`
                    : formatBulan(result.bulan)}
              </Badge>
            </div>
            <Button size="sm" variant="soft" onClick={print}>
              <Printer className="size-3.5" /> Cetak
            </Button>
          </div>

          <div className="text-slate-900">
            <KopSurat />
            <h2 className="text-center text-[15px] font-extrabold uppercase tracking-wide">{title}</h2>
            <p className="mt-1 text-center text-[11.5px] font-semibold text-slate-700">{subtitle}</p>

            <div className="mt-3 overflow-x-auto">{tabelHarian() || tabelSemester() || tabelMatriks()}</div>

            <div className="mt-2 flex flex-wrap gap-3 text-[9.5px] font-bold text-slate-600">
              <span>✓ = Hadir</span>
              <span>S = Sakit</span>
              <span>I = Izin</span>
              <span>A = Alpha</span>
              <span>C = Cabut</span>
            </div>

            <TandaTangan jabatan={sigLabel} nama={signatureName} nip={signatureNip} />
          </div>
        </Card>
      )}
    </div>
  );
}
