import { Router } from 'express';
import { query } from '../db.js';
import { catat } from '../lib/audit.js';
import { angka, bad, uuid } from '../lib/errors.js';
import { peran, wajibMasuk } from '../middleware/auth.js';

const router = Router();
router.use(wajibMasuk);

const DAFTAR = `
  SELECT p.id, p.nomor_sengketa, p.nama_pemohon, p.jenis_pajak, p.pokok_sengketa,
         p.nilai_sengketa, p.tanggal_masuk, p.tanggal_selesai_sidang, p.posisi,
         p.status_ucap, p.status_siproperti, p.dapat_dipilih, p.tersedia_di_tco, p.kelengkapan,
         p.masa_pajak, p.jenis_sengketa, p.nomor_objek_gugatan, p.tanggal_objek_gugatan,
         (SELECT nama FROM pihak WHERE perkara_id = p.id AND peran_pihak = 'Tergugat' LIMIT 1) AS tergugat,
         mj.kode AS majelis, pan.nama AS panitera, hak.nama_singkat AS hakim,
         pr.id AS prediksi_id, pr.kode, pr.versi, pr.status AS status_prediksi,
         pr.skor_keyakinan, ka.nama AS amar
  FROM perkara p
  JOIN majelis mj ON mj.id = p.majelis_id
  JOIN pengguna pan ON pan.id = p.panitera_id
  LEFT JOIN pengguna hak ON hak.id = p.hakim_id
  LEFT JOIN LATERAL (
    SELECT id, kode, versi, status, skor_keyakinan, amar_kategori_id
    FROM hasil_prediksi
    WHERE perkara_id = p.id AND status IN ('Aktif', 'Dievaluasi')
    ORDER BY versi DESC LIMIT 1
  ) pr ON true
  LEFT JOIN kategori_amar ka ON ka.id = pr.amar_kategori_id
`;

function mapPerkara(r) {
  return {
    id: r.id,
    nomorSengketa: r.nomor_sengketa,
    namaPemohon: r.nama_pemohon,
    jenisPajak: r.jenis_pajak,
    pokokSengketa: r.pokok_sengketa,
    nilaiSengketa: angka(r.nilai_sengketa),
    tanggalMasuk: r.tanggal_masuk,
    tanggalSelesai: r.tanggal_selesai_sidang,
    majelis: r.majelis,
    panitera: r.panitera,
    hakim: r.hakim,
    posisi: r.posisi,
    statusUcap: r.status_ucap,
    statusSiproperti: r.status_siproperti,
    dapatDipilih: r.dapat_dipilih,
    tersediaDiTco: r.tersedia_di_tco,
    kelengkapan: r.kelengkapan,
    masaPajak: r.masa_pajak,
    jenisSengketa: r.jenis_sengketa,
    tergugat: r.tergugat,
    nomorObjekGugatan: r.nomor_objek_gugatan,
    tanggalObjekGugatan: r.tanggal_objek_gugatan,
    prediksi: r.prediksi_id ? {
      id: r.prediksi_id,
      kode: r.kode,
      versi: r.versi,
      status: r.status_prediksi,
      amar: r.amar,
      skorKeyakinan: angka(r.skor_keyakinan),
    } : null,
  };
}

const FILTER = {
  jenisPajak: (v, n) => [`p.jenis_pajak = $${n}`, v],
  kelengkapan: (v, n) => (['lengkap', 'tidak_lengkap'].includes(v) ? [`p.kelengkapan = $${n}`, v] : null),
  tco: (v, n) => (['tersedia', 'tidak'].includes(v) ? [`p.tersedia_di_tco = $${n}`, v === 'tersedia'] : null),
  statusPrediksi: (v) => {
    if (v === 'sudah') return ['pr.id IS NOT NULL'];
    if (v === 'belum') return ['pr.id IS NULL'];
    return null;
  },
  selesaiDari: (v, n) => [`p.tanggal_selesai_sidang >= $${n}::date`, v],
  selesaiSampai: (v, n) => [`p.tanggal_selesai_sidang <= $${n}::date`, v],
  q: (v, n) => [`concat_ws(' ', p.nomor_sengketa, p.nama_pemohon, p.pokok_sengketa) ILIKE $${n}`, `%${v}%`],
};

router.get('/', peran('Panitera', 'Hakim'), async (req, res) => {
  const kondisi = ['p.tampil_penyelesaian'];
  const nilai = [];
  for (const [kunci, buat] of Object.entries(FILTER)) {
    const v = String(req.query[kunci] || '').trim();
    if (!v) continue;
    if ((kunci === 'selesaiDari' || kunci === 'selesaiSampai') && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      throw bad('Format tanggal filter harus YYYY-MM-DD.');
    }
    const hasil = buat(v, nilai.length + 1);
    if (!hasil) throw bad(`Nilai filter ${kunci} tidak dikenali.`);
    kondisi.push(hasil[0]);
    if (hasil.length > 1) nilai.push(hasil[1]);
  }
  const { rows } = await query(`${DAFTAR} WHERE ${kondisi.join(' AND ')} ORDER BY p.nomor_sengketa`, nilai);
  res.json(rows.map(mapPerkara));
});

router.get('/:id', peran('Panitera', 'Hakim'), async (req, res) => {
  const id = uuid(req.params.id, 'Perkara');
  const { rows } = await query(`${DAFTAR} WHERE p.id = $1`, [id]);
  if (!rows[0]) throw bad('Sengketa tidak ditemukan.', 404);
  const dokumen = await query(
    `SELECT jenis_dokumen, tersedia FROM dokumen_perkara WHERE perkara_id = $1 ORDER BY urutan`,
    [id],
  );
  res.json({
    ...mapPerkara(rows[0]),
    dokumen: dokumen.rows.map((d) => ({ jenis: d.jenis_dokumen, tersedia: d.tersedia })),
  });
});

router.post('/:id/pilih', peran('Panitera', 'Hakim'), async (req, res) => {
  const id = uuid(req.params.id, 'Perkara');
  const { rows } = await query(`${DAFTAR} WHERE p.id = $1`, [id]);
  if (!rows[0]) throw bad('Sengketa tidak ditemukan.', 404);
  await catat(req.user, 'Memilih sengketa', rows[0].nomor_sengketa);
  const dokumen = await query(
    `SELECT jenis_dokumen, tersedia FROM dokumen_perkara WHERE perkara_id = $1 ORDER BY urutan`,
    [id],
  );
  res.json({
    ...mapPerkara(rows[0]),
    dokumen: dokumen.rows.map((d) => ({ jenis: d.jenis_dokumen, tersedia: d.tersedia })),
  });
});

router.post('/:id/batal', peran('Panitera', 'Hakim'), async (req, res) => {
  const id = uuid(req.params.id, 'Perkara');
  const { rows } = await query(`SELECT nomor_sengketa FROM perkara WHERE id = $1`, [id]);
  if (!rows[0]) throw bad('Sengketa tidak ditemukan.', 404);
  const lain = req.body?.alasan === 'pilih_lain';
  const nomor = rows[0].nomor_sengketa;
  const isi = lain
    ? `Pemilihan sengketa ${nomor} dibatalkan. Silakan pilih sengketa lain dari daftar.`
    : `Pemilihan sengketa ${nomor} dibatalkan. Tidak ada prediksi yang dibuat.`;
  await catat(req.user, 'Membatalkan pemilihan sengketa', nomor);
  await query(
    `INSERT INTO notifikasi (pengguna_id, judul, isi, tautan) VALUES ($1, $2, $3, '/penyelesaian')`,
    [req.user.id, 'Pemilihan sengketa dibatalkan', isi],
  );
  res.json({ pesan: isi });
});

export default router;
