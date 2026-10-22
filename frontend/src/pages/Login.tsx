import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';
import toast from 'react-hot-toast';

interface LoginForm {
  email: string;
  password: string;
}

const STORAGE_KEY = 'bicsa_remembered_credentials';

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>();

  // Cargar credenciales guardadas si existen
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setValue('email', parsed.email);
        if (parsed.password) setValue('password', parsed.password);
        if (parsed.rememberMe) setRememberMe(true);
      }
    } catch {
      // Ignorar errores de parseo
    }
  }, [setValue]);

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe: true,
        }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      const user = await login(data.email, data.password);
      const firstName = user?.fullName?.split(' ')[0] || '';
      toast.success(`¡Bienvenido/a${firstName ? ', ' + firstName : ''}!`, {
        duration: 3500,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Correo o contraseña incorrectos. Por favor verifique sus datos.';
      setErrorMessage(msg);
      toast.error(msg, { duration: 4500 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-bg">
      <div className="login-box">
        <header className="login-header">
          <div className="login-brand-logo">
            <img
              src="/bicsa-logo.png"
              alt="BICSA"
              className="login-logo-img"
            />
          </div>
          <h2 className="login-welcome-title">Bienvenido</h2>
          <p className="login-welcome-subtitle">Ingresa tus credenciales para continuar</p>
        </header>

        {errorMessage && (
          <div
            className="alert alert-error"
            style={{
              marginBottom: 18,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--red-bg)',
              color: 'var(--red)',
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" noValidate>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <div className="login-input-wrap">
              <Mail size={18} strokeWidth={1.5} className="login-input-icon" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="usuario@bicsa.com.py"
                className={errors.email ? 'error' : ''}
                {...register('email', {
                  required: 'El correo es requerido',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                })}
              />
            </div>
            {errors.email && <div className="field-error">{errors.email.message}</div>}
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <div className="login-input-wrap">
              <Lock size={18} strokeWidth={1.5} className="login-input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={errors.password ? 'error' : ''}
                {...register('password', { required: 'La contraseña es requerida' })}
              />
              <button
                id="toggle-password"
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>
            {errors.password && <div className="field-error">{errors.password.message}</div>}
          </div>

          <div className="login-options-row">
            <label className="login-remember-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-remember-checkbox"
              />
              <span>Recordar usuario</span>
            </label>
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary w-full login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Ingresando...
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight size={18} strokeWidth={1.75} />
              </>
            )}
          </button>
        </form>

        <footer className="login-footer">
          <div className="login-footer-row">
            <span className="login-copy-brand">BICSA · Gestión Comercial</span>
            <span className="login-copy-version">{APP_VERSION}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
