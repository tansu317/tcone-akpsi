import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, unduhTeks } from '../api.js';
import { Alert, Disc, Icon, Shell } from '../ui.jsx';

export default function Dokumen() {
  const { id, putusanId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  useEffect(() => {
    api(`/prediksi/${id}/pembanding/${putusanId}`).then(setData).catch((e) => setGalat(e.message));
  }, [id, putusanId]);

  return (
    <Shell crumb={<>Prediksi Putusan › Bandingkan › <b>Dokumen Putusan</b></>}>
      <Disc />
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      {data ? (
        <div className="g12">
          <div className="box">
            <div className="bh">{data.nomorPutusan.split(' ')[0]}
              <button className="btn" onClick={() => unduhTeks(`/prediksi/putusan/${putusanId}/unduh`, 'putusan.txt')}><Icon name="dl" /></button>
            </div>
            <div className="bb">
              <div className="small" style={{ marginBottom: 6 }}><span style={{ background: 'var(--hl)', padding: '0 4px' }}>■</span> Amar &nbsp; <span style={{ background: 'var(--hl2)', padding: '0 4px' }}>■</span> Pertimbangan hukum</div>
              <div className="doc">
                <h4>PUTUSAN<br />Nomor {data.nomorPutusan}</h4>
                <p><b>DUDUK PERKARA.</b> {data.dudukPerkara}</p>
                <p><b>PERTIMBANGAN HUKUM.</b> <mark className="p">{data.pertimbangan}</mark></p>
                <p><b>MENGADILI.</b> <mark className="a">{data.amarTeks}</mark></p>
              </div>
            </div>
          </div>
          <div className="box">
            <div className="bh">Perbandingan dengan Perkara {data.nomorSengketa}</div>
            <div className="bb">
              <table><thead><tr><th>Aspek</th><th>Perkara dianalisis</th><th>Putusan pembanding</th></tr></thead>
                <tbody>{data.aspek.map((a) => (
                  <tr key={a.aspek} style={a.berbeda ? { background: '#fff6e5' } : undefined}>
                    <td><b>{a.aspek}</b></td><td>{a.perkara}</td><td>{a.pembanding}</td>
                  </tr>
                ))}</tbody>
              </table>
              {data.catatanPerbedaan ? <div style={{ marginTop: 10 }}><Alert><b>Perbedaan utama:</b> {data.catatanPerbedaan}</Alert></div> : null}
            </div>
          </div>
        </div>
      ) : <div className="small">Memuat dokumen...</div>}
      <button className="btn" onClick={() => navigate(`/banding/${id}`)}>Kembali ke Daftar Putusan</button>
    </Shell>
  );
}
