import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock, ShieldAlert } from 'lucide-react';
import api from '../lib/api';
import { cn, formatBulan, formatTanggal, monthISO, STATUS, TONE } from '../lib/utils';
import { hariEfektifBulan } from '../lib/libur';
import { pesanPeringatanDini, pesanRekapSiswa } from '../lib/whatsapp';
import { Badge, EmptyState, Sheet, Skeleton } from './ui';
import WaButton from './WaButton';

export default function StudentMonitorSheet({ siswa, open, onClose, initialBulan }) {
  const [bulan, setBulan] = useState(initialBulan || monthISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nisn = siswa?.nisn || '';
  const kelas = siswa?.kelas || '';
  const nama = siswa?.nama || siswa?.nama_siswa || 'Siswa';

  const load = useCallback(async () => {
    if (!open || !nisn) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getMonitoringSiswa(nisn, bulan);
      if (res?.success) {
        setData(res);
        return;
      }
      throw new Error(res?.error || 'Gagal memuat monitoring siswa');
    } catch (err) {
      // Fallback bila backend masih versi v8 (belum ada getMonitoringSiswa)
      if (/Action tidak ditemukan/i.test(err?.message || '') && kelas) {
        try {
          const [absRes, apelRes, kasusRes] = await Promise.all([
            api.getAbsensiGuru(kelas, '', bulan).catch(() => null),
            api.getApelPagi('', kelas, bulan, nisn).catch(() => null),
            api.getKasusPembinaan({ kelas }).catch(() => null),
          ]);
          const rows = (absRes?.data || []).filter(
            (r) => String(r.nisn).replace(/^0+/, '') === String(nisn).replace(/^0+/, '')
          );
          const statBulan = { H: 0, S: 0, I: 0, A: 0, C: 0 };
          const riwayatBulan = rows
            .map((r) => {
              if (statBulan[r.status] !== undefined) statBulan[r.status] += 1;
              return {
                tanggal: r.tanggal,
                status: r.status,
                jam: r.jam ? { [r.jam]: r.status } : {},
                detail: [{ jam: r.jam || 0, mapel: r.mapel || '', guru: r.guru || '', status: r.status }],
              };
            })
            .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
          const kasus = (kasusRes?.data || []).filter(
            (k) => String(k.nisn).replace(/^0+/, '') === String(nisn).replace(/^0+/, '')
          );
          setData({
            success: true,
            bulan,
            fallback: true,
            siswa: { nisn, nama, kelas, no_hp_ortu: siswa?.no_hp_ortu || '' },
            statBulan,
            statSemester: null,
            riwayatBulan,
            apelBulan: apelRes?.data || [],
            totalApelSemester: null,
            kasus,
          });
          return;
        } catch {
          /* lanjut tampilkan error awal */
        }
      }
      setData(null);
      setError(err.message || 'Gagal memuat monitoring siswa.');
    } finally {
      setLoading(false);
    }
  }, [open, nisn, kelas, nama, siswa?.no_hp_ortu, bulan]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const profil = data?.siswa || siswa || {};
  const noHp = profil.no_hp_ortu || siswa?.no_hp_ortu || '';
  const statBulan = data?.statBulan || { H: 0, S: 0, I: 0, A: 0, C: 0 };
  const statSem = data?.statSemester;
  const apelBulan = data?.apelBulan || [];
  const kasus = data?.kasus || [];
  const kasusOpen = kasus.filter((k) => k.status === 'Open').length;

  const totalBulan = statBulan.H + statBulan.S + statBulan.I + statBulan.A + statBulan.C;
  const persenBulan = totalBulan ? Math.round((statBulan.H / totalBulan) * 100) : 0;
  const acBulan = (statBulan.A || 0) + (statBulan.C || 0);
  const acSem = statSem ? (statSem.A || 0) + (statSem.C || 0) : acBulan;
  const efektif = hariEfektifBulan(bulan);

  const waRekapText = pesanRekapSiswa({
    nama: profil.nama || nama,
    kelas: profil.kelas || kelas,
    periode: formatBulan(bulan),
    stat: statBulan,
    terlambat: apelBulan.length,
  });

  const waPeringatanText = pesanPeringatanDini({
    nama: profil.nama || nama,
    kelas: profil.kelas || kelas,
    alpha: statSem ? statSem.A : statBulan.A,
    cabut: statSem ? statSem.C : statBulan.C,
    kasusOpen,
    periode: data?.semesterLabel ? `Semester ${data.semesterLabel} ${data.tahunAjaran}` : formatBulan(bulan),
  });

  return (
    <Sheet open={open} onClose={onClose} title="Monitoring Kehadiran Siswa" size="lg">
      <div className="space-y-3.5">
        {/* Header profil */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-sunken/40 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-extrabold text-ink">{profil.nama || nama}</p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-muted">
              NISN {profil.nisn || nisn} · {profil.kelas || kelas}
              {noHp ? ` · WA: ${noHp}` : ' · No. WA ortu belum diisi'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <WaButton phone={noHp} message={waRekapText} label="Kirim Rekap WA" />
            {(acSem >= 2 || kasusOpen > 0) && (
              <WaButton
                phone={noHp}
                message={waPeringatanText}
                label="WA Peringatan"
                variant="solid"
              />
            )}
          </div>
        </div>

        {/* Filter bulan */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] font-bold text-muted">
            <CalendarDays className="size-4" />
            <span>{formatBulan(bulan)} · {efektif} hari efektif</span>
          </div>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="h-9 rounded-xl border border-line bg-sunken/50 px-2.5 text-[12px] font-bold text-ink outline-none focus:border-brand focus:bg-surface"
          />
        </div>

        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : (
          <>
            {(acSem >= 2 || kasusOpen > 0) && (
              <div
                className={cn(
                  'flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[12px] font-semibold',
                  acSem >= 3 || kasusOpen > 0
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-extrabold">
                    {acSem >= 3 || kasusOpen > 0 ? 'Status Kritis — Perlu Pembinaan' : 'Peringatan Dini (Mendekati Batas)'}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    Alpha+Cabut: {acSem}×{statSem ? ' (semester ini)' : ' (bulan ini)'}
                    {kasusOpen > 0 ? ` · ${kasusOpen} kasus terbuka` : ''}.
                  </p>
                </div>
              </div>
            )}

            {/* Rekap Bulan Ini */}
            <div className="rounded-2xl border border-line p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[12.5px] font-extrabold text-ink">Rekap {formatBulan(bulan)}</p>
                <Badge tone={persenBulan >= 90 ? 'success' : persenBulan >= 75 ? 'warning' : 'danger'}>
                  {persenBulan}% hadir ({totalBulan} hari)
                </Badge>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {STATUS.map((s) => {
                  const t = TONE[s.tone];
                  return (
                    <div key={s.key} className="rounded-xl bg-sunken/60 py-2 text-center">
                      <span className={cn('text-[10px] font-extrabold uppercase', t.text)}>{s.label}</span>
                      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-ink">
                        {statBulan[s.key] || 0}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rekap Semester + Apel */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {statSem && (
                <div className="rounded-2xl border border-line p-3.5">
                  <p className="text-[12px] font-extrabold text-ink">
                    Semester {data.semesterLabel} {data.tahunAjaran}
                  </p>
                  <p className="mt-1.5 text-[11.5px] font-semibold text-muted">
                    H: <b className="text-ink">{statSem.H}</b> · S: <b className="text-ink">{statSem.S}</b> · I:{' '}
                    <b className="text-ink">{statSem.I}</b> · A:{' '}
                    <b className="text-rose-600 dark:text-rose-400">{statSem.A}</b> · C:{' '}
                    <b className="text-violet-600 dark:text-violet-400">{statSem.C}</b>
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-line p-3.5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-ink">
                    <Clock className="size-3.5 text-amber-500" /> Terlambat Apel
                  </p>
                  <Badge tone={apelBulan.length > 0 ? 'warning' : 'neutral'}>{apelBulan.length}× bulan ini</Badge>
                </div>
                {apelBulan.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[11px] font-semibold text-muted">
                    {apelBulan.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span>{formatTanggal(a.tanggal, { withDay: false })}</span>
                        <span className="tabular-nums text-ink">{a.jam_datang || '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[11px] font-medium text-muted">
                    Tidak ada catatan terlambat bulan ini
                    {data?.totalApelSemester != null ? ` (${data.totalApelSemester}× semester ini)` : ''}.
                  </p>
                )}
              </div>
            </div>

            {/* Kasus */}
            {kasus.length > 0 && (
              <div className="rounded-2xl border border-line p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-ink">
                  <ShieldAlert className="size-3.5 text-rose-500" /> Riwayat Kasus Pembinaan
                </p>
                <ul className="space-y-1.5">
                  {kasus.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-sunken/50 px-3 py-2 text-[11.5px]"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-ink">
                          {k.jenis} · {formatTanggal(k.tanggal, { withDay: false })}
                        </p>
                        {k.keterangan && <p className="truncate text-[10.5px] text-muted">{k.keterangan}</p>}
                      </div>
                      <Badge tone={k.status === 'Open' ? 'danger' : 'success'}>{k.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Riwayat Harian Bulan Ini */}
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="border-b border-line bg-sunken/50 px-3.5 py-2 text-[11.5px] font-extrabold text-ink">
                Riwayat Harian ({formatBulan(bulan)})
              </div>
              {(data?.riwayatBulan || []).length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Belum ada absensi bulan ini"
                  className="py-8"
                />
              ) : (
                <ul className="max-h-60 divide-y divide-line/70 overflow-y-auto">
                  {data.riwayatBulan.map((r) => {
                    const stObj = STATUS.find((x) => x.key === r.status) || STATUS[0];
                    const tone = TONE[stObj.tone];
                    return (
                      <li key={r.tanggal} className="flex items-center justify-between gap-2 px-3.5 py-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-ink">{formatTanggal(r.tanggal)}</p>
                          {r.detail?.length > 0 && (
                            <p className="truncate text-[10.5px] font-semibold text-muted">
                              {r.detail.map((d) => `J${d.jam}:${d.status}`).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
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
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
