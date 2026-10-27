import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { koma } from '../format.js';
import { Alert, Disc, Icon, Shell } from '../ui.jsx';

export default function Banding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api(`/prediksi/${id}`).then(setData); }, [id]);
  const daftar = data?.putusanSejenis || [];
  return (
    <Shell crumb={<>Prediksi Putusan › <b>Bandingkan Putusan Sejenis</b></>}>
      <Disc />
      <div className="box">
        <div className="bh">Daftar Putusan Relevan – {data?.perkara.nomorSengketa}</div>
        <div className="bb">
          {data && !daftar.length ? <Alert jenis="w"><b>Tidak ada putusan sejenis yang memenuhi ambang batas kemiripan.</b> Proses perbandingan dihentikan.</Alert> : null}
          <table><thead><tr><th>No. Putusan</th><th>Amar Putusan</th><th>Persentase Kemiripan</th><th>Alasan Kemiripan</th><th>Aksi</th></tr></thead>
            <tbody>
              {daftar.map((item) => (
                <tr key={item.id}>
                  <td>{item.nomor}</td><td>{item.amar}</td>
                  <td><b>{koma(item.kemiripan)}%</b><div className="bar" style={{ width: 90, marginTop: 3 }}><i style={{ width: `${item.kemiripan}%` }} /></div></td>
                  <td className="small">{item.alasan}</td>
                  <td><button className="btn bp" onClick={() => navigate(`/banding/${id}/putusan/${item.id}`)}><Icon name="eye" />Lihat & Bandingkan</button></td>
                </tr>
              ))}
              {data && !daftar.length ? <tr><td colSpan="5" className="small">Tidak ada data</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <button className="btn" onClick={() => navigate(`/prediksi/${id}`)}>Kembali ke Hasil Prediksi</button>
    </Shell>
  );
}
