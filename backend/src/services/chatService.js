import { query } from '../db.js';
import { catat } from '../lib/audit.js';
import { angka, bad } from '../lib/errors.js';

const TANPA_RUJUKAN = /cuaca|olahraga|resep/i;

export async function bukaSesi(user, prediksiId) {
  const prediksi = await query(
    `SELECT hp.id, hp.kode, ka.nama AS amar, hp.skor_keyakinan, p.jenis_pajak
     FROM hasil_prediksi hp
     JOIN perkara p ON p.id = hp.perkara_id
     LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
     WHERE hp.id = $1 AND hp.status NOT IN ('Diproses', 'Gagal')`,
    [prediksiId],
  );
  if (!prediksi.rows[0]) throw bad('Prediksi aktif tidak ditemukan.', 404);

  const ada = await query(
    `SELECT id FROM percakapan_ai
     WHERE hasil_prediksi_id = $1 AND pengguna_id = $2
     ORDER BY mulai_pada DESC LIMIT 1`,
    [prediksiId, user.id],
  );
  if (ada.rows[0]) {
    await query(
      `UPDATE percakapan_ai SET status = 'Aktif', selesai_pada = NULL WHERE id = $1 AND status = 'Selesai'`,
      [ada.rows[0].id],
    );
    await catat(user, 'Membuka sesi ChatAI', prediksi.rows[0].kode);
    return ambilSesi(ada.rows[0].id);
  }

  const konteks = {
    penggugat: '[PIHAK-01]',
    tergugat: 'Direktur Jenderal Pajak',
    jenisPajak: prediksi.rows[0].jenis_pajak,
    amarPrediksi: prediksi.rows[0].amar,
    skorKeyakinan: angka(prediksi.rows[0].skor_keyakinan),
  };
  try {
    const dibuat = await query(
      `INSERT INTO percakapan_ai (kode, hasil_prediksi_id, pengguna_id, status, konteks_anonim)
       VALUES ($1, $2, $3, 'Aktif', $4::jsonb)
       RETURNING id`,
      [`CHT-${prediksi.rows[0].kode.slice(4)}`, prediksiId, user.id, JSON.stringify(konteks)],
    );
    await catat(user, 'Membuka sesi ChatAI', prediksi.rows[0].kode);
    return ambilSesi(dibuat.rows[0].id);
  } catch (error) {
    if (error.code !== '23505') throw error;
    const ulang = await query(
      `SELECT id FROM percakapan_ai WHERE hasil_prediksi_id = $1 AND pengguna_id = $2 ORDER BY mulai_pada DESC LIMIT 1`,
      [prediksiId, user.id],
    );
    return ambilSesi(ulang.rows[0].id);
  }
}

export async function ambilSesi(id) {
  const sesi = await query(
    `SELECT c.id, c.kode, c.status, c.mulai_pada, c.konteks_anonim, c.hasil_prediksi_id,
            (SELECT COUNT(*)::int FROM pesan_ai m WHERE m.percakapan_id = c.id) AS jumlah_pesan
     FROM percakapan_ai c WHERE c.id = $1`,
    [id],
  );
  if (!sesi.rows[0]) return null;
  const pesan = await query(
    `SELECT m.id, m.peran, m.jenis_pertanyaan, m.isi, m.tanpa_rujukan, m.urutan,
            COALESCE(json_agg(json_build_object('label', r.label, 'terverifikasi', r.terverifikasi) ORDER BY r.urutan)
              FILTER (WHERE r.id IS NOT NULL), '[]') AS rujukan
     FROM pesan_ai m
     LEFT JOIN referensi_sumber r ON r.pesan_id = m.id
     WHERE m.percakapan_id = $1
     GROUP BY m.id
     ORDER BY m.urutan`,
    [id],
  );
  return {
    id: sesi.rows[0].id,
    kode: sesi.rows[0].kode,
    status: sesi.rows[0].status,
    mulaiPada: sesi.rows[0].mulai_pada,
    prediksiId: sesi.rows[0].hasil_prediksi_id,
    jumlahPesan: sesi.rows[0].jumlah_pesan,
    konteks: sesi.rows[0].konteks_anonim,
    pesan: pesan.rows.map((m) => ({
      id: m.id,
      peran: m.peran,
      jenis: m.jenis_pertanyaan,
      isi: m.isi,
      tanpaRujukan: m.tanpa_rujukan,
      rujukan: m.rujukan,
    })),
  };
}

export async function kirimPesan(user, sesiId, jenis, isi) {
  const templat = await query(
    `SELECT jawaban, rujukan, pertanyaan_contoh FROM templat_chat WHERE jenis = $1`,
    [jenis],
  );
  if (!templat.rows[0]) throw bad('Jenis pertanyaan tidak dikenal.');
  const sesi = await query(
    `SELECT id, kode, status FROM percakapan_ai WHERE id = $1 AND pengguna_id = $2`,
    [sesiId, user.id],
  );
  if (!sesi.rows[0]) throw bad('Sesi ChatAI tidak ditemukan.', 404);
  if (sesi.rows[0].status !== 'Aktif') throw bad('Sesi sudah diakhiri.');
  const pola = templat.rows[0];

  const pertanyaan = (isi || '').trim() || pola.pertanyaan_contoh;
  const urutan = await query(
    `SELECT COALESCE(MAX(urutan), 0) + 1 AS n FROM pesan_ai WHERE percakapan_id = $1`,
    [sesiId],
  );
  let n = urutan.rows[0].n;
  await query(
    `INSERT INTO pesan_ai (percakapan_id, peran, jenis_pertanyaan, isi, urutan)
     VALUES ($1, 'pengguna', $2, $3, $4)`,
    [sesiId, jenis, pertanyaan, n],
  );

  const tanpa = TANPA_RUJUKAN.test(pertanyaan);
  const jawaban = tanpa
    ? 'Informasi yang mendukung jawaban tidak tersedia pada dokumen perkara, korpus putusan, maupun basis peraturan. Sistem tidak menampilkan jawaban yang tidak didukung sumber.'
    : pola.jawaban;
  n += 1;
  const asisten = await query(
    `INSERT INTO pesan_ai (percakapan_id, peran, jenis_pertanyaan, isi, tanpa_rujukan, urutan)
     VALUES ($1, 'asisten', $2, $3, $4, $5) RETURNING id`,
    [sesiId, jenis, jawaban, tanpa, n],
  );
  if (!tanpa) {
    const rujukan = pola.rujukan || [];
    for (let i = 0; i < rujukan.length; i += 1) {
      await query(
        `INSERT INTO referensi_sumber (pesan_id, label, terverifikasi, urutan)
         VALUES ($1, $2, $3, $4)`,
        [asisten.rows[0].id, rujukan[i].label, rujukan[i].terverifikasi, i + 1],
      );
    }
  }
  await catat(user, `Pertanyaan ChatAI (${jenis})`, sesi.rows[0].kode);
  return ambilSesi(sesiId);
}

export async function akhiriSesi(user, sesiId) {
  const sesi = await query(
    `UPDATE percakapan_ai SET status = 'Selesai', selesai_pada = now()
     WHERE id = $1 AND pengguna_id = $2 RETURNING kode`,
    [sesiId, user.id],
  );
  if (!sesi.rows[0]) throw bad('Sesi ChatAI tidak ditemukan.', 404);
  await catat(user, 'Mengakhiri dan menyimpan sesi ChatAI', sesi.rows[0].kode);
  return { ok: true };
}

export async function daftarSesi(userId) {
  const { rows } = await query(
    `SELECT c.id, c.kode, c.status, c.mulai_pada, c.hasil_prediksi_id, hp.kode AS prediksi,
            (SELECT COUNT(*)::int FROM pesan_ai m WHERE m.percakapan_id = c.id) AS jumlah_pesan
     FROM percakapan_ai c
     JOIN hasil_prediksi hp ON hp.id = c.hasil_prediksi_id
     WHERE c.pengguna_id = $1
     ORDER BY c.mulai_pada DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    kode: r.kode,
    status: r.status,
    mulaiPada: r.mulai_pada,
    prediksiId: r.hasil_prediksi_id,
    prediksi: r.prediksi,
    jumlahPesan: r.jumlah_pesan,
  }));
}

export async function simpanFeedback(user, body) {
  const { prediksiId, percakapanId, jenis, rating, kategori = [], penjelasan = '' } = body;
  if (!['Sesuai', 'Tidak Sesuai'].includes(jenis) || !rating) {
    throw bad('Feedback belum lengkap. Pilih jenis feedback dan beri rating sebelum mengirim.');
  }
  const prediksi = await query(`SELECT kode FROM hasil_prediksi WHERE id = $1`, [prediksiId]);
  if (!prediksi.rows[0]) throw bad('Prediksi tidak ditemukan.', 404);
  const hasil = await query(
    `INSERT INTO feedback
      (hasil_prediksi_id, percakapan_id, pengguna_id, jenis, rating, kategori, penjelasan)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, jenis, rating, status_tindak_lanjut, dibuat_pada`,
    [prediksiId, percakapanId || null, user.id, jenis, rating, kategori, penjelasan],
  );
  await catat(user, `Feedback hasil prediksi: ${jenis}`, prediksi.rows[0].kode);
  return hasil.rows[0];
}
