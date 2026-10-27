import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast, Disc, Shell } from '../ui.jsx';

const OPSI = [
  ['SETUJU', 'Setuju dengan hasil analisis', 'S-1 – Analisis relevan dan sesuai dengan perkara.'],
  ['TIDAK SETUJU', 'Tidak setuju dengan hasil analisis', 'S-2 – Ada komponen yang tidak relevan atau keliru.'],
  ['TIDAK PERLU', 'Tidak perlu menuliskan evaluasi', 'Proses selesai tanpa menyimpan evaluasi.'],
];

export default function EvaluasiAnalisis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useAuth();
  const komponen = meta?.komponenAnalisis || [];
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [nilai, setNilai] = useState({});
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState('');

  useEffect(() => { api(`/prediksi/${id}/analisis`).then(setData); }, [id]);

  async function simpan() {
    if (status === 'TIDAK PERLU') {
      toast('Proses evaluasi hasil analisis selesai tanpa catatan');
      navigate(`/evaluasi/${id}`);
      return;
    }
    setGalat('');
    try {
      await api('/evaluasi/analisis', {
        method: 'POST',
        body: { prediksiId: id, status, alasan, nilai: komponen.map((_, i) => nilai[i]) },
      });
      toast('Evaluasi hasil analisis tersimpan');
      navigate(`/evaluasi/${id}`);
    } catch (error) {
      setGalat(error.message);
    }
  }

  return (
    <Shell crumb={<>Prediksi Putusan › Evaluasi › <b>Evaluasi Hasil Analisis</b></>}>
      <Disc />
      <div className="g12">
        <div className="box"><div className="bh">Hasil Analisis Prediksi</div><div className="bb">
          <div className="lbl">Ringkasan</div>
          <p style={{ margin: '4px 0 10px' }}>{data?.ringkasan}</p>
          <table><tbody>
            <tr><td>Informasi perkara</td><td>{data?.perkara.jenisPajak}</td></tr>
            <tr><td>Argumen relevan</td><td>{data?.argumen.length || 0} argumen</td></tr>
            <tr><td>Dasar hukum</td><td>{data?.dasarHukum.length || 0} ketentuan</td></tr>
            <tr><td>Putusan pembanding</td><td>{data?.putusanPembanding.length || 0} putusan</td></tr>
            <tr><td>Faktor dominan</td><td>{data?.faktor.length || 0} faktor</td></tr>
          </tbody></table>
        </div></div>
        <div className="box"><div className="bh">Evaluasi Hakim</div>
          <div className="bb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="opt">{OPSI.map(([kode, judul, teks]) => (
              <label key={kode} className={status === kode ? 'on' : ''}>
                <input type="radio" name="ea" checked={status === kode} onChange={() => { setStatus(kode); setGalat(''); }} />
                <span><b>{judul}</b><small>{teks}</small></span>
              </label>
            ))}</div>
            {status && status !== 'TIDAK PERLU' ? <>
              <div>
                <div className="lbl" style={{ marginBottom: 6 }}>Nilai relevansi tiap komponen (1–5) <span className="req">*</span></div>
                {komponen.map((nama, i) => (
                  <div key={nama} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <span>{nama}</span>
                    <span className="st">{[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} className={nilai[i] === n ? 'on' : ''} onClick={() => setNilai({ ...nilai, [i]: n })}>{n}</button>
                    ))}</span>
                  </div>
                ))}
              </div>
              <label className="f">{status === 'TIDAK SETUJU' ? <>Alasan ketidaksetujuan <span className="req">*</span></> : 'Catatan evaluasi (opsional)'}
                <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} />
              </label>
            </> : null}
            {galat ? <div className="err">{galat}</div> : null}
            <div className="btns">
              <button className="btn bp" disabled={!status} onClick={simpan}>{status === 'TIDAK PERLU' ? 'Selesai' : 'Simpan Evaluasi Analisis'}</button>
              <button className="btn" onClick={() => navigate(`/evaluasi/${id}`)}>Kembali</button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
