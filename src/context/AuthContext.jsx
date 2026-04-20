import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, tokenStore } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await tokenStore.get('auth_token');
        if (stored) {
          setTokenState(stored);
          try {
            const { data } = await authApi.me();
            setUser(data.user ?? data);
          } catch {
            try { await tokenStore.remove('auth_token'); } catch {}
            setTokenState(null);
          }
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setToken = async (t) => {
    try { await tokenStore.set('auth_token', t); } catch {}
    setTokenState(t);
  };

  const logout = async () => {
    try { await tokenStore.remove('auth_token'); } catch {}
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, setToken, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
