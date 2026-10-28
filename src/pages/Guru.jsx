import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  PencilLine,
  Plus,
  Search,
  Trash2,
  UserCog,
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

const ROLES = [
  { key: 'admin', label: 'Admin', tone: 'brand' },
  { key: 'kepsek', label: 'Kepala Sekolah', tone: 'warning' },
  { key: 'piket', label: 'Petugas Piket', tone: 'info' },
  { key: 'guru', label: 'Guru Mapel', tone: 'neutral' },
  { key: 'wali', label: 'Wali Kelas', tone: 'violet' },
];

const roleMeta = (role) => ROLES.find((r) => r.key === role) || ROLES[3];

const emptyForm = {
  nip: '',
  nama: '',
  username: '',
  password: '',
  role: 'guru',
  mapel: '',
  kelas_wali: '',
  originalNip: '',
};

export default function Guru() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [kelasList, setKelasList] = useState([]);
  const [mapelList, setMapelList] = useState([]);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getGuruData();
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat data guru');
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
        const cfg = await api.getConfig();
        if (cfg?.success) {
          setKelasList(cfg.kelas || []);
          setMapelList((cfg.mapel || []).map((m) => m.nama).filter(Boolean));
        }
      } catch {
        /* opsional */
      }
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((g) => {
      if (roleFilter && g.role !== roleFilter) return false;
      if (!q) return true;
      return [g.nama, g.nip, g.username, g.mapel, g.kelas_wali].some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    });
  }, [list, query, roleFilter]);

  const counts = useMemo(() => {
    const c = { admin: 0, kepsek: 0, piket: 0, guru: 0, wali: 0 };
    list.forEach((g) => {
      if (c[g.role] !== undefined) c[g.role] += 1;
    });
    return c;
  }, [list]);

  const openAdd = () => setForm({ ...emptyForm });

  const openEdit = (g) =>
    setForm({
      nip: g.nip,
      nama: g.nama,
      username: g.username,
      password: '',
      role: g.role || 'guru',
      mapel: g.mapel,
      kelas_wali: g.kelas_wali,
      originalNip: g.nip,
    });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form) return;
    if (!form.nip.trim()) return toast.warning('NIP wajib diisi');
    if (!form.nama.trim()) return toast.warning('Nama wajib diisi');
    if (!form.originalNip && !form.password.trim()) {
      return toast.warning('Password wajib diisi untuk guru baru');
    }
    if (form.role === 'wali' && !form.kelas_wali) {
      return toast.warning('Wali kelas wajib memilih kelas');
    }

    setSaving(true);
    try {
      const res = await api.simpanGuru({
        nip: form.nip.trim(),
        nama: form.nama.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        mapel: form.mapel.trim(),
        kelas_wali: form.role === 'wali' ? form.kelas_wali : '',
        originalNip: form.originalNip,
      });
      if (!res?.success) throw new Error(res?.error || 'Gagal menyimpan');
      toast.success(form.originalNip ? 'Data guru diperbarui' : 'Guru baru ditambahkan');
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
      const res = await api.hapusGuru(confirm.nip);
      if (!res?.success) throw new Error(res?.error || 'Gagal menghapus');
      toast.success('Data guru dihapus');
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand">
              <UserCog className="size-5" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Data Guru</h1>
              <p className="text-[11.5px] font-semibold text-muted">
                {list.length} guru & staf · {counts.guru} guru mapel · {counts.wali} wali kelas
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

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, NIP, mapel…"
              className="h-10 w-full rounded-xl border border-line bg-sunken/50 pl-10 pr-3 text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/10"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRoleFilter('')}
              className={cn(
                'h-8 rounded-full border px-3 text-[11.5px] font-extrabold transition',
                !roleFilter ? 'border-transparent bg-brand-soft text-brand' : 'border-line text-muted hover:text-ink'
              )}
            >
              Semua {list.length}
            </button>
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRoleFilter(roleFilter === r.key ? '' : r.key)}
                className={cn(
                  'h-8 rounded-full border px-3 text-[11.5px] font-extrabold transition',
                  roleFilter === r.key
                    ? 'border-transparent bg-brand-soft text-brand'
                    : 'border-line text-muted hover:text-ink'
                )}
              >
                {r.label} {counts[r.key]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada data guru"
            description="Tambahkan satu per satu atau import dari file CSV."
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Download className="size-3.5" /> Import
                </Button>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-3.5" /> Tambah guru
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* mobile */}
            <ul className="divide-y divide-line/70 lg:hidden">
              {filtered.map((g) => {
                const meta = roleMeta(g.role);
                return (
                  <li key={g.nip} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 text-[12px] font-extrabold text-white">
                      {initials(g.nama)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-extrabold text-ink">{g.nama}</p>
                      <p className="truncate text-[11px] font-semibold text-muted">
                        {g.nip} · {g.mapel || 'tanpa mapel'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {g.kelas_wali && <Badge tone="neutral">{g.kelas_wali}</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        aria-label={`Edit ${g.nama}`}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand"
                      >
                        <PencilLine className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(g)}
                        aria-label={`Hapus ${g.nama}`}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* desktop */}
            <div className="hidden max-h-[64vh] overflow-auto lg:block">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Nama</th>
                    <th className="w-40 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">NIP</th>
                    <th className="w-40 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Role</th>
                    <th className="px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Mapel</th>
                    <th className="w-32 px-2 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Kelas wali</th>
                    <th className="w-24 px-4 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-muted">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const meta = roleMeta(g.role);
                    return (
                      <tr key={g.nip} className="border-b border-line/60 last:border-0 hover:bg-sunken/40">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-[11px] font-extrabold text-white">
                              {initials(g.nama)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-ink">{g.nama}</p>
                              <p className="truncate text-[11px] font-medium text-muted">@{g.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-[12px] font-semibold tabular-nums text-muted">{g.nip}</td>
                        <td className="px-2 py-2.5">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="px-2 py-2.5 text-[12px] font-semibold text-muted">{g.mapel || '—'}</td>
                        <td className="px-2 py-2.5 text-[12px] font-semibold text-muted">{g.kelas_wali || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(g)}
                              aria-label={`Edit ${g.nama}`}
                              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand"
                            >
                              <PencilLine className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm(g)}
                              aria-label={`Hapus ${g.nama}`}
                              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* form sheet */}
      <Sheet
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.originalNip ? 'Edit guru' : 'Tambah guru'}
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
            <Field label="NIP / ID guru">
              <Input value={form.nip} onChange={(e) => set('nip', e.target.value)} placeholder="198501012010011001" />
            </Field>
            <Field label="Nama lengkap">
              <Input value={form.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Nama beserta gelar" />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Username">
                <Input
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  placeholder="kosong = pakai NIP"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={form.originalNip ? 'kosongkan bila tetap' : 'wajib diisi'}
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <Field label="Role">
              <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Mata pelajaran">
                <Input
                  value={form.mapel}
                  onChange={(e) => set('mapel', e.target.value)}
                  placeholder="Informatika"
                  list="mapel-options"
                />
                <datalist id="mapel-options">
                  {mapelList.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>

              <Field label="Kelas wali" hint={form.role !== 'wali' ? 'Hanya untuk role wali' : undefined}>
                <Select
                  value={form.kelas_wali}
                  onChange={(e) => set('kelas_wali', e.target.value)}
                  disabled={form.role !== 'wali'}
                >
                  <option value="">—</option>
                  {kelasList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {!form.originalNip && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
                Guru baru akan bisa langsung login memakai username &amp; password di atas.
              </p>
            )}
          </div>
        )}
      </Sheet>

      {/* delete confirm */}
      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Hapus data guru?"
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
          Data <b className="text-ink">{confirm?.nama}</b> (NIP {confirm?.nip}) akan dihapus. Riwayat absensi
          yang sudah tercatat tidak terpengaruh.
        </p>
      </Sheet>

      <ImportSheet
        open={importOpen}
        kind="guru"
        onClose={() => setImportOpen(false)}
        onDone={load}
      />
    </div>
  );
}
