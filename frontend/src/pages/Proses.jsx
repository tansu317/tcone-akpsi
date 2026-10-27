import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Shell } from '../ui.jsx';

export default function Proses() {
  const { perkaraId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { meta } = useAuth();
  const langkah = meta?.langkahPrediksi || [];
  const [posisi, setPosisi] = useState(0);
  const [hasil, setHasil] = useState(null);

  useEffect(() => {
    if (!state?.kunci || !langkah.length) {
      if (!state?.kunci) navigate('/penyelesaian', { replace: true });
      return undefined;
    }
    let indeks = 0;
    let respon = null;
    let selesai = false;
    const timer = setInterval(() => {
      if (selesai) return;
      const batas = respon ? (respon.berhasil ? langkah.length : respon.langkahGagal) : langkah.length;
      if (!respon && indeks >= langkah.length) return;
      if (respon && indeks >= batas) {
        selesai = true;
        clearInterval(timer);
        if (respon.berhasil) navigate(`/prediksi/${respon.prediksiId}`, { replace: true });
        else setHasil(respon);
        return;
      }
      indeks += 1;
      setPosisi(indeks);
    }, 330);
    api('/prediksi/generate', { method: 'POST', body: { perkaraId, kunci: state.kunci } })
      .then((data) => { respon = data; })
      .catch((error) => { respon = { berhasil: false, langkahGagal: 1, pesan: error.message }; });
    return () => { selesai = true; clearInterval(timer); };
  }, [perkaraId, state?.kunci, langkah.length, navigate]);

  const gagalPada = hasil && !hasil.berhasil ? hasil.langkahGagal : 0;
  return (
    <Shell crumb={<>Penyelesaian › <b>Prediksi Putusan</b></>}>
      <div className="box">
        <div className="bh">Proses Prediksi Putusan</div>
        <div className="bb g21">
          <ol className="steps">
            {langkah.map((nama, i) => {
              let kelas = '';
              if (gagalPada) kelas = i + 1 < gagalPada ? 'd' : i + 1 === gagalPada ? 'f' : 'sk';
              else if (i + 1 < posisi) kelas = 'd';
              else if (i + 1 === posisi) kelas = 'r';
              return <li key={nama} className={kelas}><span className="c">{kelas === 'd' ? '✓' : kelas === 'f' ? '!' : i + 1}</span>{nama}</li>;
            })}
          </ol>
          <div>
            {hasil && !hasil.berhasil ? (
              <>
                <Alert jenis="d">{hasil.pesan}</Alert>
                <div className="btns" style={{ marginTop: 12 }}><button className="btn bp" onClick={() => navigate('/penyelesaian')}>Kembali ke Daftar</button></div>
              </>
            ) : (
              <>
                <div className="lbl">Status</div>
                <div className="prog"><i style={{ width: `${(posisi / (langkah.length || 1)) * 100}%` }} /></div>
                <div className="small">Langkah {Math.min(posisi + 1, langkah.length || 1)} dari {langkah.length}. Mohon tunggu, proses maksimal 30 detik.</div>
                <Alert>Identitas para pihak dianonimkan sebelum diproses oleh model.</Alert>
              </>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
