import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { cn, initials } from '../lib/utils';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Sheet,
  Skeleton,
} from '../components/ui';
import ImportSheet from '../components/ImportSheet';

const PAGE_SIZE = 50;

const emptyForm = { nisn: '', nama: '', kelas: '', jk: '', originalNisn: '' };

export default function Siswa() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [kelasFilter, setKelasFilter] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSiswaData();
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat data siswa');
      setList(res.data || []);
    } catch (err) {
      setList([]);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await api.getKelas();
        setKelasList(res?.data || res?.kelas || []);
      } catch {
        /* opsional */
      }
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (kelasFilter && s.kelas !== kelasFilter) return false;
      if (!q) return true;
      return [s.nama, s.nisn].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [list, query, kelasFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, kelasFilter]);

  const openAdd = () => setForm({ ...emptyForm, kelas: kelasFilter || '' });
  const openEdit = (s) =>
    setForm({ nisn: s.nisn, nama: s.nama, kelas: s.kelas, jk: s.jk, originalNisn: s.nisn });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form) return;
    if (!form.nisn.trim()) return toast.warning('NISN wajib diisi');
    if (!form.nama.trim()) return toast.warning('Nama wajib diisi');
    if (!form.kelas) return toast.warning('Kelas wajib dipilih');

    setSaving(true);
    try {
      const res = await api.simpanSiswa({
        nisn: form.nisn.trim(),
        nama: form.nama.trim(),
        kelas: form.kelas,
        jk: form.jk,
        originalNisn: form.originalNisn,
      });
      if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan');
      toast.success(form.originalNisn ? 'Data siswa diperbarui' : 'Siswa baru ditambahkan');
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await api.hapusSiswa(confirm.nisn);
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus');
      toast.success('Data siswa dihapus');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const perKelas = useMemo(() => {
    const map = new Map();
    list.forEach((s) => map.set(s.kelas, (map.get(s.kelas) || 0) + 1));
    return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [list]);

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Users className="size-5" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Data Siswa</h1>
              <p className="text-[11.5px] font-semibold text-muted">
                {list.length} siswa · {perKelas.length} kelas
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="size-3.5" /> Import
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" /> Tambah
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau NISN…"
              className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-10 pr-3 text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <Select value={kelasFilter} onChange={(e) => setKelasFilter(e.target.value)} className="h-10 text-[12.5px]">
            <option value="">Semua kelas</option>
            {perKelas.map(([k, n]) => (
              <option key={k} value={k}>
                {k} ({n})
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={list.length ? 'Tidak ada siswa yang cocok' : 'Belum ada data siswa'}
            description={
              list.length
                ? 'Coba kata kunci lain atau ubah filter kelas.'
                : 'Tambahkan satu per satu atau import dari file CSV sekaligus.'
            }
            action={
              !list.length && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                    <Download className="size-3.5" /> Import
                  </Button>
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="size-3.5" /> Tambah siswa
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <>
            {/* mobile */}
            <ul className="divide-y divide-line/70 lg:hidden">
              {pageRows.map((s) => (
                <li key={s.nisn} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-[11px] font-extrabold text-muted">
                    {initials(s.nama)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">{s.nama}</p>
                    <p className="truncate text-[11px] font-semibold text-muted">
                      {s.nisn} · {s.kelas}
                      {s.jk ? ` · ${s.jk}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    aria-label={`Edit ${s.nama}`}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand"
                  >
                    <PencilLine className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(s)}
                    aria-label={`Hapus ${s.nama}`}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            {/* desktop */}
            <div className="hidden max-h-[62vh] overflow-auto lg:block">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                  <tr className="border-b border-line text-left">
                    <th className="w-36 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">NISN</th>
                    <th className="px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Nama siswa</th>
                    <th className="w-36 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Kelas</th>
                    <th className="w-20 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">JK</th>
                    <th className="w-24 px-4 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-muted">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => (
                    <tr key={s.nisn} className="border-b border-line/60 last:border-0 hover:bg-sunken/40">
                      <td className="px-4 py-2 text-[12px] font-semibold tabular-nums text-muted">{s.nisn}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sunken text-[10px] font-extrabold text-muted">
                            {initials(s.nama)}
                          </span>
                          <span className="truncate text-[13px] font-bold text-ink">{s.nama}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone="brand">{s.kelas}</Badge>
                      </td>
                      <td className="px-2 py-2 text-[12px] font-semibold text-muted">{s.jk || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            aria-label={`Edit ${s.nama}`}
                            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand"
                          >
                            <PencilLine className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(s)}
                            aria-label={`Hapus ${s.nama}`}
                            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
              <p className="text-[11.5px] font-semibold text-muted">
                {filtered.length} siswa · halaman {currentPage}/{totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="grid size-8 place-items-center rounded-lg border border-line text-muted disabled:opacity-40"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="grid size-8 place-items-center rounded-lg border border-line text-muted disabled:opacity-40"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* form */}
      <Sheet
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.originalNisn ? 'Edit siswa' : 'Tambah siswa'}
        size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button className="flex-1" loading={saving} onClick={save}>
              Simpan
            </Button>
          </div>
        }
      >
        {form && (
          <div className="space-y-3">
            <Field label="NISN">
              <Input
                value={form.nisn}
                onChange={(e) => set('nisn', e.target.value)}
                inputMode="numeric"
                placeholder="0012345678"
              />
            </Field>
            <Field label="Nama lengkap">
              <Input value={form.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Nama siswa" />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Kelas">
                <Select value={form.kelas} onChange={(e) => set('kelas', e.target.value)}>
                  <option value="">Pilih kelas</option>
                  {kelasList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jenis kelamin">
                <div className="flex gap-1.5">
                  {[
                    { v: 'L', label: 'Laki-laki' },
                    { v: 'P', label: 'Perempuan' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => set('jk', form.jk === o.v ? '' : o.v)}
                      className={cn(
                        'h-11 flex-1 rounded-xl border text-[12.5px] font-extrabold transition',
                        form.jk === o.v
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line text-muted hover:text-ink'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {kelasList.length === 0 && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                Daftar kelas belum termuat. Tambahkan kelas di sheet <b>Kelas</b> atau lewat import (kelas baru
                otomatis dibuat).
              </p>
            )}
          </div>
        )}
      </Sheet>

      {/* delete */}
      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Hapus data siswa?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" loading={deleting} onClick={doDelete}>
              Ya, hapus
            </Button>
          </div>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-muted">
          Siswa <b className="text-ink">{confirm?.nama}</b> (NISN {confirm?.nisn}, kelas {confirm?.kelas}) akan
          dihapus dari daftar. Riwayat absensi lama tidak terpengaruh.
        </p>
      </Sheet>

      <ImportSheet open={importOpen} kind="siswa" onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}
