import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { persen, waktu } from '../format.js';
import { Icon, Pager, Shell } from '../ui.jsx';

export function Riwayat() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api('/prediksi/riwayat').then(setRows); }, []);
  const tampil = rows.filter((r) => `${r.kode} ${r.nomorSengketa} ${r.amar || ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell crumb={<b>Riwayat Prediksi</b>}>
      <div className="box"><div className="bh">Riwayat Prediksi Putusan</div><div className="bb">
        <div className="dtc"><span>Search: <input value={q} onChange={(e) => setQ(e.target.value)} /></span></div>
        <table><thead><tr><th>ID Prediksi</th><th>No. Sengketa</th><th>Amar Prediksi</th><th>Keyakinan</th><th>Waktu</th><th>Dibuat oleh</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{tampil.map((p) => (
            <tr key={p.id}><td>{p.kode}</td><td>{p.nomorSengketa}</td><td>{p.amar || '–'}</td><td>{p.skorKeyakinan == null ? '–' : persen(p.skorKeyakinan)}</td><td>{waktu(p.dibuatPada)}</td><td>{p.pembuat}</td>
              <td><span className={`pill ${p.status === 'Aktif' || p.status === 'Dievaluasi' ? 'p-g' : 'p-x'}`}>{p.status}</span></td>
              <td><button className="btn bp" onClick={() => navigate(`/prediksi/${p.id}`)}><Icon name="eye" /></button></td></tr>
          ))}</tbody>
        </table>
        <Pager n={tampil.length} />
      </div></div>
    </Shell>
  );
}

export function EvaluasiSaya() {
  const [data, setData] = useState({ evaluasi: [], feedback: [] });
  useEffect(() => { api('/evaluasi/saya').then(setData); }, []);
  return (
    <Shell crumb={<b>Evaluasi & Feedback</b>}>
      <div className="g2">
        <div className="box"><div className="bh">Evaluasi Hasil Prediksi</div><div className="bb">
          <table><thead><tr><th>Prediksi</th><th>Status</th><th>Waktu</th></tr></thead>
            <tbody>{data.evaluasi.length ? data.evaluasi.map((e) => <tr key={e.dibuatPada + e.status}><td>{e.prediksi}</td><td>{e.status}</td><td>{waktu(e.dibuatPada)}</td></tr>) : <tr><td colSpan="3" className="small">Belum ada</td></tr>}</tbody>
          </table>
        </div></div>
        <div className="box"><div className="bh">Feedback ChatAI</div><div className="bb">
          <table><thead><tr><th>Prediksi</th><th>Jenis</th><th>Rating</th><th>Status</th></tr></thead>
            <tbody>{data.feedback.length ? data.feedback.map((f) => <tr key={f.dibuatPada}><td>{f.prediksi}</td><td>{f.jenis}</td><td>{f.rating}/5</td><td>{f.status}</td></tr>) : <tr><td colSpan="4" className="small">Belum ada</td></tr>}</tbody>
          </table>
        </div></div>
      </div>
    </Shell>
  );
}

export function SesiChat() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/chat/sesi').then(setRows); }, []);
  return (
    <Shell crumb={<b>Sesi ChatAI</b>}>
      <div className="box"><div className="bh">Riwayat Sesi ChatAI</div><div className="bb">
        <table><thead><tr><th>Sesi</th><th>Prediksi</th><th>Mulai</th><th>Jumlah pesan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{rows.length ? rows.map((c) => (
            <tr key={c.id}><td>{c.kode}</td><td>{c.prediksi}</td><td>{waktu(c.mulaiPada)}</td><td>{c.jumlahPesan}</td><td>{c.status}</td>
              <td><button className="btn bp" onClick={() => navigate(`/chat/${c.prediksiId}`)}>Buka Kembali</button></td></tr>
          )) : <tr><td colSpan="6" className="small">Belum ada sesi</td></tr>}</tbody>
        </table>
      </div></div>
    </Shell>
  );
}

export function Audit() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { api(`/audit?q=${encodeURIComponent(q)}`).then(setRows); }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Shell crumb={<b>Jejak Audit</b>}>
      <div className="box"><div className="bh">Jejak Audit (tidak dapat diubah)</div><div className="bb">
        <div className="dtc"><span>Search: <input value={q} onChange={(e) => setQ(e.target.value)} /></span></div>
        <table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Objek</th></tr></thead>
          <tbody>{rows.map((a, i) => <tr key={i}><td>{waktu(a.waktu)}</td><td>{a.pengguna}</td><td>{a.aksi}</td><td>{a.objek}</td></tr>)}</tbody>
        </table>
        <Pager n={rows.length} />
      </div></div>
    </Shell>
  );
}
