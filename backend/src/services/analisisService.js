import { query } from '../db.js';
import { angka, bad } from '../lib/errors.js';

export async function ambilAnalisis(prediksiId) {
  const analisis = await query(
    `SELECT a.id, a.ringkasan, a.status, hp.kode, ka.nama AS amar, hp.skor_keyakinan,
            hp.versi, m.nama AS model_nama, m.versi AS model_versi,
            p.nomor_sengketa, p.jenis_pajak, p.masa_pajak, p.pokok_sengketa, p.nilai_sengketa
     FROM analisis_perkara a
     JOIN hasil_prediksi hp ON hp.id = a.hasil_prediksi_id
     JOIN perkara p ON p.id = hp.perkara_id
     JOIN model_prediksi m ON m.id = hp.model_id
     LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
     WHERE a.hasil_prediksi_id = $1`,
    [prediksiId],
  );
  const baris = analisis.rows[0];
  if (!baris) return null;

  const [argumen, hukum, faktor, putusan] = await Promise.all([
    query(`SELECT pihak, isi FROM argumen WHERE analisis_id = $1 ORDER BY urutan`, [baris.id]),
    query(
      `SELECT d.judul, d.isi FROM analisis_dasar_hukum ad
       JOIN dasar_hukum d ON d.id = ad.dasar_hukum_id
       WHERE ad.analisis_id = $1`,
      [baris.id],
    ),
    query(
      `SELECT nama_faktor, kontribusi FROM faktor_dominan WHERE analisis_id = $1 ORDER BY urutan`,
      [baris.id],
    ),
    query(
      `SELECT t.nomor_putusan, t.amar, k.persentase
       FROM kemiripan_putusan k JOIN putusan t ON t.id = k.putusan_id
       WHERE k.hasil_prediksi_id = $1
       ORDER BY k.persentase DESC LIMIT 3`,
      [prediksiId],
    ),
  ]);

  return {
    id: baris.id,
    ringkasan: baris.ringkasan,
    status: baris.status,
    prediksi: {
      id: prediksiId,
      kode: baris.kode,
      amar: baris.amar,
      skorKeyakinan: angka(baris.skor_keyakinan),
      versi: baris.versi,
      model: `${baris.model_nama} v${baris.model_versi}`,
    },
    perkara: {
      nomorSengketa: baris.nomor_sengketa,
      jenisPajak: baris.jenis_pajak,
      masaPajak: baris.masa_pajak,
      pokokSengketa: baris.pokok_sengketa,
      nilaiSengketa: angka(baris.nilai_sengketa),
    },
    argumen: argumen.rows,
    dasarHukum: hukum.rows,
    faktor: faktor.rows.map((r) => ({ nama: r.nama_faktor, kontribusi: angka(r.kontribusi) })),
    putusanPembanding: putusan.rows.map((r) => ({
      nomor: r.nomor_putusan,
      amar: r.amar,
      kemiripan: angka(r.persentase),
    })),
  };
}

export async function bandingkan(prediksiId, putusanId) {
  const ada = await query(
    `SELECT k.catatan_perbedaan, k.persentase, t.nomor_putusan, t.amar, t.duduk_perkara,
            t.pertimbangan, t.amar_teks, hp.perkara_id, ka.nama AS amar_prediksi
     FROM kemiripan_putusan k
     JOIN putusan t ON t.id = k.putusan_id
     JOIN hasil_prediksi hp ON hp.id = k.hasil_prediksi_id
     LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
     WHERE k.hasil_prediksi_id = $1 AND k.putusan_id = $2`,
    [prediksiId, putusanId],
  );
  const baris = ada.rows[0];
  if (!baris) throw bad('Putusan pembanding tidak ditemukan pada prediksi ini.', 404);

  const perkara = await query(
    `SELECT fakta, dalil, bukti_kunci, nomor_sengketa FROM perkara WHERE id = $1`,
    [baris.perkara_id],
  );
  const p = perkara.rows[0];
  const putusan = await query(`SELECT fakta, dalil, bukti_kunci, pertimbangan, amar FROM putusan WHERE id = $1`, [putusanId]);
  const t = putusan.rows[0];

  let aspek = await query(
    `SELECT aspek, nilai_perkara, nilai_pembanding, berbeda, urutan
     FROM perbandingan_aspek
     WHERE hasil_prediksi_id = $1 AND putusan_id = $2
     ORDER BY urutan`,
    [prediksiId, putusanId],
  );

  if (!aspek.rowCount) {
    const amarPrediksi = `Prediksi: ${baris.amar_prediksi}`;
    const barisAspek = [
      [1, 'Fakta', p.fakta, t.fakta, false],
      [2, 'Dalil', p.dalil, t.dalil, false],
      [3, 'Bukti kunci', p.bukti_kunci, t.bukti_kunci, true],
      [4, 'Pertimbangan', '–', t.pertimbangan, false],
      [5, 'Amar', amarPrediksi, t.amar, amarPrediksi !== t.amar],
    ];
    for (const item of barisAspek) {
      await query(
        `INSERT INTO perbandingan_aspek
         (hasil_prediksi_id, putusan_id, urutan, aspek, nilai_perkara, nilai_pembanding, berbeda)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [prediksiId, putusanId, ...item],
      );
    }
    aspek = await query(
      `SELECT aspek, nilai_perkara, nilai_pembanding, berbeda, urutan
       FROM perbandingan_aspek
       WHERE hasil_prediksi_id = $1 AND putusan_id = $2
       ORDER BY urutan`,
      [prediksiId, putusanId],
    );
  }

  return {
    nomorSengketa: p.nomor_sengketa,
    nomorPutusan: baris.nomor_putusan,
    kemiripan: angka(baris.persentase),
    dudukPerkara: baris.duduk_perkara,
    pertimbangan: baris.pertimbangan,
    amarTeks: baris.amar_teks,
    catatanPerbedaan: baris.catatan_perbedaan,
    aspek: aspek.rows.map((r) => ({
      aspek: r.aspek,
      perkara: r.nilai_perkara,
      pembanding: r.nilai_pembanding,
      berbeda: r.berbeda,
    })),
  };
}
