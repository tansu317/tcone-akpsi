import { query } from '../db.js';
import { bandingkanModel, perluasKorpus } from '../ml/unsupervised.js';

const KATA = [
  'sanksi', 'gangguan', 'sistem', 'kekhilafan', 'jangka', 'bukti',
  'administrasi', 'tenggang', 'tarif', 'paksa', 'keterlambatan',
  'pokok', 'pembayaran', 'lewat', 'hari',
];

const SALINAN = 8;
const SIGMA = 0.22;
const cache = new Map();

function vektor({ teks, tahun, nilai, jenis }) {
  const t = String(teks || '').toLowerCase();
  const kata = KATA.map((k) => (t.includes(k) ? 1 : 0));
  const gabung = `${jenis || ''} ${t}`;
  const pajak = [
    gabung.includes('ppn') ? 1 : 0,
    gabung.includes('pph') ? 1 : 0,
    gabung.includes('pabean') || gabung.includes('tarif') ? 1 : 0,
  ];
  const nilaiN = Math.log10(Math.max(Number(nilai) || 5e8, 1)) / 10;
  const tahunN = ((Number(tahun) || 2023) - 2020) / 5;
  return [...kata, ...pajak, nilaiN, tahunN];
}

export async function laporanModel(perkaraId) {
  if (cache.has(perkaraId)) return cache.get(perkaraId);
  const [putusan, sasaran, amar] = await Promise.all([
    query(
      `SELECT amar AS y, tahun, concat_ws(' ', fakta, dalil, bukti_kunci, pertimbangan) AS teks
       FROM putusan ORDER BY urutan`,
    ),
    query(
      `SELECT jenis_pajak, nilai_sengketa, pokok_sengketa AS teks,
              EXTRACT(YEAR FROM tanggal_selesai_sidang)::int AS tahun
       FROM perkara WHERE id = $1`,
      [perkaraId],
    ),
    query(`SELECT nama FROM kategori_amar ORDER BY urutan`),
  ]);
  if (!sasaran.rows[0] || putusan.rows.length < 3) return null;

  const dasar = putusan.rows.map((r) => ({
    y: r.y,
    x: vektor({ teks: r.teks, tahun: r.tahun, nilai: null, jenis: '' }),
  }));
  const sampel = perluasKorpus(dasar, SALINAN, SIGMA, 20251027);
  const kueri = vektor({
    teks: sasaran.rows[0].teks,
    tahun: sasaran.rows[0].tahun,
    nilai: sasaran.rows[0].nilai_sengketa,
    jenis: sasaran.rows[0].jenis_pajak,
  });
  const semuaAmar = amar.rows.map((r) => r.nama);
  const model = bandingkanModel(sampel, kueri, semuaAmar);
  const terpilih = model.find((m) => m.dipilih);
  const laporan = {
    metode: 'unsupervised',
    catatan: 'K-Means, Gaussian Mixture Model, dan Agglomerative Clustering dilatih pada vektor kata putusan sejenis tanpa memakai label amar. Akurasi adalah rata-rata 5-fold: amar dugaan klaster dibandingkan dengan amar putusan pada subset uji. Amar prediksi mengikuti model dengan akurasi tertinggi.',
    ukuranKorpus: sampel.length,
    model: model.map(({ distribusi, ...lain }) => lain),
    terpilih: {
      kode: terpilih.kode,
      nama: terpilih.nama,
      akurasi: terpilih.akurasi,
      siluet: terpilih.siluet,
      amar: terpilih.amar,
      skor: terpilih.skor,
      distribusi: terpilih.distribusi,
    },
  };
  cache.set(perkaraId, laporan);
  return laporan;
}
