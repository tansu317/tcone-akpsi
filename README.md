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

## Data uji alur alternatif

| Nomor sengketa | Perilaku |
| --- | --- |
| 000437162025 | Sudah memiliki prediksi aktif PRD-437-v1 |
| 000517162025 | Sengketa tidak tersedia di Tax Court One |
| 000502162025 | Data perkara tidak ditemukan saat generate |
| 000451162025 | Dokumen perkara belum lengkap |
| 000468162025 | Putusan sejenis terbatas |
| 000489162025 | Tidak ada putusan sejenis |
| 000389152025 | Deteksi disparitas: putusan tidak tersedia |
| 000377152025 | Deteksi disparitas: pembanding tidak tersedia |
| 000365152025 | Deteksi disparitas: data tidak mencukupi |
| 000351152025 | Indikasi disparitas; simpan pertama gagal, simpan ulang berhasil |

Pada ChatAI, pertanyaan yang memuat kata `cuaca`, `olahraga`, atau `resep` menghasilkan jawaban tanpa rujukan.

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
