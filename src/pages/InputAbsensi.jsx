import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ClipboardList,
  Info,
  MessageCircle,
  RefreshCw,
  School,
  Search,
  Users,
  X,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { labelLibur, liburInfo } from '../lib/libur';
import { pesanAbsenSiswa } from '../lib/whatsapp';
import { cn, formatJam, STATUS, STATUS_MAP, TONE, todayISO } from '../lib/utils';
import { Badge, Button, Card, EmptyState, Field, Select, Sheet, Skeleton } from '../components/ui';
import StatusPicker from '../components/StatusPicker';
import WaButton from '../components/WaButton';

function jamRange(mulai, selesai) {
  const a = Number(mulai);
  const b = Number(selesai);
  if (!a || !b || b < a) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/* =========================================================
   Kartu siswa (mobile)
========================================================= */
function StudentCard({
  index,
  siswa,
  statusJam,
  savedJam,
  jamDipilih,
  editJam,
  isHadir,
  onStatus,
  onToggleHadir,
}) {
  const activeKey = editJam === 'all' ? statusJam[jamDipilih[0]] || 'H' : statusJam[editJam] || 'H';
  const worst = jamDipilih.reduce((acc, j) => {
    const st = statusJam[j] || 'H';
    const p = { C: 5, A: 4, S: 3, I: 2, H: 1 };
    return (p[st] || 0) > (p[acc] || 0) ? st : acc;
  }, 'H');
  const tone = TONE[(STATUS_MAP[worst] || STATUS[0]).tone];
  const savedNonH = Object.entries(savedJam || {})
    .filter(([, v]) => v && v !== 'H')
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border bg-surface p-3.5 shadow-card transition',
        worst === 'H' ? 'border-line' : tone.border
      )}
    >
      <div className="flex items-center gap-2.5">
        <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-sunken/60 px-2.5">
          <input
            type="checkbox"
            checked={isHadir}
            aria-label={`Tandai ${siswa.nama_siswa || siswa.nama} hadir`}
            onChange={(e) => onToggleHadir(siswa.nisn, e.target.checked)}
            className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-[11px] font-extrabold text-ink">{isHadir ? 'Hadir' : 'Absen'}</span>
        </label>

        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sunken text-[12px] font-extrabold text-muted">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight text-ink">{siswa.nama_siswa || siswa.nama}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">NISN {siswa.nisn}</p>
        </div>

        {worst !== 'H' && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
              tone.badge
            )}
          >
            <span className={cn('size-1.5 rounded-full', tone.dot)} />
            {STATUS_MAP[worst]?.label}
          </span>
        )}
      </div>

      {/* Chip per jam */}
      {jamDipilih.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-extrabold uppercase text-muted">Diisi:</span>
          {jamDipilih.map((j) => {
            const st = statusJam[j] || 'H';
            const t = TONE[(STATUS_MAP[st] || STATUS[0]).tone];
            return (
              <span
                key={j}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold',
                  st === 'H' ? 'bg-sunken text-muted' : cn(t.soft, t.text)
                )}
              >
                J{j} {st === 'H' ? '✓' : STATUS_MAP[st]?.label}
              </span>
            );
          })}
        </div>
      )}

      {savedNonH.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-extrabold uppercase text-muted">Tersimpan:</span>
          {savedNonH.map(([j, st]) => {
            const t = TONE[(STATUS_MAP[st] || STATUS[0]).tone];
            return (
              <span
                key={j}
                className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold', t.soft, t.text)}
              >
                J{j} {st}
              </span>
            );
          })}
        </div>
      )}

      <StatusPicker
        value={activeKey}
        onChange={(v) => onStatus(siswa.nisn, v)}
        label={`Status kehadiran ${siswa.nama_siswa || siswa.nama}`}
        className="mt-3"
      />
    </div>
  );
}

/* =========================================================
   Baris tabel (desktop)
========================================================= */
function StudentRow({
  index,
  siswa,
  statusJam,
  savedJam,
  jamDipilih,
  editJam,
  isHadir,
  onStatus,
  onToggleHadir,
}) {
  const activeKey = editJam === 'all' ? statusJam[jamDipilih[0]] || 'H' : statusJam[editJam] || 'H';
  const worst = jamDipilih.reduce((acc, j) => {
    const st = statusJam[j] || 'H';
    const p = { C: 5, A: 4, S: 3, I: 2, H: 1 };
    return (p[st] || 0) > (p[acc] || 0) ? st : acc;
  }, 'H');
  const tone = TONE[(STATUS_MAP[worst] || STATUS[0]).tone];
  const savedNonH = Object.entries(savedJam || {})
    .filter(([, v]) => v && v !== 'H')
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <tr className="group border-b border-line/60 last:border-0 hover:bg-sunken/40">
      <td className="w-24 px-4 py-2.5">
        <label className="flex min-h-9 cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={isHadir}
            aria-label={`Tandai ${siswa.nama_siswa || siswa.nama} hadir`}
            onChange={(e) => onToggleHadir(siswa.nisn, e.target.checked)}
            className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span className="text-[11px] font-bold text-muted">{isHadir ? 'Hadir' : 'Absen'}</span>
        </label>
      </td>
      <td className="w-12 px-2 py-2.5">
        <span className="text-[12px] font-bold tabular-nums text-muted">{index + 1}</span>
      </td>
      <td className="w-28 px-2 py-2.5">
        <span className="text-[12px] font-semibold tabular-nums text-muted">{siswa.nisn}</span>
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} />
          <span className="truncate text-[13.5px] font-bold text-ink">{siswa.nama_siswa || siswa.nama}</span>
        </div>
        {(jamDipilih.length > 1 || savedNonH.length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {jamDipilih.length > 1 &&
              jamDipilih.map((j) => {
                const st = statusJam[j] || 'H';
                const t = TONE[(STATUS_MAP[st] || STATUS[0]).tone];
                return (
                  <span
                    key={j}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[9.5px] font-extrabold',
                      st === 'H' ? 'bg-sunken text-muted' : cn(t.soft, t.text)
                    )}
                  >
                    J{j} {st === 'H' ? '✓' : st}
                  </span>
                );
              })}
            {savedNonH.map(([j, st]) => {
              const t = TONE[(STATUS_MAP[st] || STATUS[0]).tone];
              return (
                <span key={`s-${j}`} className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-extrabold', t.soft, t.text)}>
                  Tersimpan J{j}:{st}
                </span>
              );
            })}
          </div>
        )}
      </td>
      <td className="w-[340px] px-4 py-2">
        <StatusPicker
          value={activeKey}
          onChange={(v) => onStatus(siswa.nisn, v)}
          size="sm"
          label={`Status ${siswa.nama_siswa || siswa.nama}`}
        />
      </td>
    </tr>
  );
}

/* =========================================================
   Halaman
========================================================= */
export default function InputAbsensi() {
  const { user, name, role } = useAuth();
  const toast = useToast();
  const isWali = String(user?.role || '').toLowerCase() === 'wali';

  const [tanggal, setTanggal] = useState(todayISO());
  const [kelas, setKelas] = useState('');
  const [kelasList, setKelasList] = useState([]);
  const [jamData, setJamData] = useState([]);
  const [jamTerisi, setJamTerisi] = useState([]);
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [editJam, setEditJam] = useState('all'); // 'all' | number

  const [siswa, setSiswa] = useState([]);
  // perJamState: { [nisn]: { [jam]: 'H'|'S'|'I'|'A'|'C' } }
  const [perJamState, setPerJamState] = useState({});
  const [tercatatHari, setTercatatHari] = useState({ guruList: [], savedByNisn: {} });
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [waAfterSave, setWaAfterSave] = useState(null);

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
  const libur = useMemo(() => liburInfo(tanggal), [tanggal]);

  const jamDipilih = useMemo(() => {
    const list = jamRange(jamMulai, jamSelesai);
    return list.length ? list : [1];
  }, [jamMulai, jamSelesai]);

  useEffect(() => {
    if (editJam !== 'all' && !jamDipilih.includes(Number(editJam))) {
      setEditJam('all');
    }
  }, [jamDipilih, editJam]);

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

  /* ---------------- jam terisi & tercatat hari ini ---------------- */
  const loadJamTerisi = useCallback(
    async (kelasName = kelas, date = tanggal) => {
      if (!kelasName) {
        setJamTerisi([]);
        setTercatatHari({ guruList: [], savedByNisn: {} });
        return;
      }
      try {
        const [jamRes, piketRes] = await Promise.all([
          api.getJamTerisi(date, kelasName),
          api.getDashboardPiket(date, kelasName).catch(() => null),
        ]);
        setJamTerisi((jamRes?.jamTerisi || []).map(Number));
        const d = piketRes?.data?.[0];
        const savedByNisn = {};
        (d?.siswaList || []).forEach((s) => {
          savedByNisn[String(s.nisn)] = s.jam || {};
        });
        setTercatatHari({ guruList: d?.guruList || [], savedByNisn });
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
        setPerJamState({});
        return;
      }
      setLoadingSiswa(true);
      // Reset pilihan sebelum await agar tidak menimpa klik cepat setelah fetch
      setPerJamState({});
      setEditJam('all');
      setDirty(false);
      try {
        const res = await api.getSiswa(kelasName);
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat siswa');
        setSiswa(res.data || []);
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

  /* ---------------- turunan status ---------------- */
  const setOne = (nisn, value) => {
    setPerJamState((prev) => {
      const cur = { ...(prev[nisn] || {}) };
      if (editJam === 'all') {
        jamDipilih.forEach((j) => {
          if (value === 'H') delete cur[j];
          else cur[j] = value;
        });
      } else {
        const j = Number(editJam);
        if (value === 'H') delete cur[j];
        else cur[j] = value;
      }
      return { ...prev, [nisn]: cur };
    });
    setDirty(true);
  };

  const markHadir = (nisn, checked) => {
    setPerJamState((prev) => {
      const cur = { ...(prev[nisn] || {}) };
      const targets = editJam === 'all' ? jamDipilih : [Number(editJam)];
      if (checked) {
        targets.forEach((j) => delete cur[j]);
      } else {
        targets.forEach((j) => {
          if (!cur[j] || cur[j] === 'H') cur[j] = 'A';
        });
      }
      return { ...prev, [nisn]: cur };
    });
    setDirty(true);
  };

  const worstStatusSiswa = useCallback(
    (nisn) => {
      const map = perJamState[nisn] || {};
      const p = { C: 5, A: 4, S: 3, I: 2, H: 1 };
      return jamDipilih.reduce((acc, j) => {
        const st = map[j] || 'H';
        return (p[st] || 0) > (p[acc] || 0) ? st : acc;
      }, 'H');
    },
    [perJamState, jamDipilih]
  );

  const isSiswaHadir = useCallback(
    (nisn) => {
      const map = perJamState[nisn] || {};
      if (editJam === 'all') return jamDipilih.every((j) => !map[j] || map[j] === 'H');
      const st = map[Number(editJam)] || 'H';
      return st === 'H';
    },
    [perJamState, jamDipilih, editJam]
  );

  const counts = useMemo(() => {
    const c = { H: 0, S: 0, I: 0, A: 0, C: 0 };
    siswa.forEach((s) => {
      const v = worstStatusSiswa(s.nisn);
      c[v] = (c[v] || 0) + 1;
    });
    return c;
  }, [siswa, worstStatusSiswa]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return siswa.filter((s) => {
      const matchText =
        !q ||
        String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || worstStatusSiswa(s.nisn) === filterStatus;
      return matchText && matchStatus;
    });
  }, [siswa, query, filterStatus, worstStatusSiswa]);

  const total = siswa.length;
  const tidakHadir = total - counts.H;

  const jamOptions = useMemo(
    () =>
      jamData.map((j) => {
        const n = Number(j.no_jam);
        return {
          value: n,
          label: `Jam ${n}${j.mulai ? ` · ${formatJam(j.mulai)}` : ''}`,
          disabled: jamTerisi.includes(n),
        };
      }),
    [jamData, jamTerisi]
  );

  const jamSelesaiOptions = useMemo(
    () => jamOptions.filter((o) => !jamMulai || o.value >= Number(jamMulai)),
    [jamOptions, jamMulai]
  );

  const onChangeJamMulai = (val) => {
    setJamMulai(val);
    if (!val) {
      setJamSelesai('');
      return;
    }
    const n = Number(val);
    setJamSelesai((prev) => {
      const p = Number(prev);
      if (p && p >= n && !jamTerisi.includes(p)) return prev;
      return val;
    });
  };

  const hasOverlapTerisi = useMemo(() => {
    if (!jamMulai || !jamSelesai) return false;
    return jamRange(jamMulai, jamSelesai).some((j) => jamTerisi.includes(j));
  }, [jamMulai, jamSelesai, jamTerisi]);

  /* ---------------- aksi ---------------- */
  const markAllPresent = () => {
    const q = query.trim().toLowerCase();
    let changed = 0;
    let skip = 0;
    setPerJamState((prev) => {
      const next = { ...prev };
      siswa.forEach((s) => {
        const matchText =
          !q ||
          String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) ||
          String(s.nisn || '').toLowerCase().includes(q);
        if (!matchText) return;
        const w = worstStatusSiswa(s.nisn);
        if (filterStatus && w !== filterStatus) return;
        if (w !== 'H') {
          skip += 1;
          return;
        }
        changed += 1;
        delete next[s.nisn];
      });
      return next;
    });
    setDirty(true);
    if (skip > 0 && changed > 0) {
      toast.success(`${changed} siswa tetap hadir · ${skip} siswa non-hadir tidak ditimpa.`);
    } else if (skip > 0) {
      toast.success(`${skip} siswa sudah memiliki status absen, tidak ditimpa.`);
    } else {
      toast.success(`Semua ${total} siswa ditandai hadir`);
    }
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
          toast.warning(`Foto gagal diunggah (${fotoErr?.message || 'jaringan'}). Absensi tetap disimpan tanpa foto.`);
        }
      }

      const range = jamRange(jamMulai, jamSelesai);
      const absenList = [];

      const detail = siswa.map((s) => {
        const map = perJamState[s.nisn] || {};
        const perJam = {};
        range.forEach((j) => {
          perJam[j] = map[j] || 'H';
        });
        const worst = worstStatusSiswa(s.nisn);
        if (worst !== 'H') {
          const jamNonH = range.filter((j) => perJam[j] !== 'H');
          absenList.push({
            nisn: s.nisn,
            nama: s.nama_siswa || s.nama || '',
            no_hp_ortu: s.no_hp_ortu || '',
            status: worst,
            jamList: jamNonH,
          });
        }
        return {
          nisn: s.nisn,
          nama_siswa: s.nama_siswa || s.nama || '',
          status: worst,
          perJam,
        };
      });

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
        toast.warning(`${res.kasusDibuat} kasus pembinaan dibuat otomatis (siswa mencapai 3× Alpha/Cabut).`);
      }

      if (absenList.length > 0) {
        setWaAfterSave({ kelas, tanggal, mapel, list: absenList });
      }

      setDirty(false);
      setPhoto('');
      setJamMulai('');
      setJamSelesai('');
      setEditJam('all');
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
              <p className="text-[11.5px] font-semibold text-muted">{mapel ? `${mapel} · ${name}` : name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {libur.libur && <Badge tone="violet">{labelLibur(tanggal)}</Badge>}
            {kelas && (
              <Badge tone="brand">
                <School className="size-3" /> {kelas}
              </Badge>
            )}
          </div>
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
            <Select value={jamMulai} onChange={(e) => onChangeJamMulai(e.target.value)}>
              <option value="">Pilih jam</option>
              {jamOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                  {o.disabled ? ' · terisi' : ''}
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
                  {o.disabled ? ' · terisi' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {hasOverlapTerisi && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] font-semibold text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Sebagian jam sudah tersimpan untuk kelas ini. Untuk mengubah data yang sudah disimpan, buka{' '}
              {role === 'admin' ? (
                <Link to="/riwayat" className="font-extrabold underline">
                  Riwayat → Edit
                </Link>
              ) : (
                <b>Riwayat → Edit</b>
              )}
              .
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
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

      {/* ---- Tercatat hari ini ---- */}
      {kelas && tercatatHari.guruList.length > 0 && (
        <Card className="animate-rise p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-extrabold text-ink">
              Tercatat hari ini ({tercatatHari.guruList.length} sesi)
            </p>
            {role === 'admin' && (
              <Link to="/riwayat" className="text-[11.5px] font-extrabold text-brand hover:underline">
                Riwayat → Edit
              </Link>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {tercatatHari.guruList.map((g, i) => (
              <div key={i} className="rounded-xl bg-sunken/50 px-3 py-2 text-[11.5px]">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-extrabold text-ink">
                    {Array.isArray(g.jam) && g.jam.length ? `Jam ${g.jam.join(', ')}` : 'Jam —'} · {g.mapel || 'Mapel'}
                  </span>
                  <span className="font-semibold text-muted">{g.nama}</span>
                </div>
                {Array.isArray(g.absen) && g.absen.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.absen.map((a) => (
                      <span
                        key={a.nisn}
                        className="rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300"
                      >
                        {a.nama} ({a.status})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Notifikasi WA cepat setelah simpan ---- */}
      {waAfterSave && (
        <Card className="animate-rise border-emerald-500/35 bg-emerald-500/[0.05] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-[13px] font-extrabold text-ink">
                  Kirim Info WhatsApp Gratis ({waAfterSave.list.length} siswa tidak hadir)
                </p>
                <p className="text-[11px] font-semibold text-muted">
                  Ketuk tombol WA di bawah untuk langsung memberi kabar ke orang tua.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWaAfterSave(null)}
              aria-label="Tutup panel WhatsApp"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-2.5 divide-y divide-emerald-500/15">
            {waAfterSave.list.map((s) => (
              <li key={s.nisn} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-ink">
                    {s.nama}{' '}
                    <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400">
                      ({STATUS_MAP[s.status]?.label || s.status})
                    </span>
                  </p>
                  <p className="text-[10.5px] font-semibold text-muted">
                    {s.jamList?.length ? `Jam ${s.jamList.join(', ')}` : 'Sesi tersimpan'}
                    {s.no_hp_ortu ? ` · ${s.no_hp_ortu}` : ' · Pilih kontak manual di WA'}
                  </p>
                </div>
                <WaButton
                  size="xs"
                  phone={s.no_hp_ortu}
                  message={pesanAbsenSiswa({
                    nama: s.nama,
                    kelas: waAfterSave.kelas,
                    tanggal: waAfterSave.tanggal,
                    status: s.status,
                    jamList: s.jamList,
                    mapel: waAfterSave.mapel,
                  })}
                  label="Kirim WA"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

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
                {kelas ? `${kelas} · ${total} siswa` : 'Belum ada kelas dipilih'}
              </p>
            </div>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <p className="text-[11.5px] font-bold text-muted">
                {counts.H} hadir ·{' '}
                <span className={tidakHadir ? 'text-rose-500' : ''}>{tidakHadir} tidak hadir</span>
              </p>
              <button
                type="button"
                onClick={markAllPresent}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-soft px-3 text-[11.5px] font-extrabold text-brand transition active:scale-95"
              >
                <CheckCheck className="size-3.5" /> Semua hadir
              </button>
            </div>
          )}
        </div>

        {/* Pemilih status per jam */}
        {jamDipilih.length > 1 && total > 0 && (
          <div className="mx-4 mt-3 rounded-2xl border border-line bg-sunken/40 p-2.5 sm:mx-5">
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Status diisi untuk:
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEditJam('all')}
                className={cn(
                  'min-h-9 rounded-xl px-3 text-[11.5px] font-extrabold transition',
                  editJam === 'all' ? 'bg-brand text-white shadow-sm' : 'border border-line bg-surface text-muted'
                )}
              >
                Semua jam
              </button>
              {jamDipilih.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setEditJam(j)}
                  className={cn(
                    'min-h-9 rounded-xl px-3 text-[11.5px] font-extrabold transition',
                    Number(editJam) === j ? 'bg-brand text-white shadow-sm' : 'border border-line bg-surface text-muted'
                  )}
                >
                  Jam {j}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* toolbar */}
        <div className="space-y-2 px-4 py-3 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau NISN…"
              className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-10 pr-10 text-[13px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
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
                    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-extrabold transition lg:shrink-0',
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
              description="Pilih kelas di atas — daftar siswa akan dimuat otomatis."
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
                    statusJam={perJamState[s.nisn] || {}}
                    savedJam={tercatatHari.savedByNisn[String(s.nisn)] || {}}
                    jamDipilih={jamDipilih}
                    editJam={editJam}
                    isHadir={isSiswaHadir(s.nisn)}
                    onStatus={setOne}
                    onToggleHadir={markHadir}
                  />
                ))}
              </div>

              {/* desktop table */}
              <div className="hidden max-h-[62vh] overflow-auto lg:block">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                    <tr className="border-b border-line text-left">
                      <th className="w-24 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        Hadir
                      </th>
                      <th className="w-12 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        No
                      </th>
                      <th className="w-28 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        NISN
                      </th>
                      <th className="px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">
                        Nama siswa
                      </th>
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
                        statusJam={perJamState[s.nisn] || {}}
                        savedJam={tercatatHari.savedByNisn[String(s.nisn)] || {}}
                        jamDipilih={jamDipilih}
                        editJam={editJam}
                        isHadir={isSiswaHadir(s.nisn)}
                        onStatus={setOne}
                        onToggleHadir={markHadir}
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
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2.5 pl-4 shadow-float backdrop-blur">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-ink">
                {total} siswa · {counts.H} hadir
                {tidakHadir > 0 && <span className="text-rose-500"> · {tidakHadir} tidak hadir</span>}
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
                Membuka kamera…
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
