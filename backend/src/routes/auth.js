import { Router } from 'express';
import { query } from '../db.js';
import { catat } from '../lib/audit.js';
import { bad } from '../lib/errors.js';
import { penggunaPublik, tokenUntuk, wajibMasuk } from '../middleware/auth.js';

const router = Router();

router.post('/masuk', async (req, res) => {
  const nip = String(req.body?.nip || '').trim();
  const kataSandi = String(req.body?.kataSandi || '');
  if (!nip || !kataSandi) throw bad('NIP dan kata sandi wajib diisi.');

  const { rows } = await query(
    `SELECT id, nip, nama, nama_singkat, peran, jabatan, inisial
     FROM pengguna
     WHERE nip = $1 AND aktif = true AND password_hash = crypt($2, password_hash)`,
    [nip, kataSandi],
  );
  if (!rows[0]) throw bad('NIP atau kata sandi tidak sesuai.', 401);

  const pengguna = penggunaPublik(rows[0]);
  await catat(pengguna, 'Login SSO Kemenkeu', '-');
  res.json({ token: tokenUntuk(pengguna), pengguna });
});

router.get('/saya', wajibMasuk, (req, res) => {
  res.json(req.user);
});

router.post('/keluar', wajibMasuk, async (req, res) => {
  await catat(req.user, 'Keluar', '-');
  res.json({ ok: true });
});

export default router;
