import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anonimkanKonteks,
  otorisasiAksesPerkara,
  sesiMenerimaPesan,
  statusAwalLaporan,
  statusPrediksiSetelahEvaluasi,
  tolakUbahAudit,
  transisiLaporanDisparitas,
  validasiEvaluasiAnalisis,
  validasiEvaluasiPrediksi,
  validasiFeedback,
  verifikasiRujukan,
} from '../src/domain.js';
import { uuid } from '../src/lib/errors.js';

const lengkap = [5, 4, 3, 2, 1];

describe('evaluasi prediksi', () => {
  it('WB-EP-01 menolak status di luar kamus', () => {
    assert.equal(validasiEvaluasiPrediksi('SELESAI', ''), 'Pilih hasil evaluasi terlebih dahulu.');
  });
  it('WB-EP-02 DITERIMA tanpa keterangan lolos', () => {
    assert.equal(validasiEvaluasiPrediksi('DITERIMA', '   '), null);
  });
  it('WB-EP-03 DITOLAK tanpa alasan ditolak', () => {
    assert.match(validasiEvaluasiPrediksi('DITOLAK', '  '), /Alasan penolakan wajib/);
  });
  it('WB-EP-04 DIKOREKSI tanpa koreksi ditolak', () => {
    assert.match(validasiEvaluasiPrediksi('DIKOREKSI', ''), /Koreksi wajib/);
  });
  it('WB-EP-05 DITANDAI keterangan kosong lolos', () => {
    assert.equal(validasiEvaluasiPrediksi('DITANDAI', ''), null);
  });
  it('WB-EP-06 prediksi Aktif menjadi Dievaluasi', () => {
    assert.equal(statusPrediksiSetelahEvaluasi('Aktif'), 'Dievaluasi');
  });
  it('WB-EP-07 status Digantikan tidak ditimpa', () => {
    assert.equal(statusPrediksiSetelahEvaluasi('Digantikan'), 'Digantikan');
  });
});

describe('evaluasi analisis', () => {
  it('WB-EA-01 status di luar SETUJU atau TIDAK SETUJU ditolak', () => {
    assert.equal(validasiEvaluasiAnalisis('TIDAK PERLU', lengkap, ''), 'Pilih hasil evaluasi analisis.');
  });
  it('WB-EA-02 lima komponen kosong dihitung', () => {
    assert.equal(validasiEvaluasiAnalisis('SETUJU', [], ''), 'Evaluasi belum lengkap: 5 komponen belum diberi nilai.');
  });
  it('WB-EA-03 satu komponen kosong', () => {
    assert.match(validasiEvaluasiAnalisis('SETUJU', [5, 4, 3, 2, 0], ''), /1 komponen/);
  });
  it('WB-EA-04 TIDAK SETUJU tanpa alasan ditolak', () => {
    assert.equal(validasiEvaluasiAnalisis('TIDAK SETUJU', lengkap, '  '), 'Alasan ketidaksetujuan wajib diisi.');
  });
  it('WB-EA-05 SETUJU lengkap lolos', () => {
    assert.equal(validasiEvaluasiAnalisis('SETUJU', lengkap, ''), null);
  });
  it('WB-EA-06 nilai di luar 1 sampai 5 ditolak', () => {
    assert.match(validasiEvaluasiAnalisis('SETUJU', [6, 4, 3, 2, 1], ''), /1 sampai 5|di luar/);
  });
});

describe('laporan disparitas', () => {
  it('WB-LD-01 indikasi masuk Menunggu Peninjauan', () => {
    assert.equal(statusAwalLaporan(true), 'Menunggu Peninjauan');
  });
  it('WB-LD-02 tanpa indikasi tidak masuk antrean peninjauan', () => {
    assert.equal(statusAwalLaporan(false), 'Tidak Ada Indikasi');
  });
  it('WB-LD-03 Menunggu Peninjauan boleh divalidasi', () => {
    assert.equal(transisiLaporanDisparitas('Menunggu Peninjauan', 'Terkonfirmasi', ''), null);
  });
  it('WB-LD-04 Menunggu Peninjauan boleh diabaikan', () => {
    assert.equal(transisiLaporanDisparitas('Menunggu Peninjauan', 'Diabaikan', ''), null);
  });
  it('WB-LD-05 lompat ke Ditindaklanjuti ditolak', () => {
    const hasil = transisiLaporanDisparitas('Menunggu Peninjauan', 'Ditindaklanjuti', 'catatan');
    assert.equal(hasil.status, 409);
  });
  it('WB-LD-06 Tidak Ada Indikasi tidak punya transisi', () => {
    assert.equal(transisiLaporanDisparitas('Tidak Ada Indikasi', 'Terkonfirmasi', '').status, 409);
  });
  it('WB-LD-07 tindak lanjut tanpa catatan ditolak', () => {
    const hasil = transisiLaporanDisparitas('Terkonfirmasi', 'Ditindaklanjuti', '   ');
    assert.equal(hasil.status, 400);
    assert.match(hasil.pesan, /Catatan tindak lanjut wajib/);
  });
  it('WB-LD-08 tindak lanjut dengan catatan lolos', () => {
    assert.equal(transisiLaporanDisparitas('Terkonfirmasi', 'Ditindaklanjuti', 'Dibahas pleno'), null);
  });
  it('WB-LD-09 status akhir tidak bisa diubah', () => {
    assert.equal(transisiLaporanDisparitas('Ditindaklanjuti', 'Diabaikan', '').status, 409);
    assert.equal(transisiLaporanDisparitas('Diabaikan', 'Terkonfirmasi', '').status, 409);
  });
});

describe('feedback dan sesi', () => {
  it('WB-FB-01 jenis kosong ditolak', () => {
    assert.match(validasiFeedback('', 4), /Feedback belum lengkap/);
  });
  it('WB-FB-02 rating kosong ditolak', () => {
    assert.match(validasiFeedback('Sesuai', 0), /Feedback belum lengkap/);
  });
  it('WB-FB-03 Sesuai dengan rating 5 lolos', () => {
    assert.equal(validasiFeedback('Sesuai', 5), null);
  });
  it('WB-FB-04 rating di luar 1 sampai 5 ditolak', () => {
    assert.match(validasiFeedback('Tidak Sesuai', 6), /1 sampai 5|di luar/);
  });
  it('WB-CS-01 sesi Aktif menerima pesan', () => {
    assert.equal(sesiMenerimaPesan('Aktif'), null);
  });
  it('WB-CS-02 sesi Selesai menolak pesan', () => {
    assert.equal(sesiMenerimaPesan('Selesai'), 'Sesi sudah diakhiri.');
  });
});

describe('identitas', () => {
  it('WB-ID-01 UUID valid lolos', () => {
    const id = '11111111-0000-4000-8000-000000000002';
    assert.equal(uuid(id, 'Prediksi'), id);
  });
  it('WB-ID-02 UUID rusak ditolak', () => {
    assert.throws(() => uuid('bukan-uuid', 'Prediksi'), /Prediksi tidak valid/);
  });
});

describe('otorisasi akses perkara', () => {
  const perkara = {
    paniteraId: 'pan-1',
    hakimId: 'hak-1',
    anggotaMajelisIds: ['pan-1', 'hak-1', 'hak-2'],
  };

  it('WB-OA-01 sesi tidak valid ditolak 401', () => {
    const hasil = otorisasiAksesPerkara(false, { id: 'hak-1', peran: 'Hakim' }, perkara, 'detail');
    assert.equal(hasil.status, 401);
    assert.match(hasil.pesan, /Sesi tidak valid/);
    assert.equal(hasil.catatAudit, false);
  });

  it('WB-OA-02 Panitera bukan anggota majelis ditolak 403 dan diaudit', () => {
    const hasil = otorisasiAksesPerkara(true, { id: 'pan-asing', peran: 'Panitera' }, perkara, 'detail');
    assert.equal(hasil.status, 403);
    assert.match(hasil.pesan, /bukan anggota majelis/);
    assert.equal(hasil.catatAudit, true);
  });

  it('WB-OA-03 Hakim anggota majelis diizinkan', () => {
    assert.equal(otorisasiAksesPerkara(true, { id: 'hak-1', peran: 'Hakim' }, perkara, 'detail'), null);
  });

  it('WB-OA-04 Pimpinan mengakses data detail ditolak 403 dan diaudit', () => {
    const hasil = otorisasiAksesPerkara(true, { id: 'pim-1', peran: 'Pimpinan' }, perkara, 'detail');
    assert.equal(hasil.status, 403);
    assert.match(hasil.pesan, /putusan final atau data agregat/);
    assert.equal(hasil.catatAudit, true);
  });

  it('WB-OA-05 Pimpinan mengakses data agregat diizinkan', () => {
    assert.equal(
      otorisasiAksesPerkara(true, { id: 'pim-1', peran: 'Pimpinan' }, perkara, 'agregat'),
      null,
    );
  });

  it('WB-OA-06 Pimpinan mengakses putusan final diizinkan', () => {
    assert.equal(
      otorisasiAksesPerkara(true, { id: 'pim-1', peran: 'Pimpinan' }, perkara, 'putusan_final'),
      null,
    );
  });

  it('WB-OA-07 peran di luar kamus ditolak 403 dan diaudit', () => {
    const hasil = otorisasiAksesPerkara(true, { id: 'x-1', peran: 'Admin' }, perkara, 'detail');
    assert.equal(hasil.status, 403);
    assert.match(hasil.pesan, /tidak berwenang/);
    assert.equal(hasil.catatAudit, true);
  });
});

describe('anonimisasi konteks', () => {
  it('WB-AK-01 nama pihak diganti token PIHAK', () => {
    const hasil = anonimkanKonteks(
      'Permohonan diajukan oleh PT Sumber Makmur terhadap DJP.',
      ['PT Sumber Makmur'],
    );
    assert.match(hasil, /\[PIHAK-01\]/);
    assert.equal(hasil.includes('PT Sumber Makmur'), false);
  });

  it('WB-AK-02 pola NPWP diganti token NPWP', () => {
    const hasil = anonimkanKonteks('NPWP wajib pajak 01.234.567.8-901.000 tercatat.', []);
    assert.match(hasil, /\[NPWP\]/);
    assert.equal(hasil.includes('01.234.567.8-901.000'), false);
  });

  it('WB-AK-03 nama dan NPWP diganti bersamaan', () => {
    const hasil = anonimkanKonteks(
      'CV Angkasa Jaya dengan NPWP 10.987.654.3-210.000',
      ['CV Angkasa Jaya'],
    );
    assert.match(hasil, /\[PIHAK-01\]/);
    assert.match(hasil, /\[NPWP\]/);
  });
});

describe('verifikasi rujukan', () => {
  it('WB-VR-01 ID rujukan tidak ada di korpus dilabeli Tidak ditemukan', () => {
    const hasil = verifikasiRujukan({
      jawaban: 'Dasar hukum Pasal 36.',
      rujukan: [{ label: 'UU-TIDAK-ADA', kutipan: 'Pasal 36' }],
      idDiKorpus: ['UU KUP Pasal 36'],
      teksSumber: 'Pasal 36 ayat (1)',
    });
    assert.equal(hasil.rujukan[0].labelStatus, 'Tidak ditemukan');
    assert.equal(hasil.rujukan[0].terverifikasi, false);
  });

  it('WB-VR-02 kutipan tidak ada di sumber dilabeli Tidak mendukung klaim', () => {
    const hasil = verifikasiRujukan({
      jawaban: 'Klaim tidak didukung.',
      rujukan: [{ label: 'PUT-012345', kutipan: 'teks yang tidak ada' }],
      idDiKorpus: ['PUT-012345'],
      teksSumber: 'Isi putusan pembanding yang berbeda.',
    });
    assert.equal(hasil.rujukan[0].labelStatus, 'Tidak mendukung klaim');
    assert.equal(hasil.rujukan[0].terverifikasi, false);
  });

  it('WB-VR-03 tanpa rujukan terverifikasi jawaban tidak ditampilkan', () => {
    const hasil = verifikasiRujukan({
      jawaban: 'Jawaban spekulatif.',
      rujukan: [{ label: 'SUMBER-X' }],
      idDiKorpus: [],
      teksSumber: '',
    });
    assert.equal(hasil.tampilkanJawaban, false);
    assert.match(hasil.pesan, /Susun ulang pertanyaan/);
  });

  it('WB-VR-04 rujukan terverifikasi jawaban ditampilkan', () => {
    const hasil = verifikasiRujukan({
      jawaban: 'Putusan didukung Pasal 36.',
      rujukan: [{ label: 'UU KUP Pasal 36', kutipan: 'Pasal 36' }],
      idDiKorpus: ['UU KUP Pasal 36'],
      teksSumber: 'Bunyi Pasal 36 ayat (1) huruf a.',
    });
    assert.equal(hasil.tampilkanJawaban, true);
    assert.equal(hasil.rujukan[0].labelStatus, 'Terverifikasi');
    assert.equal(hasil.rujukan[0].terverifikasi, true);
    assert.equal(hasil.jawaban, 'Putusan didukung Pasal 36.');
  });
});

describe('tolak ubah audit', () => {
  it('WB-TA-01 UPDATE audit ditolak', () => {
    const hasil = tolakUbahAudit('UPDATE');
    assert.equal(hasil.ditolak, true);
    assert.match(hasil.pesan, /append-only/);
    assert.equal(hasil.catatPercobaan, true);
  });

  it('WB-TA-02 DELETE audit ditolak', () => {
    const hasil = tolakUbahAudit('DELETE');
    assert.equal(hasil.ditolak, true);
    assert.equal(hasil.catatPercobaan, true);
  });

  it('WB-TA-03 INSERT audit diteruskan', () => {
    assert.equal(tolakUbahAudit('INSERT'), null);
  });
});
