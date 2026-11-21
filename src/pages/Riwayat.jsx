import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Eye,
  Image as ImageIcon,
  PencilLine,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { cn, formatTanggal, STATUS, STATUS_MAP, TONE } from '../lib/utils';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Sheet,
  Skeleton,
} from '../components/ui';
import StatusPicker from '../components/StatusPicker';
import SearchSuggest from '../components/SearchSuggest';

const PRIOR = { C: 5, A: 4, S: 3, I: 2, H: 1 };

function encodeSessionId(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  const payload = {
    tanggal: String(item.tanggal || '').trim(),
    kelas: String(item.kelas || '').trim(),
    mapel: String(item.mapel || '').trim(),
    guru: String(item.guru || '').trim(),
  };
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
  } catch {
    return String(item.id || `${payload.tanggal}|${payload.kelas}|${payload.mapel}|${payload.guru}`);
  }
}

function formatJamLabel(jamList, jamMulai, jamSelesai) {
  if (Array.isArray(jamList) && jamList.length > 0) {
    const first = jamList[0];
    const last = jamList[jamList.length - 1];
    const contiguous = jamList.every((j, idx) => j === first + idx);
    if (jamList.length === 1) return `Jam ${first}`;
    if (contiguous) return `Jam ${first}–${last}`;
    return `Jam ${jamList.join(', ')}`;
  }
  if (!jamMulai) return 'Jam –';
  return jamSelesai && jamSelesai !== jamMulai ? `Jam ${jamMulai}–${jamSelesai}` : `Jam ${jamMulai}`;
}

function groupDetailByStudent(rows) {
  const map = new Map();
  const jamSet = new Set();

  (rows || []).forEach((r) => {
    const jam = Number(r.jam) || 0;
    if (jam > 0) jamSet.add(jam);
    const key = String(r.nisn || r.nama_siswa || '').replace(/^0+/, '') || String(r.nama_siswa || '');
    const st = r.status || 'H';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        nisn: r.nisn || '',
        nama_siswa: r.nama_siswa || 'Siswa',
        jamMap: jam > 0 ? { [jam]: st } : {},
        worst: st,
        rows: [r],
      });
    } else {
      if (jam > 0) existing.jamMap[jam] = st;
      if ((PRIOR[st] || 0) > (PRIOR[existing.worst] || 0)) existing.worst = st;
      existing.rows.push(r);
    }
  });

  const jamList = [...jamSet].sort((a, b) => a - b);
  const students = [...map.values()].sort((a, b) =>
    String(a.nama_siswa).localeCompare(String(b.nama_siswa))
  );
  const counts = { H: 0, S: 0, I: 0, A: 0, C: 0 };
  students.forEach((s) => {
    if (counts[s.worst] !== undefined) counts[s.worst] += 1;
  });

  return { students, jamList, counts };
}

export default function Riwayat() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState('');
  const [kelas, setKelas] = useState('');
  const [query, setQuery] = useState('');

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailQuery, setDetailQuery] = useState('');
  const [detailStatusFilter, setDetailStatusFilter] = useState('ALL');
  const detailReqRef = useRef(0);

  const [edit, setEdit] = useState(null);
  const [editRows, setEditRows] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editJamFilter, setEditJamFilter] = useState('all');
  const [editQuery, setEditQuery] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const editReqRef = useRef(0);
  const [truncated, setTruncated] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (opts = {}) => {
      setLoading(true);
      try {
        const params = {};
        if (opts.tanggal) params.tanggal = opts.tanggal;
        if (opts.kelas) params.kelas = opts.kelas;
        const res = await api.getRiwayatAbsensi(params);
        if (!res?.success) throw new Error(res?.error || 'Gagal memuat riwayat');
        setSessions(res.data || []);
        setTruncated(Boolean(res.truncated));
        if (res.truncated && !opts.tanggal && !opts.kelas) {
          toast.warning('Menampilkan sesi terbaru. Pilih tanggal atau kelas untuk melihat riwayat lebih lama.');
        }
      } catch (err) {
        setSessions([]);
        setTruncated(false);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load({ tanggal, kelas });
  }, [load, tanggal, kelas]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getConfig();
        if (res?.success) setKelasList(res.kelas || []);
      } catch {
        /* opsional */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (tanggal && String(s.tanggal) !== String(tanggal)) return false;
      if (kelas && String(s.kelas) !== String(kelas)) return false;
      if (!q) return true;
      return [s.kelas, s.mapel, s.guru].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [sessions, tanggal, kelas, query]);

  const sessionSuggestions = useMemo(() => {
    const mapelCount = new Map();
    const guruCount = new Map();
    sessions.forEach((s) => {
      if (tanggal && String(s.tanggal) !== String(tanggal)) return;
      if (kelas && String(s.kelas) !== String(kelas)) return;
      if (s.mapel) mapelCount.set(s.mapel, (mapelCount.get(s.mapel) || 0) + 1);
      if (s.guru) guruCount.set(s.guru, (guruCount.get(s.guru) || 0) + 1);
    });
    const out = [];
    [...mapelCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([m, n]) =>
        out.push({
          value: m,
          label: m,
          sub: `${n} sesi tersedia`,
          badge: 'Mapel',
          badgeTone: 'brand',
          group: 'mapel',
        })
      );
    [...guruCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([g, n]) =>
        out.push({
          value: g,
          label: g,
          sub: `${n} sesi tersedia`,
          badge: 'Guru',
          badgeTone: 'violet',
          group: 'guru',
        })
      );
    return out;
  }, [sessions, tanggal, kelas]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((s) => {
      const key = s.kelas || 'Tanpa kelas';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [filtered]);

  const openDetail = async (item) => {
    const reqId = ++detailReqRef.current;
    setDetail({ meta: item, rows: [] });
    setDetailError('');
    setDetailQuery('');
    setDetailStatusFilter('ALL');
    setDetailLoading(true);
    try {
      const res = await api.getDetailAbsensi(encodeSessionId(item));
      if (reqId !== detailReqRef.current) return;
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat detail');
      const d = res.data || {};
      setDetail({
        meta: {
          ...item,
          ...d,
          jam_mulai: d.jam_mulai || item.jam_mulai,
          jam_selesai: d.jam_selesai || item.jam_selesai,
          foto: d.foto || item.foto || '',
        },
        rows: d.detail || [],
      });
    } catch (err) {
      if (reqId !== detailReqRef.current) return;
      setDetailError(err.message || 'Gagal memuat detail absensi.');
      toast.error(err.message);
    } finally {
      if (reqId === detailReqRef.current) setDetailLoading(false);
    }
  };

  const openEdit = async (item, preloadedRows = null) => {
    const reqId = ++editReqRef.current;
    setEdit(item);
    setEditError('');
    setEditQuery('');
    setEditJamFilter('all');
    if (Array.isArray(preloadedRows) && preloadedRows.length > 0) {
      setEditRows(preloadedRows.map((r) => ({ ...r, status: r.status || 'H' })));
      setEditLoading(false);
      return;
    }
    setEditRows([]);
    setEditLoading(true);
    try {
      const res = await api.getDetailAbsensi(encodeSessionId(item));
      if (reqId !== editReqRef.current) return;
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat data');
      setEditRows((res.data?.detail || []).map((r) => ({ ...r, status: r.status || 'H' })));
    } catch (err) {
      if (reqId !== editReqRef.current) return;
      setEditError(err.message || 'Gagal memuat data absensi.');
      toast.error(err.message);
    } finally {
      if (reqId === editReqRef.current) setEditLoading(false);
    }
  };

  const detailSummary = useMemo(() => groupDetailByStudent(detail?.rows || []), [detail?.rows]);

  const detailStudentSuggestions = useMemo(
    () =>
      detailSummary.students.map((s) => {
        const stObj = STATUS_MAP[s.worst] || STATUS[0];
        const badgeTone =
          s.worst === 'H' ? 'success' : s.worst === 'S' || s.worst === 'I' ? 'warning' : 'danger';
        return {
          value: s.nama_siswa,
          label: s.nama_siswa,
          sub: `NISN ${s.nisn || '—'}`,
          badge: stObj.label,
          badgeTone,
          keywords: `${s.nisn} ${stObj.label}`,
        };
      }),
    [detailSummary.students]
  );

  const filteredDetailStudents = useMemo(() => {
    const q = detailQuery.trim().toLowerCase();
    return detailSummary.students.filter((s) => {
      if (detailStatusFilter === 'ABSENT' && s.worst === 'H') return false;
      if (detailStatusFilter !== 'ALL' && detailStatusFilter !== 'ABSENT' && s.worst !== detailStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(s.nama_siswa || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q)
      );
    });
  }, [detailSummary.students, detailQuery, detailStatusFilter]);

  const editSummary = useMemo(() => groupDetailByStudent(editRows), [editRows]);

  const editStudentSuggestions = useMemo(
    () =>
      editSummary.students.map((s) => {
        const stObj = STATUS_MAP[s.worst] || STATUS[0];
        const badgeTone =
          s.worst === 'H' ? 'success' : s.worst === 'S' || s.worst === 'I' ? 'warning' : 'danger';
        return {
          value: s.nama_siswa,
          label: s.nama_siswa,
          sub: `NISN ${s.nisn || '—'}`,
          badge: stObj.label,
          badgeTone,
          keywords: `${s.nisn} ${stObj.label}`,
        };
      }),
    [editSummary.students]
  );

  const filteredEditStudents = useMemo(() => {
    const q = editQuery.trim().toLowerCase();
    return editSummary.students.filter((s) => {
      if (!q) return true;
      return (
        String(s.nama_siswa || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q)
      );
    });
  }, [editSummary.students, editQuery]);

  const updateEditStudentStatus = (student, nextStatus) => {
    const targetKey = String(student.nisn || student.nama_siswa || '').replace(/^0+/, '');
    setEditRows((prev) =>
      prev.map((row) => {
        const rk = String(row.nisn || row.nama_siswa || '').replace(/^0+/, '');
        if (rk !== targetKey) return row;
        if (editJamFilter !== 'all' && Number(row.jam) !== Number(editJamFilter)) return row;
        return { ...row, status: nextStatus };
      })
    );
  };

  const saveEdit = async () => {
    if (!editRows.length) return;
    setSavingEdit(true);
    try {
      const payload = editRows
        .filter((r) => r.rowIndex)
        .map((r) => ({
          rowIndex: Number(r.rowIndex),
          status: r.status || 'H',
          nisn: r.nisn || '',
          jam: r.jam || 0,
          tanggal: edit?.tanggal || '',
          kelas: edit?.kelas || '',
          mapel: edit?.mapel || '',
          guru: edit?.guru || '',
        }));
      const res = await api.updateAbsensi(payload);
      if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan perubahan');
      toast.success('Perubahan absensi disimpan');
      if (res.kasusDibuat > 0) {
        toast.warning(`${res.kasusDibuat} kasus pembinaan dibuat otomatis (siswa mencapai 3× Alpha/Cabut).`);
      }
      if (res.ditolak > 0) {
        toast.warning(`${res.ditolak} baris dilewati karena data di sheet sudah berubah.`);
      }
      setEdit(null);
      load({ tanggal, kelas });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await api.hapusAbsensi(encodeSessionId(confirmDelete));
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus');
      toast.success('Absensi dihapus');
      setConfirmDelete(null);
      load({ tanggal, kelas });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* filter */}
      <Card className="animate-rise p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
            <CalendarDays className="size-[18px]" />
          </span>
          <div>
            <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Riwayat Absensi</h1>
            <p className="text-[11.5px] font-semibold text-muted">{filtered.length} sesi ditampilkan</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="ml-auto"
            onClick={() => load({ tanggal, kelas })}
            aria-label="Muat ulang"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="h-10 rounded-xl border border-line bg-sunken/50 px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:bg-surface"
          />
          <Select value={kelas} onChange={(e) => setKelas(e.target.value)} className="h-10 text-[12.5px]">
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
          <SearchSuggest
            value={query}
            onChange={setQuery}
            options={sessionSuggestions}
            placeholder="Cari mapel / guru…"
            hintTitle="Mapel & guru tersedia"
            showToggle
          />
        </div>

        {(tanggal || kelas || query) && (
          <button
            type="button"
            onClick={() => {
              setTanggal('');
              setKelas('');
              setQuery('');
            }}
            className="mt-2 text-[11.5px] font-bold text-brand hover:underline"
          >
            Reset filter
          </button>
        )}
      </Card>

      {/* list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : truncated ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Menampilkan sesi terbaru saja. Pilih filter <b>Tanggal</b> atau <b>Kelas</b> di atas untuk memuat riwayat lebih lama.
        </div>
      ) : null}

      {!loading && grouped.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Tidak ada riwayat"
            description="Belum ada sesi absensi yang cocok dengan filter ini."
          />
        </Card>
      ) : (
        grouped.map(([kelasName, items]) => (
          <div key={kelasName} className="space-y-2">
            <p className="px-1 text-[11.5px] font-extrabold uppercase tracking-widest text-muted">{kelasName}</p>
            {items.map((item) => (
              <Card key={item.id} className="animate-rise overflow-hidden">
                <div className="flex items-start gap-3 p-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-[11px] font-extrabold text-brand">
                    {item.jam_mulai === item.jam_selesai
                      ? `J${item.jam_mulai || '–'}`
                      : `J${item.jam_mulai || '–'}–${item.jam_selesai || '–'}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-extrabold text-ink">{item.mapel || 'Tanpa mapel'}</p>
                    <p className="truncate text-[11.5px] font-semibold text-muted">
                      {formatTanggal(item.tanggal)} · Jam {item.jam_mulai || '–'}
                      {item.jam_selesai && item.jam_selesai !== item.jam_mulai ? `–${item.jam_selesai}` : ''}
                    </p>
                    <p className="truncate text-[11.5px] font-medium text-muted">{item.guru || '—'}</p>
                  </div>
                  {item.foto && (
                    <a
                      href={item.foto}
                      target="_blank"
                      rel="noreferrer"
                      className="grid size-9 place-items-center rounded-xl border border-line text-muted transition hover:border-brand/40 hover:text-brand"
                      aria-label="Lihat foto kelas"
                    >
                      <ImageIcon className="size-4" />
                    </a>
                  )}
                </div>

                <div className="flex divide-x divide-line border-t border-line/70">
                  {[
                    { label: 'Detail', icon: Eye, onClick: () => openDetail(item), cls: 'text-brand' },
                    { label: 'Edit', icon: PencilLine, onClick: () => openEdit(item), cls: 'text-ink' },
                    {
                      label: 'Hapus',
                      icon: Trash2,
                      onClick: () => setConfirmDelete(item),
                      cls: 'text-rose-600 dark:text-rose-400',
                    },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-extrabold transition hover:bg-sunken/60 active:scale-[.98]',
                        a.cls
                      )}
                    >
                      <a.icon className="size-3.5" /> {a.label}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ))
      )}

      {/* detail sheet */}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail Riwayat Absensi"
        size="lg"
        footer={
          detail && !detailLoading && detailSummary.students.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDetail(null)}>
                Tutup
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const meta = detail.meta;
                  const rows = detail.rows;
                  setDetail(null);
                  openEdit(meta, rows);
                }}
              >
                <PencilLine className="size-4" /> Edit sesi ini
              </Button>
            </div>
          ) : null
        }
      >
        {detail && (
          <div className="space-y-3">
            {/* Info Sesi */}
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-sunken/40 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-extrabold text-ink">{detail.meta?.mapel || 'Tanpa mata pelajaran'}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-muted">
                  {detail.meta?.kelas} · {formatTanggal(detail.meta?.tanggal)}
                </p>
                <p className="text-[12px] font-medium text-muted">
                  {formatJamLabel(detailSummary.jamList, detail.meta?.jam_mulai, detail.meta?.jam_selesai)} · Guru:{' '}
                  <b className="text-ink">{detail.meta?.guru || '—'}</b>
                  {detailSummary.students.length > 0 && (
                    <>
                      {' '}
                      · <b className="text-ink">{detailSummary.students.length} siswa</b>
                    </>
                  )}
                </p>
              </div>
              {detail.meta?.foto && (
                <a
                  href={detail.meta.foto}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand/25 bg-brand-soft/70 px-3 text-[11.5px] font-extrabold text-brand transition hover:bg-brand-soft"
                >
                  <ImageIcon className="size-3.5" /> Lihat foto kelas
                </a>
              )}
            </div>

            {detailLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 rounded-2xl" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-xl" />
                ))}
              </div>
            ) : detailError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Gagal memuat detail"
                description={detailError}
                className="py-8"
                action={
                  <Button size="sm" variant="outline" onClick={() => openDetail(detail.meta)}>
                    <RefreshCw className="size-3.5" /> Coba muat ulang
                  </Button>
                }
              />
            ) : detailSummary.students.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Rincian siswa tidak ditemukan"
                description="Data absensi untuk sesi ini mungkin sudah diubah atau dihapus."
                className="py-8"
              />
            ) : (
              <>
                {/* Ringkasan 5 Status — ketuk kartu untuk menyaring siswa */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-5 gap-1.5">
                    {STATUS.map((s) => {
                      const t = TONE[s.tone];
                      const active = detailStatusFilter === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setDetailStatusFilter((cur) => (cur === s.key ? 'ALL' : s.key))}
                          className={cn(
                            'rounded-xl border px-1 py-2 text-center transition active:scale-95',
                            active ? cn(t.border, t.soft, 'ring-2 ring-brand/25') : 'border-line bg-sunken/40 hover:bg-sunken'
                          )}
                        >
                          <span className={cn('block truncate text-[10px] font-extrabold uppercase', t.text)}>{s.label}</span>
                          <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-ink">
                            {detailSummary.counts[s.key] || 0}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10.5px] font-medium text-muted">
                    Ketuk salah satu kotak status di atas untuk langsung menyaring siswa.
                  </p>
                </div>

                {/* Pencarian & Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <SearchSuggest
                    value={detailQuery}
                    onChange={setDetailQuery}
                    options={detailStudentSuggestions}
                    placeholder="Cari nama atau NISN siswa…"
                    hintTitle="Siswa di sesi ini"
                    size="sm"
                    className="min-w-[180px] flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setDetailStatusFilter((cur) => (cur === 'ABSENT' ? 'ALL' : 'ABSENT'))}
                    className={cn(
                      'h-9 rounded-xl border px-3 text-[11.5px] font-extrabold transition active:scale-95',
                      detailStatusFilter === 'ABSENT'
                        ? 'border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                        : 'border-line bg-surface text-muted hover:text-ink'
                    )}
                  >
                    {detailStatusFilter === 'ABSENT' ? 'Hanya tidak hadir ✓' : 'Tidak hadir saja'}
                  </button>
                  {detailStatusFilter !== 'ALL' && detailStatusFilter !== 'ABSENT' && (
                    <button
                      type="button"
                      onClick={() => setDetailStatusFilter('ALL')}
                      className="h-9 rounded-xl border border-brand/25 bg-brand-soft/60 px-2.5 text-[11.5px] font-extrabold text-brand"
                    >
                      Tampilkan semua
                    </button>
                  )}
                </div>

                {/* Daftar siswa (1 baris per siswa + chip per jam) */}
                {filteredDetailStudents.length === 0 ? (
                  <p className="rounded-2xl border border-line bg-sunken/40 py-6 text-center text-[12px] font-semibold text-muted">
                    {detailStatusFilter === 'ABSENT'
                      ? 'Seluruh siswa hadir pada sesi ini.'
                      : detailStatusFilter !== 'ALL'
                        ? `Tidak ada siswa berstatus ${STATUS_MAP[detailStatusFilter]?.label || detailStatusFilter}.`
                        : 'Tidak ada siswa yang cocok dengan pencarian.'}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <ul className="divide-y divide-line/70">
                      {filteredDetailStudents.map((s, idx) => {
                        const stObj = STATUS_MAP[s.worst] || STATUS[0];
                        const tone = TONE[stObj.tone];
                        return (
                          <li
                            key={s.nisn || idx}
                            className={cn(
                              'flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 transition-colors',
                              s.worst !== 'H' && tone.soft
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold text-ink">
                                <span className="mr-1.5 text-[11px] font-extrabold tabular-nums text-muted">
                                  {idx + 1}.
                                </span>
                                {s.nama_siswa}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10.5px] font-semibold tabular-nums text-muted">
                                  NISN {s.nisn || '—'}
                                </span>
                                {detailSummary.jamList.length > 1 &&
                                  detailSummary.jamList.map((j) => {
                                    const jst = s.jamMap[j];
                                    if (!jst) return null;
                                    const jt = TONE[(STATUS_MAP[jst] || STATUS[0]).tone];
                                    return (
                                      <span
                                        key={j}
                                        className={cn(
                                          'rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold',
                                          jst === 'H' ? 'bg-sunken text-muted' : cn(jt.badge)
                                        )}
                                      >
                                        J{j}: {jst === 'H' ? '✓' : jst}
                                      </span>
                                    );
                                  })}
                              </div>
                            </div>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                                tone.badge
                              )}
                            >
                              <span className={cn('size-1.5 rounded-full', tone.dot)} />
                              {stObj.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* edit sheet */}
      <Sheet
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit Absensi"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEdit(null)}>
              Batal
            </Button>
            <Button
              className="flex-1"
              size="md"
              loading={savingEdit}
              disabled={editLoading || editRows.length === 0}
              onClick={saveEdit}
            >
              Simpan perubahan
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="brand">{edit.kelas}</Badge>
              <Badge tone="neutral">{edit.mapel || 'Tanpa mapel'}</Badge>
              <Badge tone="neutral">{formatTanggal(edit.tanggal, { withDay: false })}</Badge>
              <Badge tone="neutral">
                Jam {edit.jam_mulai}
                {edit.jam_selesai && edit.jam_selesai !== edit.jam_mulai ? `–${edit.jam_selesai}` : ''}
              </Badge>
            </div>

            {editLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : editError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Gagal memuat data edit"
                description={editError}
                className="py-8"
                action={
                  <Button size="sm" variant="outline" onClick={() => openEdit(edit)}>
                    <RefreshCw className="size-3.5" /> Coba muat ulang
                  </Button>
                }
              />
            ) : editRows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Data sesi tidak ditemukan"
                description="Baris absensi mungkin sudah dihapus."
                className="py-8"
              />
            ) : (
              <>
                {editSummary.jamList.length > 1 && (
                  <div className="rounded-2xl border border-line bg-sunken/40 p-2.5">
                    <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
                      Ubah status untuk:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditJamFilter('all')}
                        className={cn(
                          'min-h-8 rounded-xl px-3 text-[11.5px] font-extrabold transition',
                          editJamFilter === 'all'
                            ? 'bg-brand text-white shadow-sm'
                            : 'border border-line bg-surface text-muted'
                        )}
                      >
                        Semua jam ({editSummary.jamList.join(', ')})
                      </button>
                      {editSummary.jamList.map((j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => setEditJamFilter(j)}
                          className={cn(
                            'min-h-8 rounded-xl px-3 text-[11.5px] font-extrabold transition',
                            Number(editJamFilter) === j
                              ? 'bg-brand text-white shadow-sm'
                              : 'border border-line bg-surface text-muted'
                          )}
                        >
                          Jam {j}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <SearchSuggest
                  value={editQuery}
                  onChange={setEditQuery}
                  options={editStudentSuggestions}
                  placeholder="Cari nama atau NISN siswa…"
                  hintTitle="Siswa di sesi ini"
                  size="sm"
                />

                {filteredEditStudents.length === 0 ? (
                  <p className="rounded-2xl border border-line bg-sunken/40 py-6 text-center text-[12px] font-semibold text-muted">
                    Tidak ada siswa yang cocok dengan pencarian.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredEditStudents.map((s, idx) => {
                    const activeVal =
                      editJamFilter === 'all'
                        ? s.worst
                        : s.jamMap[Number(editJamFilter)] || s.worst || 'H';
                    const tone = TONE[(STATUS_MAP[activeVal] || STATUS[0]).tone];
                    return (
                      <div
                        key={s.nisn || idx}
                        className={cn(
                          'rounded-2xl border p-2.5 transition-colors',
                          activeVal === 'H' ? 'border-line bg-surface' : cn(tone.border, tone.soft)
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-bold text-ink">{s.nama_siswa}</p>
                            <p className="text-[10.5px] font-semibold text-muted">NISN {s.nisn || '—'}</p>
                          </div>
                          {editSummary.jamList.length > 1 && (
                            <div className="flex flex-wrap gap-1">
                              {editSummary.jamList.map((j) => {
                                const jst = s.jamMap[j];
                                if (!jst) return null;
                                const jt = TONE[(STATUS_MAP[jst] || STATUS[0]).tone];
                                return (
                                  <span
                                    key={j}
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[9.5px] font-extrabold',
                                      jst === 'H' ? 'bg-sunken text-muted' : jt.badge
                                    )}
                                  >
                                    J{j}:{jst === 'H' ? '✓' : jst}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <StatusPicker
                          size="sm"
                          value={activeVal}
                          onChange={(v) => updateEditStudentStatus(s, v)}
                          label={`Status ${s.nama_siswa}`}
                        />
                      </div>
                    );
                  })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* delete confirm */}
      <Sheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Hapus absensi?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" loading={deleting} onClick={doDelete}>
              Ya, hapus
            </Button>
          </div>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-muted">
          Sesi <b className="text-ink">{confirmDelete?.mapel}</b> kelas{' '}
          <b className="text-ink">{confirmDelete?.kelas}</b> tanggal{' '}
          <b className="text-ink">{formatTanggal(confirmDelete?.tanggal)}</b> akan dihapus permanen.
        </p>
      </Sheet>
    </div>
  );
}
