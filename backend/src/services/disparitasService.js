import { pool, query } from '../db.js';
import { catat } from '../lib/audit.js';
import { angka, bad } from '../lib/errors.js';

async function parameterAktif() {
  const { rows } = await query(
    `SELECT id, periode_dari, periode_sampai, jenis_pajak, ambang_indeks, minimum_putusan
     FROM parameter_disparitas ORDER BY ditetapkan_pada DESC LIMIT 1`,
  );
  return rows[0];
}

export async function lihatParameter() {
  const baris = await parameterAktif();
  return {
    id: baris.id,
    periodeDari: baris.periode_dari,
    periodeSampai: baris.periode_sampai,
    jenisPajak: baris.jenis_pajak,
    ambang: angka(baris.ambang_indeks),
    minimum: baris.minimum_putusan,
  };
}

export async function simpanParameter(user, body) {
  const sekarang = await parameterAktif();
  await query(
    `UPDATE parameter_disparitas
     SET periode_dari = $2, periode_sampai = $3, jenis_pajak = $4,
         ambang_indeks = $5, minimum_putusan = $6, ditetapkan_oleh = $7, ditetapkan_pada = now()
     WHERE id = $1`,
    [
      sekarang.id,
      body.periodeDari || sekarang.periode_dari,
      body.periodeSampai || sekarang.periode_sampai,
      body.jenisPajak || sekarang.jenis_pajak,
      body.ambang ?? sekarang.ambang_indeks,
      body.minimum ?? sekarang.minimum_putusan,
      user.id,
    ],
  );
  return lihatParameter();
}

export async function daftarTarget(jenisPajak) {
  const { rows } = await query(
    `SELECT p.id, p.nomor_sengketa, p.nama_pemohon, p.jenis_pajak, p.amar_draf,
            p.jumlah_putusan_sejenis, mj.kode AS majelis
     FROM perkara p
     JOIN majelis mj ON mj.id = p.majelis_id
     WHERE p.tampil_disparitas
       AND ($1::text IS NULL OR $1 = 'Semua' OR p.jenis_pajak = $1)
     ORDER BY p.nomor_sengketa DESC`,
    [jenisPajak || null],
  );
  return rows.map((r) => ({
    id: r.id,
    nomorSengketa: r.nomor_sengketa,
    namaPemohon: r.nama_pemohon,
    jenisPajak: r.jenis_pajak,
    majelis: r.majelis,
    amarDraf: r.amar_draf || '—',
    jumlahSejenis: r.jumlah_putusan_sejenis ?? 0,
  }));
}

async function hitung(perkaraId) {
  const perkara = await query(`SELECT * FROM perkara WHERE id = $1`, [perkaraId]);
  const p = perkara.rows[0];
  if (!p || !p.tampil_disparitas) throw bad('Perkara tidak termasuk objek deteksi disparitas.', 404);
  const param = await lihatParameter();
  const sebaran = await query(
    `SELECT ka.nama, ka.urutan, s.jumlah
     FROM kategori_amar ka
     LEFT JOIN profil_sebaran_disparitas s
       ON s.kategori_amar_id = ka.id AND s.perkara_id = $1
     ORDER BY ka.urutan`,
    [perkaraId],
  );
  const daftar = sebaran.rows.map((r) => ({ amar: r.nama, jumlah: r.jumlah ?? 0 }));
  const total = daftar.reduce((n, item) => n + item.jumlah, 0);
  return { perkara: p, param, daftar, total };
}

export async function deteksi(user, perkaraId) {
  const { perkara, param, daftar, total } = await hitung(perkaraId);
  await catat(user, 'Meminta deteksi disparitas', perkara.nomor_sengketa);

  if (perkara.flag_deteksi === 'putusan_tidak_tersedia') {
    return berhenti('Informasi putusan tidak tersedia. Sistem tidak menemukan data putusan yang diperlukan untuk melakukan deteksi disparitas. Proses deteksi dihentikan.');
  }
  if (perkara.flag_deteksi === 'pembanding_tidak_tersedia') {
    return berhenti('Data pembanding tidak tersedia. Hasil perbandingan atau data putusan sejenis belum tersedia. Pastikan data pembanding tersedia sebelum deteksi dapat dilakukan kembali.');
  }
  if (perkara.flag_deteksi === 'tidak_mencukupi' || total < param.minimum) {
    const n = perkara.jumlah_putusan_sejenis ?? total;
    return berhenti(`Informasi pendukung tidak mencukupi. Hanya ${n} putusan sejenis tersedia (minimum ${param.minimum}). Sistem tidak dapat menentukan indikasi disparitas secara andal; proses dihentikan tanpa kesimpulan.`, true);
  }

  const sama = daftar.find((item) => item.amar === perkara.amar_draf)?.jumlah || 0;
  const indeks = total === 0 ? 0 : (total - sama) / total;
  const adaIndikasi = indeks >= param.ambang;
  const terkait = await query(
    `SELECT nomor_putusan, amar, kode_majelis FROM putusan ORDER BY urutan LIMIT 4`,
  );
  return {
    mode: 'hasil',
    perkaraId: perkara.id,
    nomorSengketa: perkara.nomor_sengketa,
    namaPemohon: perkara.nama_pemohon,
    amarDraf: perkara.amar_draf,
    total,
    sama,
    berbeda: total - sama,
    indeks,
    ambang: param.ambang,
    adaIndikasi,
    sebaran: daftar,
    putusanTerkait: terkait.rows.map((r) => ({
      nomor: r.nomor_putusan,
      amar: r.amar,
      majelis: r.kode_majelis,
    })),
    sisaSimulasiGagal: perkara.sisa_simulasi_gagal_simpan,
  };
}

function berhenti(pesan, peringatan = false) {
  return { mode: 'berhenti', peringatan, pesan };
}

export async function simpanDeteksi(user, perkaraId) {
  const hasil = await deteksi(user, perkaraId);
  if (hasil.mode !== 'hasil') throw bad(hasil.pesan, 409);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const terkunci = await client.query(
      `SELECT sisa_simulasi_gagal_simpan FROM perkara WHERE id = $1 FOR UPDATE`,
      [perkaraId],
    );
    if (terkunci.rows[0].sisa_simulasi_gagal_simpan > 0) {
      await client.query(
        `UPDATE perkara SET sisa_simulasi_gagal_simpan = sisa_simulasi_gagal_simpan - 1 WHERE id = $1`,
        [perkaraId],
      );
      await client.query('COMMIT');
      await catat(user, 'Gagal menyimpan hasil deteksi', hasil.nomorSengketa);
      return {
        tersimpan: false,
        pesan: 'Hasil deteksi belum berhasil disimpan. Informasi hasil deteksi tetap dipertahankan. Klik Simpan Ulang untuk mengulangi penyimpanan.',
      };
    }

    const param = await parameterAktif();
    const kode = await client.query(`SELECT 'LDP-' || lpad(nextval('laporan_disparitas_seq')::text, 3, '0') AS kode`);
    const status = hasil.adaIndikasi ? 'Menunggu Peninjauan' : 'Tidak Ada Indikasi';
    const laporan = await client.query(
      `INSERT INTO laporan_disparitas (
         kode, perkara_id, parameter_id, amar_draf, jumlah_sejenis, jumlah_selaras,
         indeks, ada_indikasi, status, dibuat_oleh
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, kode, status, terdeteksi_pada`,
      [
        kode.rows[0].kode, perkaraId, param.id, hasil.amarDraf, hasil.total, hasil.sama,
        hasil.indeks, hasil.adaIndikasi, status, user.id,
      ],
    );
    const id = laporan.rows[0].id;
    for (const item of hasil.sebaran) {
      await client.query(
        `INSERT INTO sebaran_amar_laporan (laporan_id, kategori_amar_id, jumlah)
         SELECT $1, id, $2 FROM kategori_amar WHERE nama = $3`,
        [id, item.jumlah, item.amar],
      );
    }
    const terkait = await client.query(`SELECT id, urutan FROM putusan ORDER BY urutan LIMIT 4`);
    for (const putusan of terkait.rows) {
      await client.query(
        `INSERT INTO laporan_putusan (laporan_id, putusan_id, kemiripan)
         VALUES ($1, $2, $3)`,
        [id, putusan.id, 90 - putusan.urutan],
      );
    }
    const jejak = hasil.adaIndikasi ? ['Dideteksi', 'Menunggu Peninjauan'] : ['Tidak Ada Indikasi'];
    for (const langkah of jejak) {
      await client.query(
        `INSERT INTO riwayat_status_laporan (laporan_id, status, diubah_oleh) VALUES ($1, $2, $3)`,
        [id, langkah, user.id],
      );
    }
    if (hasil.adaIndikasi) {
      await client.query(
        `INSERT INTO notifikasi (pengguna_id, judul, isi, tautan)
         SELECT id, 'Laporan disparitas menunggu peninjauan', $1, $2
         FROM pengguna WHERE peran = 'Pimpinan' AND aktif = true`,
        [`Temuan pada sengketa ${hasil.nomorSengketa} (${laporan.rows[0].kode}).`, `/laporan/${id}`],
      );
    }
    await client.query('COMMIT');
    await catat(
      user,
      hasil.adaIndikasi
        ? 'Simpan laporan disparitas (Dideteksi → Menunggu Peninjauan)'
        : 'Simpan hasil deteksi (tidak ada indikasi)',
      laporan.rows[0].kode,
    );
    return { tersimpan: true, laporan: { id, kode: laporan.rows[0].kode, status, adaIndikasi: hasil.adaIndikasi } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function daftarLaporan() {
  const { rows } = await query(
    `SELECT l.id, l.kode, l.indeks, l.status, l.ada_indikasi, l.terdeteksi_pada,
            p.nomor_sengketa, p.nama_pemohon
     FROM laporan_disparitas l
     JOIN perkara p ON p.id = l.perkara_id
     ORDER BY l.terdeteksi_pada DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    kode: r.kode,
    nomorSengketa: r.nomor_sengketa,
    namaPemohon: r.nama_pemohon,
    indeks: angka(r.indeks),
    status: r.status,
    adaIndikasi: r.ada_indikasi,
    terdeteksiPada: r.terdeteksi_pada,
  }));
}

export async function detailLaporan(id) {
  const { rows } = await query(
    `SELECT l.*, p.nomor_sengketa, p.nama_pemohon, p.amar_draf
     FROM laporan_disparitas l JOIN perkara p ON p.id = l.perkara_id WHERE l.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const l = rows[0];
  const riwayat = await query(
    `SELECT status, diubah_pada FROM riwayat_status_laporan WHERE laporan_id = $1 ORDER BY diubah_pada, id`,
    [id],
  );
  const putusan = await query(
    `SELECT t.nomor_putusan, t.amar, t.kode_majelis, lp.kemiripan
     FROM laporan_putusan lp JOIN putusan t ON t.id = lp.putusan_id
     WHERE lp.laporan_id = $1 ORDER BY lp.kemiripan DESC`,
    [id],
  );
  return {
    id: l.id,
    kode: l.kode,
    nomorSengketa: l.nomor_sengketa,
    namaPemohon: l.nama_pemohon,
    amarDraf: l.amar_draf,
    jumlahSejenis: l.jumlah_sejenis,
    jumlahSelaras: l.jumlah_selaras,
    jumlahBerbeda: l.jumlah_sejenis - l.jumlah_selaras,
    indeks: angka(l.indeks),
    adaIndikasi: l.ada_indikasi,
    status: l.status,
    catatan: l.catatan_tindak_lanjut,
    terdeteksiPada: l.terdeteksi_pada,
    riwayat: riwayat.rows.map((r) => r.status),
    putusan: putusan.rows.map((r, i) => ({
      nomor: r.nomor_putusan,
      amar: r.amar,
      majelis: `Majelis ${'ABCD'[i] || r.kode_majelis}`,
      kemiripan: angka(r.kemiripan),
    })),
  };
}

export async function ubahStatusLaporan(user, id, status, catatan) {
  const sekarang = await query(`SELECT kode, status FROM laporan_disparitas WHERE id = $1`, [id]);
  if (!sekarang.rows[0]) throw bad('Laporan tidak ditemukan.', 404);
  const dari = sekarang.rows[0].status;
  const boleh =
    (dari === 'Menunggu Peninjauan' && (status === 'Terkonfirmasi' || status === 'Diabaikan'))
    || (dari === 'Terkonfirmasi' && status === 'Ditindaklanjuti');
  if (!boleh) throw bad('Perubahan status laporan tidak sesuai alur peninjauan.', 409);
  if (status === 'Ditindaklanjuti' && !String(catatan || '').trim()) {
    throw bad('Catatan tindak lanjut wajib diisi.');
  }
  await query(
    `UPDATE laporan_disparitas
     SET status = $2, catatan_tindak_lanjut = COALESCE($3, catatan_tindak_lanjut)
     WHERE id = $1`,
    [id, status, catatan || null],
  );
  await query(
    `INSERT INTO riwayat_status_laporan (laporan_id, status, diubah_oleh) VALUES ($1, $2, $3)`,
    [id, status, user.id],
  );
  await catat(user, `Status laporan disparitas: ${status}`, sekarang.rows[0].kode);
  return detailLaporan(id);
}
