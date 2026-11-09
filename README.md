# SIPROPERTI

Kerangka kerja lokal untuk **Fitur Prediksi Putusan pada Tax Court One (SIPROPERTI)**. Antarmuka mengikuti prototipe TC One: Panitera, Hakim, dan Pimpinan menjalankan UC-01 sampai UC-09 pada basis data PostgreSQL di komputer sendiri.

Dokumen desain produksi menempatkan layanan AI pada Python/FastAPI dan GPU. Kerangka ini memakai **Node.js + Express 5** dan **React 19** sesuai kebutuhan pengembangan lokal. Prediksi amar, analisis, dan ChatAI disimulasikan dari data di PostgreSQL (tanpa memanggil model di luar mesin) agar tetap selaras dengan batas *zero data egress*.

## Menjalankan

Butuh Node.js 22, npm, dan Docker Desktop.

```powershell
docker compose up -d
cd backend
npm install
npm run dev
```

Terminal kedua:

```powershell
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. API berjalan di http://localhost:4000.

Jika port 5432 sudah dipakai PostgreSQL lain, pilih port kosong lalu samakan `DATABASE_URL` pada `backend/.env`:

```powershell
$env:POSTGRES_PORT = "55432"
docker compose up -d
```

Jika PostgreSQL sudah terpasang sendiri (tanpa Docker):

```powershell
psql -U postgres -f database/00_buat_database.sql
psql -U siproperti -d siproperti -f database/siproperti_local.sql
```

`database/siproperti_local.sql` membuat seluruh tabel dan data dummy. Skrip hanya mau jalan pada database bernama `siproperti`, dan boleh dijalankan ulang: schema `public` di database itu dihapus lalu dibuat kembali.

## Akun demo

Kata sandi semua akun: `demo123`

| Peran | NIP | Nama |
| --- | --- | --- |
| Panitera | 198705122010121003 | Rina Siregar, S.H. |
| Hakim | 197208041999031004 | Dr. Andi Wibisono, S.H., M.H. |
| Pimpinan | 196511121988031005 | Pimpinan Pengadilan Pajak |

## Data uji per use scenario

Semua use scenario pada `prototipe/SIPROPERTI_Alur_Real_Use_Case_Figma/2_Alur_per_Use_Scenario` dapat dijalankan dengan data dummy berikut. Prediksi baru dibuat dari menu Penyelesaian (Panitera) atau ikon gear di Penyelesaian Putusan (Hakim).

| Use scenario | Cara menjalankan |
| --- | --- |
| US-01.1 Prediksi berkas lengkap | Generate 000437162025 atau perkara lengkap lain |
| US-01.2 Data tidak ditemukan di TCO | Generate 000502162025 (gagal di langkah 2) |
| US-01.3 Dokumen tidak lengkap | Generate 000451162025 (gagal di langkah 3) |
| US-01.4 Putusan sejenis sedikit | Generate 000468162025 (2 putusan sejenis) |
| US-01.5 Tidak ada putusan sejenis | Generate 000489162025 |
| US-02.1 Pilih dan konfirmasi sengketa | Pilih perkara mana pun yang tersedia, lalu Konfirmasi |
| US-02.2 / US-02.3 Sengketa tidak tersedia | Pilih 000517162025, lalu Batal atau Pilih Sengketa Lain |
| US-03.1 Analisis lengkap | Analisis PRD-437-v1 (000437162025) |
| US-03.2 Informasi perkara tidak ditemukan | Generate lalu analisis 000561162025 |
| US-03.3 Argumen tidak ditemukan | Generate lalu analisis 000533162025 |
| US-03.4 Dasar hukum tidak ditemukan | Generate lalu analisis 000548162025 |
| US-03.5 Putusan relevan tidak ditemukan | Generate lalu analisis 000489162025 |
| US-03.6 Analisis tidak dapat ditampilkan | Generate lalu analisis 000412162025; percobaan pertama gagal, Coba Lagi berhasil |
| US-04.1 Bandingkan putusan paling mirip | Bandingkan PRD-437-v1 dengan PUT-012345 |
| US-04.2 Tidak ada putusan memenuhi ambang | Bandingkan prediksi 000489162025 |
| US-04.3 Dokumen putusan gagal dimuat | Lihat & Bandingkan PUT-016003 (kembali ke daftar dengan peringatan) |
| US-04.4 OCR gagal | Lihat & Bandingkan PUT-007712 (dokumen tanpa sorotan) |
| US-05.1 sampai US-05.4 | Evaluasi Hasil Prediksi: Terima, Koreksi (amar + koreksi wajib), Tolak (alasan wajib), Tandai |
| US-06.1 sampai US-06.4 | Evaluasi Hasil Analisis: Setuju, Tidak Setuju (alasan wajib), Tidak perlu, atau simpan tanpa nilai lengkap |
| US-07.1 sampai US-07.4 | ChatAI: jenis pertanyaan S-1 sampai S-4 |
| US-07.5 / US-07.6 Rujukan tidak ditemukan | Kirim pertanyaan berisi `cuaca`, `olahraga`, atau `resep`, lalu susun ulang atau Akhiri Percakapan |
| US-08.1 / US-08.2 Feedback | Beri Feedback: Sesuai, atau Belum sesuai dengan kategori |
| US-08.3 Feedback belum lengkap | Kirim Feedback tanpa rating |
| US-09.1 Tidak ada indikasi | Deteksi 000412162025, lalu simpan sebagai riwayat |
| US-09.2 Indikasi ditindaklanjuti | Deteksi 000437162025, simpan, lalu Pimpinan Validasi dan Simpan Tindak Lanjut |
| US-09.3 Indikasi ditolak | Seperti US-09.2, lalu Pimpinan Tolak Temuan (Diabaikan) |
| US-09.4 Putusan tidak tersedia | Deteksi 000389152025 |
| US-09.5 Pembanding tidak tersedia | Deteksi 000377152025 |
| US-09.6 Data tidak mencukupi | Deteksi 000365152025 |
| US-09.7 Gagal disimpan | Deteksi 000351152025; simpan pertama gagal, Simpan Ulang berhasil |

Pemicu skenario disimpan pada kolom `perkara.kondisi_analisis`, `putusan.dokumen_tersedia`, dan `putusan.ocr_berhasil`. Jalankan ulang `database/siproperti_local.sql` untuk mengembalikan data awal.

## ERD

Gambar relasi tabel ada di `docs/erd/siproperti-erd.png`. Untuk membuat ulang:

```powershell
cd tools
npm install
node generate-erd.mjs
```

## Struktur

- `backend/` — API Express 5 (auth JWT, perkara, prediksi, analisis, evaluasi, ChatAI, disparitas, audit)
- `frontend/` — SPA React 19 + Vite, tampilan TC One
- `database/siproperti_local.sql` — `CREATE TABLE` dan `INSERT` data dummy
- `docs/erd/siproperti-erd.png` — ERD

Koneksi lokal: `postgres://siproperti:siproperti@localhost:5432/siproperti` (lihat `backend/.env.example`).

Untuk mengosongkan basis data Docker dan memuat ulang skrip:

```powershell
docker compose down -v
docker compose up -d
```
