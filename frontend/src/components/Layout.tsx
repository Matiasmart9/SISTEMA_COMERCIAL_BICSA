import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  History,
  Building2,
  Download,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';

const roleLabel = {
  admin: 'Administrador',
  gerente: 'Gerente Comercial',
  ejecutivo: 'Ejecutivo/a',
};

export default function Layout() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Resumen', exact: true },
    { to: '/nueva-jornada', icon: <Plus size={18} />, label: 'Nueva jornada' },
    { to: '/historial', icon: <History size={18} />, label: 'Historial' },
    { to: '/empresas', icon: <Building2 size={18} />, label: 'Empresas' },
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
          <div className="brand-row">
            <div className="brand-name">BICSA</div>
            <span className="version-badge version-badge-light" title={`Versión ${APP_VERSION}`}>
              {APP_VERSION}
            </span>
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className="sidebar-user-role">{roleLabel[user.role]}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} title="Cerrar sesión">
            <LogOut size={16} />
            <span>Salir</span>
          </button>
          <div className="sidebar-version">Sistema Comercial BICSA · {APP_VERSION}</div>
        </div>
      </aside>
      <div className="main-content">
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
