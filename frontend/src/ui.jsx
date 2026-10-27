import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

const ToastContext = createContext(() => {});
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [text, setText] = useState('');
  function show(pesan) {
    setText(pesan);
    clearTimeout(show._t);
    show._t = setTimeout(() => setText(''), 2800);
  }
  return (
    <ToastContext.Provider value={show}>
      {children}
      {text ? <div className="toast">{text}</div> : null}
    </ToastContext.Provider>
  );
}

const PATH = {
  home: 'M12 3 2 12h3v8h5v-6h4v6h5v-8h3z',
  pred: 'M11 2v10H1A10 10 0 0 0 11 22a10 10 0 0 0 0-20zm2 0v9h9a10 10 0 0 0-9-9z',
  eye: 'M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  list: 'M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zm-4 6h2v2H3zm4 0h14v2H7z',
  scale: 'M12 3a2 2 0 0 0-1 3.7V8H5l-3 7a4 4 0 0 0 8 0L7.2 10H11v9H7v2h10v-2h-4v-9h3.8L14 15a4 4 0 0 0 8 0l-3-7h-6V6.7A2 2 0 0 0 12 3z',
  star: 'm12 17.3 6.2 3.7-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.4 14l-1.6 7z',
  chat: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z',
  audit: 'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.1 5L6.7 18.4A9 9 0 1 0 13 3z',
  flag: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
  bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1z',
  gear: 'M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.3 7.3 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.8 7.8 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  dl: 'M5 20h14v-2H5zm7-3 6-6h-4V3h-4v8H6z',
};

export function Icon({ name, size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={PATH[name]} />
    </svg>
  );
}

const MENU = {
  Panitera: [
    ['/home', 'Home', 'home'],
    ['/penyelesaian', 'Penyelesaian', 'pred', true],
    ['/riwayat', 'Riwayat Prediksi', 'list', true],
    ['/audit', 'Jejak Audit', 'audit'],
  ],
  Hakim: [
    ['/home', 'Home', 'home'],
    ['/penyelesaian', 'Penyelesaian Putusan', 'pred'],
    ['/riwayat', 'Riwayat Prediksi', 'list', true],
    ['/evaluasi-saya', 'Evaluasi & Feedback', 'star', true],
    ['/sesi-chat', 'Sesi ChatAI', 'chat', true],
    ['/audit', 'Jejak Audit', 'audit'],
  ],
  Pimpinan: [
    ['/home', 'Home', 'home'],
    ['/disparitas', 'Deteksi Disparitas', 'scale', true],
    ['/laporan', 'Laporan Disparitas', 'flag', true],
    ['/audit', 'Jejak Audit', 'audit'],
  ],
};

function menuAktif(path, sekarang) {
  if (path === '/home') return sekarang === '/home';
  if (path === '/penyelesaian') {
    return /^\/(penyelesaian|proses|prediksi|analisis|banding|chat)(\/|$)/.test(sekarang)
      || /^\/evaluasi\/.+/.test(sekarang);
  }
  return sekarang === path || sekarang.startsWith(`${path}/`);
}

export function Shell({ crumb, children }) {
  const { user, keluar } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [notif, setNotif] = useState({ belumDibaca: 0, daftar: [] });
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    api('/notifikasi').then(setNotif).catch(() => {});
  }, [pathname]);

  async function baca(item) {
    await api(`/notifikasi/${item.id}/baca`, { method: 'POST' }).catch(() => {});
    setBuka(false);
    if (item.tautan) navigate(item.tautan);
  }

  return (
    <div className="wrap">
      <aside className="side">
        <div className="brand"><span className="lg">TC</span>{user.aplikasi}</div>
        <div className="userp"><div className="av">{user.inisial}</div><div><b>{user.nama}</b><span>{user.jabatan}</span></div></div>
        <div className="mh">MENU UTAMA</div>
        <nav className="menu">
          {MENU[user.peran].map(([path, label, ikon, baru]) => (
            <button key={path} className={menuAktif(path, pathname) ? 'on' : ''} onClick={() => navigate(path)}>
              <Icon name={ikon} />{label}{baru ? <span className="nw">baru</span> : null}
            </button>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="nav">
          <span className="ham">≡</span>
          <div className="rt">
            <button className="bell" onClick={() => setBuka((v) => !v)} aria-label="Notifikasi">
              <Icon name="bell" size={18} />
              {notif.belumDibaca ? <i>{notif.belumDibaca}</i> : null}
            </button>
            <span>{user.nama}</span>
            <button className="linkish" onClick={() => { api('/auth/keluar', { method: 'POST' }).catch(() => {}); keluar(); navigate('/login'); }}>Keluar</button>
          </div>
          {buka ? (
            <div className="notif">
              {notif.daftar.length ? notif.daftar.map((item) => (
                <button key={item.id} onClick={() => baca(item)}>
                  <b>{item.judul}</b><small>{item.isi}</small>
                </button>
              )) : <button type="button">Tidak ada notifikasi</button>}
            </div>
          ) : null}
        </div>
        <div className="crumb"><Icon name="home" /> › {crumb}</div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

export function Disc() {
  return <div className="disc">Hasil prediksi, analisis, dan reasoning merupakan alat bantu yang tidak mengikat. Keputusan tetap berada pada Majelis Hakim (Pasal 78 UU No. 14 Tahun 2002).</div>;
}

export function Alert({ jenis = 'i', children }) {
  return <div className={`al al-${jenis}`}><div>{children}</div></div>;
}

export const WARNA_AMAR = ['#fcd581', '#f6a5b5', '#7cc0f2', '#c9d3df', '#7fd3d0', '#b9a7e6', '#ffcf9e'];

export function Donut({ dist, size = 210 }) {
  let sudut = -Math.PI / 2;
  const r = size / 2 - 6;
  const ri = r * 0.55;
  const cx = size / 2;
  const cy = size / 2;
  const bagian = [];
  dist.forEach((v, i) => {
    if (v <= 0) return;
    const akhir = sudut + v * 2 * Math.PI;
    const besar = v > 0.5 ? 1 : 0;
    const titik = (ang, rr) => [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
    const [x1, y1] = titik(sudut, r);
    const [x2, y2] = titik(akhir, r);
    const [x3, y3] = titik(akhir, ri);
    const [x4, y4] = titik(sudut, ri);
    bagian.push(<path key={i} d={`M${x1} ${y1}A${r} ${r} 0 ${besar} 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 ${besar} 0 ${x4} ${y4}Z`} fill={WARNA_AMAR[i]} stroke="#fff" strokeWidth="1.5" />);
    if (v >= 0.08) {
      const [tx, ty] = titik((sudut + akhir) / 2, (r + ri) / 2);
      bagian.push(<text key={`t${i}`} x={tx} y={ty} fontSize="10.5" textAnchor="middle" dominantBaseline="middle" fill="#333">{Math.round(v * 100)}%</text>);
    }
    sudut = akhir;
  });
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{bagian}</svg>;
}

export function Pager({ n }) {
  return <div className="pg"><span>Showing 1 to {n} of {n} entries</span></div>;
}
