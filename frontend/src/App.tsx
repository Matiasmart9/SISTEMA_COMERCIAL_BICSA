import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import NuevaJornadaPage from './pages/NuevaJornada';
import HistorialPage from './pages/Historial';
import EmpresasPage from './pages/Empresas';
import EmpresaDetallePage from './pages/EmpresaDetalle';
import ExportacionPage from './pages/Exportacion';
import InversionEmpresasPage from './pages/InversionEmpresas';
import JornadasEnCursoPage from './pages/JornadasEnCurso';
import UsuariosPage from './pages/Usuarios';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="nueva-jornada" element={<NuevaJornadaPage />} />
        <Route
          path="jornadas-en-curso"
          element={
            <ProtectedRoute roles={['admin', 'gerente']}>
              <JornadasEnCursoPage />
            </ProtectedRoute>
          }
        />
        <Route path="historial" element={<HistorialPage />} />
        <Route path="empresas" element={<EmpresasPage />} />
        <Route path="empresas/:id" element={<EmpresaDetallePage />} />
        <Route
          path="inversion"
          element={
            <ProtectedRoute roles={['admin', 'gerente']}>
              <InversionEmpresasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="exportacion"
          element={
            <ProtectedRoute roles={['admin', 'gerente']}>
              <ExportacionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <ProtectedRoute roles={['admin']}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
