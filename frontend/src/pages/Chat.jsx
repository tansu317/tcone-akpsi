import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { persen } from '../format.js';
import { useAuth } from '../auth.jsx';
import { useToast, Alert, Disc, Shell } from '../ui.jsx';

const FB_AWAL = { jenis: '', rating: 0, kategori: [], penjelasan: '', err: '' };

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { meta } = useAuth();
  const jenisList = meta?.jenisChat || [];
  const kotak = useRef(null);
  const [sesi, setSesi] = useState(null);
  const [jenis, setJenis] = useState('');
  const [isi, setIsi] = useState('');
  const [fb, setFb] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!jenis && jenisList[0]) {
      setJenis(jenisList[0].jenis);
      setIsi(jenisList[0].contoh);
    }
  }, [jenisList, jenis]);

  useEffect(() => {
    let hidup = true;
    api('/chat/sesi', { method: 'POST', body: { prediksiId: id } })
      .then((data) => { if (hidup) setSesi(data); })
      .catch((e) => setGalat(e.message));
    return () => { hidup = false; };
  }, [id]);

  async function kirim(event) {
    event.preventDefault();
    setGalat('');
    try {
      const data = await api(`/chat/sesi/${sesi.id}/pesan`, { method: 'POST', body: { jenis, isi } });
      setSesi(data);
      setIsi('');
    } catch (error) {
      setGalat(error.message);
    }
  }

  function susunUlang() {
    setIsi('');
    kotak.current?.focus();
  }

  async function akhiri() {
    await api(`/chat/sesi/${sesi.id}/akhiri`, { method: 'POST' });
    toast('Percakapan disimpan dan sesi ditutup');
    navigate(`/prediksi/${id}`);
  }

  async function kirimFb() {
    setGalat('');
    try {
      await api('/chat/feedback', { method: 'POST', body: { ...fb, prediksiId: id, percakapanId: sesi.id } });
      setFb(null);
      toast('Feedback telah tersimpan dan dikaitkan dengan hasil prediksi serta percakapan ChatAI');
    } catch (error) {
      setFb({ ...fb, err: error.message });
    }
  }

  const terakhir = sesi?.pesan?.at(-1);
  return (
    <Shell crumb={<>Prediksi Putusan › <b>Analisis Reasoning dengan ChatAI</b></>}>
      <Disc />
      {galat ? <Alert jenis="d">{galat}</Alert> : null}
      {sesi ? <div className="g21">
        <div className="box"><div className="bh">ChatAI – Sesi {sesi.kode}<span style={{ fontSize: 12 }}>LLM on-premise (simulasi lokal)</span></div>
          <div className="bb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="qt">{jenisList.map((item, i) => (
              <button key={item.jenis} className={jenis === item.jenis ? 'on' : ''} onClick={() => { setJenis(item.jenis); setIsi(item.contoh); }}>S-{i + 1} {item.jenis}</button>
            ))}</div>
            <div className="chat">
              {sesi.pesan.length ? sesi.pesan.map((m) => (
                <div key={m.id} className={`m ${m.peran === 'pengguna' ? 'u' : 'a'}`}>
                  <div className="who">{m.peran === 'pengguna' ? `Hakim · ${m.jenis}` : 'ChatAI'}</div>
                  {m.isi}
                  {m.rujukan?.length ? <div>{m.rujukan.map((r) => <span key={r.label} className={`ref ${r.terverifikasi ? 'v' : 'x'}`}>{r.terverifikasi ? '✔ Terverifikasi' : '⚠ Tidak ditemukan di korpus'} · {r.label}</span>)}</div> : null}
                </div>
              )) : <div className="small">Pilih jenis pertanyaan, lalu klik Kirim.</div>}
            </div>
            {terakhir?.tanpaRujukan ? (
              <div>
                <Alert jenis="w">Tidak ada rujukan yang mendukung jawaban. Susun ulang pertanyaan atau akhiri percakapan.</Alert>
                <div className="btns" style={{ marginTop: 8 }}>
                  <button className="btn bp" type="button" onClick={susunUlang}>Susun Ulang Pertanyaan</button>
                  <button className="btn" type="button" onClick={akhiri}>Tidak Melanjutkan</button>
                </div>
              </div>
            ) : null}
            <form style={{ display: 'flex', gap: 8 }} onSubmit={kirim}>
              <input ref={kotak} style={{ flex: 1 }} value={isi} onChange={(e) => setIsi(e.target.value)} />
              <button className="btn bp">Kirim</button>
            </form>
            <div className="btns">
              <button className="btn" type="button" onClick={() => setFb({ ...FB_AWAL })}>Beri Feedback</button>
              <button className="btn" type="button" onClick={akhiri}>Akhiri Percakapan</button>
            </div>
          </div>
        </div>
        <div className="box"><div className="bh">Konteks Perkara (teranonimkan)</div><div className="bb">
          <dl className="kv" style={{ gridTemplateColumns: '105px 1fr' }}>
            <dt>Penggugat</dt><dd>{sesi.konteks.penggugat}</dd>
            <dt>Tergugat</dt><dd>{sesi.konteks.tergugat}</dd>
            <dt>Jenis pajak</dt><dd>{sesi.konteks.jenisPajak}</dd>
            <dt>Amar prediksi</dt><dd>{sesi.konteks.amarPrediksi} ({persen(sesi.konteks.skorKeyakinan)})</dd>
            <dt>Faktor dominan</dt><dd>{sesi.konteks.faktorDominan || 0} faktor</dd>
            <dt>Putusan sejenis</dt><dd>{sesi.konteks.putusanSejenis >= 3 ? 'Top-3' : sesi.konteks.putusanSejenis ? `${sesi.konteks.putusanSejenis} putusan` : 'Tidak ada'}</dd>
          </dl>
          <div className="small" style={{ marginTop: 8 }}>Rujukan diverifikasi terhadap korpus putusan dan basis peraturan pada basis data lokal.</div>
        </div></div>
      </div> : <div className="small">Membuka sesi...</div>}
      {fb ? (
        <div className="modal">
          <div className="mb">
            <div className="mh2">Beri Feedback Hasil Prediksi<button className="linkish" onClick={() => setFb(null)}>✕</button></div>
            <div className="mc">
              <div className="lbl">Jenis feedback <span className="req">*</span></div>
              <div className="opt">{[
                ['Sesuai', 'Hasil prediksi sesuai', 'S-1 – Prediksi dan penjelasannya sesuai dengan telaah saya.'],
                ['Tidak Sesuai', 'Hasil prediksi belum sesuai', 'S-2 – Ada bagian prediksi atau reasoning yang belum sesuai.'],
              ].map(([kode, judul, teks]) => (
                <label key={kode} className={fb.jenis === kode ? 'on' : ''}>
                  <input type="radio" checked={fb.jenis === kode} onChange={() => setFb({ ...fb, jenis: kode, err: '' })} />
                  <span><b>{judul}</b><small>{teks}</small></span>
                </label>
              ))}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="lbl">Rating kualitas jawaban <span className="req">*</span></span>
                <span className="st">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={fb.rating === n ? 'on' : ''} onClick={() => setFb({ ...fb, rating: n })}>{n}</button>)}</span>
              </div>
              {fb.jenis === 'Tidak Sesuai' ? (
                <div>
                  <div className="lbl" style={{ marginBottom: 5 }}>Kategori masalah</div>
                  <div className="qt">{['Rujukan keliru', 'Fakta tidak tepat', 'Reasoning lemah', 'Bahasa tidak jelas'].map((k) => (
                    <button type="button" key={k} className={fb.kategori.includes(k) ? 'on' : ''} onClick={() => setFb({ ...fb, kategori: fb.kategori.includes(k) ? fb.kategori.filter((x) => x !== k) : [...fb.kategori, k] })}>{k}</button>
                  ))}</div>
                </div>
              ) : null}
              <label className="f">Penjelasan / alasan {fb.jenis === 'Tidak Sesuai' ? 'ketidaksesuaian' : 'feedback'} (apabila diperlukan)
                <textarea value={fb.penjelasan} onChange={(e) => setFb({ ...fb, penjelasan: e.target.value })} />
              </label>
              {fb.err ? <div className="err">{fb.err}</div> : null}
              <div className="small">Feedback akan dikaitkan dengan hasil prediksi dan percakapan ChatAI ini.</div>
            </div>
            <div className="mf">
              <button className="btn" onClick={() => setFb(null)}>Batal</button>
              <button className="btn bp" onClick={kirimFb}>Kirim Feedback</button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}