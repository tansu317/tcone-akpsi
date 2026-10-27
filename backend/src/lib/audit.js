import { query } from '../db.js';

export async function catat(user, aksi, objek, client) {
  const jalankan = client ? client.query.bind(client) : query;
  await jalankan(
    `INSERT INTO jejak_audit (pengguna_id, nama_pengguna, aksi, objek)
     VALUES ($1, $2, $3, $4)`,
    [user.id, user.nama, aksi, objek],
  );
}
