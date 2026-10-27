import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instance } from '@viz-js/viz';
import { Resvg } from '@resvg/resvg-js';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keluar = path.join(akar, 'docs', 'erd');

const grup = [
  ['auth', '#1f4e79', 'Autentikasi dan referensi', {
    pengguna: ['PK id', 'UK nip', 'nama', 'peran', 'jabatan'],
    majelis: ['PK id', 'UK kode', 'nama'],
    kategori_amar: ['PK id', 'UK nama', 'urutan'],
    model_prediksi: ['PK id', 'nama', 'versi', 'status'],
    dasar_hukum: ['PK id', 'judul', 'isi'],
    parameter_disparitas: ['PK id', 'periode_dari', 'ambang_indeks', 'minimum_putusan', 'FK ditetapkan_oleh'],
    templat_chat: ['PK id', 'UK jenis', 'pertanyaan_contoh', 'jawaban'],
    templat_argumen: ['PK id', 'pihak', 'isi'],
    templat_faktor: ['PK id', 'nama_faktor', 'kontribusi'],
  }],
  ['sumber', '#0f6e6e', 'Data sumber Tax Court One (hanya baca)', {
    perkara: ['PK id', 'UK nomor_sengketa', 'jenis_pajak', 'nilai_sengketa', 'status_ucap', 'FK majelis_id', 'FK panitera_id', 'FK hakim_id'],
    pihak: ['PK id', 'FK perkara_id', 'peran_pihak', 'nama'],
    dokumen_perkara: ['PK id', 'FK perkara_id', 'jenis_dokumen', 'tersedia'],
    putusan: ['PK id', 'UK nomor_putusan', 'amar', 'tahun'],
  }],
  ['prediksi', '#2b74b5', 'Prediksi putusan', {
    hasil_prediksi: ['PK id', 'UK kode', 'FK perkara_id', 'FK model_id', 'versi', 'status', 'FK amar_kategori_id', 'skor_keyakinan'],
    probabilitas_amar: ['PK id', 'FK hasil_prediksi_id', 'FK kategori_amar_id', 'probabilitas'],
    kemiripan_putusan: ['PK id', 'FK hasil_prediksi_id', 'FK putusan_id', 'persentase'],
    antrean_prediksi: ['PK id', 'UK kunci_idempoten', 'FK perkara_id', 'status', 'FK hasil_prediksi_id'],
    profil_probabilitas: ['PK id', 'FK perkara_id', 'FK kategori_amar_id', 'probabilitas'],
    profil_kemiripan: ['PK id', 'FK perkara_id', 'FK putusan_id', 'persentase'],
  }],
  ['analisis', '#1b6b4a', 'Analisis dan perbandingan', {
    analisis_perkara: ['PK id', 'FK hasil_prediksi_id', 'ringkasan', 'status'],
    argumen: ['PK id', 'FK analisis_id', 'pihak', 'isi'],
    analisis_dasar_hukum: ['PK id', 'FK analisis_id', 'FK dasar_hukum_id'],
    faktor_dominan: ['PK id', 'FK analisis_id', 'nama_faktor', 'kontribusi'],
    perbandingan_aspek: ['PK id', 'FK hasil_prediksi_id', 'FK putusan_id', 'aspek'],
  }],
  ['interaksi', '#8a5a00', 'Evaluasi, ChatAI, dan feedback', {
    evaluasi_prediksi: ['PK id', 'FK hasil_prediksi_id', 'FK evaluator_id', 'status'],
    evaluasi_analisis: ['PK id', 'FK hasil_prediksi_id', 'FK analisis_id', 'status'],
    nilai_relevansi: ['PK id', 'FK evaluasi_analisis_id', 'komponen', 'nilai'],
    percakapan_ai: ['PK id', 'UK kode', 'FK hasil_prediksi_id', 'FK pengguna_id', 'status'],
    pesan_ai: ['PK id', 'FK percakapan_id', 'peran', 'isi'],
    referensi_sumber: ['PK id', 'FK pesan_id', 'label', 'terverifikasi'],
    feedback: ['PK id', 'FK hasil_prediksi_id', 'FK percakapan_id', 'rating', 'jenis'],
  }],
  ['awas', '#7b2d3b', 'Disparitas, notifikasi, dan jejak audit', {
    laporan_disparitas: ['PK id', 'UK kode', 'FK perkara_id', 'FK parameter_id', 'indeks', 'status'],
    sebaran_amar_laporan: ['PK id', 'FK laporan_id', 'FK kategori_amar_id', 'jumlah'],
    riwayat_status_laporan: ['PK id', 'FK laporan_id', 'status'],
    laporan_putusan: ['PK laporan_id + putusan_id', 'FK laporan_id', 'FK putusan_id'],
    profil_sebaran_disparitas: ['PK id', 'FK perkara_id', 'FK kategori_amar_id', 'jumlah'],
    jejak_audit: ['PK id', 'FK pengguna_id', 'aksi', 'objek', 'waktu'],
    notifikasi: ['PK id', 'FK pengguna_id', 'judul', 'dibaca'],
  }],
];

const relasi = [
  ['pihak', 'perkara', '*', '1'],
  ['dokumen_perkara', 'perkara', '*', '1'],
  ['perkara', 'majelis', '*', '1'],
  ['perkara', 'pengguna', '*', '1'],
  ['hasil_prediksi', 'perkara', '*', '1'],
  ['hasil_prediksi', 'model_prediksi', '*', '1'],
  ['hasil_prediksi', 'kategori_amar', '*', '1'],
  ['probabilitas_amar', 'hasil_prediksi', '*', '1'],
  ['probabilitas_amar', 'kategori_amar', '*', '1'],
  ['kemiripan_putusan', 'hasil_prediksi', '*', '1'],
  ['kemiripan_putusan', 'putusan', '*', '1'],
  ['antrean_prediksi', 'perkara', '*', '1'],
  ['antrean_prediksi', 'hasil_prediksi', '*', '0..1'],
  ['profil_probabilitas', 'perkara', '*', '1'],
  ['profil_probabilitas', 'kategori_amar', '*', '1'],
  ['profil_kemiripan', 'perkara', '*', '1'],
  ['profil_kemiripan', 'putusan', '*', '1'],
  ['analisis_perkara', 'hasil_prediksi', '0..1', '1'],
  ['argumen', 'analisis_perkara', '*', '1'],
  ['analisis_dasar_hukum', 'analisis_perkara', '*', '1'],
  ['analisis_dasar_hukum', 'dasar_hukum', '*', '1'],
  ['faktor_dominan', 'analisis_perkara', '*', '1'],
  ['perbandingan_aspek', 'hasil_prediksi', '*', '1'],
  ['perbandingan_aspek', 'putusan', '*', '1'],
  ['evaluasi_prediksi', 'hasil_prediksi', '*', '1'],
  ['evaluasi_prediksi', 'pengguna', '*', '1'],
  ['evaluasi_analisis', 'analisis_perkara', '*', '1'],
  ['nilai_relevansi', 'evaluasi_analisis', '*', '1'],
  ['percakapan_ai', 'hasil_prediksi', '*', '1'],
  ['percakapan_ai', 'pengguna', '*', '1'],
  ['pesan_ai', 'percakapan_ai', '*', '1'],
  ['referensi_sumber', 'pesan_ai', '*', '1'],
  ['feedback', 'hasil_prediksi', '*', '1'],
  ['feedback', 'percakapan_ai', '*', '0..1'],
  ['parameter_disparitas', 'pengguna', '*', '1'],
  ['laporan_disparitas', 'perkara', '*', '1'],
  ['laporan_disparitas', 'parameter_disparitas', '*', '1'],
  ['sebaran_amar_laporan', 'laporan_disparitas', '*', '1'],
  ['sebaran_amar_laporan', 'kategori_amar', '*', '1'],
  ['riwayat_status_laporan', 'laporan_disparitas', '*', '1'],
  ['laporan_putusan', 'laporan_disparitas', '*', '1'],
  ['laporan_putusan', 'putusan', '*', '1'],
  ['profil_sebaran_disparitas', 'perkara', '*', '1'],
  ['jejak_audit', 'pengguna', '*', '1'],
  ['notifikasi', 'pengguna', '*', '1'],
];

function tabel(nama, kolom, warna) {
  const baris = kolom.map((kol) => `<TR><TD ALIGN="LEFT">${kol}</TD></TR>`).join('');
  return `${nama} [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3">
      <TR><TD BGCOLOR="${warna}"><FONT COLOR="white"><B>${nama}</B></FONT></TD></TR>
      ${baris}
    </TABLE>>];`;
}

const isi = grup.map(([id, warna, judul, tabelMap]) => {
  const node = Object.entries(tabelMap).map(([nama, kolom]) => tabel(nama, kolom, warna)).join('\n');
  return `subgraph cluster_${id} {
    label="${judul}";
    style="rounded";
    color="${warna}";
    fontname="Arial";
    fontsize=16;
    ${node}
  }`;
}).join('\n');

const sisi = relasi.map(([dari, ke, kardDari, kardKe]) => (
  `${dari} -> ${ke} [arrowhead=none, taillabel="${kardDari}", headlabel="${kardKe}", fontsize=9];`
)).join('\n');

const dot = `digraph SIPROPERTI {
  label="ERD SIPROPERTI\\nPostgreSQL 16 lokal – Fitur Prediksi Putusan Tax Court One";
  labelloc=t;
  fontsize=22;
  fontname="Arial";
  rankdir=LR;
  splines=polyline;
  nodesep=0.28;
  ranksep=0.7;
  pad=0.4;
  bgcolor="#f7f9fc";
  node [shape=plain, fontname="Arial", fontsize=11];
  edge [fontname="Arial", color="#607080"];
  ${isi}
  ${sisi}
}`;

const viz = await instance();
const svg = viz.renderString(dot, { format: 'svg', engine: 'dot' });
await mkdir(keluar, { recursive: true });
await writeFile(path.join(keluar, 'siproperti-erd.svg'), svg);

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 4200 },
  background: '#f7f9fc',
  font: {
    fontDirs: ['C:/Windows/Fonts'],
    defaultFontFamily: 'Arial',
    loadSystemFonts: true,
  },
});
const png = resvg.render().asPng();
await writeFile(path.join(keluar, 'siproperti-erd.png'), png);
console.log(`ERD tertulis: ${path.join(keluar, 'siproperti-erd.png')} (${png.length} byte)`);
