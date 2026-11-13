import { query } from '../db.js';
import { latihModel, prediksiModel } from '../ml/unsupervised.js';

export const KATEGORI_OBJEK = ['surat_paksa', 'penyitaan', 'lelang', 'teguran', 'sanksi', 'pabean', 'pembetulan'];
const PAJAK = ['PPN', 'PPh', 'Pabean'];

export function kategoriObjek(teks) {
  const t = String(teks || '').toLowerCase();
  if (t.includes('pembetulan')) return 'pembetulan';
  if (t.includes('teguran')) return 'teguran';
  if (t.includes('lelang')) return 'lelang';
  if (t.includes('sita')) return 'penyitaan';
  if (t.includes('surat paksa')) return 'surat_paksa';
  if (t.includes('tarif') || t.includes('pabean')) return 'pabean';
  if (t.includes('sanksi')) return 'sanksi';
  return null;
}

function vektor({ kategori, jenis, nilai, tahun }) {
  const objek = KATEGORI_OBJEK.map((k) => (k === kategori ? 1 : 0));
  const pajak = PAJAK.map((p) => (String(jenis || '').startsWith(p) ? 1 : 0));
  const nilaiN = Math.log10(Math.max(Number(nilai) || 5e8, 1));
  const tahunN = Number(tahun) || 2023;
  return [...objek, ...pajak, nilaiN, tahunN];
}

let latihan = null;

function siapkanLatihan() {
  if (!latihan) latihan = latih().catch((error) => { latihan = null; throw error; });
  return latihan;
}

async function latih() {
  const [korpus, amar] = await Promise.all([
    query(`SELECT kategori_objek, jenis_pajak, nilai_sengketa, tahun, amar FROM korpus_putusan ORDER BY id`),
    query(`SELECT nama FROM kategori_amar ORDER BY urutan`),
  ]);
  if (korpus.rows.length < 20) return null;
  const sampel = korpus.rows.map((r) => ({
    y: r.amar,
    x: vektor({ kategori: r.kategori_objek, jenis: r.jenis_pajak, nilai: r.nilai_sengketa, tahun: r.tahun }),
  }));
  return { ...latihModel(sampel, amar.rows.map((r) => r.nama)), ukuran: sampel.length };
}

export async function laporanModel(perkaraId) {
  const [latih, sasaran] = await Promise.all([
    siapkanLatihan(),
    query(
      `SELECT jenis_pajak, nilai_sengketa, pokok_sengketa,
              EXTRACT(YEAR FROM tanggal_selesai_sidang)::int AS tahun
       FROM perkara WHERE id = $1`,
      [perkaraId],
    ),
  ]);
  const p = sasaran.rows[0];
  if (!latih || !p) return null;
  const kategori = kategoriObjek(p.pokok_sengketa);
  const model = prediksiModel(latih, vektor({ kategori, jenis: p.jenis_pajak, nilai: p.nilai_sengketa, tahun: p.tahun }));
  const terpilih = model.find((m) => m.dipilih);
  return {
    metode: 'unsupervised',
    catatan: 'K-Means, Gaussian Mixture Model, dan Agglomerative Clustering dilatih tanpa label amar pada fitur kategori objek gugatan, jenis pajak, nilai sengketa, dan tahun putusan. Distribusi amar adalah campuran sebaran amar tiap klaster, dibobot kedekatan perkara ke klaster. Akurasi adalah rata-rata 5-fold: amar dengan peluang tertinggi dibandingkan dengan amar putusan pada subset uji. Amar prediksi mengikuti model dengan akurasi tertinggi.',
    ukuranKorpus: latih.ukuran,
    kategoriObjek: kategori,
    model: model.map(({ distribusi, ...lain }) => lain),
    terpilih,
  };
}
