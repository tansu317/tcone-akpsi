import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { koma, waktu } from '../format.js';
import { useToast, Alert, Icon, Pager, Shell } from '../ui.jsx';

const WARNA = {
  'Menunggu Peninjauan': 'p-o',
  Terkonfirmasi: 'p-b',
  Ditindaklanjuti: 'p-g',
  Diabaikan: 'p-x',
  'Tidak Ada Indikasi': 'p-t',
};
const ALUR = ['Dideteksi', 'Menunggu Peninjauan', 'Terkonfirmasi', 'Ditindaklanjuti'];

export default function Laporan({ detail }) {
  return detail ? <Detail /> : <Daftar />;
}

function Daftar() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api('/disparitas/laporan').then(setRows); }, []);
  const tampil = rows.filter((r) => `${r.kode} ${r.nomorSengketa} ${r.namaPemohon}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell crumb={<b>Laporan Disparitas</b>}>
      <div className="box"><div className="bh">Riwayat Laporan Disparitas</div><div className="bb">
        <div className="dtc"><span>Search: <input value={q} onChange={(e) => setQ(e.target.value)} /></span></div>
        <table><thead><tr><th>ID Laporan</th><th>No. Sengketa</th><th>Nama Pemohon</th><th>Indeks</th><th>Tanggal Deteksi</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {tampil.map((l) => (
              <tr key={l.id}><td>{l.kode}</td><td>{l.nomorSengketa}</td><td>{l.namaPemohon}</td><td>{koma(l.indeks)}</td><td>{waktu(l.terdeteksiPada)}</td>
                <td><span className={`pill ${WARNA[l.status]}`}>{l.status}</span></td>
                <td>{l.adaIndikasi ? <button className="btn bp" onClick={() => navigate(`/laporan/${l.id}`)}><Icon name="eye" />Tinjau</button> : null}</td></tr>
            ))}
            {!tampil.length ? <tr><td colSpan="7" className="small">Belum ada laporan disparitas</td></tr> : null}
          </tbody>
        </table>
        <Pager n={tampil.length} />
      </div></div>
    </Shell>
  );
}

function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [catatan, setCatatan] = useState('Dibahas dalam rapat pleno hakim untuk menyamakan pendekatan pembuktian unsur kekhilafan pada sengketa Pasal 36 KUP.');
  const [galat, setGalat] = useState('');

  function muat() { api(`/disparitas/laporan/${id}`).then(setData); }
  useEffect(muat, [id]);

  async function ubah(status) {
    setGalat('');
    try {
      setData(await api(`/disparitas/laporan/${id}`, { method: 'PATCH', body: { status, catatan } }));
      toast(`Status laporan menjadi ${status}`);
    } catch (error) {
      setGalat(error.message);
    }
  }

  if (!data) return <Shell crumb="Laporan">Memuat laporan...</Shell>;
  return (
    <Shell crumb={<>Laporan Disparitas › <b>{data.kode}</b></>}>
      <div className="box"><div className="bh">Status Laporan {data.kode}</div><div className="bb"><div className="tl">
        {ALUR.map((f) => <span key={f} className={data.status === f ? 'on' : data.riwayat.includes(f) ? 'pa' : ''}>{f}</span>)}
        {data.status === 'Diabaikan' ? <span className="x">Diabaikan</span> : null}
      </div></div></div>
      <div className="g12">
        <div className="box"><div className="bh">Temuan Disparitas – {data.nomorSengketa}</div><div className="bb">
          <dl className="kv">
            <dt>Nama Pemohon</dt><dd>{data.namaPemohon}</dd>
            <dt>Amar draf putusan</dt><dd>{data.amarDraf}</dd>
            <dt>Indeks disparitas</dt><dd style={{ color: '#dd4b39' }}>{koma(data.indeks)} (ambang 0,60)</dd>
            <dt>Putusan sejenis</dt><dd>{data.jumlahSejenis} putusan; {data.jumlahBerbeda} beramar berbeda</dd>
            <dt>Tanggal deteksi</dt><dd>{waktu(data.terdeteksiPada)}</dd>
          </dl>
          <table style={{ marginTop: 10 }}><thead><tr><th>Putusan terkait</th><th>Majelis</th><th>Amar</th></tr></thead>
            <tbody>{data.putusan.map((p) => <tr key={p.nomor}><td>{p.nomor.split(' ')[0]}</td><td>{p.majelis}</td><td>{p.amar}</td></tr>)}</tbody>
          </table>
          <div className="small" style={{ marginTop: 6 }}>Nama majelis disamarkan pada tampilan agregat.</div>
        </div></div>
        <div className="box"><div className="bh">Peninjauan Pimpinan</div><div className="bb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.status === 'Menunggu Peninjauan' ? <div className="btns">
            <button className="btn bs" onClick={() => ubah('Terkonfirmasi')}>Validasi Temuan</button>
            <button className="btn bd" onClick={() => ubah('Diabaikan')}>Tolak Temuan</button>
          </div> : null}
          {data.status === 'Terkonfirmasi' ? <>
            <label className="f">Catatan resolusi / tindak lanjut <span className="req">*</span><textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>
            <button className="btn bp" onClick={() => ubah('Ditindaklanjuti')}>Simpan Tindak Lanjut</button>
          </> : null}
          {data.status === 'Ditindaklanjuti' ? <Alert jenis="s"><b>Ditindaklanjuti.</b> {data.catatan}</Alert> : null}
          {data.status === 'Diabaikan' ? <Alert>Temuan ditolak oleh Pimpinan. Status laporan <b>Diabaikan</b> dan disimpan sebagai riwayat analisis.</Alert> : null}
          {galat ? <div className="err">{galat}</div> : null}
        </div></div>
      </div>
      <button className="btn" onClick={() => navigate('/laporan')}>Kembali ke Daftar Laporan</button>
    </Shell>
  );
}
