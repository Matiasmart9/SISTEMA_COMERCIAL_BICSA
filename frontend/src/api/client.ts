import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Interceptor: agregar token JWT a cada request y validar vencimiento a medianoche (00:00 hs)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bicsa_token');
  const sessionDate = localStorage.getItem('bicsa_session_date');

  if (token && sessionDate) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (sessionDate !== today) {
      localStorage.removeItem('bicsa_token');
      localStorage.removeItem('bicsa_session_date');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Sesión expirada a las 00:00 hs'));
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar 401 (token expirado en rutas protegidas)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('bicsa_token');
      localStorage.removeItem('bicsa_session_date');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
