import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { persen, waktu } from '../format.js';
import { useAuth } from '../auth.jsx';
import { useToast, Disc, Donut, Icon, Shell } from '../ui.jsx';

const OPSI = [
  ['DITERIMA', 'Terima hasil prediksi', 'S1 – Hasil prediksi dapat diterima sebagai informasi pendukung.', 'p-g'],
  ['DIKOREKSI', 'Koreksi hasil prediksi', 'S2 – Terdapat informasi atau hasil yang perlu dikoreksi.', 'p-b'],
  ['DITOLAK', 'Tolak hasil prediksi', 'S3 – Hasil prediksi tidak dapat digunakan.', 'p-r'],
  ['DITANDAI', 'Tandai untuk ditinjau', 'S4 – Ditandai untuk ditindaklanjuti kemudian.', 'p-o'],
];

export default function Evaluasi() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useAuth();
  const [pred, setPred] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [status, setStatus] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [amarKoreksi, setAmarKoreksi] = useState('Menolak');
  const [bagian, setBagian] = useState('Amar prediksi');
  const [galat, setGalat] = useState('');

  function muat() {
    api(`/prediksi/${id}`).then(setPred);
    api(`/evaluasi/prediksi/${id}`).then(setRiwayat);
  }
  useEffect(muat, [id]);

  async function simpan() {
    setGalat('');
    try {
      const hasil = await api('/evaluasi/prediksi', {
        method: 'POST',
        body: { prediksiId: id, status, keterangan, amarKoreksi, bagianDikoreksi: bagian },
      });
      setStatus('');
      setKeterangan('');
      muat();
      toast(`Hasil evaluasi tersimpan dengan status ${hasil.status}`);
    } catch (error) {
      setGalat(error.message);
    }
  }

  return (
    <Shell crumb={<>Prediksi Putusan › <b>Evaluasi Hasil Prediksi</b></>}>
      <Disc />
      <div className="g21">
        <div className="box"><div className="bh">Evaluasi Hasil Prediksi – {pred?.perkara.nomorSengketa}</div>
          <div className="bb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pred ? <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#f7f9fb', padding: 10, borderRadius: 3 }}>
              <Donut dist={pred.distribusi.map((d) => d.probabilitas)} size={110} />
              <div><div className="lbl">Hasil prediksi</div><div className="big">{pred.amar}</div><div className="small">Keyakinan {persen(pred.skorKeyakinan)} · {pred.perkara.pokokSengketa}</div></div>
            </div> : null}
            <div className="lbl">Tentukan hasil evaluasi</div>
            <div className="opt">
              {OPSI.map(([kode, judul, teks, warna]) => (
                <label key={kode} className={status === kode ? 'on' : ''}>
                  <input type="radio" name="ev" checked={status === kode} onChange={() => { setStatus(kode); setGalat(''); }} />
                  <span><b>{judul}</b> <span className={`pill ${warna}`}>{kode}</span><small>{teks}</small></span>
                </label>
              ))}
            </div>
            {status === 'DIKOREKSI' ? (
              <div className="g2">
                <label className="f">Amar menurut koreksi Hakim <span className="req">*</span>
                  <select value={amarKoreksi} onChange={(e) => setAmarKoreksi(e.target.value)}>{(meta?.kategoriAmar || []).map((a) => <option key={a}>{a}</option>)}</select>
                </label>
                <label className="f">Bagian yang dikoreksi
                  <select value={bagian} onChange={(e) => setBagian(e.target.value)}><option>Amar prediksi</option><option>Informasi perkara</option><option>Faktor dominan</option></select>
                </label>
              </div>
            ) : null}
            {status ? <label className="f">{status === 'DITOLAK' ? 'Alasan penolakan' : status === 'DIKOREKSI' ? 'Koreksi yang diberikan' : 'Keterangan'} {(status === 'DITOLAK' || status === 'DIKOREKSI') ? <span className="req">*</span> : '(opsional)'}
              <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
            </label> : null}
            {galat ? <div className="err">{galat}</div> : null}
            <div className="btns">
              <button className="btn bp" disabled={!status} onClick={simpan}>Simpan Evaluasi</button>
              <button className="btn" onClick={() => navigate(`/evaluasi/${id}/analisis`)}><Icon name="list" />Evaluasi Hasil Analisis</button>
              <button className="btn" onClick={() => navigate(`/prediksi/${id}`)}>Kembali</button>
            </div>
          </div>
        </div>
        <div className="box"><div className="bh">Riwayat Evaluasi</div><div className="bb">
          {riwayat.length ? riwayat.map((e) => (
            <div key={e.id} style={{ borderBottom: '1px solid #eee', padding: '6px 0' }}>
              <span className={`pill ${{ DITERIMA: 'p-g', DIKOREKSI: 'p-b', DITOLAK: 'p-r', DITANDAI: 'p-o' }[e.status]}`}>{e.status}</span>
              <span className="small"> {waktu(e.dibuatPada)}</span>
              <div style={{ fontSize: 12.5 }}>{e.status === 'DIKOREKSI' ? `Koreksi amar: ${e.amarKoreksi}. ` : ''}{e.keterangan || '–'}</div>
            </div>
          )) : <span className="small">Belum ada evaluasi.</span>}
          <div className="small" style={{ marginTop: 8 }}>Evaluasi yang tersimpan tidak dapat diubah; perubahan pandangan dicatat sebagai evaluasi baru.</div>
        </div></div>
      </div>
    </Shell>
  );
}
