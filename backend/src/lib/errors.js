export function bad(pesan, status = 400) {
  const error = new Error(pesan);
  error.status = status;
  return error;
}

export function angka(nilai) {
  if (nilai == null) return null;
  return Number(nilai);
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(nilai, nama = 'ID') {
  if (!POLA_UUID.test(nilai || '')) throw bad(`${nama} tidak valid.`);
  return nilai;
}
