import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { koma, persen, rupiah } from '../format.js';
import { Alert, Disc, Shell } from '../ui.jsx';

function Kotak({ judul, children }) {
  return <div className="box"><div className="bh">{judul}</div><div className="bb">{children}</div></div>;
}

export default function Analisis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  useEffect(() => { api(`/prediksi/${id}/analisis`).then(setData).catch((e) => setGalat(e.message)); }, [id]);

  return (
    <Shell crumb={<>Prediksi Putusan › <b>Analisis Hasil Prediksi</b></>}>
      <Disc />
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      {!data ? <div className="small">Memuat analisis...</div> : <>
        <div className="g2">
          <Kotak judul="Hasil Prediksi Putusan">
            <div className="lbl">Amar prediksi</div>
            <div className="big">{data.prediksi.amar}</div>
            <div className="small">Skor keyakinan {persen(data.prediksi.skorKeyakinan)} · versi v{data.prediksi.versi} · {data.prediksi.model}</div>
          </Kotak>
          <Kotak judul="Informasi Perkara yang Digunakan">
            <dl className="kv">
              <dt>Nomor Sengketa</dt><dd>{data.perkara.nomorSengketa}</dd>
              <dt>Jenis Pajak / Masa</dt><dd>{data.perkara.jenisPajak} / {data.perkara.masaPajak}</dd>
              <dt>Pokok Sengketa</dt><dd>{data.perkara.pokokSengketa}</dd>
              <dt>Nilai Sengketa</dt><dd>{rupiah(data.perkara.nilaiSengketa)}</dd>
            </dl>
          </Kotak>
        </div>
        <div className="g2">
          <Kotak judul="Argumen yang Relevan">
            {data.argumen.length ? <table><thead><tr><th>Pihak</th><th>Argumen</th></tr></thead><tbody>
              {data.argumen.map((a) => <tr key={a.isi}><td><span className={`pill ${a.pihak === 'Penggugat' ? 'p-b' : 'p-o'}`}>{a.pihak}</span></td><td>{a.isi}</td></tr>)}
            </tbody></table> : <Alert jenis="w">Tidak ada argumen yang relevan.</Alert>}
          </Kotak>
          <Kotak judul="Dasar Hukum yang Berkaitan">
            {data.dasarHukum.length ? data.dasarHukum.map((d) => <p key={d.judul} style={{ margin: '0 0 8px' }}><b>{d.judul}</b><br /><span className="small">{d.isi}</span></p>) : <Alert jenis="w">Tidak ada dasar hukum yang relevan.</Alert>}
          </Kotak>
        </div>
        <div className="g2">
          <Kotak judul="Putusan Relevan sebagai Pembanding">
            {data.putusanPembanding.length ? <table><thead><tr><th>No. Putusan</th><th>Amar</th><th>Kemiripan</th></tr></thead><tbody>
              {data.putusanPembanding.map((p) => <tr key={p.nomor}><td>{p.nomor}</td><td>{p.amar}</td><td>{koma(p.kemiripan)}%</td></tr>)}
            </tbody></table> : <Alert jenis="w">Tidak ada putusan yang relevan.</Alert>}
          </Kotak>
          <Kotak judul="Faktor Dominan Prediksi">
            {data.faktor.map((f) => (
              <div key={f.nama} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 52px', gap: 8, alignItems: 'center', fontSize: 12.5, marginBottom: 6 }}>
                <span>{f.nama}</span>
                <div style={{ position: 'relative', height: 10, background: '#eee', borderRadius: 3 }}>
                  <i style={f.kontribusi > 0
                    ? { position: 'absolute', top: 0, bottom: 0, left: '50%', width: `${f.kontribusi * 220}%`, background: '#00a65a' }
                    : { position: 'absolute', top: 0, bottom: 0, right: '50%', width: `${-f.kontribusi * 220}%`, background: '#dd4b39' }} />
                </div>
                <b style={{ color: f.kontribusi > 0 ? '#00a65a' : '#dd4b39' }}>{f.kontribusi > 0 ? '+' : ''}{f.kontribusi.toFixed(2)}</b>
              </div>
            ))}
          </Kotak>
        </div>
        <Kotak judul="Ringkasan Hasil Analisis"><p style={{ margin: 0 }}>{data.ringkasan}</p></Kotak>
        <button className="btn bp" onClick={() => navigate(`/prediksi/${id}`)}>Kembali ke Hasil Prediksi</button>
      </>}
    </Shell>
  );
}
