import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Upload,
  Trash2,
  Clock,
  Calendar,
  Search,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProfilePhotoModal from '../components/ProfilePhotoModal';

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: 'ejecutivo' | 'gerente' | 'admin';
  is_active: boolean;
  photo_odometer_enabled?: boolean;
  avatar_url?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Sin registros aún';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Sin registros aún';
    const datePart = d.toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('es-PY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${datePart} - ${timePart} hs`;
  } catch {
    return 'Sin registros aún';
  }
}

export default function UsuariosPage() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Modal Foto de Perfil
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [photoUser, setPhotoUser] = useState<UserItem | null>(null);

  // Formulario Nuevo Usuario
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'ejecutivo' | 'gerente' | 'admin'>('ejecutivo');
  const [newPhotoOdometer, setNewPhotoOdometer] = useState<boolean>(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Formulario Reset Password dentro del modal de detalle
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
      const updated = { ...u, is_active: res.data.is_active };
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      if (selectedUser?.id === u.id) {
        setSelectedUser(updated);
      }
      toast.success(`Usuario ${res.data.is_active ? 'reactivado' : 'desactivado'} con éxito`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al cambiar estado del usuario');
    }
  }

  // Habilitar / Deshabilitar Fotos de Odómetro (Switch Toggle)
  async function handleTogglePhotoOdometer(u: UserItem) {
    const nextVal = !u.photo_odometer_enabled;
    try {
      const res = await api.patch<UserItem>(`/usuarios/${u.id}/photo-odometer-toggle`, {
        enabled: nextVal,
      });
      const updated = { ...u, photo_odometer_enabled: res.data.photo_odometer_enabled };
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      if (selectedUser?.id === u.id) {
        setSelectedUser(updated);
      }
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
      const updated = { ...u, role };
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      if (selectedUser?.id === u.id) {
        setSelectedUser(updated);
      }
      toast.success('Rol actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar rol');
    }
  }

  // Selección de foto para nuevo usuario
  const handleCreatePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Seleccione un archivo de imagen válido (JPG, PNG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const targetSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
        setNewAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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
        avatarUrl: newAvatarUrl,
      });

      setUsers((prev) => [...prev, res.data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      toast.success('Usuario creado con éxito');
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('ejecutivo');
      setNewPhotoOdometer(false);
      setNewAvatarUrl(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  }

  // Resetear Contraseña directamente para el usuario seleccionado
  async function handleResetPasswordDirect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    if (!resetPasswordVal.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y un número');
      return;
    }

    setResetting(true);
    try {
      await api.patch(`/usuarios/${selectedUser.id}/reset-password`, {
        newPassword: resetPasswordVal,
      });
      toast.success(`Contraseña de ${selectedUser.full_name} actualizada correctamente`);
      setResetPasswordVal('');
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

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="usuarios-page">
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Administración de Usuarios y Accesos
          </h1>
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 2 }}>
            Gestione las cuentas del equipo comercial, fotos, roles y configuración de fotos de tablero
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

      {/* Barra de Filtro y Buscador */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360, minWidth: 220 }}>
            <Search
              size={17}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }}
            />
            <input
              type="text"
              placeholder="Buscar por nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 38px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                background: '#F8FAFC',
              }}
            />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario' : 'usuarios'} registrados
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas de Usuarios */}
      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-muted)' }}>
          <Users size={40} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>No se encontraron usuarios</div>
          <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
            {search ? 'Intente con otro término de búsqueda' : 'No hay usuarios registrados'}
          </p>
        </div>
      ) : (
        <div className="usuarios-cards-grid">
          {filteredUsers.map((u) => {
            const initials = u.full_name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase() || 'U';

            return (
              <div
                key={u.id}
                className="usuario-card"
                onClick={() => setSelectedUser(u)}
                style={{ opacity: u.is_active ? 1 : 0.65 }}
              >
                <div>
                  {/* Top: Avatar, Nombre, Estado */}
                  <div className="usuario-card-top">
                    <div
                      className="usuario-card-avatar"
                      style={{
                        background: u.is_active ? '#EA580C' : '#94A3B8',
                        color: '#FFFFFF',
                      }}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.full_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div className="usuario-card-info">
                      <div className="usuario-card-name">
                        <span>{u.full_name}</span>
                        {u.id === currentUser?.id && (
                          <span className="pill pill-gray" style={{ fontSize: '0.64rem', padding: '0px 5px' }}>
                            (Tú)
                          </span>
                        )}
                      </div>
                      <div className="usuario-card-email">{u.email}</div>
                    </div>

                    <div>
                      {u.is_active ? (
                        <span className="pill pill-green" style={{ fontSize: '0.70rem', padding: '2px 7px' }}>
                          Activo
                        </span>
                      ) : (
                        <span className="pill pill-red" style={{ fontSize: '0.70rem', padding: '2px 7px' }}>
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges: Rol y Fotos Tablero */}
                  <div className="usuario-card-badges">
                    {getRoleBadge(u.role)}
                    <span
                      className={`pill ${u.photo_odometer_enabled ? 'pill-orange' : 'pill-gray'}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    >
                      {u.photo_odometer_enabled ? 'Tablero: On' : 'Tablero: Off'}
                    </span>
                  </div>
                </div>

                {/* Meta: Fechas y Clic Prompt */}
                <div className="usuario-card-meta">
                  <div className="usuario-card-meta-row">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={12} />
                      <span>Último acceso:</span>
                    </span>
                    <strong style={{ color: u.last_login_at ? 'var(--ink)' : 'var(--ink-muted)' }}>
                      {formatDateTime(u.last_login_at)}
                    </strong>
                  </div>

                  <div className="usuario-card-meta-row" style={{ marginTop: 2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={12} />
                      <span>Alta:</span>
                    </span>
                    <span>{new Date(u.created_at).toLocaleDateString('es-PY')}</span>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px dashed #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      color: 'var(--primary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>Gestionar usuario</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Ficha y Gestión de Usuario al hacer clic en el cuadro */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99990,
            padding: 16,
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Ficha Fijo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px 12px 20px',
                borderBottom: '1px solid #F1F5F9',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#FFF0E6',
                    color: '#EA4800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                    Gestión de Usuario
                  </h2>
                  <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                    Opciones y permisos de acceso al sistema
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="btn btn-ghost"
                style={{ padding: 6, borderRadius: '50%' }}
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido scrolleable con scroll sutil y elegante */}
            <div
              className="custom-modal-scroll"
              style={{
                padding: '14px 20px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* Cabecera del Usuario con Avatar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  background: '#F8FAFC',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid #E2E8F0',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: '#EA4800',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.35rem',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    border: '2px solid #FFFFFF',
                  }}
                >
                  {selectedUser.avatar_url ? (
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    selectedUser.full_name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase() || 'U'
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>
                    {selectedUser.full_name}
                  </div>
                  <div style={{ fontSize: '0.80rem', color: 'var(--ink-muted)', marginBottom: 5 }}>
                    {selectedUser.email}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 9px', fontSize: '0.74rem', gap: 5 }}
                    onClick={() => {
                      setPhotoUser(selectedUser);
                      setShowPhotoModal(true);
                    }}
                  >
                    <Camera size={13} />
                    <span>Foto de perfil</span>
                  </button>
                </div>
              </div>

            {/* Bloque 1: Fechas de Actividad y Auditoría */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                padding: '10px 12px',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #E2E8F0',
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} />
                  <span>Fecha de alta</span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
                  {formatDateTime(selectedUser.created_at)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} />
                  <span>Último inicio de sesión</span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: selectedUser.last_login_at ? 'var(--ink)' : 'var(--ink-muted)', marginTop: 2 }}>
                  {formatDateTime(selectedUser.last_login_at)}
                </div>
              </div>
            </div>

            {/* Bloque 2: Permisos y Configuración */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {/* Rol */}
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  Rol en el Sistema
                </label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => handleRoleChange(selectedUser, e.target.value as any)}
                  style={{ width: '100%', fontSize: '0.86rem', padding: '7px 10px' }}
                >
                  <option value="ejecutivo">Ejecutivo/a Comercial</option>
                  <option value="gerente">Gerente Comercial</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* Switch de Fotos de Tablero */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  background: '#F8FAFC',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--ink)' }}>
                    Fotos de tablero (Odómetro)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                    {selectedUser.photo_odometer_enabled
                      ? 'Habilitado: Se solicita foto del tablero'
                      : 'Deshabilitado: No requiere foto del tablero'}
                  </div>
                </div>

                <label className="toggle-switch" title="Activar/Desactivar fotos de odómetro">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedUser.photo_odometer_enabled)}
                    onChange={() => handleTogglePhotoOdometer(selectedUser)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {/* Estado de Acceso */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  background: selectedUser.is_active ? '#F0FDF4' : '#FEF2F2',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedUser.is_active ? '#BBF7D0' : '#FECACA'}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: selectedUser.is_active ? '#15803D' : '#DC2626' }}>
                    {selectedUser.is_active ? 'Cuenta Activa' : 'Cuenta Desactivada'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                    {selectedUser.is_active
                      ? 'El usuario puede ingresar y operar normalmente'
                      : 'Acceso a la plataforma bloqueado'}
                  </div>
                </div>

                {selectedUser.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => handleToggleActive(selectedUser)}
                    className={`btn btn-sm ${selectedUser.is_active ? 'btn-danger' : 'btn-primary'}`}
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    {selectedUser.is_active ? (
                      <>
                        <UserX size={13} />
                        <span>Desactivar</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={13} />
                        <span>Reactivar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Bloque 3: Restablecer Contraseña Directo */}
            <div
              style={{
                padding: '12px 14px',
                background: '#F8FAFC',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #E2E8F0',
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={14} />
                <span>Cambiar Contraseña</span>
              </div>

              <form onSubmit={handleResetPasswordDirect} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="password"
                  placeholder="Nueva contraseña (mínimo 8 caracteres)"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  style={{ flex: 1, minWidth: 200, fontSize: '0.84rem', padding: '8px 12px' }}
                />
                <button
                  type="submit"
                  disabled={resetting || !resetPasswordVal.trim()}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                >
                  <Lock size={14} />
                  <span>{resetting ? 'Guardando...' : 'Actualizar Clave'}</span>
                </button>
              </form>
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                Requiere al menos 1 mayúscula, 1 minúscula y 1 número.
              </div>
            </div>

            </div>

            {/* Footer Cerrar Fijo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                borderTop: '1px solid #F1F5F9',
                padding: '14px 24px',
                background: '#FAFAFA',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedUser(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Registrar Nuevo Usuario */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99990,
            padding: 16,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid #F1F5F9',
                flexShrink: 0,
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                Registrar Nuevo Usuario
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="custom-modal-scroll"
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* Foto de perfil opcional */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 16,
                  padding: '12px 14px',
                  background: '#F8FAFC',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--line)',
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: '#EA4800',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  {newAvatarUrl ? (
                    <img src={newAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    newName.trim() ? newName.trim().charAt(0).toUpperCase() : <Camera size={22} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)' }}>
                    Foto de perfil (opcional)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginBottom: 6 }}>
                    Si no se selecciona foto, se mostrarán las iniciales
                  </div>
                  <input
                    type="file"
                    ref={createFileInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    style={{ display: 'none' }}
                    onChange={handleCreatePhotoSelected}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                      onClick={() => createFileInputRef.current?.click()}
                    >
                      <Upload size={12} />
                      <span>{newAvatarUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                    </button>
                    {newAvatarUrl && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        onClick={() => {
                          setNewAvatarUrl(null);
                          if (createFileInputRef.current) createFileInputRef.current.value = '';
                        }}
                      >
                        <Trash2 size={12} />
                        <span>Quitar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ingresa nombre y apellido"
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

              {/* Switch de Fotos de Tablero en Crear Usuario */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '12px 14px',
                  background: 'var(--primary-lighter)',
                  border: '1.5px solid var(--primary-light)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>
                    Habilitar fotos de tablero (Odómetro)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                    Permite al usuario subir fotos del odómetro al inicio y fin de jornada
                  </div>
                </div>

                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={newPhotoOdometer}
                    onChange={(e) => setNewPhotoOdometer(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
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

      {/* Modal 3: Recorte y Carga de Foto de Perfil */}
      {showPhotoModal && photoUser && (
        <ProfilePhotoModal
          isOpen={showPhotoModal}
          onClose={() => {
            setShowPhotoModal(false);
            setPhotoUser(null);
          }}
          userId={photoUser.id}
          userName={photoUser.full_name}
          currentAvatarUrl={photoUser.avatar_url}
          onSuccess={(newUrl) => {
            setUsers((prev) =>
              prev.map((item) => (item.id === photoUser.id ? { ...item, avatar_url: newUrl } : item))
            );
            if (selectedUser && selectedUser.id === photoUser.id) {
              setSelectedUser({ ...selectedUser, avatar_url: newUrl });
            }
            if (photoUser.id === currentUser?.id) {
              updateUser({ avatarUrl: newUrl });
            }
          }}
        />
      )}
    </div>
  );
}
