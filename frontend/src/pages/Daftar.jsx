import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { rupiah, tgl } from '../format.js';
import { useAuth } from '../auth.jsx';
import { Alert, Icon, Pager, Shell } from '../ui.jsx';

export default function Daftar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  const [galat, setGalat] = useState('');
  const panitera = user.peran === 'Panitera';
  const tampil = rows.filter((r) => `${r.nomorSengketa} ${r.namaPemohon} ${r.jenisPajak}`.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    api('/perkara').then(setRows).catch((e) => setGalat(e.message));
  }, []);

  async function pilih(id) {
    try {
      setModal(await api(`/perkara/${id}/pilih`, { method: 'POST' }));
    } catch (error) {
      setGalat(error.message);
    }
  }

  function generate(id) {
    navigate(`/proses/${id}`, { state: { kunci: crypto.randomUUID() } });
  }

  return (
    <Shell crumb={<b>{panitera ? 'Penyelesaian' : 'Penyelesaian Putusan'}</b>}>
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      <div className="box">
        <div className="bh">{panitera ? 'Sengketa Gugatan – Belum Diucap' : 'Daftar Penyelesaian Putusan'}</div>
        <div className="bb">
          {panitera ? (
            <div className="toolbar">
              <button className="ib new" disabled={!sel} onClick={() => pilih(sel)} title="Prediksi Putusan"><Icon name="pred" size={16} /></button>
              <span className="small">Pilih satu baris sengketa, lalu klik ikon Prediksi Putusan.</span>
            </div>
          ) : null}
          <div className="dtc"><span>Show <select defaultValue="10"><option>10</option><option>25</option></select> entries</span>
            <span>Search: <input value={q} onChange={(e) => setQ(e.target.value)} /></span></div>
          <div style={{ overflow: 'auto' }}>
            <table>
              <thead>
                {panitera ? (
                  <tr><th>Nomor Sengketa</th><th>Nama Pemohon</th><th>Jenis Pajak</th><th>PP</th><th>Tanggal Selesai Sidang</th><th>Status</th><th>Prediksi</th><th>Indikator</th></tr>
                ) : (
                  <tr><th>No. Sengketa</th><th>Nama Pemohon</th><th>Hakim</th><th>Majelis</th><th>Posisi</th><th>Tgl. Selesai</th><th>Jenis Pajak</th><th>Status</th><th>Indikator</th><th>Aksi</th></tr>
                )}
              </thead>
              <tbody>
                {tampil.map((s) => panitera ? (
                  <tr key={s.id} className={`clk ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
                    <td>{s.nomorSengketa}</td><td>{s.namaPemohon}</td><td>{s.jenisPajak}</td><td>{s.panitera}</td><td>{tgl(s.tanggalSelesai)}</td><td>{s.statusUcap}</td>
                    <td>{s.prediksi ? <span className="pill p-g">v{s.prediksi.versi} {s.prediksi.status}</span> : <span className="small">–</span>}</td>
                    <td><span className="dot" style={{ background: s.prediksi ? '#00a65a' : '#dd4b39' }} /></td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td>{s.nomorSengketa}</td><td>{s.namaPemohon}</td><td>{s.hakim}</td><td>{s.majelis}</td><td>{s.posisi}</td><td>{tgl(s.tanggalSelesai)}</td><td>{s.jenisPajak}</td><td>{s.statusUcap}</td>
                    <td><span className="dot" style={{ background: s.prediksi ? '#00a65a' : '#dd4b39' }} /></td>
                    <td><button className="linkish" title="Prediksi Putusan" onClick={() => pilih(s.id)}><Icon name="gear" size={17} /></button></td>
                  </tr>
                ))}
                {!tampil.length ? <tr><td colSpan={panitera ? 8 : 10} className="small">Tidak ada data yang sesuai dengan pencarian</td></tr> : null}
              </tbody>
            </table>
          </div>
          <Pager n={tampil.length} />
        </div>
      </div>
      {modal ? (
        <div className="modal">
          <div className="mb">
            <div className="mh2">Konfirmasi Sengketa yang Akan Diprediksi<button className="linkish" onClick={() => setModal(null)}>✕</button></div>
            <div className="mc">
              {!modal.dapatDipilih ? (
                <Alert jenis="d"><b>Sengketa {modal.nomorSengketa} tidak tersedia.</b> Data sengketa tidak ditemukan pada Tax Court One (kemungkinan telah dicabut, dipindahkan majelisnya, atau sudah diucap). Silakan batalkan proses atau pilih sengketa lain.</Alert>
              ) : (
                <>
                  {modal.prediksi ? <Alert>Sengketa ini sudah memiliki prediksi <b>versi {modal.prediksi.versi}</b> ({modal.prediksi.status}). Anda dapat melihat prediksi tersebut atau membuat versi baru tanpa menimpa versi sebelumnya.</Alert> : null}
                  <div className="g2">
                    <dl className="kv">
                      <dt>Nomor Sengketa</dt><dd>{modal.nomorSengketa}</dd>
                      <dt>Jenis Sengketa</dt><dd>{modal.jenisSengketa}</dd>
                      <dt>Jenis Pajak</dt><dd>{modal.jenisPajak}</dd>
                      <dt>Pokok Sengketa</dt><dd>{modal.pokokSengketa}</dd>
                      <dt>Nilai Sengketa</dt><dd>{rupiah(modal.nilaiSengketa)}</dd>
                      <dt>Penggugat</dt><dd>{modal.namaPemohon}</dd>
                      <dt>Majelis</dt><dd>{modal.majelis}</dd>
                    </dl>
                    <div>
                      <div className="lbl" style={{ marginBottom: 6 }}>Dokumen perkara di Tax Court One</div>
                      <ul className="chk">{modal.dokumen.map((d) => <li key={d.jenis}><span className={d.tersedia ? 'ok' : 'no'}>{d.tersedia ? '✔' : '✘'}</span>{d.jenis}</li>)}</ul>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mf">
              <button className="btn" onClick={() => setModal(null)}>Batal</button>
              {modal.dapatDipilih && modal.prediksi ? <button className="btn" onClick={() => navigate(`/prediksi/${modal.prediksi.id}`)}><Icon name="eye" />Lihat Prediksi v{modal.prediksi.versi}</button> : null}
              {modal.dapatDipilih ? <button className="btn bp" onClick={() => generate(modal.id)}><Icon name="pred" />{modal.prediksi ? 'Generate Prediksi Versi Baru' : 'Konfirmasi & Generate Prediksi'}</button> : <button className="btn bp" onClick={() => setModal(null)}>Pilih Sengketa Lain</button>}
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
