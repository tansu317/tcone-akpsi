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

/**
 * Otorisasi akses perkara (F9).
 * @param {boolean} sesiValid sesi autentikasi masih berlaku
 * @param {{ id: string, peran: string }} pengguna
 * @param {{ paniteraId?: string, hakimId?: string, anggotaMajelisIds?: string[] }} perkara
 * @param {string} jenisData 'putusan_final' | 'agregat' | jenis lain
 * @returns {null|{ status: number, pesan: string, catatAudit: boolean }}
 */
export function otorisasiAksesPerkara(sesiValid, pengguna, perkara = {}, jenisData = 'detail') {
  if (!sesiValid) {
    return { status: 401, pesan: 'Sesi tidak valid atau telah kedaluwarsa.', catatAudit: false };
  }
  const peran = pengguna?.peran;
  if (peran === 'Panitera' || peran === 'Hakim') {
    const anggota = (perkara.anggotaMajelisIds || []).includes(pengguna.id)
      || pengguna.id === perkara.paniteraId
      || pengguna.id === perkara.hakimId;
    if (!anggota) {
      return {
        status: 403,
        pesan: 'Anda bukan anggota majelis perkara ini.',
        catatAudit: true,
      };
    }
    return null;
  }
  if (peran === 'Pimpinan') {
    if (jenisData !== 'putusan_final' && jenisData !== 'agregat') {
      return {
        status: 403,
        pesan: 'Pimpinan hanya dapat mengakses putusan final atau data agregat.',
        catatAudit: true,
      };
    }
    return null;
  }
  return { status: 403, pesan: 'Peran Anda tidak berwenang mengakses perkara ini.', catatAudit: true };
}

const POLA_NPWP = /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g;

function lepasRegex(teks) {
  return String(teks).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Anonimisasi konteks perkara (F10).
 * @param {string} teks
 * @param {Array<string|{ nama: string, token?: string }>} daftarPihak
 */
export function anonimkanKonteks(teks, daftarPihak = []) {
  let hasil = String(teks ?? '');
  daftarPihak.forEach((pihak, i) => {
    const nama = typeof pihak === 'string' ? pihak : pihak?.nama;
    if (!nama) return;
    const token = (typeof pihak === 'object' && pihak.token)
      || `[PIHAK-${String(i + 1).padStart(2, '0')}]`;
    hasil = hasil.replace(new RegExp(lepasRegex(nama), 'g'), token);
  });
  hasil = hasil.replace(POLA_NPWP, '[NPWP]');
  return hasil;
}

/**
 * Verifikasi rujukan jawaban ChatAI (F11).
 * @param {{ jawaban: string, rujukan?: Array<{ id?: string, label: string, kutipan?: string }>, idDiKorpus?: Iterable<string>, teksSumber?: string }} masukan
 */
export function verifikasiRujukan({ jawaban, rujukan = [], idDiKorpus = [], teksSumber = '' } = {}) {
  const korpus = idDiKorpus instanceof Set ? idDiKorpus : new Set(idDiKorpus);
  const diperiksa = (Array.isArray(rujukan) ? rujukan : []).map((item) => {
    const kunci = item.id || item.label;
    if (!korpus.has(kunci) && !korpus.has(item.label)) {
      return { ...item, labelStatus: 'Tidak ditemukan', terverifikasi: false };
    }
    if (item.kutipan && teksSumber && !teksSumber.includes(item.kutipan)) {
      return { ...item, labelStatus: 'Tidak mendukung klaim', terverifikasi: false };
    }
    return { ...item, labelStatus: 'Terverifikasi', terverifikasi: true };
  });
  const adaTerverifikasi = diperiksa.some((r) => r.terverifikasi);
  if (!adaTerverifikasi) {
    return {
      rujukan: diperiksa,
      tampilkanJawaban: false,
      pesan: 'Tidak ada rujukan yang mendukung jawaban. Susun ulang pertanyaan atau akhiri percakapan.',
    };
  }
  return {
    rujukan: diperiksa,
    tampilkanJawaban: true,
    jawaban,
  };
}

/**
 * Model keputusan trigger append-only jejak audit (F12 / trg_audit_imut).
 * @param {'INSERT'|'UPDATE'|'DELETE'|string} operasi
 */
export function tolakUbahAudit(operasi) {
  if (operasi === 'UPDATE' || operasi === 'DELETE') {
    return {
      ditolak: true,
      pesan: 'Rekaman pada tabel jejak_audit bersifat append-only dan tidak dapat diubah atau dihapus.',
      catatPercobaan: true,
    };
  }
  return null;
}

export function ringkasanAnalisis(amar, jumlahPembanding) {
  const pembanding = jumlahPembanding >= 2
    ? 'Dua dari tiga putusan pembanding teratas berakhir dengan amar yang sama. '
    : '';
  return `Prediksi ${amar} terutama didukung oleh terpenuhinya jangka waktu permohonan dan indikasi bahwa sanksi timbul karena kekhilafan. ${pembanding}Riwayat keterlambatan pelaporan menahan probabilitas pengabulan seluruhnya.`;
}
