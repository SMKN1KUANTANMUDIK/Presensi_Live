import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { Badge, Button, Sheet } from './ui';
import { csvToObjects, downloadText, pick, toCSV } from '../lib/csv';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { cn } from '../lib/utils';

const TEMPLATES = {
  siswa: {
    file: 'format-import-siswa.csv',
    headers: ['nisn', 'nama_siswa', 'kelas', 'jk'],
    display: ['nisn', 'nama', 'kelas', 'jk'],
    contoh: [
      ['0012345678', 'Aditya Pratama', 'X TKJ 1', 'L'],
      ['0012345679', 'Bunga Lestari', 'X TKJ 1', 'P'],
    ],
    kolom: [
      { key: 'nisn', desc: 'Nomor induk siswa (wajib, unik)' },
      { key: 'nama_siswa', desc: 'Nama lengkap siswa (wajib)' },
      { key: 'kelas', desc: 'Contoh: X TKJ 1 (wajib, kelas baru otomatis dibuat)' },
      { key: 'jk', desc: 'L atau P (opsional)' },
    ],
    map: (o) => ({
      nisn: pick(o, ['nisn']),
      nama: pick(o, ['nama_siswa', 'nama']),
      kelas: pick(o, ['kelas']),
      jk: pick(o, ['jk', 'jenis_kelamin']),
    }),
    validate: (r) => (r.nisn && r.nama && r.kelas ? '' : 'NISN, nama, dan kelas wajib diisi'),
    send: (rows, mode) => api.importSiswa({ rows, mode }),
  },
  guru: {
    file: 'format-import-guru.csv',
    headers: ['nip', 'nama_guru', 'username', 'password', 'role', 'mapel', 'kelas_wali'],
    display: ['nip', 'nama', 'username', 'password', 'role', 'mapel', 'kelas_wali'],
    contoh: [
      ['198501012010011001', 'Waldo Guntala, S.Kom', 'waldo', 'rahasia123', 'guru', 'Informatika', ''],
      ['199002022015022002', 'Siti Aminah', 'siti', 'rahasia123', 'wali', 'Matematika', 'X TKJ 1'],
    ],
    kolom: [
      { key: 'nip', desc: 'NIP / ID guru (wajib, unik)' },
      { key: 'nama_guru', desc: 'Nama lengkap (wajib)' },
      { key: 'username', desc: 'Untuk login (kosong = pakai NIP)' },
      { key: 'password', desc: 'Kosong = password lama dipertahankan / default 123456' },
      { key: 'role', desc: 'admin / kepsek / piket / guru / wali' },
      { key: 'mapel', desc: 'Mata pelajaran yang diampu' },
      { key: 'kelas_wali', desc: 'Wajib bila role = wali' },
    ],
    map: (o) => ({
      nip: pick(o, ['nip']),
      nama: pick(o, ['nama_guru', 'nama']),
      username: pick(o, ['username']),
      password: pick(o, ['password']),
      role: (pick(o, ['role']) || 'guru').toLowerCase(),
      mapel: pick(o, ['mapel']),
      kelas_wali: pick(o, ['kelas_wali', 'kelas']),
    }),
    validate: (r) => {
      if (!r.nip) return 'NIP wajib diisi';
      if (!r.nama) return 'Nama wajib diisi';
      if (!['admin', 'kepsek', 'piket', 'guru', 'wali'].includes(r.role)) return `Role "${r.role}" tidak valid`;
      if (r.role === 'wali' && !r.kelas_wali) return 'Wali kelas wajib mengisi kelas_wali';
      return '';
    },
    send: (rows, mode) => api.importGuru({ rows, mode }),
  },
};

export default function ImportSheet({ open, onClose, kind = 'siswa', onDone }) {
  const tpl = TEMPLATES[kind];
  const toast = useToast();
  const fileRef = useRef(null);

  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState('upsert');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const { objects } = csvToObjects(text);
    const valid = [];
    const invalid = [];
    objects.forEach((o, i) => {
      const row = tpl.map(o);
      const err = tpl.validate(row);
      if (err) invalid.push({ line: i + 2, error: err, row });
      else valid.push(row);
    });
    return { valid, invalid, total: objects.length };
  }, [text, tpl]);

  const reset = () => {
    setText('');
    setFileName('');
    setMode('upsert');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const downloadTemplate = () => {
    downloadText(tpl.file, toCSV(tpl.headers, tpl.contoh));
    toast.success('Format berhasil diunduh');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2 MB');
      return;
    }
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    setResult(null);
  };

  const doImport = async () => {
    if (!parsed || !parsed.valid.length) return;
    setBusy(true);
    try {
      const res = await tpl.send(parsed.valid, mode);
      if (!res?.success) throw new Error(res?.error || 'Import gagal');
      setResult(res);
      toast.success(`Import selesai: ${res.added || 0} baru, ${res.updated || 0} diperbarui`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Import data ${kind}`}
      size="lg"
      footer={
        result ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              onDone?.();
              close();
            }}
          >
            Selesai
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={close}>
              Batal
            </Button>
            <Button
              className="flex-1"
              size="md"
              onClick={doImport}
              loading={busy}
              disabled={!parsed?.valid.length}
            >
              <Upload className="size-4" />
              Import {parsed?.valid.length ? `${parsed.valid.length} baris` : ''}
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-500" />
            <div>
              <p className="text-[14px] font-extrabold text-ink">Import berhasil</p>
              <p className="mt-1 text-[12.5px] font-medium text-muted">
                {result.added || 0} data baru · {result.updated || 0} diperbarui · {result.skipped || 0} dilewati
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Baru', value: result.added || 0, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Diperbarui', value: result.updated || 0, cls: 'text-sky-600 dark:text-sky-400' },
              { label: 'Dilewati', value: result.skipped || 0, cls: 'text-amber-600 dark:text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-sunken/40 px-2 py-3 text-center">
                <p className={cn('text-xl font-extrabold tabular-nums', s.cls)}>{s.value}</p>
                <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {result.newKelas?.length ? (
            <div className="rounded-2xl border border-line bg-sunken/40 p-3">
              <p className="text-[12px] font-bold text-ink">Kelas baru ditambahkan otomatis:</p>
              <p className="mt-1 text-[12px] font-medium text-muted">{result.newKelas.join(', ')}</p>
            </div>
          ) : null}

          {result.errors?.length ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-3.5" /> {result.errors.length} baris bermasalah
              </p>
              <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-[11.5px] font-medium text-amber-700/90 dark:text-amber-200/80">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {/* langkah 1: unduh format */}
          <div className="rounded-2xl border border-line bg-sunken/40 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <FileSpreadsheet className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-extrabold text-ink">1. Unduh format</p>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-muted">
                  Buka file CSV dengan Excel / Google Sheets, isi datanya, lalu unggah kembali.
                </p>
                <Button variant="soft" size="sm" className="mt-2" onClick={downloadTemplate}>
                  <Download className="size-3.5" /> Unduh format CSV
                </Button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-sunken/60">
                  <tr>
                    {tpl.headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-extrabold text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tpl.contoh.map((row, i) => (
                    <tr key={i} className="border-t border-line/60">
                      {row.map((c, j) => (
                        <td key={j} className="px-2 py-1.5 font-semibold text-ink/80">
                          {c || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer text-[11.5px] font-bold text-brand">Keterangan kolom</summary>
              <ul className="mt-1.5 space-y-1">
                {tpl.kolom.map((k) => (
                  <li key={k.key} className="text-[11.5px] font-medium text-muted">
                    <b className="text-ink">{k.key}</b> — {k.desc}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* langkah 2: unggah */}
          <div>
            <p className="mb-2 text-[13.5px] font-extrabold text-ink">2. Unggah file yang sudah diisi</p>

            <label
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition',
                fileName ? 'border-brand/40 bg-brand-soft/40' : 'border-line hover:border-brand/40 hover:bg-sunken/40'
              )}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
              <Upload className="size-5 text-muted" />
              <span className="text-[12.5px] font-bold text-ink">
                {fileName || 'Pilih file CSV'}
              </span>
              <span className="text-[11px] font-medium text-muted">Maksimal 2 MB · pemisah koma atau titik koma</span>
            </label>

            <details className="mt-2">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-brand">
                <ClipboardPaste className="size-3.5" /> Atau tempel data dari spreadsheet
              </summary>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFileName('');
                  setResult(null);
                }}
                rows={5}
                placeholder={`${tpl.headers.join(',')}\n${tpl.contoh[0].join(',')}`}
                className="mt-2 w-full rounded-xl border border-line bg-sunken/50 p-3 font-mono text-[11.5px] leading-relaxed text-ink outline-none focus:border-brand focus:bg-surface"
              />
            </details>
          </div>

          {/* pratinjau */}
          {parsed && (
            <div className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{parsed.valid.length} baris siap</Badge>
                {parsed.invalid.length > 0 && <Badge tone="danger">{parsed.invalid.length} bermasalah</Badge>}
                <span className="text-[11.5px] font-medium text-muted">{parsed.total} baris terbaca</span>
              </div>

              {parsed.valid.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-line">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 bg-sunken/80">
                      <tr>
                        {tpl.headers.map((h) => (
                          <th key={h} className="px-2 py-1 text-left font-extrabold text-muted">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.valid.slice(0, 8).map((row, i) => (
                        <tr key={i} className="border-t border-line/60">
                          {tpl.display.map((k) => (
                            <td key={k} className="whitespace-nowrap px-2 py-1 font-semibold text-ink/80">
                              {row[k] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {parsed.invalid.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11.5px] font-medium text-rose-600 dark:text-rose-400">
                  {parsed.invalid.slice(0, 5).map((e, i) => (
                    <li key={i}>• Baris {e.line}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* mode */}
          <div className="rounded-2xl border border-line p-3">
            <p className="text-[12.5px] font-extrabold text-ink">3. Pilih cara import</p>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name={`mode-${kind}`}
                checked={mode === 'upsert'}
                onChange={() => setMode('upsert')}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12.5px] font-bold text-ink">Tambah &amp; perbarui</span>
                <span className="block text-[11.5px] font-medium text-muted">
                  Data dengan NISN/NIP yang sama akan diperbarui, sisanya ditambahkan.
                </span>
              </span>
            </label>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name={`mode-${kind}`}
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12.5px] font-bold text-rose-600 dark:text-rose-400">
                  Ganti seluruh data
                </span>
                <span className="block text-[11.5px] font-medium text-muted">
                  Semua data {kind} lama dihapus lalu diganti isi file. Gunakan dengan hati-hati.
                </span>
              </span>
            </label>
          </div>

          {busy && (
            <p className="flex items-center justify-center gap-2 text-[12px] font-bold text-muted">
              <Loader2 className="size-4 animate-spin" /> Mengirim data ke server…
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
