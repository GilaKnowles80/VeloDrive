import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

const STORAGE_KEYS = ['accessToken', 'refreshToken', 'token', 'user'];
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);

  /** Persist user to localStorage and context state */
  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser || null));
    setUser(updatedUser || null);
    return updatedUser;
  };

  const clearSession = () => {
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    setUser(null);
    setIdleWarning(false);
  };

  const resetIdleTimer = () => {
    setIdleWarning(false);
  };

  useEffect(() => {
    if (!user) return;

    let lastActivity = Date.now();
    const warnAt = IDLE_TIMEOUT_MS - 60 * 1000; // warn 1 minute before logout
    let timer;

    const scheduleLogout = () => {
      if (timer) clearTimeout(timer);
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        clearSession();
        window.location.href = '/login';
        return;
      }
      timer = setTimeout(() => {
        clearSession();
        window.location.href = '/login';
      }, remaining);
    };

    const handleActivity = () => {
      lastActivity = Date.now();
      setIdleWarning(false);
      scheduleLogout();
    };

    const checkIdle = () => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= warnAt && !idleWarning) {
        setIdleWarning(true);
      } else if (elapsed < warnAt && idleWarning) {
        setIdleWarning(false);
      }
      scheduleLogout();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'keydown', 'keyup', 'click', 'scroll', 'touchstart', 'wheel'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const interval = setInterval(checkIdle, 15000);

    scheduleLogout();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [user, idleWarning]);

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
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, isOwner, isRenter, login, loginWithCredentials, register, logout, loading, updateUser }}>
      {children}
      {idleWarning && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-red-600 text-white p-6 rounded-2xl shadow-2xl max-w-sm text-center border border-red-400">
            <h3 className="text-lg font-bold mb-2">Session Idle Warning</h3>
            <p className="text-sm mb-4">You have been inactive for nearly 30 minutes. You will be logged out automatically for your security.</p>
            <button
              onClick={resetIdleTimer}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition"
            >
            Stay Signed In
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);