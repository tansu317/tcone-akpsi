-- =============================================================================
-- SIPROPERTI – skema dan data dummy PostgreSQL (lokal)
-- Fitur Prediksi Putusan pada Tax Court One, Pengadilan Pajak
--
-- Hanya boleh dijalankan pada database bernama siproperti.
-- Skrip menghapus schema public lalu membuat ulang tabel, sehingga aman
-- dijalankan ulang pada database khusus proyek ini.
--
-- psql:
--   psql -U siproperti -d siproperti -f database/siproperti_local.sql
--
-- pgAdmin: buka database siproperti, lalu jalankan berkas ini (Query Tool).
-- Docker Compose menjalankan berkas ini otomatis saat volume pertama kali dibuat.
--
-- Produksi pada dokumen desain memakai PostgreSQL 16 + pgvector.
-- Skrip lokal memakai PostgreSQL standar (tanpa pgvector) agar dapat dijalankan
-- di komputer mahasiswa. Embedding vektor dapat ditambahkan kemudian.
-- =============================================================================

SET client_encoding TO 'UTF8';

DO $$
BEGIN
  IF current_database() <> 'siproperti' THEN
    RAISE EXCEPTION
      'Skrip ini hanya boleh dijalankan pada database siproperti. Database saat ini: %',
      current_database();
  END IF;
END $$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Referensi dan pengguna
-- -----------------------------------------------------------------------------

CREATE TABLE majelis (
  id uuid PRIMARY KEY,
  kode varchar(20) NOT NULL UNIQUE,
  nama varchar(120) NOT NULL
);

CREATE TABLE pengguna (
  id uuid PRIMARY KEY,
  nip varchar(18) NOT NULL UNIQUE,
  nama varchar(160) NOT NULL,
  nama_singkat varchar(80) NOT NULL,
  peran varchar(20) NOT NULL CHECK (peran IN ('Panitera', 'Hakim', 'Pimpinan')),
  jabatan varchar(120) NOT NULL,
  inisial varchar(4) NOT NULL,
  password_hash text NOT NULL,
  aktif boolean NOT NULL DEFAULT true
);

CREATE TABLE kategori_amar (
  id smallint PRIMARY KEY,
  nama varchar(80) NOT NULL UNIQUE,
  urutan smallint NOT NULL UNIQUE
);

CREATE TABLE model_prediksi (
  id uuid PRIMARY KEY,
  nama varchar(80) NOT NULL,
  versi varchar(20) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('dev', 'staging', 'produksi')),
  deskripsi text NOT NULL,
  tanggal_promosi date,
  UNIQUE (nama, versi)
);

CREATE TABLE dasar_hukum (
  id uuid PRIMARY KEY,
  judul varchar(200) NOT NULL,
  isi text NOT NULL
);

CREATE TABLE parameter_disparitas (
  id uuid PRIMARY KEY,
  periode_dari date NOT NULL,
  periode_sampai date NOT NULL,
  jenis_pajak varchar(40) NOT NULL DEFAULT 'Semua',
  ambang_indeks numeric(4,2) NOT NULL CHECK (ambang_indeks >= 0 AND ambang_indeks <= 1),
  minimum_putusan integer NOT NULL CHECK (minimum_putusan >= 1),
  ditetapkan_oleh uuid NOT NULL REFERENCES pengguna (id),
  ditetapkan_pada timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Data sumber Tax Court One (hanya dibaca oleh SIPROPERTI, tidak ditulis balik)
-- -----------------------------------------------------------------------------

CREATE TABLE perkara (
  id uuid PRIMARY KEY,
  nomor_sengketa varchar(20) NOT NULL UNIQUE,
  jenis_sengketa varchar(40) NOT NULL DEFAULT 'Gugatan',
  nama_pemohon varchar(200) NOT NULL,
  jenis_pajak varchar(40) NOT NULL,
  pokok_sengketa text NOT NULL,
  nilai_sengketa numeric(18,2) NOT NULL,
  masa_pajak varchar(40),
  tanggal_masuk date NOT NULL,
  tanggal_selesai_sidang date,
  majelis_id uuid NOT NULL REFERENCES majelis (id),
  panitera_id uuid NOT NULL REFERENCES pengguna (id),
  hakim_id uuid REFERENCES pengguna (id),
  posisi varchar(40),
  status_ucap varchar(30) NOT NULL DEFAULT 'Belum Ucap'
    CHECK (status_ucap IN ('Belum Ucap', 'Telah Diucap', 'Dicabut')),
  status_siproperti varchar(30) NOT NULL DEFAULT 'Belum Diprediksi'
    CHECK (status_siproperti IN ('Belum Diprediksi', 'Diproses', 'Telah Diprediksi', 'Gagal')),
  tampil_penyelesaian boolean NOT NULL DEFAULT false,
  tampil_disparitas boolean NOT NULL DEFAULT false,
  dapat_dipilih boolean NOT NULL DEFAULT true,
  tersedia_di_tco boolean NOT NULL DEFAULT true,
  kelengkapan varchar(20) NOT NULL DEFAULT 'lengkap'
    CHECK (kelengkapan IN ('lengkap', 'tidak_lengkap')),
  profil_kemiripan varchar(20) NOT NULL DEFAULT 'penuh'
    CHECK (profil_kemiripan IN ('penuh', 'terbatas', 'tidak_ada')),
  amar_draf varchar(80),
  jumlah_putusan_sejenis integer,
  flag_deteksi varchar(40)
    CHECK (flag_deteksi IN (
      'hitung', 'putusan_tidak_tersedia', 'pembanding_tidak_tersedia', 'tidak_mencukupi'
    )),
  sisa_simulasi_gagal_simpan smallint NOT NULL DEFAULT 0,
  fakta text,
  dalil text,
  bukti_kunci text
);

CREATE TABLE pihak (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  peran_pihak varchar(30) NOT NULL CHECK (peran_pihak IN ('Penggugat', 'Tergugat')),
  nama varchar(200) NOT NULL,
  nama_anonim varchar(40) NOT NULL
);

CREATE TABLE dokumen_perkara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  jenis_dokumen varchar(120) NOT NULL,
  urutan smallint NOT NULL,
  tersedia boolean NOT NULL DEFAULT true,
  UNIQUE (perkara_id, urutan)
);

CREATE TABLE putusan (
  id uuid PRIMARY KEY,
  nomor_putusan varchar(120) NOT NULL UNIQUE,
  tahun smallint NOT NULL,
  kode_majelis varchar(20) NOT NULL,
  amar varchar(80) NOT NULL,
  urutan smallint NOT NULL UNIQUE,
  fakta text NOT NULL,
  dalil text NOT NULL,
  bukti_kunci text NOT NULL,
  duduk_perkara text NOT NULL,
  pertimbangan text NOT NULL,
  amar_teks text NOT NULL
);

-- -----------------------------------------------------------------------------
-- Templat mesin lokal (pengganti model GPU / LLM on-premise saat pengembangan)
-- -----------------------------------------------------------------------------

CREATE TABLE templat_argumen (
  id smallserial PRIMARY KEY,
  pihak varchar(30) NOT NULL,
  isi text NOT NULL,
  urutan smallint NOT NULL
);

CREATE TABLE templat_faktor (
  id smallserial PRIMARY KEY,
  nama_faktor varchar(200) NOT NULL,
  kontribusi numeric(6,4) NOT NULL,
  urutan smallint NOT NULL
);

CREATE TABLE templat_chat (
  id smallserial PRIMARY KEY,
  jenis varchar(80) NOT NULL UNIQUE,
  urutan smallint NOT NULL UNIQUE,
  pertanyaan_contoh text NOT NULL,
  jawaban text NOT NULL,
  rujukan jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE profil_probabilitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  kategori_amar_id smallint NOT NULL REFERENCES kategori_amar (id),
  probabilitas numeric(6,4) NOT NULL CHECK (probabilitas >= 0 AND probabilitas <= 1),
  UNIQUE (perkara_id, kategori_amar_id)
);

CREATE TABLE profil_kemiripan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  putusan_id uuid NOT NULL REFERENCES putusan (id),
  persentase numeric(5,2) NOT NULL CHECK (persentase >= 0 AND persentase <= 100),
  alasan text NOT NULL,
  catatan_perbedaan text,
  UNIQUE (perkara_id, putusan_id)
);

CREATE TABLE profil_sebaran_disparitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  kategori_amar_id smallint NOT NULL REFERENCES kategori_amar (id),
  jumlah integer NOT NULL CHECK (jumlah >= 0),
  UNIQUE (perkara_id, kategori_amar_id)
);

-- -----------------------------------------------------------------------------
-- Prediksi, analisis, perbandingan
-- -----------------------------------------------------------------------------

CREATE TABLE hasil_prediksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode varchar(30) NOT NULL UNIQUE,
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  model_id uuid NOT NULL REFERENCES model_prediksi (id),
  versi integer NOT NULL CHECK (versi >= 1),
  status varchar(20) NOT NULL
    CHECK (status IN ('Diproses', 'Aktif', 'Gagal', 'Dievaluasi', 'Digantikan')),
  amar_kategori_id smallint REFERENCES kategori_amar (id),
  skor_keyakinan numeric(6,4) CHECK (skor_keyakinan >= 0 AND skor_keyakinan <= 1),
  dibuat_oleh uuid NOT NULL REFERENCES pengguna (id),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perkara_id, versi)
);

CREATE UNIQUE INDEX uq_hasil_prediksi_berjalan
  ON hasil_prediksi (perkara_id)
  WHERE status IN ('Diproses', 'Aktif', 'Dievaluasi');

CREATE TABLE probabilitas_amar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  kategori_amar_id smallint NOT NULL REFERENCES kategori_amar (id),
  probabilitas numeric(6,4) NOT NULL CHECK (probabilitas >= 0 AND probabilitas <= 1),
  UNIQUE (hasil_prediksi_id, kategori_amar_id)
);

CREATE TABLE kemiripan_putusan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  putusan_id uuid NOT NULL REFERENCES putusan (id),
  persentase numeric(5,2) NOT NULL,
  alasan text NOT NULL,
  catatan_perbedaan text,
  UNIQUE (hasil_prediksi_id, putusan_id)
);

CREATE TABLE antrean_prediksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunci_idempoten varchar(80) NOT NULL UNIQUE,
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  pengguna_id uuid NOT NULL REFERENCES pengguna (id),
  status varchar(20) NOT NULL CHECK (status IN ('Diproses', 'Selesai', 'Gagal')),
  langkah_gagal smallint,
  pesan text,
  hasil_prediksi_id uuid REFERENCES hasil_prediksi (id),
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analisis_perkara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL UNIQUE REFERENCES hasil_prediksi (id),
  ringkasan text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'Tersedia'
    CHECK (status IN ('Tersedia', 'Sebagian', 'Gagal')),
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE argumen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analisis_id uuid NOT NULL REFERENCES analisis_perkara (id),
  pihak varchar(30) NOT NULL,
  isi text NOT NULL,
  urutan smallint NOT NULL
);

CREATE TABLE analisis_dasar_hukum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analisis_id uuid NOT NULL REFERENCES analisis_perkara (id),
  dasar_hukum_id uuid NOT NULL REFERENCES dasar_hukum (id),
  UNIQUE (analisis_id, dasar_hukum_id)
);

CREATE TABLE faktor_dominan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analisis_id uuid NOT NULL REFERENCES analisis_perkara (id),
  nama_faktor varchar(200) NOT NULL,
  kontribusi numeric(6,4) NOT NULL,
  urutan smallint NOT NULL
);

CREATE TABLE perbandingan_aspek (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  putusan_id uuid NOT NULL REFERENCES putusan (id),
  aspek varchar(40) NOT NULL
    CHECK (aspek IN ('Fakta', 'Dalil', 'Bukti kunci', 'Pertimbangan', 'Amar')),
  nilai_perkara text NOT NULL,
  nilai_pembanding text NOT NULL,
  berbeda boolean NOT NULL DEFAULT false,
  urutan smallint NOT NULL,
  UNIQUE (hasil_prediksi_id, putusan_id, aspek)
);

-- -----------------------------------------------------------------------------
-- Evaluasi (append-only), ChatAI, feedback
-- -----------------------------------------------------------------------------

CREATE TABLE evaluasi_prediksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  evaluator_id uuid NOT NULL REFERENCES pengguna (id),
  status varchar(20) NOT NULL
    CHECK (status IN ('DITERIMA', 'DIKOREKSI', 'DITOLAK', 'DITANDAI')),
  amar_koreksi varchar(80),
  bagian_dikoreksi varchar(80),
  keterangan text,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evaluasi_analisis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  analisis_id uuid NOT NULL REFERENCES analisis_perkara (id),
  evaluator_id uuid NOT NULL REFERENCES pengguna (id),
  status varchar(20) NOT NULL CHECK (status IN ('SETUJU', 'TIDAK SETUJU')),
  alasan text,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nilai_relevansi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluasi_analisis_id uuid NOT NULL REFERENCES evaluasi_analisis (id),
  komponen varchar(80) NOT NULL,
  nilai smallint NOT NULL CHECK (nilai BETWEEN 1 AND 5),
  urutan smallint NOT NULL
);

CREATE TABLE percakapan_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode varchar(40) NOT NULL UNIQUE,
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  pengguna_id uuid NOT NULL REFERENCES pengguna (id),
  status varchar(20) NOT NULL CHECK (status IN ('Aktif', 'Selesai')),
  konteks_anonim jsonb NOT NULL DEFAULT '{}'::jsonb,
  mulai_pada timestamptz NOT NULL DEFAULT now(),
  selesai_pada timestamptz
);

CREATE TABLE pesan_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  percakapan_id uuid NOT NULL REFERENCES percakapan_ai (id),
  peran varchar(20) NOT NULL CHECK (peran IN ('pengguna', 'asisten')),
  jenis_pertanyaan varchar(80),
  isi text NOT NULL,
  tanpa_rujukan boolean NOT NULL DEFAULT false,
  urutan integer NOT NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referensi_sumber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesan_id uuid NOT NULL REFERENCES pesan_ai (id),
  label varchar(200) NOT NULL,
  terverifikasi boolean NOT NULL,
  dasar_hukum_id uuid REFERENCES dasar_hukum (id),
  putusan_id uuid REFERENCES putusan (id),
  urutan smallint NOT NULL
);

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hasil_prediksi_id uuid NOT NULL REFERENCES hasil_prediksi (id),
  percakapan_id uuid REFERENCES percakapan_ai (id),
  pengguna_id uuid NOT NULL REFERENCES pengguna (id),
  jenis varchar(20) NOT NULL CHECK (jenis IN ('Sesuai', 'Tidak Sesuai')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  kategori text[] NOT NULL DEFAULT '{}',
  penjelasan text,
  status_tindak_lanjut varchar(80) NOT NULL DEFAULT 'Diteruskan ke tim pengelola model',
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Disparitas, notifikasi, jejak audit
-- -----------------------------------------------------------------------------

CREATE SEQUENCE laporan_disparitas_seq START 1;

CREATE TABLE laporan_disparitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode varchar(20) NOT NULL UNIQUE,
  perkara_id uuid NOT NULL REFERENCES perkara (id),
  parameter_id uuid NOT NULL REFERENCES parameter_disparitas (id),
  amar_draf varchar(80),
  jumlah_sejenis integer NOT NULL,
  jumlah_selaras integer NOT NULL,
  indeks numeric(6,4) NOT NULL,
  ada_indikasi boolean NOT NULL,
  status varchar(30) NOT NULL CHECK (status IN (
    'Menunggu Peninjauan', 'Terkonfirmasi', 'Ditindaklanjuti', 'Diabaikan', 'Tidak Ada Indikasi'
  )),
  catatan_tindak_lanjut text,
  terdeteksi_pada timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid NOT NULL REFERENCES pengguna (id)
);

CREATE TABLE sebaran_amar_laporan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id uuid NOT NULL REFERENCES laporan_disparitas (id),
  kategori_amar_id smallint NOT NULL REFERENCES kategori_amar (id),
  jumlah integer NOT NULL CHECK (jumlah >= 0),
  UNIQUE (laporan_id, kategori_amar_id)
);

CREATE TABLE riwayat_status_laporan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laporan_id uuid NOT NULL REFERENCES laporan_disparitas (id),
  status varchar(40) NOT NULL,
  diubah_oleh uuid REFERENCES pengguna (id),
  diubah_pada timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE laporan_putusan (
  laporan_id uuid NOT NULL REFERENCES laporan_disparitas (id),
  putusan_id uuid NOT NULL REFERENCES putusan (id),
  kemiripan numeric(5,2) NOT NULL,
  PRIMARY KEY (laporan_id, putusan_id)
);

CREATE TABLE jejak_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pengguna_id uuid REFERENCES pengguna (id),
  nama_pengguna varchar(160) NOT NULL,
  aksi varchar(200) NOT NULL,
  objek varchar(200) NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifikasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengguna_id uuid NOT NULL REFERENCES pengguna (id),
  judul varchar(160) NOT NULL,
  isi text NOT NULL,
  tautan varchar(200),
  dibaca boolean NOT NULL DEFAULT false,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perkara_penyelesaian ON perkara (tampil_penyelesaian, nomor_sengketa);
CREATE INDEX idx_perkara_disparitas ON perkara (tampil_disparitas);
CREATE INDEX idx_hasil_perkara ON hasil_prediksi (perkara_id, versi DESC);
CREATE INDEX idx_audit_waktu ON jejak_audit (waktu DESC);
CREATE INDEX idx_notifikasi_pengguna ON notifikasi (pengguna_id, dibaca, dibuat_pada DESC);

CREATE OR REPLACE VIEW v_prediksi_berjalan AS
SELECT
  hp.id,
  hp.kode,
  hp.versi,
  hp.status,
  hp.skor_keyakinan,
  hp.dibuat_pada,
  ka.nama AS amar,
  p.nomor_sengketa,
  p.nama_pemohon
FROM hasil_prediksi hp
JOIN perkara p ON p.id = hp.perkara_id
LEFT JOIN kategori_amar ka ON ka.id = hp.amar_kategori_id
WHERE hp.status IN ('Aktif', 'Dievaluasi');

-- Rekaman evaluasi, pesan, feedback, dan jejak audit tidak boleh diubah/dihapus.
CREATE OR REPLACE FUNCTION cegah_ubah_hapus()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rekaman pada tabel % bersifat append-only dan tidak dapat diubah atau dihapus.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_evaluasi_prediksi_imut
  BEFORE UPDATE OR DELETE ON evaluasi_prediksi
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_evaluasi_analisis_imut
  BEFORE UPDATE OR DELETE ON evaluasi_analisis
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_nilai_relevansi_imut
  BEFORE UPDATE OR DELETE ON nilai_relevansi
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_pesan_ai_imut
  BEFORE UPDATE OR DELETE ON pesan_ai
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_referensi_imut
  BEFORE UPDATE OR DELETE ON referensi_sumber
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_feedback_imut
  BEFORE UPDATE OR DELETE ON feedback
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

CREATE TRIGGER trg_audit_imut
  BEFORE UPDATE OR DELETE ON jejak_audit
  FOR EACH ROW EXECUTE FUNCTION cegah_ubah_hapus();

COMMENT ON TABLE perkara IS 'Sengketa yang dibaca dari Tax Court One. Status SIPROPERTI adalah turunan lokal, bukan tulisan balik ke basis data sumber.';
COMMENT ON TABLE hasil_prediksi IS 'Versi prediksi amar. Status: Diproses, Aktif, Gagal, Dievaluasi, Digantikan.';
COMMENT ON TABLE evaluasi_prediksi IS 'Evaluasi hakim bersifat immutable (FR-5.4). Perubahan pandangan dicatat sebagai baris baru.';
COMMENT ON TABLE jejak_audit IS 'Jejak audit append-only. Retensi produksi minimal 5 tahun (TR-08).';
COMMENT ON TABLE model_prediksi IS 'Registri model: promosi dev, staging, lalu produksi (TR-07).';

-- =============================================================================
-- DATA DUMMY (fiktif, selaras dengan prototipe tcone_siproperti)
-- Kata sandi semua akun: demo123
-- =============================================================================

INSERT INTO majelis (id, kode, nama) VALUES
  ('11111111-0000-4000-8000-0000000000b1', 'M IVB', 'Majelis IVB'),
  ('11111111-0000-4000-8000-0000000000b2', 'M XIIA', 'Majelis XIIA'),
  ('11111111-0000-4000-8000-0000000000b3', 'M VIIIB', 'Majelis VIIIB'),
  ('11111111-0000-4000-8000-0000000000b4', 'M IIA', 'Majelis IIA'),
  ('11111111-0000-4000-8000-0000000000b5', 'M VB', 'Majelis VB'),
  ('11111111-0000-4000-8000-0000000000b6', 'M XIA', 'Majelis XIA'),
  ('11111111-0000-4000-8000-0000000000b7', 'M IVA', 'Majelis IVA');

INSERT INTO pengguna (id, nip, nama, nama_singkat, peran, jabatan, inisial, password_hash) VALUES
  ('11111111-0000-4000-8000-0000000000a1', '198705122010121003', 'Rina Siregar, S.H.', 'Rina Siregar, S.H.', 'Panitera', 'Panitera Pengganti', 'RS', crypt('demo123', gen_salt('bf'))),
  ('11111111-0000-4000-8000-0000000000a2', '197208041999031004', 'Dr. Andi Wibisono, S.H., M.H.', 'Dr. A. Wibisono', 'Hakim', 'Hakim – Majelis IVB', 'AW', crypt('demo123', gen_salt('bf'))),
  ('11111111-0000-4000-8000-0000000000a3', '196511121988031005', 'Pimpinan Pengadilan Pajak', 'Pimpinan', 'Pimpinan', 'Ketua', 'PP', crypt('demo123', gen_salt('bf')));

INSERT INTO kategori_amar (id, nama, urutan) VALUES
  (1, 'Mengabulkan Seluruhnya', 1),
  (2, 'Mengabulkan Sebagian', 2),
  (3, 'Menolak', 3),
  (4, 'Tidak Dapat Diterima', 4),
  (5, 'Membatalkan', 5),
  (6, 'Mencabut', 6),
  (7, 'Menambah Pajak Yang Harus Dibayar', 7);

INSERT INTO model_prediksi (id, nama, versi, status, deskripsi, tanggal_promosi) VALUES
  ('33333333-0000-4000-8000-000000000001', 'AmarClassifier', '2.3', 'produksi', 'Model klasifikasi amar yang dipakai prediksi berjalan.', DATE '2025-08-01'),
  ('33333333-0000-4000-8000-000000000002', 'AmarClassifier', '2.4-rc', 'staging', 'Kandidat promosi, belum dipakai perkara produksi.', DATE '2025-09-15'),
  ('33333333-0000-4000-8000-000000000003', 'AmarClassifier', '2.5-dev', 'dev', 'Pelatihan ulang di lingkungan pengembangan.', NULL);

INSERT INTO dasar_hukum (id, judul, isi) VALUES
  ('44444444-0000-4000-8000-000000000001', 'UU KUP Pasal 36 ayat (1) huruf a', 'Pengurangan atau penghapusan sanksi administrasi yang dikenakan karena khilaf atau bukan karena kesalahan Wajib Pajak.'),
  ('44444444-0000-4000-8000-000000000002', 'UU No. 14 Tahun 2002 Pasal 31 ayat (3)', 'Kewenangan Pengadilan Pajak mengadili sengketa gugatan.'),
  ('44444444-0000-4000-8000-000000000003', 'PMK tentang Tata Cara Pengurangan atau Penghapusan Sanksi Administrasi', 'Syarat dan jangka waktu permohonan pengurangan sanksi.');

INSERT INTO parameter_disparitas (
  id, periode_dari, periode_sampai, jenis_pajak, ambang_indeks, minimum_putusan, ditetapkan_oleh, ditetapkan_pada
) VALUES (
  '77777777-0000-4000-8000-000000000001',
  DATE '2021-01-01', DATE '2025-06-01', 'Semua', 0.60, 10,
  '11111111-0000-4000-8000-0000000000a3', TIMESTAMP WITH TIME ZONE '2025-09-01 08:00:00+07'
);

INSERT INTO perkara (
  id, nomor_sengketa, nama_pemohon, jenis_pajak, pokok_sengketa, nilai_sengketa,
  masa_pajak, tanggal_masuk, tanggal_selesai_sidang, majelis_id, panitera_id, hakim_id, posisi,
  status_siproperti, tampil_penyelesaian, tampil_disparitas, dapat_dipilih, tersedia_di_tco,
  kelengkapan, profil_kemiripan, amar_draf, jumlah_putusan_sejenis, flag_deteksi, sisa_simulasi_gagal_simpan
) VALUES
  ('11111111-0000-4000-8000-000000000001', '000412162025', 'PT Sinar Kencana Logistik', 'PPN', 'Gugatan atas pelaksanaan Surat Paksa', 1284500000, '2024', DATE '2025-03-11', DATE '2025-08-14', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, true, true, true, 'lengkap', 'penuh', 'Mengabulkan Seluruhnya', 37, 'hitung', 0),
  ('11111111-0000-4000-8000-000000000002', '000437162025', 'CV Mitra Agro Lestari', 'PPN', 'Gugatan atas penolakan pengurangan sanksi administrasi (Pasal 36 KUP)', 642180000, 'Desember 2021', DATE '2025-03-19', DATE '2025-08-21', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Telah Diprediksi', true, true, true, true, 'lengkap', 'penuh', 'Menolak', 42, 'hitung', 0),
  ('11111111-0000-4000-8000-000000000003', '000451162025', 'PT Arunika Tekstil', 'Pabean', 'Gugatan atas Surat Penetapan Tarif dan/atau Nilai Pabean', 318900000, '2024', DATE '2025-04-02', DATE '2025-08-28', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'tidak_lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000004', '000468162025', 'PT Bahari Sentosa Marine', 'PPh Pasal 23', 'Gugatan atas pelaksanaan penyitaan', 915000000, '2024', DATE '2025-04-15', DATE '2025-09-02', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'lengkap', 'terbatas', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000005', '000489162025', 'PT Kalimaya Perkebunan', 'PPh Badan', 'Gugatan atas pengumuman lelang barang sitaan', 205740000, '2024', DATE '2025-05-06', DATE '2025-09-04', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'lengkap', 'tidak_ada', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000006', '000502162025', 'PT Nusantara Digital Niaga', 'PPN', 'Gugatan atas Surat Teguran', 477300000, '2024', DATE '2025-05-14', DATE '2025-09-09', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, false, 'lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000007', '000517162025', 'PT Lintas Samudra Cargo', 'Pabean', 'Gugatan atas Keputusan pembetulan', 733120000, '2024', DATE '2025-05-20', DATE '2025-09-11', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, false, false, 'lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000008', '000533162025', 'PT Graha Mandiri Konstruksi', 'PPh Pasal 23', 'Gugatan atas pelaksanaan Surat Paksa', 1022640000, '2024', DATE '2025-05-27', DATE '2025-09-16', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000009', '000548162025', 'CV Surya Pratama Elektrik', 'PPN', 'Gugatan atas penolakan penghapusan sanksi', 158900000, '2024', DATE '2025-06-03', DATE '2025-09-18', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000010', '000561162025', 'PT Andalas Prima Sawit', 'Pabean', 'Gugatan atas penetapan kembali tarif', 690450000, '2024', DATE '2025-06-10', DATE '2025-09-23', '11111111-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', true, false, true, true, 'lengkap', 'penuh', NULL, NULL, NULL, 0),
  ('11111111-0000-4000-8000-000000000011', '000389152025', 'PT Cakra Buana Energi', 'Pabean', 'Gugatan atas penetapan nilai pabean', 450000000, '2024', DATE '2025-02-12', DATE '2025-07-20', '11111111-0000-4000-8000-0000000000b2', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', false, true, false, true, 'lengkap', 'tidak_ada', NULL, 0, 'putusan_tidak_tersedia', 0),
  ('11111111-0000-4000-8000-000000000012', '000377152025', 'PT Delta Mas Retailindo', 'PPh Pasal 23', 'Gugatan atas pelaksanaan surat paksa', 275000000, '2024', DATE '2025-02-03', DATE '2025-07-11', '11111111-0000-4000-8000-0000000000b3', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', false, true, false, true, 'lengkap', 'tidak_ada', 'Mengabulkan Sebagian', 0, 'pembanding_tidak_tersedia', 0),
  ('11111111-0000-4000-8000-000000000013', '000365152025', 'CV Tirta Kencana', 'PPN', 'Gugatan atas penolakan pengurangan sanksi', 98000000, '2024', DATE '2025-01-22', DATE '2025-07-02', '11111111-0000-4000-8000-0000000000b4', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', false, true, false, true, 'lengkap', 'tidak_ada', 'Menolak', 3, 'tidak_mencukupi', 0),
  ('11111111-0000-4000-8000-000000000014', '000351152025', 'PT Mega Samudera Lines', 'Pabean', 'Gugatan atas penetapan tarif', 860000000, '2024', DATE '2025-01-15', DATE '2025-06-28', '11111111-0000-4000-8000-0000000000b5', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2', 'Hakim P1', 'Belum Diprediksi', false, true, false, true, 'lengkap', 'tidak_ada', 'Menolak', 29, 'hitung', 1);

UPDATE perkara SET
  fakta = pokok_sengketa,
  dalil = 'Dalil para pihak sebagaimana berkas perkara',
  bukti_kunci = 'Dokumen perkara pada Tax Court One';

UPDATE perkara SET
  fakta = 'Terlambat setor PPN Des 2021; sanksi Rp642,18 jt',
  dalil = 'Gangguan e-Billing; pokok sudah lunas',
  bukti_kunci = 'Tiket layanan internal penggugat'
WHERE nomor_sengketa = '000437162025';

INSERT INTO pihak (perkara_id, peran_pihak, nama, nama_anonim)
SELECT id, 'Penggugat', nama_pemohon, 'PIHAK-01' FROM perkara
UNION ALL
SELECT id, 'Tergugat', 'Direktur Jenderal Pajak', 'Direktur Jenderal Pajak' FROM perkara;

INSERT INTO dokumen_perkara (perkara_id, jenis_dokumen, urutan, tersedia)
SELECT p.id, d.jenis, d.urutan,
  NOT (p.kelengkapan = 'tidak_lengkap' AND d.urutan > 4)
FROM perkara p
CROSS JOIN (VALUES
  (1, 'Surat Gugatan'),
  (2, 'Surat Tanggapan Tergugat'),
  (3, 'Surat Bantahan Penggugat'),
  (4, 'Objek Gugatan (salinan keputusan/Surat Paksa)'),
  (5, 'Berita Acara Sidang'),
  (6, 'Daftar Alat Bukti')
) AS d(urutan, jenis);

INSERT INTO putusan (
  id, nomor_putusan, tahun, kode_majelis, amar, urutan, fakta, dalil, bukti_kunci, duduk_perkara, pertimbangan, amar_teks
) VALUES
  (
    '22222222-0000-4000-8000-000000000001',
    'PUT-012345.16/2023/PP/M.IVB Tahun 2023',
    2023, 'M IVB', 'Mengabulkan Sebagian', 1,
    'Terlambat setor PPN Mar 2022; sanksi Rp511,40 jt',
    'Gangguan sistem pembayaran; pokok sudah lunas',
    'Surat keterangan gangguan dari otoritas',
    $dok$Penggugat mengajukan gugatan atas Keputusan Direktur Jenderal Pajak yang menolak permohonan pengurangan sanksi administrasi berupa bunga atas keterlambatan penyetoran PPN Masa Maret 2022 sebesar Rp511.400.000.$dok$,
    $dok$Menimbang bahwa berdasarkan surat keterangan gangguan sistem pembayaran yang diterbitkan otoritas, Majelis berpendapat keterlambatan penyetoran terjadi bukan karena kesalahan Penggugat sehingga memenuhi ketentuan Pasal 36 ayat (1) huruf a UU KUP; Menimbang bahwa untuk Masa Februari 2022 tidak terdapat bukti pendukung sehingga koreksi sanksi untuk masa tersebut tetap dipertahankan.$dok$,
    'Menyatakan mengabulkan sebagian gugatan Penggugat sehingga sanksi administrasi yang masih harus dibayar menjadi Rp102.280.000.'
  ),
  (
    '22222222-0000-4000-8000-000000000002',
    'PUT-009871.16/2022/PP/M.IIA Tahun 2022',
    2022, 'M IIA', 'Mengabulkan Sebagian', 2,
    'Penolakan pengurangan sanksi bunga PPN; nilai sebanding',
    'Kekhilafan administrasi dan pelunasan pokok',
    'Rekening koran dan bukti setor',
    'Penggugat memohon pengurangan sanksi administrasi setelah pokok pajak dilunasi.',
    'Majelis mengabulkan sebagian karena sebagian masa pajak tidak didukung bukti kekhilafan.',
    'Mengabulkan gugatan untuk sebagian dan menolak selebihnya.'
  ),
  (
    '22222222-0000-4000-8000-000000000003',
    'PUT-014420.16/2023/PP/M.XIA Tahun 2023',
    2023, 'M XIA', 'Menolak', 3,
    'Permohonan pengurangan sanksi diajukan lewat waktu',
    'Gangguan sistem tidak dijelaskan dalam jangka waktu',
    'Tidak ada bukti tanggal gangguan',
    'Gugatan atas penolakan pengurangan sanksi yang diajukan setelah tenggang waktu.',
    'Permohonan diajukan melewati jangka waktu sehingga tidak memenuhi syarat PMK.',
    'Menolak gugatan Penggugat.'
  ),
  (
    '22222222-0000-4000-8000-000000000004',
    'PUT-007712.16/2021/PP/M.VB Tahun 2021',
    2021, 'M VB', 'Mengabulkan Seluruhnya', 4,
    'Sanksi timbul karena kekhilafan administrasi fiskus',
    'Kesalahan penerbitan surat ketetapan',
    'Lembar pemeriksaan internal',
    'Sengketa bermula dari kekhilafan administrasi pada penerbitan surat.',
    'Terdapat bukti kekhilafan administrasi fiskus sehingga sanksi dihapuskan.',
    'Mengabulkan gugatan Penggugat seluruhnya.'
  ),
  (
    '22222222-0000-4000-8000-000000000005',
    'PUT-016003.16/2024/PP/M.IVA Tahun 2024',
    2024, 'M IVA', 'Tidak Dapat Diterima', 5,
    'Gugatan diajukan setelah 30 hari',
    'Keberatan terhadap surat teguran',
    'Bukti tanggal terima surat',
    'Gugatan diajukan melewati tenggang waktu 30 hari.',
    'Gugatan melewati tenggang waktu sebagaimana Pasal 40 UU Pengadilan Pajak.',
    'Menyatakan gugatan tidak dapat diterima.'
  );

INSERT INTO templat_argumen (pihak, isi, urutan) VALUES
  ('Penggugat', 'Keterlambatan penyetoran PPN masa Desember 2021 terjadi karena gangguan sistem e-Billing (bukti: tiket layanan).', 1),
  ('Penggugat', 'Pokok pajak telah dilunasi sebelum Surat Tagihan Pajak diterbitkan.', 2),
  ('Tergugat', 'Penggugat terlambat menyampaikan SPT Masa pada dua masa pajak sebelumnya sehingga tidak memenuhi unsur kekhilafan.', 3);

INSERT INTO templat_faktor (nama_faktor, kontribusi, urutan) VALUES
  ('Permohonan diajukan dalam jangka waktu', 0.2100, 1),
  ('Sanksi timbul karena kekhilafan, bukan kesalahan WP', 0.1700, 2),
  ('Bukti pelunasan pokok pajak lengkap', 0.0900, 3),
  ('Riwayat keterlambatan pelaporan 2 masa', -0.1200, 4),
  ('Sebagian dalil tidak didukung bukti', -0.0800, 5);

INSERT INTO templat_chat (jenis, urutan, pertanyaan_contoh, jawaban, rujukan) VALUES
  (
    'Penjelasan Reasoning', 1,
    'Faktor atau argumen apa yang paling berkontribusi terhadap hasil prediksi?',
    'Prediksi didorong oleh dua faktor utama: permohonan diajukan dalam jangka waktu Pasal 36 ayat (1) huruf a UU KUP dan indikasi bahwa sanksi timbul karena kekhilafan. Riwayat keterlambatan pelaporan dua masa sebelumnya menahan probabilitas pengabulan seluruhnya.',
    '[{"label":"UU KUP Pasal 36 ayat (1) huruf a","terverifikasi":true},{"label":"PUT-012345.16/2023/PP/M.IVB","terverifikasi":true}]'::jsonb
  ),
  (
    'Dasar Hukum', 2,
    'Pasal atau peraturan apa yang relevan dengan hasil prediksi?',
    'Ketentuan utama adalah Pasal 36 ayat (1) huruf a UU KUP tentang pengurangan sanksi karena kekhilafan, Pasal 31 ayat (3) UU No. 14 Tahun 2002 tentang kewenangan mengadili gugatan, serta PMK tentang tata cara pengurangan sanksi administrasi.',
    '[{"label":"UU KUP Pasal 36 ayat (1) huruf a","terverifikasi":true},{"label":"UU 14/2002 Pasal 31 ayat (3)","terverifikasi":true},{"label":"SE-12/PJ/2019","terverifikasi":false}]'::jsonb
  ),
  (
    'Pertimbangan Putusan Sejenis', 3,
    'Bagaimana pertimbangan majelis pada putusan sejenis?',
    'Pada 3 dari 5 putusan teratas, majelis mengabulkan (seluruhnya atau sebagian) bila terdapat bukti tertulis gangguan sistem dari otoritas. Putusan yang menolak umumnya karena permohonan melewati jangka waktu.',
    '[{"label":"PUT-012345.16/2023/PP/M.IVB","terverifikasi":true},{"label":"PUT-009871.16/2022/PP/M.IIA","terverifikasi":true},{"label":"PUT-014420.16/2023/PP/M.XIA","terverifikasi":true}]'::jsonb
  ),
  (
    'Brainstorming Analisis', 4,
    'Aspek apa yang perlu diuji majelis dari dalil gangguan e-Billing?',
    'Majelis dapat menguji: (1) apakah gangguan tercatat resmi pada tanggal jatuh tempo, (2) apakah penggugat mencoba kanal pembayaran lain, dan (3) relevansi keterlambatan masa sebelumnya terhadap unsur kekhilafan. Penilaian tetap berada pada majelis.',
    '[{"label":"Berita Acara Sidang (dokumen perkara)","terverifikasi":true}]'::jsonb
  );

INSERT INTO profil_probabilitas (perkara_id, kategori_amar_id, probabilitas)
SELECT p.id, u.kategori::smallint, u.prob
FROM (VALUES
  ('000412162025', ARRAY[0.44,0.31,0.15,0.05,0.03,0.01,0.01]::numeric[]),
  ('000437162025', ARRAY[0.12,0.58,0.18,0.06,0.03,0.02,0.01]::numeric[]),
  ('000451162025', ARRAY[0.20,0.40,0.25,0.08,0.04,0.02,0.01]::numeric[]),
  ('000468162025', ARRAY[0.11,0.26,0.47,0.09,0.04,0.02,0.01]::numeric[]),
  ('000489162025', ARRAY[0.36,0.27,0.21,0.08,0.05,0.02,0.01]::numeric[]),
  ('000502162025', ARRAY[0.20,0.40,0.25,0.08,0.04,0.02,0.01]::numeric[]),
  ('000517162025', ARRAY[0.20,0.40,0.25,0.08,0.04,0.02,0.01]::numeric[]),
  ('000533162025', ARRAY[0.21,0.39,0.27,0.07,0.03,0.02,0.01]::numeric[]),
  ('000548162025', ARRAY[0.16,0.52,0.20,0.07,0.03,0.01,0.01]::numeric[]),
  ('000561162025', ARRAY[0.09,0.22,0.55,0.08,0.03,0.02,0.01]::numeric[])
) AS src(nomor, probs)
JOIN perkara p ON p.nomor_sengketa = src.nomor
CROSS JOIN LATERAL unnest(src.probs) WITH ORDINALITY AS u(prob, kategori);

INSERT INTO profil_kemiripan (perkara_id, putusan_id, persentase, alasan, catatan_perbedaan)
SELECT p.id, t.id, x.persentase, x.alasan, x.catatan
FROM perkara p
JOIN (VALUES
  (1, 91.37::numeric, 'Pokok sengketa sama (pengurangan sanksi Pasal 36 ayat 1 huruf a KUP); dasar hukum identik', 'Perbedaan utama: kekuatan bukti gangguan sistem (surat resmi otoritas vs tiket layanan internal).'),
  (2, 87.12::numeric, 'Penolakan pengurangan sanksi; nilai sanksi sebanding', NULL),
  (3, 82.48::numeric, 'Isu sama; permohonan diajukan melewati jangka waktu', NULL),
  (4, 79.06::numeric, 'Isu sama; terdapat bukti kekhilafan administrasi fiskus', NULL),
  (5, 74.55::numeric, 'Gugatan melewati tenggang waktu 30 hari', NULL)
) AS x(urutan, persentase, alasan, catatan) ON true
JOIN putusan t ON t.urutan = x.urutan
WHERE p.tampil_penyelesaian
  AND (
    p.profil_kemiripan = 'penuh'
    OR (p.profil_kemiripan = 'terbatas' AND x.urutan IN (3, 4))
  );

INSERT INTO profil_sebaran_disparitas (perkara_id, kategori_amar_id, jumlah)
SELECT p.id, u.kategori::smallint, u.jumlah
FROM (VALUES
  ('000412162025', ARRAY[25,7,3,2,0,0,0]::int[]),
  ('000437162025', ARRAY[5,26,7,3,1,0,0]::int[]),
  ('000351152025', ARRAY[3,18,5,2,1,0,0]::int[])
) AS src(nomor, sebaran)
JOIN perkara p ON p.nomor_sengketa = src.nomor
CROSS JOIN LATERAL unnest(src.sebaran) WITH ORDINALITY AS u(jumlah, kategori);

INSERT INTO hasil_prediksi (
  id, kode, perkara_id, model_id, versi, status, amar_kategori_id, skor_keyakinan, dibuat_oleh, dibuat_pada
) VALUES (
  '55555555-0000-4000-8000-000000000001',
  'PRD-437-v1',
  '11111111-0000-4000-8000-000000000002',
  '33333333-0000-4000-8000-000000000001',
  1, 'Aktif', 2, 0.5800,
  '11111111-0000-4000-8000-0000000000a1',
  TIMESTAMP WITH TIME ZONE '2025-09-12 09:42:00+07'
);

INSERT INTO probabilitas_amar (hasil_prediksi_id, kategori_amar_id, probabilitas)
SELECT '55555555-0000-4000-8000-000000000001', kategori_amar_id, probabilitas
FROM profil_probabilitas
WHERE perkara_id = '11111111-0000-4000-8000-000000000002';

INSERT INTO kemiripan_putusan (hasil_prediksi_id, putusan_id, persentase, alasan, catatan_perbedaan)
SELECT '55555555-0000-4000-8000-000000000001', putusan_id, persentase, alasan, catatan_perbedaan
FROM profil_kemiripan
WHERE perkara_id = '11111111-0000-4000-8000-000000000002';

INSERT INTO analisis_perkara (id, hasil_prediksi_id, ringkasan, status, dibuat_pada) VALUES (
  '66666666-0000-4000-8000-000000000001',
  '55555555-0000-4000-8000-000000000001',
  'Prediksi Mengabulkan Sebagian terutama didukung oleh terpenuhinya jangka waktu permohonan dan indikasi bahwa sanksi timbul karena kekhilafan. Dua dari tiga putusan pembanding teratas berakhir dengan amar yang sama. Riwayat keterlambatan pelaporan menahan probabilitas pengabulan seluruhnya.',
  'Tersedia',
  TIMESTAMP WITH TIME ZONE '2025-09-12 09:42:00+07'
);

INSERT INTO argumen (analisis_id, pihak, isi, urutan)
SELECT '66666666-0000-4000-8000-000000000001', pihak, isi, urutan
FROM templat_argumen;

INSERT INTO analisis_dasar_hukum (analisis_id, dasar_hukum_id)
SELECT '66666666-0000-4000-8000-000000000001', id FROM dasar_hukum;

INSERT INTO faktor_dominan (analisis_id, nama_faktor, kontribusi, urutan)
SELECT '66666666-0000-4000-8000-000000000001', nama_faktor, kontribusi, urutan
FROM templat_faktor;

INSERT INTO perbandingan_aspek (
  hasil_prediksi_id, putusan_id, aspek, nilai_perkara, nilai_pembanding, berbeda, urutan
)
SELECT
  '55555555-0000-4000-8000-000000000001',
  '22222222-0000-4000-8000-000000000001',
  x.aspek, x.nilai_perkara, x.nilai_pembanding, x.berbeda, x.urutan
FROM (VALUES
  (1, 'Fakta', 'Terlambat setor PPN Des 2021; sanksi Rp642,18 jt', 'Terlambat setor PPN Mar 2022; sanksi Rp511,40 jt', false),
  (2, 'Dalil', 'Gangguan e-Billing; pokok sudah lunas', 'Gangguan sistem pembayaran; pokok sudah lunas', false),
  (3, 'Bukti kunci', 'Tiket layanan internal penggugat', 'Surat keterangan gangguan dari otoritas', true),
  (4, 'Pertimbangan', '–', 'Bukan kesalahan WP; satu masa tidak didukung bukti', false),
  (5, 'Amar', 'Prediksi: Mengabulkan Sebagian', 'Mengabulkan Sebagian', false)
) AS x(urutan, aspek, nilai_perkara, nilai_pembanding, berbeda);

INSERT INTO antrean_prediksi (
  kunci_idempoten, perkara_id, pengguna_id, status, hasil_prediksi_id, pesan, dibuat_pada
) VALUES (
  'seed-prd-437-v1',
  '11111111-0000-4000-8000-000000000002',
  '11111111-0000-4000-8000-0000000000a1',
  'Selesai',
  '55555555-0000-4000-8000-000000000001',
  'Prediksi contoh awal prototipe',
  TIMESTAMP WITH TIME ZONE '2025-09-12 09:42:00+07'
);

INSERT INTO jejak_audit (pengguna_id, nama_pengguna, aksi, objek, waktu) VALUES (
  '11111111-0000-4000-8000-0000000000a1',
  'Rina Siregar, S.H.',
  'Generate prediksi putusan',
  '000437162025 / PRD-437-v1',
  TIMESTAMP WITH TIME ZONE '2025-09-12 09:42:00+07'
);

INSERT INTO notifikasi (pengguna_id, judul, isi, tautan) VALUES (
  '11111111-0000-4000-8000-0000000000a2',
  'Prediksi menunggu telaah',
  'Sengketa 000437162025 memiliki prediksi aktif PRD-437-v1.',
  '/prediksi/55555555-0000-4000-8000-000000000001'
);
