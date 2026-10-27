import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon, Pager, Shell } from '../ui.jsx';

export default function Disparitas() {
  const navigate = useNavigate();
  const [param, setParam] = useState(null);
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/disparitas/parameter').then(setParam);
  }, []);
  useEffect(() => {
    if (!param) return;
    api(`/disparitas/target?jenisPajak=${encodeURIComponent(param.jenisPajak)}`).then(setRows);
  }, [param?.jenisPajak]);

  const tampil = rows.filter((r) => `${r.nomorSengketa} ${r.namaPemohon}`.toLowerCase().includes(q.toLowerCase()));

  async function jalankan() {
    const hasil = await api('/disparitas/deteksi', {
      method: 'POST',
      body: {
        perkaraId: sel,
        parameter: {
          periodeDari: param.periodeDari,
          periodeSampai: param.periodeSampai,
          jenisPajak: param.jenisPajak,
          ambang: Number(param.ambang),
          minimum: Number(param.minimum),
        },
      },
    });
    navigate('/disparitas/hasil', { state: { hasil } });
  }

  return (
    <Shell crumb={<b>Deteksi Disparitas Putusan</b>}>
      <div className="box"><div className="bh">Parameter Deteksi</div>
        <div className="bb" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="f">Periode putusan sejenis dari<input type="month" value={String(param?.periodeDari || '').slice(0, 7)} onChange={(e) => setParam({ ...param, periodeDari: `${e.target.value}-01` })} /></label>
          <label className="f">sampai<input type="month" value={String(param?.periodeSampai || '').slice(0, 7)} onChange={(e) => setParam({ ...param, periodeSampai: `${e.target.value}-01` })} /></label>
          <label className="f">Jenis pajak<select value={param?.jenisPajak || 'Semua'} onChange={(e) => setParam({ ...param, jenisPajak: e.target.value })}><option>Semua</option><option>PPN</option><option>Pabean</option><option>PPh Pasal 23</option><option>PPh Badan</option></select></label>
          <label className="f">Ambang batas indeks<input type="number" step="0.05" style={{ width: 110 }} value={param?.ambang ?? 0.6} onChange={(e) => setParam({ ...param, ambang: e.target.value })} /></label>
          <label className="f">Minimum putusan sejenis<input type="number" style={{ width: 90 }} value={param?.minimum ?? 10} onChange={(e) => setParam({ ...param, minimum: e.target.value })} /></label>
        </div>
      </div>
      <div className="box"><div className="bh">Putusan yang Sedang Ditangani</div><div className="bb">
        <div className="dtc"><span>Search: <input value={q} onChange={(e) => setQ(e.target.value)} /></span></div>
        <table><thead><tr><th></th><th>No. Sengketa</th><th>Nama Pemohon</th><th>Jenis Pajak</th><th>Majelis</th><th>Amar Draf Putusan</th><th>Putusan Sejenis</th></tr></thead>
          <tbody>{tampil.map((d) => (
            <tr key={d.id} className={`clk ${sel === d.id ? 'sel' : ''}`} onClick={() => setSel(d.id)}>
              <td><input type="radio" checked={sel === d.id} readOnly /></td>
              <td>{d.nomorSengketa}</td><td>{d.namaPemohon}</td><td>{d.jenisPajak}</td><td>{d.majelis}</td><td>{d.amarDraf}</td><td>{d.jumlahSejenis}</td>
            </tr>
          ))}</tbody>
        </table>
        <Pager n={tampil.length} />
        <div className="btns" style={{ marginTop: 10 }}><button className="btn bp" disabled={!sel} onClick={jalankan}><Icon name="scale" />Deteksi Disparitas</button></div>
      </div></div>
    </Shell>
  );
}
