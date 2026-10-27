import jwt from 'jsonwebtoken';

export function wajibMasuk(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ pesan: 'Sesi tidak valid. Silakan masuk kembali.' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ pesan: 'Sesi berakhir. Silakan masuk kembali.' });
  }
}

export function peran(...daftar) {
  return (req, res, next) => {
    if (!daftar.includes(req.user.peran)) {
      return res.status(403).json({ pesan: 'Peran Anda tidak berwenang untuk aksi ini.' });
    }
    next();
  };
}

export function penggunaPublik(baris) {
  return {
    id: baris.id,
    nip: baris.nip,
    nama: baris.nama,
    namaSingkat: baris.nama_singkat,
    peran: baris.peran,
    jabatan: baris.jabatan,
    inisial: baris.inisial,
    aplikasi: baris.peran === 'Panitera' ? 'Persidangan' : 'Hakim',
  };
}

export function tokenUntuk(pengguna) {
  return jwt.sign(pengguna, process.env.JWT_SECRET, { expiresIn: '12h' });
}
