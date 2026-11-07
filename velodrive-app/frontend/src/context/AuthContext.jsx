import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

const STORAGE_KEYS = ['accessToken', 'refreshToken', 'token', 'user'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((res) => {
        const u = res.data?.user || res.data;
        if (u && (u.id || u._id || u.email)) {
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        } else {
          clearSession();
        }
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const applySession = (u, accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(u || null));
    setUser(u || null);
    return u;
  };

  const isAuthenticated = !!user && !!(localStorage.getItem('accessToken') || localStorage.getItem('token'));
  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'owner';
  const isRenter = user?.role === 'renter';

  const login = (u, accessToken, refreshToken) => ({ success: true, user: applySession(u, accessToken, refreshToken), tokens: { accessToken, refreshToken } });

  const loginWithCredentials = async (emailOrUser, passwordOrToken, maybeRefresh) => {
    // Back-compat: loginWithCredentials(email, password) OR loginWithCredentials(user, accessToken, refreshToken)
    if (passwordOrToken && !maybeRefresh && typeof emailOrUser === 'object') {
      return { user: applySession(emailOrUser, passwordOrToken, undefined) };
    }
    if (typeof emailOrUser === 'object') {
      return { user: applySession(emailOrUser, passwordOrToken, maybeRefresh) };
    }
    const res = await api.post('/auth/login', { email: String(emailOrUser || '').trim().toLowerCase(), password: passwordOrToken });
    const { user: u, tokens } = res.data || {};
    applySession(u, tokens?.accessToken, tokens?.refreshToken);
    return res.data;
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  };

  const logout = () => clearSession();

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, isOwner, isRenter, login, loginWithCredentials, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);