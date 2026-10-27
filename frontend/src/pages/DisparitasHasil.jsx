import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { koma } from '../format.js';
import { useToast, Alert, Shell } from '../ui.jsx';

export default function DisparitasHasil() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const awal = state?.hasil;
  const [simpan, setSimpan] = useState(null);
  const [gagal, setGagal] = useState('');
  if (!awal) return <Navigate to="/disparitas" replace />;
  if (awal.mode === 'berhenti') {
    return (
      <Shell crumb={<>Deteksi Disparitas › <b>Hasil Deteksi</b></>}>
        <Alert jenis={awal.peringatan ? 'w' : 'd'}>{awal.pesan}</Alert>
        <button className="btn bp" onClick={() => navigate('/disparitas')}>Kembali ke Parameter</button>
      </Shell>
    );
  }
  const total = awal.total || 1;
  async function simpanHasil() {
    const data = await api('/disparitas/simpan', { method: 'POST', body: { perkaraId: awal.perkaraId } });
    if (!data.tersimpan) {
      setGagal(data.pesan);
      return;
    }
    setGagal('');
    setSimpan(data.laporan);
    toast(data.laporan.adaIndikasi ? 'Laporan disparitas tersimpan. Status Menunggu Peninjauan' : 'Hasil deteksi disimpan sebagai riwayat analisis');
  }
  return (
    <Shell crumb={<>Deteksi Disparitas › <b>Hasil Deteksi</b></>}>
      <div className="g12">
        <div className="box"><div className="bh">Hasil Deteksi Disparitas – {awal.nomorSengketa}</div>
          <div className="bb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {awal.adaIndikasi
              ? <Alert jenis="w"><b>Terdapat indikasi disparitas.</b> Amar draf <b>{awal.amarDraf}</b> berbeda dengan {awal.berbeda} dari {awal.total} putusan sejenis.</Alert>
              : <Alert jenis="s"><b>Tidak terdapat indikasi disparitas.</b> Amar draf <b>{awal.amarDraf}</b> selaras dengan mayoritas putusan sejenis.</Alert>}
            <dl className="kv">
              <dt>Indeks disparitas</dt><dd style={{ color: awal.adaIndikasi ? '#dd4b39' : '#00a65a' }}>{koma(awal.indeks)}</dd>
              <dt>Ambang batas</dt><dd>{koma(awal.ambang)}</dd>
              <dt>Putusan sejenis</dt><dd>{awal.total} putusan</dd>
            </dl>
            <div className="gauge"><b style={{ left: `${awal.ambang * 100}%` }} /><i style={{ left: `${awal.indeks * 100}%` }} /></div>
            <div className="small">Garis merah = ambang batas; garis hitam = indeks perkara.</div>
            {gagal ? <Alert jenis="d">{gagal}</Alert> : null}
            <div className="btns">
              {simpan ? <>
                <span className="pill p-g">Tersimpan {simpan.kode}</span>
                {simpan.adaIndikasi ? <button className="btn bp" onClick={() => navigate(`/laporan/${simpan.id}`)}>Buka Laporan Disparitas</button> : null}
              </> : <button className="btn bp" onClick={simpanHasil}>{gagal ? 'Simpan Ulang' : 'Simpan Hasil Deteksi'}</button>}
              <button className="btn" onClick={() => navigate('/disparitas')}>Kembali</button>
            </div>
          </div>
        </div>
        <div className="box"><div className="bh">Sebaran Amar Putusan Sejenis</div><div className="bb">
          {awal.sebaran.filter((s) => s.jumlah).map((s) => (
            <div key={s.amar} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 28px', gap: 8, alignItems: 'center', fontSize: 12.5, marginBottom: 6 }}>
              <span>{s.amar}{s.amar === awal.amarDraf ? <b> (draf)</b> : ''}</span>
              <div className="bar"><i style={{ width: `${(s.jumlah / total) * 100}%`, background: s.amar === awal.amarDraf ? '#dd4b39' : '#3c8dbc' }} /></div>
              <b>{s.jumlah}</b>
            </div>
          ))}
          <table style={{ marginTop: 8 }}><thead><tr><th>Putusan terkait</th><th>Amar</th><th>Majelis</th></tr></thead>
            <tbody>{awal.putusanTerkait.map((p) => <tr key={p.nomor}><td>{p.nomor.split(' ')[0]}</td><td>{p.amar}</td><td>{p.majelis}</td></tr>)}</tbody>
          </table>
        </div></div>
      </div>
    </Shell>
  );
}
