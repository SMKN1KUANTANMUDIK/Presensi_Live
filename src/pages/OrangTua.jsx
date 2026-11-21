import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, User } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/utils';
import { Badge, Card, EmptyState, Select, Skeleton } from '../components/ui';
import StudentMonitorSheet from '../components/StudentMonitorSheet';
import SearchSuggest from '../components/SearchSuggest';

export default function OrangTua() {
  const { user } = useAuth();
  const kelasDefault = user?.kelas_wali || user?.kelas || '';

  const [kelasList, setKelasList] = useState([]);
  const [kelas, setKelas] = useState(kelasDefault);
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api
      .getKelas()
      .then((res) => {
        const list = res?.data || [];
        setKelasList(list);
        if (!kelasDefault && list.length) setKelas(list[0]);
      })
      .catch(() => {});
  }, [kelasDefault]);

  useEffect(() => {
    if (!kelas) return undefined;
    let alive = true;
    setLoading(true);
    api
      .getSiswa(kelas)
      .then((res) => {
        if (alive) setSiswaList(res?.data || []);
      })
      .catch(() => {
        if (alive) setSiswaList([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kelas]);

  const siswaSuggestions = useMemo(
    () =>
      siswaList.map((s) => {
        const nama = s.nama_siswa || s.nama || '';
        return {
          value: nama,
          label: nama,
          sub: `NISN ${s.nisn}${s.no_hp_ortu ? ` · WA ${s.no_hp_ortu}` : ''}`,
          badge: s.no_hp_ortu ? 'Ada WA' : 'Lihat',
          badgeTone: s.no_hp_ortu ? 'success' : 'brand',
          keywords: `${s.nisn} ${s.no_hp_ortu || ''}`,
          raw: s,
        };
      }),
    [siswaList]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return siswaList;
    return siswaList.filter(
      (s) => String(s.nama_siswa || s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').includes(q)
    );
  }, [siswaList, query]);

  return (
    <div className="space-y-3">
      <Card className="animate-rise p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <ShieldCheck className="size-[18px]" />
            </span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-ink">Monitoring Kehadiran Siswa</h1>
              <p className="text-[11.5px] font-semibold text-muted">
                Pilih siswa untuk lihat rekap bulanan/semester & kirim WA orang tua
              </p>
            </div>
          </div>
          <Badge tone="neutral">Gratis via WA</Badge>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Select value={kelas} onChange={(e) => setKelas(e.target.value)} className="h-10 text-[12.5px]">
            <option value="">Pilih kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>

          <SearchSuggest
            value={query}
            onChange={setQuery}
            onSelect={(opt) => {
              const s = opt.raw;
              const nama = s?.nama_siswa || s?.nama || opt.label;
              setQuery(nama);
              if (s) {
                setSelected({
                  nisn: s.nisn,
                  nama,
                  kelas: s.kelas || kelas,
                  no_hp_ortu: s.no_hp_ortu || '',
                });
              }
            }}
            options={siswaSuggestions}
            placeholder="Cari nama atau NISN…"
            hintTitle={kelas ? `Siswa kelas ${kelas}` : 'Siswa tersedia'}
            showToggle
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={User} title="Tidak ada siswa" description="Pilih kelas di atas untuk melihat daftar siswa." />
        ) : (
          <ul className="divide-y divide-line/70">
            {filtered.map((s) => {
              const nama = s.nama_siswa || s.nama;
              return (
                <li key={s.nisn}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected({
                        nisn: s.nisn,
                        nama,
                        kelas: s.kelas || kelas,
                        no_hp_ortu: s.no_hp_ortu || '',
                      })
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunken/50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-[11px] font-extrabold text-brand">
                      {initials(nama)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{nama}</p>
                      <p className="truncate text-[11px] font-semibold text-muted">
                        NISN {s.nisn}
                        {s.no_hp_ortu ? ` · WA ${s.no_hp_ortu}` : ''}
                      </p>
                    </div>
                    <Badge tone="brand">Lihat &amp; WA</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <StudentMonitorSheet open={Boolean(selected)} siswa={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
