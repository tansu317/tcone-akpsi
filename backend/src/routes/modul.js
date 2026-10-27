import { Router } from 'express';
import { query } from '../db.js';
import { catat } from '../lib/audit.js';
import { angka, bad, uuid } from '../lib/errors.js';
import { peran, wajibMasuk } from '../middleware/auth.js';
import { KOMPONEN_ANALISIS, LANGKAH_PREDIKSI } from '../domain.js';
import {
  akhiriSesi,
  ambilSesi,
  bukaSesi,
  daftarSesi,
  kirimPesan,
  simpanFeedback,
} from '../services/chatService.js';
import {
  daftarLaporan,
  daftarTarget,
  detailLaporan,
  deteksi,
  lihatParameter,
  simpanDeteksi,
  simpanParameter,
  ubahStatusLaporan,
} from '../services/disparitasService.js';

const router = Router();

router.get('/meta', wajibMasuk, async (_req, res) => {
  const amar = await query(`SELECT nama FROM kategori_amar ORDER BY urutan`);
  const chat = await query(`SELECT jenis, pertanyaan_contoh FROM templat_chat ORDER BY urutan`);
  res.json({
    kategoriAmar: amar.rows.map((r) => r.nama),
    komponenAnalisis: KOMPONEN_ANALISIS,
    langkahPrediksi: LANGKAH_PREDIKSI,
    jenisChat: chat.rows.map((r) => ({ jenis: r.jenis, contoh: r.pertanyaan_contoh })),
  });
});

router.get('/dashboard', wajibMasuk, async (req, res) => {
  const { peran: peranUser, id } = req.user;
  if (peranUser === 'Panitera') {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM perkara WHERE tampil_penyelesaian AND status_ucap = 'Belum Ucap') AS belum_ucap,
         (SELECT COUNT(DISTINCT perkara_id)::int FROM hasil_prediksi WHERE status IN ('Aktif','Dievaluasi')) AS terprediksi,
         (SELECT COUNT(*)::int FROM perkara WHERE tampil_penyelesaian AND kelengkapan = 'tidak_lengkap') AS belum_lengkap,
         (SELECT COUNT(*)::int FROM antrean_prediksi WHERE status = 'Gagal') AS gagal`,
    );
    return res.json({
      kartu: [
        [rows[0].belum_ucap, 'Sengketa gugatan belum diucap', '#00c0ef'],
        [rows[0].terprediksi, 'Sengketa telah diprediksi', '#00a65a'],
        [rows[0].belum_lengkap, 'Berkas belum lengkap', '#f39c12'],
        [rows[0].gagal, 'Prediksi gagal', '#dd4b39'],
      ],
    });
  }
  if (peranUser === 'Hakim') {
    const hitung = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM perkara WHERE tampil_penyelesaian) AS aktif,
         (SELECT COUNT(*)::int FROM hasil_prediksi hp JOIN perkara p ON p.id = hp.perkara_id
            WHERE hp.status = 'Aktif' AND p.hakim_id = $1) AS menunggu,
         (SELECT COUNT(*)::int FROM evaluasi_prediksi WHERE evaluator_id = $1) AS evaluasi,
         (SELECT COUNT(*)::int FROM percakapan_ai WHERE pengguna_id = $1) AS chat`,
      [id],
    );
    const antrean = await query(
      `SELECT hp.id, p.nomor_sengketa, p.nama_pemohon, ka.nama AS amar, hp.skor_keyakinan
       FROM hasil_prediksi hp
       JOIN perkara p ON p.id = hp.perkara_id
       LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
       WHERE hp.status = 'Aktif' AND p.hakim_id = $1
       ORDER BY hp.dibuat_pada DESC`,
      [id],
    );
    return res.json({
      kartu: [
        [hitung.rows[0].aktif, 'Penyelesaian putusan aktif', '#00c0ef'],
        [hitung.rows[0].menunggu, 'Prediksi menunggu telaah', '#00a65a'],
        [hitung.rows[0].evaluasi, 'Evaluasi tersimpan', '#f39c12'],
        [hitung.rows[0].chat, 'Sesi ChatAI', '#605ca8'],
      ],
      menunggu: antrean.rows.map((r) => ({
        id: r.id,
        nomorSengketa: r.nomor_sengketa,
        namaPemohon: r.nama_pemohon,
        amar: r.amar,
        skorKeyakinan: angka(r.skor_keyakinan),
      })),
    });
  }
  const lap = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM perkara WHERE tampil_disparitas) AS ditangani,
       (SELECT COUNT(*)::int FROM laporan_disparitas WHERE status = 'Menunggu Peninjauan') AS tunggu,
       (SELECT COUNT(*)::int FROM laporan_disparitas WHERE status = 'Ditindaklanjuti') AS tindak,
       (SELECT COUNT(*)::int FROM laporan_disparitas WHERE status = 'Diabaikan') AS abaikan`,
  );
  res.json({
    kartu: [
      [lap.rows[0].ditangani, 'Putusan sedang ditangani', '#00c0ef'],
      [lap.rows[0].tunggu, 'Menunggu peninjauan', '#dd4b39'],
      [lap.rows[0].tindak, 'Ditindaklanjuti', '#00a65a'],
      [lap.rows[0].abaikan, 'Diabaikan', '#777777'],
    ],
  });
});

router.get('/notifikasi', wajibMasuk, async (req, res) => {
  const { rows } = await query(
    `SELECT id, judul, isi, tautan, dibaca, dibuat_pada
     FROM notifikasi WHERE pengguna_id = $1 ORDER BY dibuat_pada DESC LIMIT 20`,
    [req.user.id],
  );
  res.json({
    belumDibaca: rows.filter((r) => !r.dibaca).length,
    daftar: rows.map((r) => ({
      id: r.id, judul: r.judul, isi: r.isi, tautan: r.tautan, dibaca: r.dibaca, dibuatPada: r.dibuat_pada,
    })),
  });
});

router.post('/notifikasi/:id/baca', wajibMasuk, async (req, res) => {
  await query(`UPDATE notifikasi SET dibaca = true WHERE id = $1 AND pengguna_id = $2`, [
    uuid(req.params.id, 'Notifikasi'), req.user.id,
  ]);
  res.json({ ok: true });
});

const evaluasi = Router();
evaluasi.use(wajibMasuk, peran('Hakim'));

evaluasi.get('/prediksi/:id', async (req, res) => {
  const id = uuid(req.params.id, 'Prediksi');
  const { rows } = await query(
    `SELECT id, status, amar_koreksi, bagian_dikoreksi, keterangan, dibuat_pada
     FROM evaluasi_prediksi WHERE hasil_prediksi_id = $1 ORDER BY dibuat_pada DESC`,
    [id],
  );
  res.json(rows.map((r) => ({
    id: r.id,
    status: r.status,
    amarKoreksi: r.amar_koreksi,
    bagian: r.bagian_dikoreksi,
    keterangan: r.keterangan,
    dibuatPada: r.dibuat_pada,
  })));
});

evaluasi.post('/prediksi', async (req, res) => {
  const prediksiId = uuid(req.body?.prediksiId, 'Prediksi');
  const status = req.body?.status;
  const keterangan = String(req.body?.keterangan || '');
  if (!['DITERIMA', 'DIKOREKSI', 'DITOLAK', 'DITANDAI'].includes(status)) {
    throw bad('Pilih hasil evaluasi terlebih dahulu.');
  }
  if ((status === 'DIKOREKSI' || status === 'DITOLAK') && !keterangan.trim()) {
    throw bad(status === 'DITOLAK'
      ? 'Alasan penolakan wajib diisi sebelum evaluasi disimpan.'
      : 'Koreksi wajib diisi sebelum evaluasi disimpan.');
  }
  const prediksi = await query(`SELECT kode, status FROM hasil_prediksi WHERE id = $1`, [prediksiId]);
  if (!prediksi.rows[0]) throw bad('Prediksi tidak ditemukan.', 404);
  const simpan = await query(
    `INSERT INTO evaluasi_prediksi
      (hasil_prediksi_id, evaluator_id, status, amar_koreksi, bagian_dikoreksi, keterangan)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, status, keterangan, amar_koreksi, dibuat_pada`,
    [prediksiId, req.user.id, status, req.body?.amarKoreksi || null, req.body?.bagianDikoreksi || null, keterangan],
  );
  if (prediksi.rows[0].status === 'Aktif') {
    await query(`UPDATE hasil_prediksi SET status = 'Dievaluasi' WHERE id = $1`, [prediksiId]);
  }
  await catat(req.user, `Evaluasi hasil prediksi: ${status}`, prediksi.rows[0].kode);
  const r = simpan.rows[0];
  res.status(201).json({
    id: r.id, status: r.status, keterangan: r.keterangan, amarKoreksi: r.amar_koreksi, dibuatPada: r.dibuat_pada,
  });
});

evaluasi.post('/analisis', async (req, res) => {
  const prediksiId = uuid(req.body?.prediksiId, 'Prediksi');
  const status = req.body?.status;
  const nilai = req.body?.nilai || [];
  const alasan = String(req.body?.alasan || '');
  if (!['SETUJU', 'TIDAK SETUJU'].includes(status)) throw bad('Pilih hasil evaluasi analisis.');
  const kosong = KOMPONEN_ANALISIS.filter((_, i) => !nilai[i]);
  if (kosong.length) throw bad(`Evaluasi belum lengkap: ${kosong.length} komponen belum diberi nilai.`);
  if (status === 'TIDAK SETUJU' && !alasan.trim()) throw bad('Alasan ketidaksetujuan wajib diisi.');
  const analisis = await query(`SELECT id FROM analisis_perkara WHERE hasil_prediksi_id = $1`, [prediksiId]);
  if (!analisis.rows[0]) throw bad('Analisis perkara belum tersedia.', 404);
  const prediksi = await query(`SELECT kode FROM hasil_prediksi WHERE id = $1`, [prediksiId]);
  const simpan = await query(
    `INSERT INTO evaluasi_analisis (hasil_prediksi_id, analisis_id, evaluator_id, status, alasan)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [prediksiId, analisis.rows[0].id, req.user.id, status, alasan],
  );
  for (let i = 0; i < KOMPONEN_ANALISIS.length; i += 1) {
    await query(
      `INSERT INTO nilai_relevansi (evaluasi_analisis_id, komponen, nilai, urutan) VALUES ($1,$2,$3,$4)`,
      [simpan.rows[0].id, KOMPONEN_ANALISIS[i], Number(nilai[i]), i + 1],
    );
  }
  await catat(req.user, `Evaluasi hasil analisis: ${status}`, prediksi.rows[0].kode);
  res.status(201).json({ id: simpan.rows[0].id, status });
});

evaluasi.get('/saya', async (req, res) => {
  const prediksi = await query(
    `SELECT e.status, e.keterangan, e.dibuat_pada, hp.kode
     FROM evaluasi_prediksi e JOIN hasil_prediksi hp ON hp.id = e.hasil_prediksi_id
     WHERE e.evaluator_id = $1 ORDER BY e.dibuat_pada DESC`,
    [req.user.id],
  );
  const umpan = await query(
    `SELECT f.jenis, f.rating, f.status_tindak_lanjut, f.dibuat_pada, hp.kode
     FROM feedback f JOIN hasil_prediksi hp ON hp.id = f.hasil_prediksi_id
     WHERE f.pengguna_id = $1 ORDER BY f.dibuat_pada DESC`,
    [req.user.id],
  );
  res.json({
    evaluasi: prediksi.rows.map((r) => ({
      prediksi: r.kode, status: r.status, keterangan: r.keterangan, dibuatPada: r.dibuat_pada,
    })),
    feedback: umpan.rows.map((r) => ({
      prediksi: r.kode, jenis: r.jenis, rating: r.rating, status: r.status_tindak_lanjut, dibuatPada: r.dibuat_pada,
    })),
  });
});

const chat = Router();
chat.use(wajibMasuk, peran('Hakim'));
chat.get('/sesi', async (req, res) => res.json(await daftarSesi(req.user.id)));
chat.post('/sesi', async (req, res) => res.status(201).json(await bukaSesi(req.user, uuid(req.body?.prediksiId, 'Prediksi'))));
chat.get('/sesi/:id', async (req, res) => {
  const data = await ambilSesi(uuid(req.params.id, 'Sesi'));
  if (!data) throw bad('Sesi tidak ditemukan.', 404);
  res.json(data);
});
chat.post('/sesi/:id/pesan', async (req, res) => {
  res.json(await kirimPesan(req.user, uuid(req.params.id, 'Sesi'), req.body?.jenis, req.body?.isi));
});
chat.post('/sesi/:id/akhiri', async (req, res) => {
  res.json(await akhiriSesi(req.user, uuid(req.params.id, 'Sesi')));
});
chat.post('/feedback', async (req, res) => {
  res.status(201).json(await simpanFeedback(req.user, req.body || {}));
});

const disparitas = Router();
disparitas.use(wajibMasuk, peran('Pimpinan'));
disparitas.get('/parameter', async (_req, res) => res.json(await lihatParameter()));
disparitas.put('/parameter', async (req, res) => res.json(await simpanParameter(req.user, req.body || {})));
disparitas.get('/target', async (req, res) => res.json(await daftarTarget(req.query.jenisPajak)));
disparitas.post('/deteksi', async (req, res) => {
  if (req.body?.parameter) await simpanParameter(req.user, req.body.parameter);
  res.json(await deteksi(req.user, uuid(req.body?.perkaraId, 'Perkara')));
});
disparitas.post('/simpan', async (req, res) => {
  res.status(201).json(await simpanDeteksi(req.user, uuid(req.body?.perkaraId, 'Perkara')));
});
disparitas.get('/laporan', async (_req, res) => res.json(await daftarLaporan()));
disparitas.get('/laporan/:id', async (req, res) => {
  const data = await detailLaporan(uuid(req.params.id, 'Laporan'));
  if (!data) throw bad('Laporan tidak ditemukan.', 404);
  res.json(data);
});
disparitas.patch('/laporan/:id', async (req, res) => {
  res.json(await ubahStatusLaporan(req.user, uuid(req.params.id, 'Laporan'), req.body?.status, req.body?.catatan));
});

const audit = Router();
audit.use(wajibMasuk);
audit.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = await query(
    `SELECT waktu, nama_pengguna, aksi, objek
     FROM jejak_audit
     WHERE ($1 = '' OR nama_pengguna ILIKE $2 OR aksi ILIKE $2 OR objek ILIKE $2)
     ORDER BY waktu DESC
     LIMIT 200`,
    [q, `%${q}%`],
  );
  res.json(rows.map((r) => ({
    waktu: r.waktu, pengguna: r.nama_pengguna, aksi: r.aksi, objek: r.objek,
  })));
});

router.use('/evaluasi', evaluasi);
router.use('/chat', chat);
router.use('/disparitas', disparitas);
router.use('/audit', audit);

export default router;
