import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { persen } from '../format.js';
import { useAuth } from '../auth.jsx';
import { Alert, Icon, Shell } from '../ui.jsx';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setGalat(e.message));
  }, []);

  return (
    <Shell crumb={<b>Home</b>}>
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      {data ? (
        <div className="g4">
          {data.kartu.map(([angka, judul, warna]) => (
            <div className="sb" style={{ background: warna }} key={judul}>
              <div><div className="n">{angka}</div><div className="t">{judul}</div></div>
            </div>
          ))}
        </div>
      ) : <div className="small">Memuat ringkasan...</div>}
      {user.peran === 'Panitera' ? (
        <div className="box"><div className="bh">Tugas Prediksi Putusan</div><div className="bb">
          <Alert>Terdapat sengketa gugatan berstatus <b>Belum Ucap</b> yang siap diprediksi. Buka menu <b>Penyelesaian</b> lalu pilih sengketa dan klik ikon <b>Prediksi Putusan</b>.</Alert>
          <div className="btns" style={{ marginTop: 10 }}><button className="btn bp" onClick={() => navigate('/penyelesaian')}><Icon name="pred" />Buka Penyelesaian</button></div>
        </div></div>
      ) : null}
      {user.peran === 'Hakim' && data ? (
        <div className="box"><div className="bh">Prediksi Menunggu Telaah Anda</div><div className="bb">
          <table><thead><tr><th>No. Sengketa</th><th>Nama Pemohon</th><th>Amar Prediksi</th><th>Keyakinan</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.menunggu?.length ? data.menunggu.map((item) => (
                <tr key={item.id}><td>{item.nomorSengketa}</td><td>{item.namaPemohon}</td><td>{item.amar}</td><td>{persen(item.skorKeyakinan)}</td>
                  <td><button className="btn bp" onClick={() => navigate(`/prediksi/${item.id}`)}><Icon name="eye" />Lihat</button></td></tr>
              )) : <tr><td colSpan="5" className="small">Tidak ada prediksi yang menunggu telaah.</td></tr>}
            </tbody>
          </table>
        </div></div>
      ) : null}
      {user.peran === 'Pimpinan' ? (
        <div className="box"><div className="bh">Konsistensi Putusan</div><div className="bb">
          <Alert>Gunakan menu <b>Deteksi Disparitas</b> untuk memeriksa keselarasan amar putusan yang sedang ditangani dengan putusan-putusan sejenis. Indikator disparitas tidak digunakan untuk menilai kinerja individu hakim.</Alert>
          <div className="btns" style={{ marginTop: 10 }}>
            <button className="btn bp" onClick={() => navigate('/disparitas')}><Icon name="scale" />Deteksi Disparitas</button>
            <button className="btn" onClick={() => navigate('/laporan')}><Icon name="flag" />Laporan Disparitas</button>
          </div>
        </div></div>
      ) : null}
    </Shell>
  );
}
