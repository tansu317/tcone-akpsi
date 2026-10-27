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

export function ringkasanAnalisis(amar, jumlahPembanding) {
  const pembanding = jumlahPembanding >= 2
    ? 'Dua dari tiga putusan pembanding teratas berakhir dengan amar yang sama. '
    : '';
  return `Prediksi ${amar} terutama didukung oleh terpenuhinya jangka waktu permohonan dan indikasi bahwa sanksi timbul karena kekhilafan. ${pembanding}Riwayat keterlambatan pelaporan menahan probabilitas pengabulan seluruhnya.`;
}
