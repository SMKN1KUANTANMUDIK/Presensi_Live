import {
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { STATUS, TONE, cn } from '../lib/utils';
import { Button, Sheet } from './ui';

const GUIDES = {
  '/input': {
    title: 'Cara Mengisi Absensi Kelas',
    intro: 'Halaman ini dipakai guru untuk mencatat kehadiran siswa di kelas.',
    steps: [
      'Pilih Tanggal dan Kelas yang sedang Anda ajar.',
      'Pilih Jam mulai (Jam selesai otomatis terisi sama, ubah jika mengajar lebih dari 1 jam).',
      'Semua siswa otomatis dianggap Hadir. Anda cukup ketuk Sakit, Izin, Alpha, atau Cabut pada siswa yang tidak hadir saja.',
      'Tekan tombol hijau Simpan di bawah. Setelah tersimpan, Anda bisa langsung kirim kabar ke WhatsApp orang tua.',
    ],
    tip: 'Jika siswa hanya izin/cabut di salah satu jam (misal jam ke-4 saja), pilih tombol "Jam 4" pada kotak "Status diisi untuk" sebelum menandai siswa.',
    showLegend: true,
  },
  '/piket': {
    title: 'Panduan Dashboard Piket',
    intro: 'Pantau seluruh kelas hari ini, catat siswa terlambat apel pagi, dan deteksi siswa yang bolos di tengah jam pelajaran.',
    steps: [
      'Cek kotak merah paling atas (jika ada) untuk melihat siswa yang hadir di jam awal lalu bolos/cabut di jam berikutnya.',
      'Gunakan kartu Apel Pagi → tekan "Catat siswa" untuk mencatat siswa yang datang terlambat.',
      'Pada daftar kelas di bawah, kotak J1, J2, dst. berwarna hijau jika sudah diabsen dan abu-abu jika jam masih kosong.',
      'Ketuk "Detail siswa" pada kartu kelas untuk melihat rincian per jam dan kirim pesan WhatsApp ke orang tua.',
    ],
    tip: 'Klik tombol WhatsApp (WA) untuk langsung membuka pesan yang sudah tertulis rapi — gratis tanpa pulsa/SMS.',
    showLegend: true,
  },
  '/report': {
    title: 'Cara Cetak & Simpan PDF Laporan',
    intro: 'Buat rekap absensi resmi berkop sekolah yang siap dicetak ke kertas A4 atau disimpan jadi file PDF.',
    steps: [
      'Pilih jenis laporan: Harian (1 hari per jam), Bulanan (ringkasan 1 bulan), atau Per guru.',
      'Pilih Kelas dan Tanggal/Bulan/Semester, lalu tekan tombol "Tampilkan rekap".',
      'Setelah tabel muncul, tekan "Cetak / PDF" untuk mencetak atau "CSV" untuk membuka di Excel.',
    ],
    tip: 'Cara menyimpan sebagai file PDF: tekan tombol "Cetak / PDF", lalu pada pilihan Printer ganti ke "Simpan sebagai PDF" (Save as PDF).',
    showLegend: true,
  },
  '/dashboard': {
    title: 'Panduan Dashboard Admin',
    intro: 'Ringkasan cepat kondisi kehadiran seluruh sekolah hari ini dan pintasan menuju semua menu pengelolaan.',
    steps: [
      'Lihat persentase kehadiran, jumlah pelanggaran (Alpha & Cabut), dan kelas yang belum menginput absensi hari ini.',
      'Ketuk kartu menu cepat (Input Absensi, Piket, Data Siswa, Data Guru, Riwayat, Kasus) untuk membuka halaman tujuan.',
    ],
    tip: 'Untuk menambah banyak siswa atau guru sekaligus dari Excel, buka Data Siswa / Data Guru lalu pilih tombol Import Excel/CSV.',
    showLegend: false,
  },
  '/kasus': {
    title: 'Panduan Kasus Pembinaan',
    intro: 'Daftar siswa yang tercatat Alpha atau Cabut ≥ 3 hari dalam satu semester agar bisa dibina bersama wali kelas, BK, dan orang tua.',
    steps: [
      'Tekan "Cek siswa 3× Alpha/Cabut" untuk memperbarui daftar otomatis dari data absensi semester ini.',
      'Tekan "WA Ortu" untuk menghubungi orang tua langsung, atau ketuk nama siswa untuk melihat riwayat lengkapnya.',
      'Tekan "Catat tindakan" setelah pembinaan dilakukan. Jika perlu penanganan lanjut, tekan "Teruskan ke BK / Kepsek".',
    ],
    tip: 'Wali kelas otomatis hanya melihat siswa dari kelas walinya sendiri agar data tetap rapi dan fokus.',
    showLegend: false,
  },
  '/riwayat': {
    title: 'Panduan Riwayat Absensi',
    intro: 'Melihat kembali, memperbaiki (Edit), atau menghapus sesi absensi yang sudah pernah disimpan.',
    steps: [
      'Gunakan filter Tanggal, Kelas, atau kolom pencarian nama guru/mapel untuk menemukan sesi yang dicari.',
      'Tekan "Detail" untuk melihat daftar siswa, "Edit" untuk mengubah status kehadiran yang keliru, atau "Hapus" jika sesi salah input.',
    ],
    tip: 'Mengubah status siswa di menu Edit otomatis memperbarui laporan harian, bulanan, dan kasus pembinaan.',
    showLegend: false,
  },
  '/kepsek': {
    title: 'Panduan Dashboard Kepala Sekolah',
    intro: 'Pantau tren kehadiran seluruh sekolah, perbandingan antar jurusan, kelas terbaik, dan siswa yang perlu perhatian.',
    steps: [
      'Pilih periode di bagian atas: Harian, Mingguan, Bulanan, atau Semester.',
      'Gunakan pilihan Kelas jika ingin melihat rincian khusus satu kelas saja.',
      'Pada daftar "Peringatan Dini & Siswa Rawan", ketuk nama siswa untuk melihat rekap lengkapnya atau tekan tombol WA.',
    ],
    tip: 'Kotak ringkasan otomatis (warna biru) merangkum kondisi sekolah sehingga tidak perlu menghitung manual.',
    showLegend: false,
  },
  '/siswa': {
    title: 'Panduan Kelola Data Siswa',
    intro: 'Tambah, ubah, atau hapus data siswa beserta nomor WhatsApp orang tua.',
    steps: [
      'Gunakan kolom pencarian untuk mencari siswa berdasarkan nama atau NISN, atau pilih filter kelas.',
      'Ketuk "Tambah" untuk menambah 1 siswa, atau "Import Excel/CSV" untuk memasukkan 1 kelas/sekolah sekaligus.',
      'Ketuk ikon grafik di baris siswa untuk membuka laporan kehadiran bulanan & semester siswa tersebut.',
    ],
    tip: 'Mengisi nomor WA Orang Tua (contoh: 081234567890) membuat tombol kirim WhatsApp otomatis menuju nomor orang tua tanpa harus mencari kontak manual.',
    showLegend: false,
  },
  '/guru': {
    title: 'Panduan Kelola Data Guru & Akun',
    intro: 'Mengatur akun login, hak akses (peran), mata pelajaran, dan penetapan wali kelas.',
    steps: [
      'Tekan "Tambah" untuk membuat akun guru baru, atau ikon pensil untuk mengubah data/reset password.',
      'Pilih Role sesuai tugas: Admin, Kepala Sekolah, Petugas Piket, Guru Mapel, atau Wali Kelas.',
      'Khusus Role "Wali Kelas", pilih juga "Kelas wali" agar otomatis terhubung dengan kelas binaannya.',
    ],
    tip: 'Saat mengedit data guru, biarkan kolom Password kosong jika tidak ingin mengganti password yang lama.',
    showLegend: false,
  },
  '/orangtua': {
    title: 'Panduan Monitoring Siswa',
    intro: 'Melihat rangkuman kehadiran bulanan & semester per siswa sekaligus mengirim laporan ke WhatsApp orang tua.',
    steps: [
      'Pilih Kelas di bagian atas, lalu cari dan ketuk nama siswa yang ingin dilihat.',
      'Di jendela yang muncul, Anda dapat mengganti bulan, melihat jumlah keterlambatan apel pagi, dan langsung mengirim rekap lewat tombol WA.',
    ],
    tip: 'Pesan WhatsApp sudah otomatis memuat persentase hadir dan jumlah S/I/A/C bulan terpilih.',
    showLegend: true,
  },
  '/ortu': {
    title: 'Cara Menggunakan Portal Orang Tua',
    intro: 'Cek kehadiran dan keterlambatan anak di sekolah secara mandiri tanpa perlu password.',
    steps: [
      'Pilih Kelas anak pada kolom pertama (bisa diketik atau langsung dipilih dari daftar).',
      'Pilih Nama Anak dari rekomendasi yang muncul otomatis (atau pindah ke tab "NISN Anak" jika ingin memasukkan 10 angka NISN).',
      'Centang "Ingat perangkat ini" agar lain kali langsung terbuka tanpa perlu memilih ulang, lalu tekan "Lihat Kehadiran".',
    ],
    tip: 'Tanggal hari Sabtu, Minggu, dan libur nasional otomatis ditandai sebagai hari libur.',
    showLegend: true,
  },
  '/login': {
    title: 'Bantuan Masuk Aplikasi',
    intro: 'Gunakan halaman ini untuk masuk sesuai peran Anda di sekolah.',
    steps: [
      'Guru, Wali Kelas, Piket, Admin & Kepsek: masukkan Username dan Password yang diberikan admin sekolah, lalu tekan Masuk.',
      'Orang Tua / Wali Siswa: TIDAK perlu isi username/password — langsung tekan tombol "Buka Portal Orang Tua (Tanpa Password)" di bawah.',
    ],
    tip: 'Jika lupa password atau akun belum terdaftar, silakan hubungi operator/admin sekolah.',
    showLegend: false,
  },
};

export default function HelpSheet({ open, onClose, pathname = '/input' }) {
  const guide = GUIDES[pathname] || GUIDES['/input'];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <HelpCircle className="size-5 text-brand" />
          <span>{guide.title}</span>
        </span>
      }
      size="md"
      footer={
        <Button className="w-full" size="md" onClick={onClose}>
          <CheckCircle2 className="size-4" /> Saya mengerti
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="rounded-2xl bg-brand-soft/60 px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-ink">
          {guide.intro}
        </p>

        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
            <Sparkles className="size-3.5 text-brand" /> Langkah Cepat
          </p>
          <ol className="space-y-2.5">
            {guide.steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-2xl border border-line/80 bg-sunken/35 p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11.5px] font-extrabold text-white">
                  {idx + 1}
                </span>
                <span className="text-[13px] font-semibold leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {guide.showLegend && (
          <div className="rounded-2xl border border-line bg-surface p-3.5">
            <p className="mb-2 text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
              Arti Warna &amp; Singkatan Status
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {STATUS.map((s) => {
                const t = TONE[s.tone];
                const desc =
                  s.key === 'H'
                    ? 'Masuk kelas'
                    : s.key === 'S'
                      ? 'Sakit (ada kabar)'
                      : s.key === 'I'
                        ? 'Izin resmi'
                        : s.key === 'A'
                          ? 'Tanpa keterangan'
                          : 'Keluar saat KBM';
                return (
                  <div key={s.key} className={cn('rounded-xl px-2.5 py-2', t.soft)}>
                    <p className={cn('text-[12px] font-extrabold', t.text)}>
                      {s.short} = {s.label}
                    </p>
                    <p className="text-[10.5px] font-semibold text-muted">{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {guide.tip && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-[12.5px] font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>{guide.tip}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
