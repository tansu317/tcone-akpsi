import { Router } from 'express';
import { query } from '../db.js';
import { bad, uuid } from '../lib/errors.js';
import { peran, wajibMasuk } from '../middleware/auth.js';
import { ambilPrediksi, generatePrediksi, riwayatPrediksi } from '../services/prediksiService.js';
import { ambilAnalisis, bandingkan } from '../services/analisisService.js';

const router = Router();
router.use(wajibMasuk);

router.get('/riwayat', peran('Panitera', 'Hakim'), async (_req, res) => {
  res.json(await riwayatPrediksi());
});

router.post('/generate', peran('Panitera', 'Hakim'), async (req, res) => {
  const perkaraId = uuid(req.body?.perkaraId, 'Perkara');
  const hasil = await generatePrediksi(req.user, perkaraId, req.body?.kunci);
  res.status(hasil.berhasil ? 201 : 200).json(hasil);
});

router.get('/:id', peran('Panitera', 'Hakim', 'Pimpinan'), async (req, res) => {
  const data = await ambilPrediksi(uuid(req.params.id, 'Prediksi'));
  if (!data) throw bad('Prediksi tidak ditemukan.', 404);
  res.json(data);
});

router.get('/:id/analisis', peran('Panitera', 'Hakim'), async (req, res) => {
  const data = await ambilAnalisis(uuid(req.params.id, 'Prediksi'));
  if (!data) throw bad('Analisis untuk prediksi ini belum tersedia.', 404);
  res.json(data);
});

router.get('/:id/pembanding/:putusanId', peran('Hakim'), async (req, res) => {
  const data = await bandingkan(uuid(req.params.id, 'Prediksi'), uuid(req.params.putusanId, 'Putusan'));
  res.json(data);
});

router.get('/putusan/:id/unduh', peran('Panitera', 'Hakim'), async (req, res) => {
  const { rows } = await query(
    `SELECT nomor_putusan, duduk_perkara, pertimbangan, amar_teks FROM putusan WHERE id = $1`,
    [uuid(req.params.id, 'Putusan')],
  );
  if (!rows[0]) throw bad('Putusan tidak ditemukan.', 404);
  const teks = [
    `PUTUSAN`,
    `Nomor ${rows[0].nomor_putusan}`,
    '',
    `DUDUK PERKARA. ${rows[0].duduk_perkara}`,
    '',
    `PERTIMBANGAN HUKUM. ${rows[0].pertimbangan}`,
    '',
    `MENGADILI. ${rows[0].amar_teks}`,
    '',
    'Dokumen contoh fiktif untuk lingkungan lokal SIPROPERTI.',
  ].join('\n');
  const nama = rows[0].nomor_putusan.split(' ')[0].replace(/[^\w.-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${nama}.txt"`);
  res.type('text/plain; charset=utf-8').send(teks);
});

export default router;
