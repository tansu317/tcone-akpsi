-- Jalankan sekali sebagai superuser, terhubung ke database "postgres"
-- (bukan ke database siproperti). Lewati perintah yang sudah pernah berhasil.
--
--   psql -U postgres -f database/00_buat_database.sql
--
-- Setelah itu jalankan database/siproperti_local.sql pada database siproperti.
-- Jika memakai Docker Compose di akar proyek, berkas ini tidak diperlukan:
-- container membuat role, database, tabel, dan data dummy sendiri.

CREATE ROLE siproperti LOGIN PASSWORD 'siproperti';
CREATE DATABASE siproperti OWNER siproperti;
