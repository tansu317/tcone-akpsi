import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('siproperti_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/saya')
      .then(async (pengguna) => {
        setUser(pengguna);
        setMeta(await api('/meta'));
      })
      .catch(() => localStorage.removeItem('siproperti_token'))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    meta,
    loading,
    async masuk(nip, kataSandi) {
      const data = await api('/auth/masuk', { method: 'POST', body: { nip, kataSandi } });
      localStorage.setItem('siproperti_token', data.token);
      setUser(data.pengguna);
      setMeta(await api('/meta'));
      return data.pengguna;
    },
    keluar() {
      localStorage.removeItem('siproperti_token');
      setUser(null);
      setMeta(null);
    },
  }), [user, meta, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
