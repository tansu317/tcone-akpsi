import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Daftar from './pages/Daftar.jsx';
import Proses from './pages/Proses.jsx';
import Hasil from './pages/Hasil.jsx';
import Analisis from './pages/Analisis.jsx';
import Banding from './pages/Banding.jsx';
import Dokumen from './pages/Dokumen.jsx';
import Evaluasi from './pages/Evaluasi.jsx';
import EvaluasiAnalisis from './pages/EvaluasiAnalisis.jsx';
import Chat from './pages/Chat.jsx';
import Disparitas from './pages/Disparitas.jsx';
import DisparitasHasil from './pages/DisparitasHasil.jsx';
import Laporan from './pages/Laporan.jsx';
import { Audit, EvaluasiSaya, Riwayat, SesiChat } from './pages/Lain.jsx';

function Jaga({ children, peran }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="content">Memuat sesi...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (peran && !peran.includes(user.peran)) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? null : user ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/home" element={<Jaga><Home /></Jaga>} />
      <Route path="/penyelesaian" element={<Jaga peran={['Panitera', 'Hakim']}><Daftar /></Jaga>} />
      <Route path="/proses/:perkaraId" element={<Jaga peran={['Panitera', 'Hakim']}><Proses /></Jaga>} />
      <Route path="/prediksi/:id" element={<Jaga peran={['Panitera', 'Hakim']}><Hasil /></Jaga>} />
      <Route path="/analisis/:id" element={<Jaga peran={['Panitera', 'Hakim']}><Analisis /></Jaga>} />
      <Route path="/banding/:id" element={<Jaga peran={['Hakim']}><Banding /></Jaga>} />
      <Route path="/banding/:id/putusan/:putusanId" element={<Jaga peran={['Hakim']}><Dokumen /></Jaga>} />
      <Route path="/evaluasi/:id" element={<Jaga peran={['Hakim']}><Evaluasi /></Jaga>} />
      <Route path="/evaluasi/:id/analisis" element={<Jaga peran={['Hakim']}><EvaluasiAnalisis /></Jaga>} />
      <Route path="/chat/:id" element={<Jaga peran={['Hakim']}><Chat /></Jaga>} />
      <Route path="/riwayat" element={<Jaga peran={['Panitera', 'Hakim']}><Riwayat /></Jaga>} />
      <Route path="/evaluasi-saya" element={<Jaga peran={['Hakim']}><EvaluasiSaya /></Jaga>} />
      <Route path="/sesi-chat" element={<Jaga peran={['Hakim']}><SesiChat /></Jaga>} />
      <Route path="/disparitas" element={<Jaga peran={['Pimpinan']}><Disparitas /></Jaga>} />
      <Route path="/disparitas/hasil" element={<Jaga peran={['Pimpinan']}><DisparitasHasil /></Jaga>} />
      <Route path="/laporan" element={<Jaga peran={['Pimpinan']}><Laporan /></Jaga>} />
      <Route path="/laporan/:id" element={<Jaga peran={['Pimpinan']}><Laporan detail /></Jaga>} />
      <Route path="/audit" element={<Jaga><Audit /></Jaga>} />
      <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
    </Routes>
  );
}
