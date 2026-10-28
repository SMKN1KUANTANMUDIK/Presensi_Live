import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ClipboardList,
  Info,
  RefreshCw,
  School,
  Search,
  Users,
  X,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { cn, formatJam, STATUS, TONE, todayISO } from '../lib/utils';
import { Badge, Button, Card, EmptyState, Field, Select, Sheet, Skeleton } from '../components/ui';
import StatusPicker from '../components/StatusPicker';

/* =========================================================
   Kartu siswa (mobile)
========================================================== */

const ABSEN_STATUS = STATUS.filter((s) => s.key !== 'H');

/* =========================================================
   Kartu siswa (mobile) â€” dengan toggle Hadir
========================================================== */
function StudentCard({ index, siswa, status, isHadir, onStatus, onToggleHadir }) {
  const current = isHadir ? 'H' : (status || 'H');
  const tone = TONE[(STATUS.find((s) => s.key === current) || STATUS[0]).tone];
  const hasAbsensi = current !== 'H';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border bg-surface p-3.5 shadow-card transition',
        current === 'H' ? 'border-line' : tone.border
      )}
    >
      <div className="flex items-center gap-3 pl-1.5">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isHadir}
            onChange={(e) => onToggleHadir(siswa.nisn, e.target.checked)}
            className="rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-[11px] font-semibold text-muted">
            {isHadir ? 'Hadir' : 'Tandai absen'}
          </span>
        </label>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sunken text-[12px] font-extrabold text-muted">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight text-ink">{siswa.nama_siswa || siswa.nama}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">NISN {siswa.nisn}</p>
        </div>
        {!isHadir && hasAbsensi ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
              tone.badge
            )}
          >
            <span className={cn('size-1.5 rounded-full', tone.dot)} />
            {(STATUS.find((s) => s.key === current) || STATUS[0]).label}
          </span>
        ) : null}
      </div>

      {!isHadir ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="text-[10.5px] font-semibold text-muted">Pilih absen:</span>
          {ABSEN_STATUS.map((s) => {
            const toneS = TONE[s.tone];
            const active = current === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onStatus(siswa.nisn, s.key)}
                className={cn(
                  'inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-extrabold transition',
                  active
                    ? cn('border-transparent', toneS.soft, toneS.text)
                    : 'border-line bg-surface text-muted hover:text-ink'
                )}
              >
                <span className={cn('size-1.5 rounded-full', toneS.dot)} />
                {s.label}
              </button>
            );
          })}
        </div>
      ) : (
        <StatusPicker
          value={current}
          onChange={(v) => onStatus(siswa.nisn, v)}
          label={`Status kehadiran ${siswa.nama_siswa || siswa.nama}`}
          className="mt-3"
        />
      )}
    </div>
  );
}

/* =========================================================
   Baris tabel (desktop)
========================================================= */
function StudentRow({ index, siswa, status, isHadir, onStatus, onToggleHadir }) {
  const current = isHadir ? 'H' : (status || 'H');
  const tone = TONE[(STATUS.find((s) => s.key === current) || STATUS[0]).tone];
  const hasAbsensi = current !== 'H';
  return (
    <tr className="group border-b border-line/60 last:border-0 hover:bg-sunken/40">
      <td className="w-14 px-4 py-2.5">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isHadir}
            onChange={(e) => onToggleHadir(siswa.nisn, e.target.checked)}
            className="rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-[11px] font-semibold text-muted">
            {isHadir ? 'Hadir' : 'Tandai absen'}
          </span>
        </label>
      </td>
      <td className="w-14 px-4 py-2.5">
        <span className="text-[12px] font-bold tabular-nums text-muted">{index + 1}</span>
      </td>
      <td className="w-32 px-2 py-2.5">
        <span className="text-[12px] font-semibold tabular-nums text-muted">{siswa.nisn}</span>
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} />
          <span className="truncate text-[13.5px] font-bold text-ink">{siswa.nama_siswa || siswa.nama}</span>
        </div>
      </td>
      <td className="w-[340px] px-4 py-2">
        {!isHadir ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-semibold text-muted">Absen:</span>
            {ABSEN_STATUS.map((s) => {
              const toneS = TONE[s.tone];
              const active = current === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onStatus(siswa.nisn, s.key)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-1 text-[10.5px] font-extrabold transition',
                    active
                      ? cn('border-transparent', toneS.soft, toneS.text)
                      : 'border-line bg-surface text-muted hover:text-ink'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', toneS.dot)} />
                  {s.short}
                </button>
              );
            })}
          </div>
        ) : (
          <StatusPicker value={current} onChange={(v) => onStatus(siswa.nisn, v)} size="sm" label={`Status ${siswa.nama_siswa}`} />
        )}
      </td>
    </tr>
  );
}

/* =========================================================
   Halaman
========================================================= */
export default function InputAbsensi() {
  const { user, name } = useAuth();
  const toast = useToast();
  const isWali = String(user?.role || '').toLowerCase() === 'wali';

  const [tanggal, setTanggal] = useState(todayISO());
  const [kelas, setKelas] = useState('');
  const [kelasList, setKelasList] = useState([]);
  const [jamData, setJamData] = useState([]);
  const [jamTerisi, setJamTerisi] = useState([]);
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');

  const [siswa, setSiswa] = useState([]);
  const [status, setStatus] = useState({});
  const [hadirSet, setHadirSet] = useState(new Set());
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [photo, setPhoto] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  const mapel = user?.mapel || '';

  /* ---------------- config ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.getConfig();
        if (!alive) return;
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat data kelas');
        const list = res.kelas || [];
        setKelasList(list);
        setJamData(res.jamTersedia || []);
        const waliKelas = user?.kelas || user?.kelas_wali;
        if (isWali && waliKelas && list.includes(waliKelas)) setKelas(waliKelas);
      } catch (err) {
        if (alive) toast.error(err.message);
      } finally {
        if (alive) setLoadingConfig(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isWali, user?.kelas, user?.kelas_wali, toast]);

  /* ---------------- jam terisi ---------------- */
  const loadJamTerisi = useCallback(
    async (kelasName = kelas, date = tanggal) => {
      if (!kelasName) {
        setJamTerisi([]);
        return;
      }
      try {
        const res = await api.getJamTerisi(date, kelasName);
        setJamTerisi((res?.jamTerisi || []).map(Number));
      } catch {
        setJamTerisi([]);
      }
    },
    [kelas, tanggal]
  );

  /* ---------------- siswa ---------------- */
  const loadSiswa = useCallback(
    async (kelasName = kelas) => {
      if (!kelasName) {
        setSiswa([]);
        setStatus({});
        return;
      }
      setLoadingSiswa(true);
      try {
        const res = await api.getSiswa(kelasName);
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat siswa');
        const list = res.data || [];
        setSiswa(list);
        setStatus({});
        setHadirSet(new Set(list.map((s) => s.nisn)));
        setDirty(false);
      } catch (err) {
        setSiswa([]);
        toast.error(err.message);
      } finally {
        setLoadingSiswa(false);
      }
    },
    [kelas, toast]
  );

  useEffect(() => {
    if (!kelas) return;
    loadJamTerisi(kelas, tanggal);
    loadSiswa(kelas);
    setJamMulai('');
    setJamSelesai('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas]);

  useEffect(() => {
    if (kelas) loadJamTerisi(kelas, tanggal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  /* ---------------- unsaved guard ---------------- */
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* ---------------- turunan ---------------- */
  const setOne = (nisn, value) => {
    setStatus((prev) => ({ ...prev, [nisn]: value }));
    setDirty(true);
  };

  const markHadir = (nisn, checked) => {
    setHadirSet((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(nisn);
        setStatus((st) => {
          const nu = { ...st };
          delete nu[nisn];
          return nu;
        });
      } else {
        next.delete(nisn);
        // Saat Hadir dicabut: kalau sudah ada absen (non-H), pakai absen tersebut;
        // kalau masih Hadir/kosong, isi dengan Alpha sebagai absen default.
        setStatus((st) => {
          const nu = { ...st };
          const cur = nu[nisn];
          if (!cur || cur === 'H') nu[nisn] = 'A';
          return nu;
        });
      }
      setDirty(true);
      return next;
    });
  };

  const effectiveStatus = (nisn) => {
    if (hadirSet.has(nisn)) return 'H';
    return status[nisn] || 'H';
  };

  const counts = useMemo(() => {
    const c = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    siswa.forEach((s) => {
      const v = effectiveStatus(s.nisn);
      c[v] = (c[v] || 0) + 1;
    });
    return c;
  }, [siswa, status, hadirSet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return siswa.filter((s) => {
      const matchText =
        !q ||
        String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || effectiveStatus(s.nisn) === filterStatus;
      return matchText && matchStatus;
    });
  }, [siswa, status, hadirSet, query, filterStatus]);

  const total = siswa.length;
  const tidakHadir = total - counts.H;

  const jamOptions = useMemo(
    () =>
      jamData.map((j) => {
        const n = Number(j.no_jam);
        return {
          value: n,
          label: `Jam ${n}${j.mulai ? ` Â· ${formatJam(j.mulai)}` : ''}`,
          disabled: jamTerisi.includes(n),
        };
      }),
    [jamData, jamTerisi]
  );

  const jamSelesaiOptions = useMemo(
    () => jamOptions.filter((o) => !jamMulai || o.value >= Number(jamMulai)),
    [jamOptions, jamMulai]
  );

  /* ---------------- aksi ---------------- */
  const markAllPresent = () => {
    const q = query.trim().toLowerCase();
    let changed = 0;
    let skip = 0;
    setStatus((prev) => {
      const next = { ...prev };
      siswa.forEach((s) => {
        const matchText =
          !q ||
          String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) ||
          String(s.nisn || '').toLowerCase().includes(q);
        if (!matchText) return;
        if (filterStatus && (prev[s.nisn] || 'H') !== filterStatus) return;
        const cur = prev[s.nisn] || 'H';
        if (cur !== 'H') {
          // sudah ada absen (non-H) â†’ jangan timpa dengan Hadir
          skip += 1;
          return;
        }
        if (cur !== 'H') return;
        next[s.nisn] = 'H';
        changed += 1;
      });
      return next;
    });
    setHadirSet((prev) => {
      const next = new Set(prev);
      siswa.forEach((s) => {
        const matchText =
          !q ||
          String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) ||
          String(s.nisn || '').toLowerCase().includes(q);
        if (!matchText) return;
        next.add(s.nisn);
      });
      return next;
    });
    setDirty(true);
    if (skip > 0 && changed > 0)
      toast.success(`${changed} siswa ditandai hadir Â· ${skip} siswa tetap absen (tidak ditimpa).`);
    else if (skip > 0)
      toast.success(`${skip} siswa sudah memiliki absen, tidak ditimpa.`);
    else
      toast.success(changed ? `${changed} siswa ditandai hadir` : 'Semua siswa sudah hadir');
  };

  const simpan = async () => {
    if (saving) return;
    if (!kelas) return toast.warning('Pilih kelas terlebih dahulu.');
    if (!jamMulai) return toast.warning('Pilih jam mulai.');
    if (!jamSelesai) return toast.warning('Pilih jam selesai.');
    if (Number(jamSelesai) < Number(jamMulai)) return toast.warning('Jam selesai tidak boleh sebelum jam mulai.');
    for (let j = Number(jamMulai); j <= Number(jamSelesai); j += 1) {
      if (jamTerisi.includes(j)) return toast.warning(`Jam ke-${j} sudah terisi untuk kelas ini.`);
    }
    if (!siswa.length) return toast.warning('Belum ada data siswa.');

    setSaving(true);
    try {
      let fotoUrl = '';
      if (photo) {
        try {
          const up = await api.uploadFoto(photo);
          if (up?.success) fotoUrl = up.downloadUrl || up.url || '';
          else toast.warning('Foto gagal diunggah. Absensi tetap disimpan tanpa foto.');
        } catch (fotoErr) {
          // absensi tetap disimpan; hanya fotonya yang hilang
          toast.warning('Foto gagal diunggah (' + (fotoErr?.message || 'jaringan') + '). Absensi tetap disimpan tanpa foto.');
        }
      }

      const detail = siswa.map((s) => ({
        nisn: s.nisn,
        nama_siswa: s.nama_siswa || s.nama || '',
        status: effectiveStatus(s.nisn),
      }));

      const res = await api.simpanAbsensi({
        tanggal,
        kelas,
        mapel,
        guru: name,
        jam_mulai: Number(jamMulai),
        jam_selesai: Number(jamSelesai),
        foto: fotoUrl,
        detail,
      });

      if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan absensi');

      toast.success(`Absensi ${kelas} tersimpan`);
      if (res.kasusDibuat > 0) {
        toast.warning(
          `${res.kasusDibuat} kasus pembinaan dibuat otomatis (siswa mencapai 3Ã— Alpha/Cabut).`
        );
      }
      setDirty(false);
      setPhoto('');
      setJamMulai('');
      setJamSelesai('');
      await loadJamTerisi(kelas, tanggal);
      await loadSiswa(kelas);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- kamera ---------------- */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak didukung browser ini.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Aktifkan izin kamera pada browser.'
          : err.message || 'Gagal membuka kamera.'
      );
    }
  }, []);

  useEffect(() => {
    if (cameraOpen) startCamera();
    else stopCamera();
    return stopCamera;
  }, [cameraOpen, startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL('image/jpeg', 0.82));
    setCameraOpen(false);
    toast.success('Foto kelas diambil');
  };

  /* ---------------- render ---------------- */
  return (
    <div className="space-y-3">
      {/* ---- Sesi absensi ---- */}
      <Card className="animate-rise p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <CalendarDays className="size-[18px]" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Sesi Absensi</h1>
              <p className="text-[11.5px] font-semibold text-muted">
                {mapel ? `${mapel} Â· ${name}` : name}
              </p>
            </div>
          </div>
          {kelas && (
            <Badge tone="brand">
              <School className="size-3" /> {kelas}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Field label="Tanggal">
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-sunken/50 px-3 text-[13px] font-semibold text-ink outline-none transition focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10"
            />
          </Field>

          <Field label="Kelas">
            <Select value={kelas} onChange={(e) => setKelas(e.target.value)} disabled={loadingConfig}>
              <option value="">Pilih kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Jam mulai">
            <Select value={jamMulai} onChange={(e) => setJamMulai(e.target.value)}>
              <option value="">Pilih jam</option>
              {jamOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                  {o.disabled ? ' Â· terisi' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Jam selesai">
            <Select value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} disabled={!jamMulai}>
              <option value="">Pilih jam</option>
              {jamSelesaiOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                  {o.disabled ? ' Â· terisi' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              loadJamTerisi();
              loadSiswa();
            }}
            disabled={!kelas || loadingSiswa}
          >
            <RefreshCw className={cn('size-3.5', loadingSiswa && 'animate-spin')} />
            Muat ulang siswa
          </Button>

          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition',
              photo
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-line bg-surface text-muted hover:text-ink'
            )}
          >
            <Camera className="size-3.5" />
            {photo ? 'Foto siap' : 'Foto kelas'}
          </button>

          {photo && (
            <button
              type="button"
              onClick={() => setPhoto('')}
              className="grid size-9 place-items-center rounded-xl text-muted hover:bg-sunken"
              aria-label="Hapus foto"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </Card>

      {/* ---- Daftar siswa ---- */}
      <Card className="animate-rise overflow-hidden" style={{ animationDelay: '40ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <Users className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Daftar Siswa</h2>
              <p className="text-[11.5px] font-semibold text-muted">
                {kelas ? `${kelas} Â· ${total} siswa` : 'Belum ada kelas dipilih'}
              </p>
            </div>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <p className="text-[11.5px] font-bold text-muted">
                {counts.H} hadir Â·{' '}
                <span className={tidakHadir ? 'text-rose-500' : ''}>{tidakHadir} tidak hadir</span>
              </p>
              <button
                type="button"
                onClick={markAllPresent}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-[11px] font-extrabold text-brand transition active:scale-95"
              >
                <CheckCheck className="size-3.5" /> Semua hadir
              </button>
            </div>
          )}
        </div>

        {/* toolbar */}
        <div className="space-y-2 px-4 py-3 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau NISNâ€¦"
              className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-10 pr-3 text-[13px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 lg:flex lg:flex-wrap">
            {STATUS.map((s) => {
              const tone = TONE[s.tone];
              const active = filterStatus === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFilterStatus(active ? null : s.key)}
                  className={cn(
                    'inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-2 text-[11.5px] font-extrabold transition lg:shrink-0 lg:px-2.5',
                    active
                      ? cn('border-transparent', tone.soft, tone.text)
                      : 'border-line bg-surface text-muted hover:text-ink'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', tone.dot)} />
                  {s.label}
                  <span className="tabular-nums opacity-70">{counts[s.key]}</span>
                </button>
              );
            })}

          </div>
        </div>

        {/* list */}
        <div className="border-t border-line/70">
          {loadingSiswa ? (
            <div className="space-y-2.5 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-line p-3.5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="mt-3 h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          ) : !total ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada data siswa"
              description="Pilih kelas di atas â€” daftar siswa akan dimuat otomatis."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada siswa yang cocok"
              description="Coba kata kunci lain atau hapus filter status."
            />
          ) : (
            <>
              {/* mobile cards */}
              <div className="space-y-2.5 p-3 lg:hidden">
                {filtered.map((s) => (
                  <StudentCard
                    key={s.nisn}
                    index={siswa.indexOf(s)}
                    siswa={s}
                    status={status[s.nisn]}
                    isHadir={hadirSet.has(s.nisn)}
                    onStatus={(v) => setOne(s.nisn, v)}
                    onToggleHadir={(nisn, checked) => markHadir(nisn, checked)}
                  />
                ))}
              </div>

              {/* desktop table */}
              <div className="hidden max-h-[62vh] overflow-auto lg:block">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                    <tr className="border-b border-line text-left">
                      <th className="w-14 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">No</th>
                      <th className="w-32 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">NISN</th>
                      <th className="px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Nama siswa</th>
                      <th className="w-[340px] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        Status kehadiran
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <StudentRow
                        key={s.nisn}
                        index={siswa.indexOf(s)}
                        siswa={s}
                        status={status[s.nisn]}
                        isHadir={hadirSet.has(s.nisn)}
                        onStatus={(v) => setOne(s.nisn, v)}
                        onToggleHadir={(nisn, checked) => markHadir(nisn, checked)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ---- action bar ---- */}
      {total > 0 && (
        <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2.5 pl-4 shadow-float backdrop-blur">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-ink">
                {total} siswa Â· {counts.H} hadir
                {tidakHadir > 0 && <span className="text-rose-500"> Â· {tidakHadir} tidak hadir</span>}
              </p>
              <p className="truncate text-[10.5px] font-semibold text-muted">
                {dirty ? 'Ada perubahan belum disimpan' : 'Siap disimpan'}
              </p>
            </div>
            <Button onClick={simpan} loading={saving} variant="success" size="md" className="shrink-0">
              {!saving && <Check className="size-4" />}
              Simpan
            </Button>
          </div>
        </div>
      )}

      {/* ---- camera sheet ---- */}
      <Sheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title="Foto kelas"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCameraOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={capture} disabled={!cameraReady}>
              <Camera className="size-4" /> Ambil foto
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-slate-950">
            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 grid place-items-center text-[12px] font-semibold text-white/70">
                Membuka kameraâ€¦
              </div>
            )}
          </div>
          {cameraError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:text-rose-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              {cameraError}
            </div>
          )}
          <p className="text-[11.5px] font-medium text-muted">
            Foto bersifat opsional dan diunggah ke Google Drive saat absensi disimpan.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

