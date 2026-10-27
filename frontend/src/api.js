export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('siproperti_token');
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.pesan || 'Terjadi kesalahan');
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function unduhTeks(path, nama) {
  const token = localStorage.getItem('siproperti_token');
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Dokumen gagal diunduh.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}
