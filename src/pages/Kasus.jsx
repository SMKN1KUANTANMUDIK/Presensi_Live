import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { cn, formatTanggal, todayISO } from '../lib/utils';
import { pesanPeringatanDini } from '../lib/whatsapp';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Sheet, Skeleton } from '../components/ui';
import WaButton from '../components/WaButton';
import StudentMonitorSheet from '../components/StudentMonitorSheet';

const LEVEL_META = {
  wali_kelas: { label: 'Wali Kelas', tone: 'info' },
  bk: { label: 'BK', tone: 'warning' },
  kepsek: { label: 'Kepsek', tone: 'danger' },
};

export default function Kasus() {
  const { user, role } = useAuth();
  const toast = useToast();

  const kasusRole = role === 'admin' ? 'bk' : role === 'kepsek' ? 'kepsek' : 'wali_kelas';
  const kelasWali = user?.kelas_wali || user?.kelas || '';
  const isWali = kasusRole === 'wali_kelas';

  const [list, setList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [statusFilter, setStatusFilter] = useState('Open');
  const [levelFilter, setLevelFilter] = useState('');
  const [kelasFilter, setKelasFilter] = useState(isWali ? kelasWali : '');

  const [tambahOpen, setTambahOpen] = useState(false);
  const [tambahForm, setTambahForm] = useState({
    tanggal: todayISO(),
    nisn: '',
    nama_siswa: '',
    kelas: isWali ? kelasWali : '',
    jenis: 'Alpha',
    keterangan: '',
  });
  const [savingTambah, setSavingTambah] = useState(false);

  const [tindakanTarget, setTindakanTarget] = useState(null);
  const [tindakanText, setTindakanText] = useState('');
  const [catatanText, setCatatanText] = useState('');
  const [savingTindakan, setSavingTindakan] = useState(false);

  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');
  const [savingEscalate, setSavingEscalate] = useState(false);

  const [tutupTarget, setTutupTarget] = useState(null);
  const [tutupAlasan, setTutupAlasan] = useState('');
  const [savingTutup, setSavingTutup] = useState(false);

  const [monitorSiswa, setMonitorSiswa] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getKasusPembinaan({
        status: statusFilter || 'SEMUA',
        kelas: isWali ? kelasWali : kelasFilter || 'SEMUA',
        role: kasusRole,
        kelas_wali: kelasWali,
        level: levelFilter,
      });
      if (!res?.success) throw new Error(res?.error || 'Gagal memuat kasus pembinaan');
      setList(res.data || []);
    } catch (err) {
      setList([]);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kelasFilter, levelFilter, kasusRole, isWali, kelasWali, toast]);

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await api.getKelas();
        setKelasList(res?.data || []);
      } catch {
        /* opsional */
      }
    })();
  }, [load]);

  const sinkron = async () => {
    setSyncing(true);
    try {
      const res = await api.sinkronKasusAbsensi(isWali && kelasWali ? { kelas: kelasWali } : {});
      if (!res?.success) throw new Error(res?.error || 'Gagal menyinkronkan kasus');
      if (res.dibuat > 0) {
        toast.warning(`${res.dibuat} kasus pembinaan baru dibuat otomatis dari data Alpha/Cabut ≥ 3×.`);
        load();
      } else {
        toast.success('Data kasus sudah sinkron dengan absensi.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const submitTambah = async () => {
    if (!tambahForm.nisn.trim() || !tambahForm.nama_siswa.trim() || !tambahForm.kelas.trim()) {
      return toast.warning('NISN, nama siswa, dan kelas wajib diisi.');
    }
    setSavingTambah(true);
    try {
      const res = await api.simpanKasusPembinaan(tambahForm, kasusRole, kelasWali);
      if (!res?.success) throw new Error(res?.error || 'Gagal menambah kasus');
      toast.success('Kasus pembinaan ditambahkan.');
      setTambahOpen(false);
      setTambahForm({
        tanggal: todayISO(),
        nisn: '',
        nama_siswa: '',
        kelas: isWali ? kelasWali : '',
        jenis: 'Alpha',
        keterangan: '',
      });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingTambah(false);
    }
  };

  const submitTindakan = async () => {
    if (!tindakanTarget || !tindakanText.trim()) return toast.warning('Isi tindakan pembinaan.');
    setSavingTindakan(true);
    try {
      const res = await api.catatTindakanKasus(
        tindakanTarget.id,
        kasusRole,
        tindakanText.trim(),
        catatanText.trim()
      );
      if (!res?.success) throw new Error(res?.error || 'Gagal mencatat tindakan');
      toast.success('Tindakan pembinaan dicatat.');
      setTindakanTarget(null);
      setTindakanText('');
      setCatatanText('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingTindakan(false);
    }
  };

  const submitEscalate = async () => {
    if (!escalateTarget || !escalateReason.trim()) return toast.warning('Isi alasan eskalasi.');
    const keLevel = escalateTarget.level === 'wali_kelas' ? 'bk' : 'kepsek';
    setSavingEscalate(true);
    try {
      const res = await api.escalateKasus(
        escalateTarget.id,
        escalateTarget.level,
        keLevel,
        escalateReason.trim()
      );
      if (!res?.success) throw new Error(res?.error || 'Gagal mengeskalasi kasus');
      toast.success(`Kasus diteruskan ke ${LEVEL_META[keLevel]?.label || keLevel}.`);
      setEscalateTarget(null);
      setEscalateReason('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEscalate(false);
    }
  };

  const submitTutup = async () => {
    if (!tutupTarget || !tutupAlasan.trim()) return toast.warning('Isi alasan penutupan kasus.');
    setSavingTutup(true);
    try {
      const res = await api.tutupKasusPembinaan(tutupTarget.id, tutupAlasan.trim(), kasusRole);
      if (!res?.success) throw new Error(res?.error || 'Gagal menutup kasus');
      toast.success('Kasus pembinaan ditutup.');
      setTutupTarget(null);
      setTutupAlasan('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingTutup(false);
    }
  };

  const openCount = useMemo(() => list.filter((k) => k.status === 'Open').length, [list]);

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Kasus Pembinaan</h1>
              <p className="text-[11.5px] font-semibold text-muted">
                {openCount} aktif · {list.length} total ditampilkan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={sinkron} loading={syncing}>
              <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} /> Cek siswa 3× Alpha/Cabut
            </Button>
            <Button size="sm" onClick={() => setTambahOpen(true)}>
              <Plus className="size-3.5" /> Catat kasus baru
            </Button>
          </div>
        </div>

        <p className="mt-2.5 rounded-xl bg-sunken/50 px-3 py-2 text-[11.5px] font-medium text-muted">
          Siswa yang tidak masuk tanpa keterangan (Alpha) atau membolos (Cabut) ≥ 3 hari dalam satu semester otomatis masuk ke daftar ini untuk dibina bersama orang tua.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 text-[12.5px]">
            <option value="Open">Aktif (Belum selesai)</option>
            <option value="Ditutup">Sudah selesai</option>
            <option value="">Semua status</option>
          </Select>

          <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="h-10 text-[12.5px]">
            <option value="">Semua tingkat penanganan</option>
            <option value="wali_kelas">Ditangani Wali Kelas</option>
            <option value="bk">Ditangani BK</option>
            <option value="kepsek">Ditangani Kepala Sekolah</option>
          </Select>

          <Select
            value={isWali ? kelasWali : kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            disabled={isWali}
            className="h-10 text-[12.5px]"
          >
            <option value="">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Tidak ada kasus pembinaan"
            description="Belum ada siswa yang tercatat melampaui ambang Alpha/Cabut pada filter ini."
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {list.map((k) => {
            const lvl = LEVEL_META[k.level] || LEVEL_META.wali_kelas;
            const isOpen = k.status === 'Open';
            const canEscalate = isOpen && (k.level === 'wali_kelas' || k.level === 'bk');
            const canClose = isOpen && (kasusRole === 'kepsek' || kasusRole === 'bk');
            const waText = pesanPeringatanDini({
              nama: k.nama_siswa,
              kelas: k.kelas,
              alpha: k.jenis === 'Alpha' ? 3 : 0,
              cabut: k.jenis === 'Cabut' ? 3 : 0,
              kasusOpen: isOpen ? 1 : 0,
              periode: k.keterangan || formatTanggal(k.tanggal, { withDay: false }),
            });

            return (
              <Card key={k.id} className="animate-rise p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={isOpen ? 'danger' : 'success'}>{isOpen ? 'Aktif' : 'Selesai'}</Badge>
                      <Badge tone={lvl.tone}>{lvl.label}</Badge>
                      <Badge tone="neutral">{k.jenis}</Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setMonitorSiswa({
                          nisn: k.nisn,
                          nama: k.nama_siswa,
                          kelas: k.kelas,
                          no_hp_ortu: k.no_hp_ortu,
                        })
                      }
                      className="mt-2 block text-left text-[14.5px] font-extrabold text-ink hover:text-brand"
                    >
                      {k.nama_siswa}
                    </button>
                    <p className="text-[11.5px] font-semibold text-muted">
                      {k.kelas} · NISN {k.nisn} · {formatTanggal(k.tanggal, { withDay: false })}
                    </p>
                  </div>

                  <WaButton size="xs" phone={k.no_hp_ortu} message={waText} label="WA Ortu" />
                </div>

                {k.keterangan && (
                  <p className="mt-2.5 rounded-xl bg-sunken/60 px-3 py-2 text-[12px] font-medium text-ink">
                    {k.keterangan}
                  </p>
                )}

                {(k.tindakan_wali || k.tindakan_bk || k.tindakan_kepsek) && (
                  <div className="mt-2.5 space-y-1 text-[11.5px] text-muted">
                    {k.tindakan_wali && (
                      <p>
                        <b className="text-ink">Tindakan Wali:</b> {k.tindakan_wali}
                      </p>
                    )}
                    {k.tindakan_bk && (
                      <p>
                        <b className="text-ink">Tindakan BK:</b> {k.tindakan_bk}
                      </p>
                    )}
                    {k.tindakan_kepsek && (
                      <p>
                        <b className="text-ink">Tindakan Kepsek:</b> {k.tindakan_kepsek}
                      </p>
                    )}
                  </div>
                )}

                {!isOpen && k.alasan_penutupan && (
                  <p className="mt-2 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Ditutup: {k.alasan_penutupan}
                  </p>
                )}

                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line/70 pt-3">
                    <Button
                      variant="soft"
                      size="sm"
                      onClick={() => {
                        setTindakanTarget(k);
                        setTindakanText('');
                        setCatatanText('');
                      }}
                    >
                      <ClipboardCheck className="size-3.5" /> Catat tindakan
                    </Button>
                    {canEscalate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEscalateTarget(k);
                          setEscalateReason('');
                        }}
                      >
                        <ArrowUpRight className="size-3.5" /> Teruskan ke {k.level === 'wali_kelas' ? 'BK' : 'Kepsek'}
                      </Button>
                    )}
                    {canClose && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => {
                          setTutupTarget(k);
                          setTutupAlasan('');
                        }}
                      >
                        <CheckCircle2 className="size-3.5" /> Tandai selesai
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Tambah */}
      <Sheet
        open={tambahOpen}
        onClose={() => setTambahOpen(false)}
        title="Tambah Kasus Pembinaan"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setTambahOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1" loading={savingTambah} onClick={submitTambah}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Tanggal">
            <Input
              type="date"
              value={tambahForm.tanggal}
              onChange={(e) => setTambahForm((f) => ({ ...f, tanggal: e.target.value }))}
            />
          </Field>
          <Field label="NISN">
            <Input
              value={tambahForm.nisn}
              onChange={(e) => setTambahForm((f) => ({ ...f, nisn: e.target.value }))}
              placeholder="NISN siswa"
            />
          </Field>
          <Field label="Nama Siswa">
            <Input
              value={tambahForm.nama_siswa}
              onChange={(e) => setTambahForm((f) => ({ ...f, nama_siswa: e.target.value }))}
              placeholder="Nama lengkap siswa"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Kelas">
              <Select
                value={tambahForm.kelas}
                disabled={isWali}
                onChange={(e) => setTambahForm((f) => ({ ...f, kelas: e.target.value }))}
              >
                <option value="">Pilih kelas</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jenis">
              <Select
                value={tambahForm.jenis}
                onChange={(e) => setTambahForm((f) => ({ ...f, jenis: e.target.value }))}
              >
                <option value="Alpha">Alpha</option>
                <option value="Cabut">Cabut</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Lainnya">Lainnya</option>
              </Select>
            </Field>
          </div>
          <Field label="Keterangan">
            <Input
              value={tambahForm.keterangan}
              onChange={(e) => setTambahForm((f) => ({ ...f, keterangan: e.target.value }))}
              placeholder="Ringkasan permasalahan"
            />
          </Field>
        </div>
      </Sheet>

      {/* Modal Catat Tindakan */}
      <Sheet
        open={Boolean(tindakanTarget)}
        onClose={() => setTindakanTarget(null)}
        title="Catat Tindakan Pembinaan"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setTindakanTarget(null)}>
              Batal
            </Button>
            <Button className="flex-1" loading={savingTindakan} onClick={submitTindakan}>
              Simpan
            </Button>
          </div>
        }
      >
        {tindakanTarget && (
          <div className="space-y-3">
            <p className="rounded-xl bg-sunken/60 px-3 py-2 text-[12px] font-bold text-ink">
              {tindakanTarget.nama_siswa} · {tindakanTarget.kelas} ({tindakanTarget.jenis})
            </p>
            <Field label="Tindakan yang dilakukan">
              <Input
                value={tindakanText}
                onChange={(e) => setTindakanText(e.target.value)}
                placeholder="Misal: Pemanggilan orang tua / bimbingan konseling"
              />
            </Field>
            <Field label="Catatan tambahan (opsional)">
              <Input
                value={catatanText}
                onChange={(e) => setCatatanText(e.target.value)}
                placeholder="Hasil pertemuan / komitmen siswa"
              />
            </Field>
          </div>
        )}
      </Sheet>

      {/* Modal Eskalasi */}
      <Sheet
        open={Boolean(escalateTarget)}
        onClose={() => setEscalateTarget(null)}
        title="Eskalasi Kasus"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEscalateTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" loading={savingEscalate} onClick={submitEscalate}>
              Eskalasi
            </Button>
          </div>
        }
      >
        {escalateTarget && (
          <div className="space-y-3">
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mr-1 inline size-3.5" />
              Teruskan kasus <b>{escalateTarget.nama_siswa}</b> ke{' '}
              <b>{escalateTarget.level === 'wali_kelas' ? 'BK' : 'Kepala Sekolah'}</b>
            </p>
            <Field label="Alasan eskalasi">
              <Input
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Alasan perlunya penanganan tingkat lanjut"
              />
            </Field>
          </div>
        )}
      </Sheet>

      {/* Modal Tutup */}
      <Sheet
        open={Boolean(tutupTarget)}
        onClose={() => setTutupTarget(null)}
        title="Tutup Kasus Pembinaan"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setTutupTarget(null)}>
              Batal
            </Button>
            <Button variant="success" className="flex-1" loading={savingTutup} onClick={submitTutup}>
              Tutup Kasus
            </Button>
          </div>
        }
      >
        {tutupTarget && (
          <div className="space-y-3">
            <p className="text-[12.5px] font-medium text-muted">
              Tutup kasus untuk <b className="text-ink">{tutupTarget.nama_siswa}</b> ({tutupTarget.kelas}).
            </p>
            <Field label="Alasan penutupan">
              <Input
                value={tutupAlasan}
                onChange={(e) => setTutupAlasan(e.target.value)}
                placeholder="Misal: Kehadiran membaik setelah pembinaan"
              />
            </Field>
          </div>
        )}
      </Sheet>

      <StudentMonitorSheet
        open={Boolean(monitorSiswa)}
        siswa={monitorSiswa}
        onClose={() => setMonitorSiswa(null)}
      />
    </div>
  );
}
