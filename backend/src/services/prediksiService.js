import { pool, query } from '../db.js';
import { catat } from '../lib/audit.js';
import { angka, bad } from '../lib/errors.js';
import { LANGKAH_PREDIKSI, ringkasanAnalisis } from '../domain.js';
import { laporanModel } from './modelService.js';

const PERAN_GENERATE = ['Panitera', 'Hakim'];

export async function generatePrediksi(user, perkaraId, kunci) {
  if (!PERAN_GENERATE.includes(user.peran)) {
    throw bad('Peran Anda tidak berwenang menghasilkan prediksi.', 403);
  }
  if (!kunci || String(kunci).length < 8) {
    throw bad('Kunci proses prediksi tidak valid.');
  }

  const sudah = await query(
    `SELECT status, langkah_gagal, pesan, hasil_prediksi_id
     FROM antrean_prediksi WHERE kunci_idempoten = $1`,
    [kunci],
  );
  if (sudah.rows[0] && sudah.rows[0].status !== 'Diproses') {
    return bentukUlang(sudah.rows[0]);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO antrean_prediksi (kunci_idempoten, perkara_id, pengguna_id, status)
       VALUES ($1, $2, $3, 'Diproses')`,
      [kunci, perkaraId, user.id],
    );
    const hasil = await jalankan(client, user, perkaraId);
    await client.query(
      `UPDATE antrean_prediksi
       SET status = $2, langkah_gagal = $3, pesan = $4, hasil_prediksi_id = $5
       WHERE kunci_idempoten = $1`,
      [kunci, hasil.berhasil ? 'Selesai' : 'Gagal', hasil.langkahGagal, hasil.pesan, hasil.prediksiId],
    );
    await client.query('COMMIT');
    return hasil;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const ulang = await query(
        `SELECT status, langkah_gagal, pesan, hasil_prediksi_id
         FROM antrean_prediksi WHERE kunci_idempoten = $1`,
        [kunci],
      );
      if (ulang.rows[0] && ulang.rows[0].status !== 'Diproses') return bentukUlang(ulang.rows[0]);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function bentukUlang(baris) {
  if (baris.status === 'Gagal') {
    return {
      berhasil: false,
      langkah: LANGKAH_PREDIKSI,
      langkahGagal: baris.langkah_gagal,
      pesan: baris.pesan,
      prediksiId: null,
    };
  }
  return {
    berhasil: true,
    langkah: LANGKAH_PREDIKSI,
    langkahGagal: null,
    pesan: baris.pesan,
    prediksiId: baris.hasil_prediksi_id,
  };
}

async function jalankan(client, user, perkaraId) {
  const perkaraRes = await client.query(
    `SELECT * FROM perkara WHERE id = $1 FOR UPDATE`,
    [perkaraId],
  );
  const perkara = perkaraRes.rows[0];
  if (!perkara) throw bad('Sengketa tidak ditemukan.', 404);
  if (!perkara.dapat_dipilih) {
    throw bad('Sengketa tidak tersedia untuk diprediksi.', 409);
  }

  if (!perkara.tersedia_di_tco) {
    const pesan = `Data tidak ditemukan. Tax Court One tidak menemukan data perkara untuk sengketa ${perkara.nomor_sengketa}. Proses prediksi tidak dapat dilanjutkan.`;
    await catat(user, 'Prediksi dihentikan: data perkara tidak ditemukan', perkara.nomor_sengketa, client);
    return { berhasil: false, langkah: LANGKAH_PREDIKSI, langkahGagal: 2, pesan, prediksiId: null };
  }

  if (perkara.kelengkapan !== 'lengkap') {
    const kurang = await client.query(
      `SELECT jenis_dokumen FROM dokumen_perkara
       WHERE perkara_id = $1 AND tersedia = false ORDER BY urutan`,
      [perkara.id],
    );
    const daftar = kurang.rows.map((r) => r.jenis_dokumen).join(', ');
    const pesan = `Data atau dokumen perkara yang akan dilakukan analisis tidak lengkap. Proses prediksi dihentikan. Dokumen yang belum tersedia: ${daftar}. Lengkapi dokumen pada Tax Court One lalu ulangi prediksi.`;
    await catat(user, 'Prediksi dihentikan: data/dokumen tidak lengkap', perkara.nomor_sengketa, client);
    return { berhasil: false, langkah: LANGKAH_PREDIKSI, langkahGagal: 3, pesan, prediksiId: null };
  }

  const versiRes = await client.query(
    `SELECT COALESCE(MAX(versi), 0) + 1 AS versi FROM hasil_prediksi WHERE perkara_id = $1`,
    [perkara.id],
  );
  const versi = versiRes.rows[0].versi;
  const kode = `PRD-${perkara.nomor_sengketa.slice(3, 6)}-v${versi}`;
  const model = await client.query(
    `SELECT id, nama, versi FROM model_prediksi WHERE status = 'produksi' ORDER BY tanggal_promosi DESC LIMIT 1`,
  );
  if (!model.rows[0]) throw bad('Model prediksi produksi belum tersedia.', 500);

  await client.query(
    `UPDATE hasil_prediksi SET status = 'Digantikan'
     WHERE perkara_id = $1 AND status IN ('Aktif', 'Dievaluasi')`,
    [perkara.id],
  );

  const prediksi = await client.query(
    `INSERT INTO hasil_prediksi (kode, perkara_id, model_id, versi, status, dibuat_oleh)
     VALUES ($1, $2, $3, $4, 'Aktif', $5)
     RETURNING id`,
    [kode, perkara.id, model.rows[0].id, versi, user.id],
  );
  const prediksiId = prediksi.rows[0].id;

  const ml = await laporanModel(perkara.id);
  if (!ml) throw bad('Korpus putusan sejenis belum cukup untuk model unsupervised.', 500);
  const kategori = await client.query(`SELECT id, nama FROM kategori_amar`);
  const idAmar = new Map(kategori.rows.map((r) => [r.nama, r.id]));
  if (!idAmar.has(ml.terpilih.amar)) throw bad('Amar hasil model tidak dikenali.', 500);
  for (const item of ml.terpilih.distribusi) {
    await client.query(
      `INSERT INTO probabilitas_amar (hasil_prediksi_id, kategori_amar_id, probabilitas)
       VALUES ($1, $2, $3)`,
      [prediksiId, idAmar.get(item.amar), item.probabilitas],
    );
  }
  await client.query(
    `UPDATE hasil_prediksi
     SET amar_kategori_id = $2, skor_keyakinan = $3
     WHERE id = $1`,
    [prediksiId, idAmar.get(ml.terpilih.amar), ml.terpilih.skor],
  );

  await client.query(
    `INSERT INTO kemiripan_putusan (hasil_prediksi_id, putusan_id, persentase, alasan, catatan_perbedaan)
     SELECT $1, putusan_id, persentase, alasan, catatan_perbedaan
     FROM profil_kemiripan WHERE perkara_id = $2`,
    [prediksiId, perkara.id],
  );

  const amar = await client.query(
    `SELECT ka.nama FROM hasil_prediksi hp
     JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id WHERE hp.id = $1`,
    [prediksiId],
  );
  const jumlahMirip = await client.query(
    `SELECT COUNT(*)::int AS n FROM kemiripan_putusan WHERE hasil_prediksi_id = $1`,
    [prediksiId],
  );
  const analisis = await client.query(
    `INSERT INTO analisis_perkara (hasil_prediksi_id, ringkasan)
     VALUES ($1, $2) RETURNING id`,
    [prediksiId, ringkasanAnalisis(amar.rows[0].nama, jumlahMirip.rows[0].n)],
  );
  await client.query(
    `INSERT INTO argumen (analisis_id, pihak, isi, urutan)
     SELECT $1, pihak, isi, urutan FROM templat_argumen ORDER BY urutan`,
    [analisis.rows[0].id],
  );
  await client.query(
    `INSERT INTO analisis_dasar_hukum (analisis_id, dasar_hukum_id)
     SELECT $1, id FROM dasar_hukum`,
    [analisis.rows[0].id],
  );
  await client.query(
    `INSERT INTO faktor_dominan (analisis_id, nama_faktor, kontribusi, urutan)
     SELECT $1, nama_faktor, kontribusi, urutan FROM templat_faktor ORDER BY urutan`,
    [analisis.rows[0].id],
  );

  await client.query(
    `UPDATE perkara SET status_siproperti = 'Telah Diprediksi' WHERE id = $1`,
    [perkara.id],
  );
  await catat(user, 'Generate prediksi putusan', `${perkara.nomor_sengketa} / ${kode}`, client);

  return {
    berhasil: true,
    langkah: LANGKAH_PREDIKSI,
    langkahGagal: null,
    pesan: null,
    prediksiId,
  };
}

export async function ambilPrediksi(id) {
  const utama = await query(
    `SELECT hp.id, hp.kode, hp.versi, hp.status, hp.skor_keyakinan, hp.dibuat_pada,
            ka.nama AS amar, m.nama AS model_nama, m.versi AS model_versi,
            u.nama AS pembuat, u.jabatan AS jabatan_pembuat,
            p.id AS perkara_id, p.nomor_sengketa, p.nama_pemohon, p.jenis_pajak,
            p.jenis_sengketa, p.pokok_sengketa, p.nilai_sengketa, p.masa_pajak,
            p.profil_kemiripan, mj.kode AS majelis
     FROM hasil_prediksi hp
     JOIN perkara p ON p.id = hp.perkara_id
     JOIN majelis mj ON mj.id = p.majelis_id
     JOIN model_prediksi m ON m.id = hp.model_id
     JOIN pengguna u ON u.id = hp.dibuat_oleh
     LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
     WHERE hp.id = $1`,
    [id],
  );
  const baris = utama.rows[0];
  if (!baris) return null;

  const distribusi = await query(
    `SELECT ka.nama, pa.probabilitas
     FROM probabilitas_amar pa
     JOIN kategori_amar ka ON ka.id = pa.kategori_amar_id
     WHERE pa.hasil_prediksi_id = $1
     ORDER BY ka.urutan`,
    [id],
  );
  const mirip = await query(
    `SELECT t.id, t.nomor_putusan, t.amar, k.persentase, k.alasan
     FROM kemiripan_putusan k
     JOIN putusan t ON t.id = k.putusan_id
     WHERE k.hasil_prediksi_id = $1
     ORDER BY k.persentase DESC`,
    [id],
  );

  return {
    id: baris.id,
    kode: baris.kode,
    versi: baris.versi,
    status: baris.status,
    amar: baris.amar,
    skorKeyakinan: angka(baris.skor_keyakinan),
    dibuatPada: baris.dibuat_pada,
    pembuat: `${baris.pembuat} (${baris.jabatan_pembuat})`,
    model: `${baris.model_nama} v${baris.model_versi}`,
    profilKemiripan: baris.profil_kemiripan,
    distribusi: distribusi.rows.map((r) => ({ amar: r.nama, probabilitas: angka(r.probabilitas) })),
    putusanSejenis: mirip.rows.map((r) => ({
      id: r.id,
      nomor: r.nomor_putusan,
      amar: r.amar,
      kemiripan: angka(r.persentase),
      alasan: r.alasan,
    })),
    modelMl: await laporanModel(baris.perkara_id),
    perkara: {
      id: baris.perkara_id,
      nomorSengketa: baris.nomor_sengketa,
      namaPemohon: baris.nama_pemohon,
      jenisPajak: baris.jenis_pajak,
      jenisSengketa: baris.jenis_sengketa,
      pokokSengketa: baris.pokok_sengketa,
      nilaiSengketa: angka(baris.nilai_sengketa),
      masaPajak: baris.masa_pajak,
      majelis: baris.majelis,
    },
  };
}

export async function riwayatPrediksi() {
  const { rows } = await query(
    `SELECT hp.id, hp.kode, hp.versi, hp.status, hp.skor_keyakinan, hp.dibuat_pada,
            ka.nama AS amar, p.nomor_sengketa, u.nama AS pembuat
     FROM hasil_prediksi hp
     JOIN perkara p ON p.id = hp.perkara_id
     JOIN pengguna u ON u.id = hp.dibuat_oleh
     LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
     WHERE hp.status <> 'Diproses'
     ORDER BY hp.dibuat_pada DESC, hp.versi DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    kode: r.kode,
    versi: r.versi,
    status: r.status,
    amar: r.amar,
    skorKeyakinan: angka(r.skor_keyakinan),
    dibuatPada: r.dibuat_pada,
    pembuat: r.pembuat,
    nomorSengketa: r.nomor_sengketa,
  }));
}
