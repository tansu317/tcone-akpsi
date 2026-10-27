import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const AKUN = [
  ['Panitera', '198705122010121003'],
  ['Hakim', '197208041999031004'],
  ['Pimpinan', '196511121988031005'],
];

export default function Login() {
  const { masuk } = useAuth();
  const navigate = useNavigate();
  const [nip, setNip] = useState(AKUN[1][1]);
  const [kataSandi, setKataSandi] = useState('demo123');
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function kirim(event) {
    event.preventDefault();
    setSibuk(true);
    setPesan('');
    try {
      await masuk(nip, kataSandi);
      navigate('/home');
    } catch (error) {
      setPesan(error.message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="login">
      <form className="lc" onSubmit={kirim}>
        <div className="hd">
          <div style={{ fontSize: 12, opacity: 0.7 }}>Pengadilan Pajak</div>
          <div style={{ fontSize: 20 }}>Tax Court One</div>
        </div>
        <div className="lbd">
          <div className="small">Masuk menggunakan akun SSO Kemenkeu. Pada lingkungan lokal, kata sandi demo adalah demo123.</div>
          <label className="f">Username / NIP<input value={nip} onChange={(e) => setNip(e.target.value)} /></label>
          <label className="f">Password<input type="password" value={kataSandi} onChange={(e) => setKataSandi(e.target.value)} /></label>
          <div className="qt">
            {AKUN.map(([peran, nomor]) => (
              <button type="button" key={peran} className={nip === nomor ? 'on' : ''} onClick={() => { setNip(nomor); setKataSandi('demo123'); }}>{peran}</button>
            ))}
          </div>
          {pesan ? <div className="err">{pesan}</div> : null}
          <button className="btn bp" style={{ justifyContent: 'center' }} disabled={sibuk}>Masuk dengan SSO Kemenkeu</button>
          <div className="small">Seluruh data contoh bersifat fiktif.</div>
        </div>
      </form>
    </div>
  );
}
