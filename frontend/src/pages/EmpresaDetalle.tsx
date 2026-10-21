import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  ArrowLeft,
  MapPin,
  ExternalLink,
  X,
  PlusCircle,
  Save,
  Edit3,
  Calendar,
  FileText,
  Clock,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatThousands, parseThousands, formatGs } from '../utils/formatters';
import { DEPARTAMENTOS_PARAGUAY, getCiudadesPorDepartamento } from '../data/paraguayLocations';

interface Company {
  id: string;
  name: string;
  commercial_status: string;
  department?: string | null;
  city?: string | null;
  zone?: string | null;
  maps_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

interface CompanyVisit {
  id: string;
  date: string;
  visit_type: string;
  zone: string | null;
  maps_url: string | null;
  reason: string;
  funnel_stage: string;
  result: string;
  uber_ref_gs: number | null;
  bolt_ref_gs: number | null;
  notes: string | null;
  user_name: string;
  km_total: number;
}

export default function EmpresaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isManager = ['admin', 'gerente'].includes(user?.role || '');

  const [company, setCompany] = useState<Company | null>(null);
  const [visits, setVisits] = useState<CompanyVisit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modal de edición de datos de la empresa
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDepartment, setEditDepartment] = useState<string>('Central');
  const [editCity, setEditCity] = useState<string>('San Lorenzo');
  const [editZone, setEditZone] = useState<string>('');
  const [editMapsUrl, setEditMapsUrl] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('Prospecto');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  // Modal de nuevo seguimiento directo
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);
  const [followUpDate, setFollowUpDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [followUpVisitType, setFollowUpVisitType] = useState<string>('Prospecto en seguimiento');
  const [followUpReason, setFollowUpReason] = useState<string>('Seguimiento comercial');
  const [followUpFunnelStage, setFollowUpFunnelStage] = useState<string>('Negociación');
  const [followUpResult, setFollowUpResult] = useState<string>('En negociación');
  const [followUpZone, setFollowUpZone] = useState<string>('');
  const [followUpMapsUrl, setFollowUpMapsUrl] = useState<string>('');
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [followUpUber, setFollowUpUber] = useState<string>('');
  const [followUpBolt, setFollowUpBolt] = useState<string>('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      loadCompanyDetail(id);
    }
  }, [id]);

  async function loadCompanyDetail(companyId: string) {
    setLoading(true);
    try {
      const res = await api.get<{ company: Company; visits: CompanyVisit[] }>(
        `/empresas/${companyId}`
      );
      const c = res.data.company;
      setCompany(c);
      setVisits(res.data.visits || []);
      setSelectedStatus(c.commercial_status);
      setEditName(c.name || '');

      let dept = c.department || '';
      if (!dept) {
        if (c.zone?.toLowerCase().includes('asunci') || c.city?.toLowerCase().includes('asunci')) {
          dept = 'Asunción (Distrito Capital)';
        } else {
          dept = 'Central';
        }
      } else if (dept === 'Capital') {
        dept = 'Asunción (Distrito Capital)';
      }
      setEditDepartment(dept);

      const availableCities = getCiudadesPorDepartamento(dept);
      const city = c.city && availableCities.includes(c.city)
        ? c.city
        : (availableCities[0] || 'San Lorenzo');
      setEditCity(city);

      setEditZone(c.zone || '');
      setEditMapsUrl(c.maps_url || '');
      setEditNotes(c.notes || '');
      setEditStatus(c.commercial_status || 'Prospecto');

      // Prellenar seguimiento con datos principales de la empresa
      setFollowUpZone(c.zone || '');
      setFollowUpMapsUrl(c.maps_url || '');
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar detalle de la empresa');
    } finally {
      setLoading(false);
    }
  }

  function openEditModal() {
    if (!company) return;
    setEditName(company.name || '');

    let dept = company.department || '';
    if (!dept) {
      if (company.zone?.toLowerCase().includes('asunci') || company.city?.toLowerCase().includes('asunci')) {
        dept = 'Asunción (Distrito Capital)';
      } else {
        dept = 'Central';
      }
    } else if (dept === 'Capital') {
      dept = 'Asunción (Distrito Capital)';
    }
    setEditDepartment(dept);

    const availableCities = getCiudadesPorDepartamento(dept);
    const city = company.city && availableCities.includes(company.city)
      ? company.city
      : (availableCities[0] || 'San Lorenzo');
    setEditCity(city);

    setEditZone(company.zone || '');
    setEditMapsUrl(company.maps_url || '');
    setEditNotes(company.notes || '');
    setEditStatus(company.commercial_status || 'Prospecto');
    setShowEditModal(true);
  }

  async function handleUpdateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editName.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    if (!editDepartment) {
      toast.error('Seleccione el departamento (INE)');
      return;
    }
    if (!editCity) {
      toast.error('Seleccione la ciudad / municipio (INE)');
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await api.put(`/empresas/${id}`, {
        name: editName.trim(),
        department: editDepartment.trim(),
        city: editCity.trim(),
        zone: editZone.trim(),
        mapsUrl: editMapsUrl.trim(),
        notes: editNotes.trim(),
        commercialStatus: editStatus,
      });
      setCompany(res.data.company);
      setSelectedStatus(res.data.company.commercial_status);
      toast.success('¡Datos de la empresa actualizados exitosamente!');
      setShowEditModal(false);
      loadCompanyDetail(id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al actualizar datos de la empresa');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleCreateFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setFollowUpSubmitting(true);
    try {
      await api.post(`/empresas/${id}/visitas`, {
        date: followUpDate,
        visitType: followUpVisitType,
        reason: followUpReason,
        funnelStage: followUpFunnelStage,
        result: followUpResult,
        zone: followUpZone.trim() || undefined,
        mapsUrl: followUpMapsUrl.trim() || undefined,
        notes: followUpNotes.trim() || undefined,
        uberRefGs: followUpUber ? parseThousands(followUpUber) : undefined,
        boltRefGs: followUpBolt ? parseThousands(followUpBolt) : undefined,
      });
      toast.success('¡Seguimiento registrado exitosamente en el expediente!');
      setShowFollowUpModal(false);
      setFollowUpNotes('');
      setFollowUpUber('');
      setFollowUpBolt('');
      loadCompanyDetail(id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al registrar seguimiento');
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!id || !newStatus) return;
    setStatusUpdating(true);
    try {
      await api.patch(`/empresas/${id}/status`, { commercialStatus: newStatus });
      setSelectedStatus(newStatus);
      if (company) {
        setCompany({ ...company, commercial_status: newStatus });
      }
      toast.success('Estado comercial actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar estado comercial');
    } finally {
      setStatusUpdating(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Contratado':
        return <span className="pill pill-green">Contratado</span>;
      case 'En negociación':
        return <span className="pill pill-orange">En negociación</span>;
      case 'Prospecto':
        return <span className="pill pill-yellow">Prospecto</span>;
      case 'Venta perdida':
      case 'Sin interés':
        return <span className="pill pill-red">Venta perdida</span>;
      case 'Inactivo':
        return <span className="pill pill-gray">Inactivo</span>;
      default:
        return <span className="pill pill-gray">{status}</span>;
    }
  };

  const getResultPillClass = (result: string) => {
    switch (result) {
      case 'Contratado':
        return 'pill-green';
      case 'Propuesta enviada':
      case 'En negociación':
        return 'pill-orange';
      case 'Venta perdida':
      case 'Sin interés':
        return 'pill-red';
      default:
        return 'pill-gray';
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="empty-state">
        <Building2 size={40} />
        <p>Empresa no encontrada.</p>
        <Link to="/empresas" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          ← Volver a empresas
        </Link>
      </div>
    );
  }

  return (
    <div className="empresa-detalle-page">
      {/* Botón Volver */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/empresas" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', paddingLeft: 0 }}>
          <ArrowLeft size={16} />
          <span>Volver al directorio de empresas</span>
        </Link>
      </div>

      {/* Ficha Principal de la Empresa */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Building2 size={26} color="var(--primary)" />
              <h1 style={{ fontSize: '1.65rem', color: 'var(--ink)', margin: 0, fontWeight: 800 }}>
                {company.name}
              </h1>
              <button
                id="btn-editar-empresa"
                type="button"
                onClick={openEditModal}
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 8 }}
                title="Editar datos de la empresa"
              >
                <Edit3 size={14} />
                <span>Editar datos</span>
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="muted flex items-center gap-1" style={{ fontSize: '0.85rem' }}>
                <Calendar size={13} />
                <span>Registrada: {formatDate(company.created_at)}</span>
              </span>
              <span>•</span>
              <span className="muted flex items-center gap-1" style={{ fontSize: '0.85rem' }}>
                <Clock size={13} />
                <span>Total de visitas: <strong>{visits.length}</strong></span>
              </span>
            </div>
          </div>

          {/* Estado comercial y selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink-muted)', marginBottom: 4, letterSpacing: '0.8px' }}>
                ESTADO COMERCIAL
              </div>
              {getStatusBadge(company.commercial_status)}
            </div>

            {isManager && (
              <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14, marginLeft: 6 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                  Cambiar estado:
                </label>
                <select
                  disabled={statusUpdating}
                  value={selectedStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--line-dark)',
                    fontSize: '0.85rem',
                    background: '#fff',
                    fontWeight: 600,
                  }}
                >
                  <option value="Prospecto">Prospecto</option>
                  <option value="En negociación">En negociación</option>
                  <option value="Contratado">Contratado</option>
                  <option value="Venta perdida">Venta perdida</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Datos clave de la Empresa (Dirección, Maps, Notas) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            background: 'var(--surface-2)',
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #FFE4D3',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }} className="flex items-center gap-1">
              <MapPin size={13} />
              <span>UBICACIÓN / CIUDAD</span>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.92rem' }}>
              {company.city && company.department ? (
                <span>{company.city}, {company.department}</span>
              ) : company.city || company.department ? (
                <span>{company.city || company.department}</span>
              ) : (
                company.zone || <span className="muted" style={{ fontStyle: 'italic', fontWeight: 400 }}>No especificada</span>
              )}
            </div>
            {company.zone && (company.city || company.department) && (
              <div className="muted" style={{ fontSize: '0.8rem', marginTop: 3 }}>
                {company.zone}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }} className="flex items-center gap-1">
              <Compass size={13} />
              <span>UBICACIÓN GOOGLE MAPS</span>
            </div>
            <div>
              {company.maps_url ? (
                <a
                  href={company.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                  style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}
                >
                  <span>Abrir enlace en Google Maps</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className="muted" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>Sin enlace registrado</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }} className="flex items-center gap-1">
              <FileText size={13} />
              <span>NOTAS / OBSERVACIONES GENERALES</span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
              {company.notes || <span className="muted" style={{ fontStyle: 'italic' }}>Sin observaciones registradas</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Historial cronológico de visitas a esta empresa */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 className="card-title">
            Historial de Visitas y Contactos ({visits.length})
          </h2>
          <button
            id="btn-registrar-seguimiento"
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowFollowUpModal(true)}
          >
            <PlusCircle size={16} />
            <span>Registrar seguimiento</span>
          </button>
        </div>

        {visits.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {visits.map((v) => (
              <div
                key={v.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-md)',
                  padding: 18,
                  background: '#fffdfb',
                  borderLeft: '4px solid var(--primary)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>
                      {formatDate(v.date)}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                      por <strong>{v.user_name}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="pill pill-orange">{v.funnel_stage}</span>
                    <span className={`pill ${getResultPillClass(v.result)}`}>{v.result}</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    fontSize: '0.88rem',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <span className="muted">Tipo de visita:</span> <strong>{v.visit_type}</strong>
                  </div>
                  <div>
                    <span className="muted">Motivo:</span> <strong>{v.reason}</strong>
                  </div>
                  {v.zone && (
                    <div>
                      <span className="muted">Ciudad / Zona:</span> {v.zone}
                    </div>
                  )}
                  {v.maps_url && (
                    <div>
                      <a
                        href={v.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <MapPin size={13} />
                        <span>Ver en Google Maps</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>

                {(v.uber_ref_gs || v.bolt_ref_gs) && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      background: 'var(--surface-2)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-flex',
                      gap: 14,
                      marginBottom: 8,
                    }}
                  >
                    {v.uber_ref_gs && (
                      <span>Uber ref. ida: <strong>{formatGs(v.uber_ref_gs)}</strong></span>
                    )}
                    {v.bolt_ref_gs && (
                      <span>Bolt ref. ida: <strong>{formatGs(v.bolt_ref_gs)}</strong></span>
                    )}
                  </div>
                )}

                {v.notes && (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      fontSize: '0.88rem',
                      color: 'var(--ink)',
                      marginTop: 6,
                    }}
                  >
                    <strong>Observaciones:</strong> {v.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Building2 size={40} />
            <p>No hay visitas registradas para esta empresa todavía.</p>
          </div>
        )}
      </div>

      {/* Modal: Editar Datos de la Empresa */}
      {showEditModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !editSubmitting && setShowEditModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 540,
              width: '100%',
              maxHeight: 'min(86vh, 620px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid var(--line)', background: '#fff', flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <Building2 size={20} color="var(--primary)" />
                <h2 style={{ fontSize: '1.25rem', color: 'var(--ink)', margin: 0 }}>Editar Datos de Empresa</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn btn-secondary btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario con cuerpo scrolleable y pie fijo */}
            <form
              onSubmit={handleUpdateCompany}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label htmlFor="edit-empresa-nombre" style={{ fontWeight: 700 }}>
                    Nombre de la Empresa *
                  </label>
                  <input
                    id="edit-empresa-nombre"
                    type="text"
                    required
                    placeholder="Ej. Comercial Horizonte S.A."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ height: 42, fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label htmlFor="edit-empresa-departamento" style={{ fontWeight: 700 }}>
                      Departamento (INE) *
                    </label>
                    <select
                      id="edit-empresa-departamento"
                      value={editDepartment}
                      onChange={(e) => {
                        const dept = e.target.value;
                        setEditDepartment(dept);
                        const cities = getCiudadesPorDepartamento(dept);
                        if (cities.length > 0) setEditCity(cities[0]);
                        else setEditCity('');
                      }}
                      required
                      style={{ height: 42, fontWeight: 600 }}
                    >
                      {DEPARTAMENTOS_PARAGUAY.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="edit-empresa-ciudad" style={{ fontWeight: 700 }}>
                      Ciudad / Municipio (INE) *
                    </label>
                    <select
                      id="edit-empresa-ciudad"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      required
                      style={{ height: 42, fontWeight: 600 }}
                    >
                      {getCiudadesPorDepartamento(editDepartment).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="edit-empresa-zona" style={{ fontWeight: 700 }}>
                    Dirección o barrio específico (opcional)
                  </label>
                  <input
                    id="edit-empresa-zona"
                    type="text"
                    placeholder="Ej. B° Villa Morra, Av. Mcal. López c/ San Martín"
                    value={editZone}
                    onChange={(e) => setEditZone(e.target.value)}
                    style={{ height: 42 }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-empresa-maps" style={{ fontWeight: 700 }}>
                    Enlace Google Maps (opcional)
                  </label>
                  <input
                    id="edit-empresa-maps"
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={editMapsUrl}
                    onChange={(e) => setEditMapsUrl(e.target.value)}
                    style={{ height: 42 }}
                  />
                </div>

                <div className="field">
                  <label>Estado Comercial</label>
                  <select
                    id="edit-empresa-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Prospecto">Prospecto</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Contratado">Contratado</option>
                    <option value="Venta perdida">Venta perdida</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Notas / Observaciones generales de la empresa</label>
                  <textarea
                    id="edit-empresa-notas"
                    rows={3}
                    placeholder="Rubro, decisores, teléfono o detalles relevantes..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer Fijo Siempre Visible */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 22px', background: '#F8FAFC', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  id="btn-guardar-edicion-empresa"
                  type="submit"
                  disabled={editSubmitting}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  <span>{editSubmitting ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Registrar seguimiento directo */}
      {showFollowUpModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => !followUpSubmitting && setShowFollowUpModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 560,
              width: '100%',
              maxHeight: 'min(86vh, 620px)',
              overflowY: 'auto',
              padding: 24,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>Registrar seguimiento</h2>
              <button type="button" onClick={() => setShowFollowUpModal(false)} className="btn btn-secondary btn-icon">
                <X size={18} />
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
              {company.name} — se vinculará a tu jornada de la fecha elegida (o se creará una automáticamente).
            </p>

            <form onSubmit={handleCreateFollowUp}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 14px' }}>
                <div className="field">
                  <label>Fecha *</label>
                  <input
                    id="seguimiento-fecha"
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Tipo de visita *</label>
                  <select id="seguimiento-tipo" value={followUpVisitType} onChange={(e) => setFollowUpVisitType(e.target.value)}>
                    <option value="Nueva visita">Nueva visita</option>
                    <option value="Prospecto en seguimiento">Prospecto en seguimiento</option>
                    <option value="Cliente actual">Cliente actual</option>
                  </select>
                </div>
                <div className="field">
                  <label>Motivo *</label>
                  <select id="seguimiento-motivo" value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)}>
                    <option value="Prospección">Prospección</option>
                    <option value="Presentación de servicios">Presentación de servicios</option>
                    <option value="Seguimiento comercial">Seguimiento comercial</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Fidelización">Fidelización</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="field">
                  <label>Etapa del embudo *</label>
                  <select id="seguimiento-etapa" value={followUpFunnelStage} onChange={(e) => setFollowUpFunnelStage(e.target.value)}>
                    <option value="Prospección">Prospección</option>
                    <option value="Contacto con decisor">Contacto con decisor</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Contrato">Contrato</option>
                    <option value="Venta ganada / Suscripción">Venta ganada / Suscripción</option>
                  </select>
                </div>
                <div className="field">
                  <label>Resultado *</label>
                  <select id="seguimiento-resultado" value={followUpResult} onChange={(e) => setFollowUpResult(e.target.value)}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Propuesta enviada">Propuesta enviada</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Contratado">Contratado</option>
                    <option value="Venta perdida">Venta perdida</option>
                    <option value="Visita realizada">Visita realizada</option>
                  </select>
                </div>
                <div className="field">
                  <label>Ciudad / Zona</label>
                  <input
                    id="seguimiento-zona"
                    type="text"
                    placeholder="Ej. Asunción - Villa Morra"
                    value={followUpZone}
                    onChange={(e) => setFollowUpZone(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label>URL Google Maps</label>
                <input
                  id="seguimiento-maps"
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={followUpMapsUrl}
                  onChange={(e) => setFollowUpMapsUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <div className="field">
                  <label>Ref. Uber ida (Gs.)</label>
                  <input
                    id="seguimiento-uber"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 35.000"
                    value={formatThousands(followUpUber)}
                    onChange={(e) => setFollowUpUber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="field">
                  <label>Ref. Bolt ida (Gs.)</label>
                  <input
                    id="seguimiento-bolt"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 30.000"
                    value={formatThousands(followUpBolt)}
                    onChange={(e) => setFollowUpBolt(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="field">
                <label>Observaciones</label>
                <textarea
                  id="seguimiento-notas"
                  rows={3}
                  placeholder="Detalle del contacto, próximos pasos..."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowFollowUpModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button id="seguimiento-guardar" type="submit" disabled={followUpSubmitting} className="btn btn-primary">
                  <Save size={16} />
                  <span>{followUpSubmitting ? 'Guardando...' : 'Guardar seguimiento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
