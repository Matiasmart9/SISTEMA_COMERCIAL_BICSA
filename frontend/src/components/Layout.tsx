import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Radio,
  History,
  Building2,
  DollarSign,
  Download,
  Users,
  LogOut,
  Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';
import { api } from '../api/client';
import ProfilePhotoModal from './ProfilePhotoModal';

const roleLabel = {
  admin: 'Administrador',
  gerente: 'Gerente Comercial',
  ejecutivo: 'Ejecutivo/a',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [hasActiveJornada, setHasActiveJornada] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  // Consultar si hay una jornada abierta / en curso para el usuario
  const checkActiveJornada = async () => {
    if (!user) return;
    try {
      const res = await api.get('/jornadas/activa');
      setHasActiveJornada(Boolean(res.data?.activa));
    } catch (err) {
      // Silenciar error en background polling
    }
  };

  useEffect(() => {
    checkActiveJornada();

    // Evento personalizado cuando se inicia o cierra una jornada
    const handleJornadaChange = () => {
      checkActiveJornada();
    };
    window.addEventListener('jornada-status-changed', handleJornadaChange);

    // Polling ligero cada 25 segundos
    const timer = setInterval(checkActiveJornada, 25000);

    return () => {
      window.removeEventListener('jornada-status-changed', handleJornadaChange);
      clearInterval(timer);
    };
  }, [user, location.pathname]);

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const isManager = ['admin', 'gerente'].includes(user.role) || user.email === 'matiasmart7@gmail.com';

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Resumen', exact: true },
    {
      to: '/nueva-jornada',
      icon: <Plus size={18} />,
      label: hasActiveJornada ? 'Jornada activa' : 'Nueva jornada',
      badge: hasActiveJornada ? 'En curso' : null,
    },
    ...(isManager
      ? [{ to: '/jornadas-en-curso', icon: <Radio size={18} />, label: 'Jornada en Curso' }]
      : []),
    { to: '/historial', icon: <History size={18} />, label: 'Historial' },
    { to: '/empresas', icon: <Building2 size={18} />, label: 'Empresas' },
    ...(isManager
      ? [{ to: '/inversion', icon: <DollarSign size={18} />, label: 'Costos Empresa' }]
      : []),
    ...(user.role !== 'ejecutivo'
      ? [{ to: '/exportacion', icon: <Download size={18} />, label: 'Exportar' }]
      : []),
    ...(user.role === 'admin'
      ? [{ to: '/usuarios', icon: <Users size={18} />, label: 'Usuarios' }]
      : []),
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-card">
            <img
              src="/bicsa-logo.png"
              alt="BICSA"
              className="sidebar-logo-img"
            />
          </div>
          <div className="brand-subtitle">Gestión Comercial</div>
        </div>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span className="sidebar-pending-badge" title="Jornada en curso pendiente de cierre">
                  <span className="pulse-dot" />
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div
            className="sidebar-user"
            onClick={() => setShowPhotoModal(true)}
            role="button"
            tabIndex={0}
            title="Haz clic para cambiar o eliminar tu foto de perfil"
          >
            <div className="sidebar-user-avatar-wrap">
              <div className="sidebar-user-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="sidebar-user-avatar-img"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="sidebar-avatar-hover-overlay" title="Cambiar foto">
                <Camera size={14} />
              </div>
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={user.fullName}>{user.fullName}</div>
              <div className="sidebar-user-role">{roleLabel[user.role]}</div>
            </div>
            <div className="sidebar-user-action-hint">
              <Camera size={11} style={{ marginRight: 3 }} />
              <span>Cambiar imagen</span>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Cerrar sesión">
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
          <div className="sidebar-version">Sistema Comercial BICSA · {APP_VERSION}</div>
        </div>

        <ProfilePhotoModal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          userId={user.id}
          userName={user.fullName}
          currentAvatarUrl={user.avatarUrl}
          onSuccess={() => {}}
        />
      </aside>
      <div className="main-content">
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
