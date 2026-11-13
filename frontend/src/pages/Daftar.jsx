import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { rupiah, tgl } from '../format.js';
import { useAuth } from '../auth.jsx';
import { useToast, Alert, Icon, Pager, Shell } from '../ui.jsx';

const FILTER_AWAL = { jenisPajak: '', statusPrediksi: '', kelengkapan: '', tco: '', selesaiDari: '', selesaiSampai: '' };

function StatusPrediksi({ s }) {
  if (s.prediksi) return <span className="pill p-g">v{s.prediksi.versi} {s.prediksi.status}</span>;
  return <span className={`pill ${s.statusSiproperti === 'Gagal' ? 'p-r' : 'p-x'}`}>{s.statusSiproperti}</span>;
}

function Kelengkapan({ s }) {
  return s.kelengkapan === 'lengkap'
    ? <span className="pill p-g">Lengkap</span>
    : <span className="pill p-o">Tidak lengkap</span>;
}

function Tco({ s }) {
  return s.tersediaDiTco
    ? <span className="pill p-b">Tersedia</span>
    : <span className="pill p-r">Tidak tersedia</span>;
}

export default function Daftar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(FILTER_AWAL);
  const [terapan, setTerapan] = useState(FILTER_AWAL);
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  const [galat, setGalat] = useState('');
  const panitera = user.peran === 'Panitera';
  const tampil = rows.filter((r) => `${r.nomorSengketa} ${r.namaPemohon} ${r.jenisPajak}`.toLowerCase().includes(q.toLowerCase()));
  const jumlahFilter = Object.values(terapan).filter(Boolean).length;

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(terapan).filter(([, v]) => v)).toString();
    api(`/perkara${qs ? `?${qs}` : ''}`).then((data) => { setRows(data); setGalat(''); }).catch((e) => setGalat(e.message));
  }, [terapan]);

  async function pilih(id) {
    try {
      setModal(await api(`/perkara/${id}/pilih`, { method: 'POST' }));
    } catch (error) {
      setGalat(error.message);
    }
  }

  async function batal(alasan) {
    const id = modal.id;
    setModal(null);
    if (alasan === 'pilih_lain') setSel(null);
    try {
      const hasil = await api(`/perkara/${id}/batal`, { method: 'POST', body: { alasan } });
      toast(hasil.pesan);
      window.dispatchEvent(new Event('siproperti:notifikasi'));
    } catch (error) {
      setGalat(error.message);
    }
  }

  function generate(id) {
    navigate(`/proses/${id}`, { state: { kunci: crypto.randomUUID() } });
  }

  const ubah = (kunci) => (e) => setFilter({ ...filter, [kunci]: e.target.value });

  return (
    <Shell crumb={<b>{panitera ? 'Penyelesaian' : 'Penyelesaian Putusan'}</b>}>
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      <div className="box">
        <div className="bh">Filter Sengketa{jumlahFilter ? <span style={{ fontSize: 12 }}>{jumlahFilter} filter aktif</span> : null}</div>
        <form className="bb filter" onSubmit={(e) => { e.preventDefault(); setTerapan(filter); }}>
          <label className="f">Jenis pajak
            <select value={filter.jenisPajak} onChange={ubah('jenisPajak')}>
              <option value="">Semua</option><option>PPN</option><option>PPh Pasal 23</option><option>PPh Badan</option><option>Pabean</option>
            </select>
          </label>
          <label className="f">Status prediksi
            <select value={filter.statusPrediksi} onChange={ubah('statusPrediksi')}>
              <option value="">Semua</option><option value="sudah">Sudah diprediksi</option><option value="belum">Belum diprediksi</option>
            </select>
          </label>
          <label className="f">Kelengkapan berkas
            <select value={filter.kelengkapan} onChange={ubah('kelengkapan')}>
              <option value="">Semua</option><option value="lengkap">Lengkap</option><option value="tidak_lengkap">Tidak lengkap</option>
            </select>
          </label>
          <label className="f">Tax Court One
            <select value={filter.tco} onChange={ubah('tco')}>
              <option value="">Semua</option><option value="tersedia">Tersedia</option><option value="tidak">Tidak tersedia</option>
            </select>
          </label>
          <label className="f">Selesai sidang dari<input type="date" value={filter.selesaiDari} onChange={ubah('selesaiDari')} /></label>
          <label className="f">sampai<input type="date" value={filter.selesaiSampai} onChange={ubah('selesaiSampai')} /></label>
          <div className="btns">
            <button className="btn bp" type="submit">Terapkan</button>
            <button className="btn" type="button" onClick={() => { setFilter(FILTER_AWAL); setTerapan(FILTER_AWAL); }}>Reset</button>
          </div>
        </form>
      </div>
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
                  <tr><th>Nomor Sengketa</th><th>Nama Pemohon</th><th>Jenis Pajak</th><th>Masa Pajak</th><th>Panitera Pengganti</th><th>Tgl. Masuk</th><th>Tgl. Selesai Sidang</th><th>Status Ucap</th><th>Kelengkapan Berkas</th><th>Tax Court One</th><th>Status Prediksi</th><th>Indikator</th></tr>
                ) : (
                  <tr><th>No. Sengketa</th><th>Nama Pemohon</th><th>Hakim</th><th>Majelis</th><th>Posisi</th><th>Jenis Pajak</th><th>Masa Pajak</th><th>Panitera Pengganti</th><th>Tgl. Masuk</th><th>Tgl. Selesai</th><th>Kelengkapan Berkas</th><th>Tax Court One</th><th>Status Prediksi</th><th>Indikator</th><th>Aksi</th></tr>
                )}
              </thead>
              <tbody>
                {tampil.map((s) => panitera ? (
                  <tr key={s.id} className={`clk ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
                    <td>{s.nomorSengketa}</td><td>{s.namaPemohon}</td><td>{s.jenisPajak}</td><td>{s.masaPajak || '–'}</td><td>{s.panitera}</td><td>{tgl(s.tanggalMasuk)}</td><td>{tgl(s.tanggalSelesai)}</td><td>{s.statusUcap}</td>
                    <td><Kelengkapan s={s} /></td><td><Tco s={s} /></td><td><StatusPrediksi s={s} /></td>
                    <td><span className="dot" style={{ background: s.prediksi ? '#00a65a' : '#dd4b39' }} /></td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td>{s.nomorSengketa}</td><td>{s.namaPemohon}</td><td>{s.hakim}</td><td>{s.majelis}</td><td>{s.posisi}</td><td>{s.jenisPajak}</td><td>{s.masaPajak || '–'}</td><td>{s.panitera}</td><td>{tgl(s.tanggalMasuk)}</td><td>{tgl(s.tanggalSelesai)}</td>
                    <td><Kelengkapan s={s} /></td><td><Tco s={s} /></td><td><StatusPrediksi s={s} /></td>
                    <td><span className="dot" style={{ background: s.prediksi ? '#00a65a' : '#dd4b39' }} /></td>
                    <td><button className="linkish" title="Prediksi Putusan" onClick={() => pilih(s.id)}><Icon name="gear" size={17} /></button></td>
                  </tr>
                ))}
                {!tampil.length ? <tr><td colSpan={panitera ? 12 : 15} className="small">Tidak ada data yang sesuai dengan pencarian atau filter</td></tr> : null}
              </tbody>
            </table>
          </div>
          <Pager n={tampil.length} />
        </div>
      </div>
      {modal ? (
        <div className="modal">
          <div className="mb">
            <div className="mh2">Konfirmasi Sengketa yang Akan Diprediksi<button className="linkish" onClick={() => batal('batal')}>✕</button></div>
            <div className="mc">
              {!modal.dapatDipilih ? (
                <Alert jenis="d"><b>Sengketa {modal.nomorSengketa} tidak tersedia.</b> Data sengketa tidak ditemukan pada Tax Court One (kemungkinan telah dicabut, dipindahkan majelisnya, atau sudah diucap). Silakan batalkan proses atau pilih sengketa lain.</Alert>
              ) : (
                <>
                  {modal.prediksi ? <Alert>Sengketa ini sudah memiliki prediksi <b>versi {modal.prediksi.versi}</b> ({modal.prediksi.status}). Anda dapat melihat prediksi tersebut atau membuat versi baru tanpa menimpa versi sebelumnya.</Alert> : null}
                  {!modal.tersediaDiTco ? <Alert jenis="w">Data perkara belum terkonfirmasi tersedia di Tax Court One. Proses prediksi akan memeriksa ulang ke Tax Court One.</Alert> : null}
                  {modal.kelengkapan !== 'lengkap' ? <Alert jenis="w">Berkas perkara belum lengkap. Prediksi akan dihentikan pada tahap validasi kelengkapan.</Alert> : null}
                  <div className="g2">
                    <dl className="kv">
                      <dt>Nomor Sengketa</dt><dd>{modal.nomorSengketa}</dd>
                      <dt>Jenis Sengketa</dt><dd>{modal.jenisSengketa}</dd>
                      <dt>Jenis Pajak</dt><dd>{modal.jenisPajak}</dd>
                      <dt>Masa Pajak</dt><dd>{modal.masaPajak || '–'}</dd>
                      <dt>Pokok Sengketa</dt><dd>{modal.pokokSengketa}</dd>
                      <dt>Objek Gugatan</dt><dd>{modal.nomorObjekGugatan || '–'}{modal.tanggalObjekGugatan ? ` tanggal ${tgl(modal.tanggalObjekGugatan)}` : ''}</dd>
                      <dt>Nilai Sengketa</dt><dd>{rupiah(modal.nilaiSengketa)}</dd>
                      <dt>Penggugat</dt><dd>{modal.namaPemohon}</dd>
                      <dt>Tergugat</dt><dd>{modal.tergugat || '–'}</dd>
                      <dt>Majelis</dt><dd>{modal.majelis}</dd>
                      <dt>Panitera Pengganti</dt><dd>{modal.panitera}</dd>
                      <dt>Tanggal Masuk</dt><dd>{tgl(modal.tanggalMasuk)}</dd>
                    </dl>
                    <div>
                      <div className="lbl" style={{ marginBottom: 6 }}>Ketersediaan</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}><Tco s={modal} /><Kelengkapan s={modal} /></div>
                      <div className="lbl" style={{ marginBottom: 6 }}>Dokumen perkara di Tax Court One</div>
                      <ul className="chk">{modal.dokumen.map((d) => <li key={d.jenis}><span className={d.tersedia ? 'ok' : 'no'}>{d.tersedia ? '✔' : '✘'}</span>{d.jenis}</li>)}</ul>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mf">
              <button className="btn" onClick={() => batal('batal')}>Batal</button>
              {modal.dapatDipilih && modal.prediksi ? <button className="btn" onClick={() => navigate(`/prediksi/${modal.prediksi.id}`)}><Icon name="eye" />Lihat Prediksi v{modal.prediksi.versi}</button> : null}
              {modal.dapatDipilih ? <button className="btn bp" onClick={() => generate(modal.id)}><Icon name="pred" />{modal.prediksi ? 'Generate Prediksi Versi Baru' : 'Konfirmasi & Generate Prediksi'}</button> : <button className="btn bp" onClick={() => batal('pilih_lain')}>Pilih Sengketa Lain</button>}
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
