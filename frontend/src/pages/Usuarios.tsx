import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  UserCheck,
  UserX,
  X,
  Save,
  Lock,
  Mail,
  User as UserIcon,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: 'ejecutivo' | 'gerente' | 'admin';
  is_active: boolean;
  photo_odometer_enabled?: boolean;
  created_at: string;
}

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modales
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<UserItem | null>(null);

  // Formulario Nuevo Usuario
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'ejecutivo' | 'gerente' | 'admin'>('ejecutivo');
  const [newPhotoOdometer, setNewPhotoOdometer] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // Formulario Reset Password
  const [resetPasswordVal, setResetPasswordVal] = useState<string>('');
  const [resetting, setResetting] = useState<boolean>(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.get<UserItem[]>('/usuarios');
      setUsers(res.data.filter((u) => u.email !== 'matiasmart7@gmail.com'));
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  // Activar / Desactivar
  async function handleToggleActive(u: UserItem) {
    if (u.id === currentUser?.id) {
      toast.error('No puede desactivar su propia cuenta');
      return;
    }
    const actionText = u.is_active ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Está seguro de que desea ${actionText} a ${u.full_name}?`)) {
      return;
    }

    try {
      const res = await api.patch<UserItem>(`/usuarios/${u.id}/toggle`);
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, is_active: res.data.is_active } : item))
      );
      toast.success(`Usuario ${res.data.is_active ? 'reactivado' : 'desactivado'} con éxito`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al cambiar estado del usuario');
    }
  }

  // Habilitar / Deshabilitar Fotos de Odómetro
  async function handleTogglePhotoOdometer(u: UserItem) {
    try {
      const res = await api.patch<UserItem>(`/usuarios/${u.id}/photo-odometer-toggle`);
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, photo_odometer_enabled: res.data.photo_odometer_enabled } : item))
      );
      toast.success(
        res.data.photo_odometer_enabled
          ? `Fotos de tablero habilitadas para ${u.full_name}`
          : `Fotos de tablero deshabilitadas para ${u.full_name}`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al actualizar fotos de odómetro');
    }
  }

  // Cambiar rol
  async function handleRoleChange(u: UserItem, role: 'ejecutivo' | 'gerente' | 'admin') {
    if (u.id === currentUser?.id && role !== 'admin') {
      toast.error('No puede remover su propio rol de administrador');
      return;
    }

    try {
      await api.patch(`/usuarios/${u.id}/role`, { role });
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, role } : item))
      );
      toast.success('Rol actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar rol');
    }
  }

  // Crear Usuario
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();

    if (!newPassword.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)) {
      toast.error('La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y un número');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post<UserItem>('/usuarios', {
        fullName: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        photoOdometerEnabled: newPhotoOdometer,
      });

      setUsers((prev) => [...prev, res.data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      toast.success('Usuario creado con éxito');
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('ejecutivo');
      setNewPhotoOdometer(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  }

  // Resetear Contraseña
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) return;

    if (!resetPasswordVal.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y un número');
      return;
    }

    setResetting(true);
    try {
      await api.patch(`/usuarios/${targetUser.id}/reset-password`, {
        newPassword: resetPasswordVal,
      });
      toast.success(`Contraseña de ${targetUser.full_name} actualizada`);
      setShowResetModal(false);
      setResetPasswordVal('');
      setTargetUser(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al resetear contraseña');
    } finally {
      setResetting(false);
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="pill pill-orange">Administrador</span>;
      case 'gerente':
        return <span className="pill pill-yellow">Gerente Comercial</span>;
      case 'ejecutivo':
        return <span className="pill pill-gray">Ejecutivo/a</span>;
      default:
        return <span className="pill pill-gray">{role}</span>;
    }
  };

  return (
    <div className="usuarios-page">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Administración de Usuarios y Accesos
          </h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Gestione las cuentas del equipo comercial, roles y permisos de acceso al sistema
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={18} />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Tabla de Usuarios */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Usuarios Registrados ({users.length})</h2>
        </div>

        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>Nombre y Apellido</th>
                  <th style={{ minWidth: 180 }}>Correo Electrónico</th>
                  <th style={{ minWidth: 130 }}>Rol</th>
                  <th style={{ textAlign: 'center', minWidth: 110 }}>Fotos Tablero</th>
                  <th style={{ textAlign: 'center', minWidth: 70 }}>Estado</th>
                  <th style={{ textAlign: 'center', minWidth: 85 }}>Fecha Alta</th>
                  <th style={{ textAlign: 'center', minWidth: 135 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.65 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: u.is_active ? 'var(--primary-light)' : '#f0ecea',
                            color: u.is_active ? 'var(--primary-dark)' : '#75665c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            flexShrink: 0,
                          }}
                        >
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.86rem' }}>
                          {u.full_name}
                        </span>
                        {u.id === currentUser?.id && (
                          <span className="pill pill-gray" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            (Tú)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as any)}
                        style={{
                          padding: '4px 6px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line-dark)',
                          fontSize: '0.8rem',
                          background: '#fff',
                          fontWeight: 600,
                          width: '100%',
                          maxWidth: 140,
                        }}
                      >
                        <option value="ejecutivo">Ejecutivo/a</option>
                        <option value="gerente">Gerente Comercial</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleTogglePhotoOdometer(u)}
                        className={`btn btn-sm ${u.photo_odometer_enabled ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.74rem',
                          borderRadius: '20px',
                          gap: 4,
                          fontWeight: 700,
                          display: 'inline-flex',
                        }}
                        title={
                          u.photo_odometer_enabled
                            ? 'Clic para deshabilitar opción de fotos'
                            : 'Clic para habilitar fotos de odómetro al inicio y fin'
                        }
                      >
                        <Camera size={12} />
                        <span>{u.photo_odometer_enabled ? 'Habilitado' : 'Deshabilitado'}</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.is_active ? (
                        <span className="pill pill-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>Activo</span>
                      ) : (
                        <span className="pill pill-red" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>Inactivo</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                      {new Date(u.created_at).toLocaleDateString('es-PY')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 5, justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setShowResetModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.76rem', gap: 4 }}
                          title="Cambiar contraseña de este usuario"
                        >
                          <Key size={13} />
                          <span>Clave</span>
                        </button>

                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ padding: '4px 8px', fontSize: '0.76rem', gap: 4 }}
                            title={u.is_active ? 'Desactivar acceso' : 'Reactivar acceso'}
                          >
                            {u.is_active ? (
                              <>
                                <UserX size={13} />
                                <span>Desactivar</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={13} />
                                <span>Activar</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Crear Usuario */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 480,
              width: '100%',
              padding: 28,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>Registrar Nuevo Usuario</h2>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="field">
                <label>Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Daisy Ozorio"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  placeholder="nombre@bicsa.com.py"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caract., mayúscula, número"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className="field-hint">Mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número.</div>
              </div>

              <div className="field">
                <label>Rol en el Sistema *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="ejecutivo">Ejecutivo/a Comercial</option>
                  <option value="gerente">Gerente Comercial</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div
                style={{
                  background: 'var(--primary-lighter)',
                  border: '1.5px solid var(--primary-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 10,
                  cursor: 'pointer',
                }}
                onClick={() => setNewPhotoOdometer(!newPhotoOdometer)}
              >
                <input
                  type="checkbox"
                  id="newPhotoOdometer"
                  checked={newPhotoOdometer}
                  onChange={(e) => setNewPhotoOdometer(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="newPhotoOdometer" style={{ margin: 0, cursor: 'pointer', fontSize: '0.88rem' }}>
                  <strong style={{ color: 'var(--primary-dark)', display: 'block' }}>
                    📸 Habilitar carga de fotos de tablero
                  </strong>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    Permite al usuario subir foto del odómetro al inicio y al finalizar su jornada
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  <span>{creating ? 'Guardando...' : 'Crear Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showResetModal && targetUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowResetModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 420,
              width: '100%',
              padding: 28,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>Restablecer Contraseña</h2>
              <button onClick={() => setShowResetModal(false)} className="btn btn-secondary btn-icon">
                <X size={18} />
              </button>
            </div>

            <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
              Defina una nueva contraseña para <strong>{targetUser.full_name}</strong> ({targetUser.email}).
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="field">
                <label>Nueva Contraseña *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caract., mayúscula, número"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                />
                <div className="field-hint">Mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="btn btn-primary"
                >
                  <Lock size={16} />
                  <span>{resetting ? 'Actualizando...' : 'Restablecer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
