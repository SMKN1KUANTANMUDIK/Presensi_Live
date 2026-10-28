import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Eye,
  Image as ImageIcon,
  PencilLine,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { cn, formatTanggal, STATUS, TONE } from '../lib/utils';
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

function normalizeId(id) {
  if (!id) return '';
  const raw = String(id).trim();
  if (!raw.includes('|')) return raw;
  const parts = raw.split('|');
  const payload = {
    tanggal: parts[0] || '',
    kelas: parts[1] || '',
    mapel: parts[2] || '',
    guru: parts.slice(3).join('|') || '',
  };
  try {
    return btoa(JSON.stringify(payload));
  } catch {
    return raw;
  }
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

  const [edit, setEdit] = useState(null);
  const [editRows, setEditRows] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRiwayatAbsensi();
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat riwayat');
      setSessions(res.data || []);
      setTruncated(Boolean(res.truncated));
      if (res.truncated) {
        toast.warning('Riwayat ditampilkan sebagian (batas waktu server). Gunakan filter tanggal/kelas.');
      }
    } catch (err) {
      setSessions([]);
      setTruncated(false);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await api.getConfig();
        if (res?.success) setKelasList(res.kelas || []);
      } catch {
        /* opsional */
      }
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (tanggal && String(s.tanggal) !== String(tanggal)) return false;
      if (kelas && String(s.kelas) !== String(kelas)) return false;
      if (!q) return true;
      return [s.kelas, s.mapel, s.guru].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [sessions, tanggal, kelas, query]);

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
    setDetail({ meta: item, rows: [] });
    setDetailLoading(true);
    try {
      const res = await api.getDetailAbsensi(normalizeId(item.id));
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat detail');
      // gabung dengan baris list agar jam_mulai/jam_selesai/foto tidak hilang
      setDetail({ meta: { ...item, ...(res.data || {}) }, rows: res.data?.detail || [] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (item) => {
    setEdit(item);
    setEditRows([]);
    try {
      const res = await api.getDetailAbsensi(normalizeId(item.id));
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat data');
      setEditRows((res.data?.detail || []).map((r) => ({ ...r, status: r.status || 'H' })));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      // kirim identitas baris (nisn/tanggal/kelas/mapel/guru/jam) supaya
      // backend bisa memastikan baris yang ditulis memang baris yang diedit
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
      load();
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
      const res = await api.hapusAbsensi(normalizeId(confirmDelete.id));
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus');
      toast.success('Absensi dihapus');
      setConfirmDelete(null);
      load();
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
          <Button variant="outline" size="icon" className="ml-auto" onClick={load} aria-label="Muat ulang">
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari mapel / guru…"
              className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-9 pr-3 text-[12.5px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:bg-surface"
            />
          </div>
        </div>

        {(tanggal || kelas || query) && (
          <button
            type="button"
            onClick={() => {
              setTanggal('');
              setKelas('');
              setQuery('');
            }}
            className="mt-2 text-[11.5px] font-bold text-brand"
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
          Data terlalu banyak untuk dimuat sekaligus — hanya sesi terbaru yang ditampilkan. Gunakan filter
          tanggal/kelas untuk data lebih lama.
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
                    {item.jam_mulai || '–'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-extrabold text-ink">{item.mapel || 'Tanpa mapel'}</p>
                    <p className="truncate text-[11.5px] font-semibold text-muted">
                      {formatTanggal(item.tanggal)} · Jam {item.jam_mulai || '–'}–{item.jam_selesai || '–'}
                    </p>
                    <p className="truncate text-[11.5px] font-medium text-muted">{item.guru || '—'}</p>
                  </div>
                  {item.foto && (
                    <a
                      href={item.foto}
                      target="_blank"
                      rel="noreferrer"
                      className="grid size-9 place-items-center rounded-xl border border-line text-muted transition hover:text-brand"
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
                    { label: 'Hapus', icon: Trash2, onClick: () => setConfirmDelete(item), cls: 'text-rose-600 dark:text-rose-400' },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-extrabold transition hover:bg-sunken/60',
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
      <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail absensi" size="lg">
        {detail && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-sunken/40 p-3">
              <p className="text-[14px] font-extrabold text-ink">{detail.meta?.mapel || '—'}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-muted">
                {detail.meta?.kelas} · Jam {detail.meta?.jam_mulai}–{detail.meta?.jam_selesai}
              </p>
              <p className="text-[12px] font-medium text-muted">{detail.meta?.guru}</p>
            </div>

            {detailLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                <table className="w-full border-collapse">
                  <thead className="bg-sunken/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-muted">Siswa</th>
                      <th className="w-16 px-2 py-2 text-[11px] font-extrabold uppercase text-muted">Jam</th>
                      <th className="w-20 px-3 py-2 text-right text-[11px] font-extrabold uppercase text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.rows || []).map((r, i) => {
                      const tone = TONE[STATUS.find((s) => s.key === r.status)?.tone || 'hadir'];
                      return (
                        <tr key={i} className="border-t border-line/60">
                          <td className="px-3 py-2">
                            <p className="text-[12.5px] font-bold text-ink">{r.nama_siswa}</p>
                            <p className="text-[10.5px] font-semibold text-muted">{r.nisn}</p>
                          </td>
                          <td className="px-2 py-2 text-center text-[11.5px] font-bold text-muted">{r.jam ?? '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-extrabold', tone.badge)}>
                              {STATUS.find((s) => s.key === r.status)?.label || r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* edit sheet */}
      <Sheet
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title="Edit absensi"
        size="lg"
        footer={
          <Button className="w-full" size="lg" loading={savingEdit} onClick={saveEdit}>
            Simpan perubahan
          </Button>
        }
      >
        {edit && (
          <div className="space-y-2">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge tone="brand">{edit.kelas}</Badge>
              <Badge tone="neutral">{edit.mapel}</Badge>
              <Badge tone="neutral">
                Jam {edit.jam_mulai}–{edit.jam_selesai}
              </Badge>
            </div>

            {editRows.length === 0 && <Skeleton className="h-24 rounded-2xl" />}

            {editRows.map((r, i) => (
              <div key={`${r.rowIndex}-${i}`} className="rounded-2xl border border-line p-2.5">
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-ink">{r.nama_siswa}</p>
                    <p className="text-[10.5px] font-semibold text-muted">
                      {r.nisn} {r.jam ? `· Jam ${r.jam}` : ''}
                    </p>
                  </div>
                </div>
                <StatusPicker
                  size="sm"
                  value={r.status || 'H'}
                  onChange={(v) =>
                    setEditRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: v } : row)))
                  }
                  label={`Status ${r.nama_siswa}`}
                />
              </div>
            ))}
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
