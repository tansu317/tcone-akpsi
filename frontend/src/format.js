function bagian(nilai, tipe) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(tipe === 'waktu' ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).formatToParts(new Date(nilai));
}

function ambil(parts, tipe) {
  return parts.find((p) => p.type === tipe)?.value;
}

export function tgl(nilai) {
  if (!nilai) return '–';
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '–';
  const p = bagian(nilai);
  return `${ambil(p, 'day')}-${ambil(p, 'month')}-${ambil(p, 'year')}`;
}

export function waktu(nilai) {
  if (!nilai) return '–';
  const p = bagian(nilai, 'waktu');
  return `${ambil(p, 'day')}-${ambil(p, 'month')}-${ambil(p, 'year')} ${ambil(p, 'hour')}:${ambil(p, 'minute')}`;
}

export function rupiah(nilai) {
  return `Rp${Number(nilai || 0).toLocaleString('id-ID')}`;
}

export function persen(nilai, digit = 2) {
  return `${(Number(nilai) * 100).toFixed(digit).replace('.', ',')}%`;
}

export function koma(nilai, digit = 2) {
  return Number(nilai).toFixed(digit).replace('.', ',');
}
