import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'gerente' | 'ejecutivo';
  photoOdometerEnabled?: boolean;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (fields: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Obtener fecha local actual en formato YYYY-MM-DD
const getTodayLocalDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('bicsa_token');
    localStorage.removeItem('bicsa_session_date');
    setUser(null);
  }, []);

  const checkMidnightSession = useCallback(() => {
    const token = localStorage.getItem('bicsa_token');
    if (!token) return false;

    const sessionDate = localStorage.getItem('bicsa_session_date');
    const today = getTodayLocalDateStr();

    if (sessionDate && sessionDate !== today) {
      // Han pasado las 00:00 hs de un nuevo día -> cerrar sesión automáticamente
      logout();
      return true;
    }

    if (!sessionDate) {
      // Si la sesión no tenía fecha guardada, registrar el día de hoy
      localStorage.setItem('bicsa_session_date', today);
    }
    return false;
  }, [logout]);

  const fetchMe = useCallback(async () => {
    const isExpired = checkMidnightSession();
    if (isExpired) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('bicsa_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('bicsa_token');
      localStorage.removeItem('bicsa_session_date');
    } finally {
      setLoading(false);
    }
  }, [checkMidnightSession]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Manejo de expiración a medianoche (00:00 hs) para smartphone y web
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      checkMidnightSession();
    };

    // Al reanudar pestaña o desbloquear smartphone
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Verificación periódica cada 30 segundos
    const interval = setInterval(() => {
      checkMidnightSession();
    }, 30000);

    // Temporizador exacto para las 00:00:01 del día siguiente
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());
    const midnightTimer = setTimeout(() => {
      checkMidnightSession();
    }, msUntilMidnight);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
      clearTimeout(midnightTimer);
    };
  }, [checkMidnightSession]);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('bicsa_token', data.token);
    localStorage.setItem('bicsa_session_date', getTodayLocalDateStr());
    setUser(data.user);
    return data.user;
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : null));
  };

  const refreshUser = async () => {
    await fetchMe();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
