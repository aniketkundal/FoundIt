import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

// Holds the logged-in user and exposes login/register/logout.
// On first load, if a token exists we validate it by fetching /auth/me, so a
// refresh keeps the user signed in (or cleanly signs them out if expired).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then(({ user }) => active && setUser(user))
      .catch((err) => {
        if (err.status === 401) setToken(null);
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (form) => {
    const { token, user } = await api('/auth/register', {
      method: 'POST',
      body: form, // { name, email, phone, password }
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const updateProfile = useCallback(async ({ name, phone }) => {
    const { user } = await api('/auth/me', {
      method: 'PATCH',
      body: { name, phone },
    });
    setUser(user);
    return user;
  }, []);

  const changePassword = useCallback(
    (currentPassword, newPassword) =>
      api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    []
  );

  const requestReset = useCallback(
    (email) => api('/auth/reset-request', { method: 'POST', body: { email } }),
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        updateProfile,
        changePassword,
        requestReset,
        logout,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
