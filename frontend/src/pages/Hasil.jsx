import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, unduhTeks } from '../api.js';
import { koma, persen, rupiah, waktu } from '../format.js';
import { useAuth } from '../auth.jsx';
import { Alert, Disc, Donut, Icon, Shell, WARNA_AMAR } from '../ui.jsx';

export default function Hasil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const hakim = user.peran === 'Hakim';

  useEffect(() => {
    api(`/prediksi/${id}`).then(setData).catch((e) => setGalat(e.message));
  }, [id]);

  if (galat) return <Shell crumb="Prediksi"><Alert jenis="d">{galat}</Alert></Shell>;
  if (!data) return <Shell crumb="Prediksi">Memuat hasil prediksi...</Shell>;
  const dist = data.distribusi.map((d) => d.probabilitas);
  const urut = data.distribusi.map((d, i) => ({ ...d, i })).sort((a, b) => b.probabilitas - a.probabilitas);

  return (
    <Shell crumb={<>{hakim ? 'Penyelesaian Putusan' : 'Penyelesaian'} › <b>Prediksi Putusan</b></>}>
      <Disc />
      <div className="box">
        <div className="bh">Informasi Sengketa<span style={{ fontSize: 12 }}>Versi prediksi: v{data.versi} · {data.status}</span></div>
        <div className="bb g2">
          <dl className="kv"><dt>Nomor Sengketa</dt><dd>{data.perkara.nomorSengketa}</dd><dt>Penggugat</dt><dd>{data.perkara.namaPemohon}</dd><dt>Jenis Pajak</dt><dd>{data.perkara.jenisPajak}</dd></dl>
          <dl className="kv"><dt>Pokok Sengketa</dt><dd>{data.perkara.pokokSengketa}</dd><dt>Nilai</dt><dd>{rupiah(data.perkara.nilaiSengketa)}</dd><dt>Model</dt><dd>{data.model} · {waktu(data.dibuatPada)}</dd><dt>Dibuat oleh</dt><dd>{data.pembuat}</dd></dl>
        </div>
      </div>
      <div className="box">
        <div className="bh">Hasil Prediksi Amar Putusan</div>
        <div className="bb g12">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Donut dist={dist} />
            <div className="legend">{urut.map((item) => <span key={item.amar}><i style={{ background: WARNA_AMAR[item.i] }} />{item.amar} ({persen(item.probabilitas)})</span>)}</div>
          </div>
          <div>
            <div className="lbl">Amar dengan probabilitas tertinggi</div>
            <div className="big" style={{ margin: '2px 0 8px' }}>{data.amar}</div>
            <span className={`pill ${data.skorKeyakinan < 0.5 ? 'p-o' : 'p-b'}`}>Skor keyakinan {persen(data.skorKeyakinan)}{data.skorKeyakinan < 0.5 ? ' · keyakinan rendah' : ''}</span>
            <table style={{ marginTop: 10 }}><thead><tr><th>Amar Putusan</th><th>Hasil Prediksi</th></tr></thead>
              <tbody>{urut.map((item) => <tr key={item.amar}><td>{item.amar}</td><td>{persen(item.probabilitas)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
      {data.modelMl ? (
        <div className="box">
          <div className="bh">Akurasi Tiga Model Unsupervised<span>Dipakai: {data.modelMl.terpilih.nama}</span></div>
          <div className="bb">
            <p className="small" style={{ marginTop: 0 }}>{data.modelMl.catatan} Korpus: {data.modelMl.ukuranKorpus} sampel.</p>
            <div className="ml">
              {data.modelMl.model.map((m) => (
                <div className={m.dipilih ? 'row win' : 'row'} key={m.kode}>
                  <div>
                    <b>{m.nama}</b> {m.dipilih ? <span className="pill p-g">Dipakai</span> : null}
                    <div className="small">Prediksi model: {m.amar} · siluet {koma(m.siluet)}</div>
                  </div>
                  <div className="track" aria-hidden="true"><i style={{ width: `${Math.max(0, m.akurasi) * 100}%` }} /></div>
                  <b>{persen(m.akurasi, 1)}</b>
                </div>
              ))}
            </div>
            {data.modelMl.terpilih.amar === data.amar
              ? <p className="small" style={{ marginBottom: 0 }}>Amar yang ditampilkan mengikuti {data.modelMl.terpilih.nama} karena akurasinya paling tinggi ({persen(data.modelMl.terpilih.akurasi, 1)}).</p>
              : <p className="small" style={{ marginBottom: 0 }}>Model terpilih memprediksi <b>{data.modelMl.terpilih.amar}</b>. Amar pada kartu di atas adalah amar yang tersimpan pada hasil ini.</p>}
          </div>
        </div>
      ) : null}
      <div className="box">
        <div className="bh">Daftar Putusan Yang Memiliki Kemiripan</div>
        <div className="bb">
          {data.profilKemiripan === 'terbatas' ? <Alert jenis="w">Hanya <b>{data.putusanSejenis.length} putusan sejenis</b> yang memenuhi ambang kemiripan berdasarkan metadata. Analisis disusun berdasarkan informasi yang tersedia.</Alert> : null}
          {data.profilKemiripan === 'tidak_ada' || !data.putusanSejenis.length ? <Alert jenis="w">Tidak ada putusan sejenis yang sesuai berdasarkan metadata perkara.</Alert> : null}
          <table><thead><tr><th>No. Putusan</th><th>Amar Putusan</th><th>Persentase Kemiripan</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.putusanSejenis.map((item) => (
                <tr key={item.id}><td>{item.nomor}</td><td>{item.amar}</td><td>{koma(item.kemiripan)}%</td>
                  <td><button className="btn bp" onClick={() => unduhTeks(`/prediksi/putusan/${item.id}/unduh`, `${item.nomor.split(' ')[0]}.txt`)}><Icon name="dl" /></button></td></tr>
              ))}
              {!data.putusanSejenis.length ? <tr><td colSpan="4" className="small">Tidak ada putusan sejenis yang sesuai</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="btns">
        <button className="btn bp" onClick={() => navigate(`/analisis/${data.id}`)}><Icon name="list" />Analisis Hasil Prediksi</button>
        {hakim ? <>
          <button className="btn bi" onClick={() => navigate(`/banding/${data.id}`)}><Icon name="scale" />Bandingkan Putusan Sejenis</button>
          <button className="btn bs" onClick={() => navigate(`/evaluasi/${data.id}`)}><Icon name="star" />Evaluasi Hasil Prediksi</button>
          <button className="btn bw" onClick={() => navigate(`/chat/${data.id}`)}><Icon name="chat" />Analisis Reasoning dengan ChatAI</button>
        </> : null}
        <button className="btn" onClick={() => navigate('/penyelesaian')}>Kembali</button>
      </div>
    </Shell>
  );
}
