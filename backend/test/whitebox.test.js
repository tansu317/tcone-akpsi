import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  sesiMenerimaPesan,
  statusAwalLaporan,
  statusPrediksiSetelahEvaluasi,
  transisiLaporanDisparitas,
  validasiEvaluasiAnalisis,
  validasiEvaluasiPrediksi,
  validasiFeedback,
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
