export const LANGKAH_PREDIKSI = [
  'Meminta data perkara ke Tax Court One',
  'Menerima data & dokumen perkara dari Tax Court One',
  'Memvalidasi kelengkapan data dan dokumen perkara',
  'Preprocessing dokumen (OCR, normalisasi teks)',
  'Mengekstraksi informasi relevan (pihak, dalil, dasar hukum)',
  'Menjalankan K-Means, GMM, dan Agglomerative Clustering',
  'Menghitung relevansi & menyiapkan daftar putusan sejenis',
  'Menghasilkan probabilitas per kategori amar',
  'Menyimpan hasil prediksi putusan',
];

export const KOMPONEN_ANALISIS = [
  'Informasi perkara',
  'Argumen yang relevan',
  'Dasar hukum',
  'Putusan pembanding',
  'Faktor dominan & ringkasan',
];

const STATUS_EVALUASI = ['DITERIMA', 'DIKOREKSI', 'DITOLAK', 'DITANDAI'];

export function validasiEvaluasiPrediksi(status, keterangan) {
  if (!STATUS_EVALUASI.includes(status)) return 'Pilih hasil evaluasi terlebih dahulu.';
  const teks = String(keterangan || '').trim();
  if ((status === 'DIKOREKSI' || status === 'DITOLAK') && !teks) {
    return status === 'DITOLAK'
      ? 'Alasan penolakan wajib diisi sebelum evaluasi disimpan.'
      : 'Koreksi wajib diisi sebelum evaluasi disimpan.';
  }
  return null;
}

export function statusPrediksiSetelahEvaluasi(status) {
  return status === 'Aktif' ? 'Dievaluasi' : status;
}

export function validasiEvaluasiAnalisis(status, nilai, alasan) {
  if (!['SETUJU', 'TIDAK SETUJU'].includes(status)) return 'Pilih hasil evaluasi analisis.';
  const daftar = Array.isArray(nilai) ? nilai : [];
  const kosong = KOMPONEN_ANALISIS.filter((_, i) => daftar[i] == null || daftar[i] === '' || Number(daftar[i]) === 0);
  if (kosong.length) return `Evaluasi belum lengkap: ${kosong.length} komponen belum diberi nilai.`;
  const diLuar = daftar.some((n) => !Number.isInteger(Number(n)) || Number(n) < 1 || Number(n) > 5);
  if (diLuar) return 'Nilai relevansi harus bilangan 1 sampai 5.';
  if (status === 'TIDAK SETUJU' && !String(alasan || '').trim()) return 'Alasan ketidaksetujuan wajib diisi.';
  return null;
}

export function statusAwalLaporan(adaIndikasi) {
  return adaIndikasi ? 'Menunggu Peninjauan' : 'Tidak Ada Indikasi';
}

export function transisiLaporanDisparitas(dari, ke, catatan) {
  const boleh = (dari === 'Menunggu Peninjauan' && (ke === 'Terkonfirmasi' || ke === 'Diabaikan'))
    || (dari === 'Terkonfirmasi' && ke === 'Ditindaklanjuti');
  if (!boleh) return { pesan: 'Perubahan status laporan tidak sesuai alur peninjauan.', status: 409 };
  if (ke === 'Ditindaklanjuti' && !String(catatan || '').trim()) {
    return { pesan: 'Catatan tindak lanjut wajib diisi.', status: 400 };
  }
  return null;
}

export function validasiFeedback(jenis, rating) {
  if (!['Sesuai', 'Tidak Sesuai'].includes(jenis) || !rating) {
    return 'Feedback belum lengkap. Pilih jenis feedback dan beri rating sebelum mengirim.';
  }
  const angka = Number(rating);
  if (!Number.isInteger(angka) || angka < 1 || angka > 5) return 'Rating harus bilangan 1 sampai 5.';
  return null;
}

export function sesiMenerimaPesan(status) {
  return status === 'Aktif' ? null : 'Sesi sudah diakhiri.';
}

export function ringkasanAnalisis(amar, jumlahPembanding) {
  const pembanding = jumlahPembanding >= 2
    ? 'Dua dari tiga putusan pembanding teratas berakhir dengan amar yang sama. '
    : '';
  return `Prediksi ${amar} terutama didukung oleh terpenuhinya jangka waktu permohonan dan indikasi bahwa sanksi timbul karena kekhilafan. ${pembanding}Riwayat keterlambatan pelaporan menahan probabilitas pengabulan seluruhnya.`;
}
