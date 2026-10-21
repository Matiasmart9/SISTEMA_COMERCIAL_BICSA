import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Search,
  ChevronRight,
  X,
  Filter,
  FileSpreadsheet,
  Plus,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DEPARTAMENTOS_PARAGUAY, getCiudadesPorDepartamento } from '../data/paraguayLocations';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('es-PY');
  } catch {
    return '-';
  }
}

interface CompanySummaryItem {
  id: string;
  name: string;
  commercial_status: string;
  department?: string | null;
  city?: string | null;
  zone?: string | null;
  maps_url?: string | null;
  total_visits: string | number;
  first_visit: string | null;
  last_visit: string | null;
  executors_names?: string;
}

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = ['admin', 'gerente'].includes(user?.role || '');

  const [query, setQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [companies, setCompanies] = useState<CompanySummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal para Agregar Nueva Empresa
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addName, setAddName] = useState<string>('');
  const [addDepartment, setAddDepartment] = useState<string>('Central');
  const [addCity, setAddCity] = useState<string>('San Lorenzo');
  const [addZone, setAddZone] = useState<string>('');
  const [addMapsUrl, setAddMapsUrl] = useState<string>('');
  const [addStatus, setAddStatus] = useState<string>('Prospecto');
  const [addNotes, setAddNotes] = useState<string>('');
  const [addSubmitting, setAddSubmitting] = useState<boolean>(false);

  const openAddModal = () => {
    setAddName('');
    setAddDepartment('Central');
    const cities = getCiudadesPorDepartamento('Central');
    setAddCity(cities.includes('San Lorenzo') ? 'San Lorenzo' : cities[0] || '');
    setAddZone('');
    setAddMapsUrl('');
    setAddStatus('Prospecto');
    setAddNotes('');
    setShowAddModal(true);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    if (!addDepartment) {
      toast.error('Seleccione el departamento (INE)');
      return;
    }
    if (!addCity) {
      toast.error('Seleccione la ciudad / municipio (INE)');
      return;
    }

    setAddSubmitting(true);
    try {
      const res = await api.post('/empresas', {
        name: addName.trim(),
        department: addDepartment.trim(),
        city: addCity.trim(),
        zone: addZone.trim(),
        mapsUrl: addMapsUrl.trim(),
        commercialStatus: addStatus,
        notes: addNotes.trim(),
      });
      toast.success(`¡Empresa "${res.data.company.name}" creada con éxito!`, { icon: '🏢' });
      setShowAddModal(false);
      fetchCompanies(query, statusFilter);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al registrar la empresa');
    } finally {
      setAddSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCompanies(query, statusFilter);
  }, []);

  const handleSearchChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCompanies(val, statusFilter);
    }, 280);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    fetchCompanies(query, val);
  };

  async function fetchCompanies(searchTerm: string, status: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('q', searchTerm.trim());
      if (status && status !== 'all') params.append('status', status);
      params.append('limit', '100');

      const res = await api.get<{ data: CompanySummaryItem[] }>(
        `/empresas?${params.toString()}`
      );
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar listado de empresas');
    } finally {
      setLoading(false);
    }
  }

  // Descarga de Excel con los filtros aplicados
  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await api.get(`/empresas/export/excel?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `BICSA_Empresas_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('¡Planilla Excel de empresas descargada con éxito!', { icon: '📊' });
    } catch (err) {
      console.error(err);
      toast.error('Error al descargar el archivo Excel');
    } finally {
      setExporting(false);
    }
  };

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
        return <span className="pill pill-gray">{status || 'Prospecto'}</span>;
    }
  };

  return (
    <div className="empresas-page">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Directorio de Empresas
          </h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {isManager
              ? 'Cartera global de empresas contactadas por el equipo comercial de BICSA'
              : 'Empresas y prospectos asignados o contactados por su usuario'}
          </p>
        </div>

        <button
          id="btn-abrir-agregar-empresa"
          type="button"
          className="btn btn-primary"
          onClick={openAddModal}
          style={{ height: 42, padding: '0 18px', fontWeight: 700 }}
        >
          <Plus size={18} />
          <span>Agregar Empresa</span>
        </button>
      </div>

      {/* Barra de búsqueda, filtro de estado y exportación a Excel */}
      <div className="search-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          {/* Búsqueda por texto */}
          <div className="search-input-wrapper">
            <div className="search-input-icon">
              <Search size={18} />
            </div>
            <input
              type="text"
              className="search-input-field"
              placeholder="Buscar por nombre de empresa (ej. Horizonte, Ñandutí)..."
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => handleSearchChange('')}
                title="Borrar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtro por Estado Comercial */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--ink-muted)" style={{ flexShrink: 0 }} />
            <select
              id="filtro-estado-comercial"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              style={{
                height: 44,
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--line-dark)',
                background: '#FFFFFF',
                color: 'var(--ink)',
                fontSize: '0.9rem',
                fontWeight: 600,
                minWidth: 190,
                cursor: 'pointer',
              }}
            >
              <option value="">Todos los estados</option>
              <option value="Prospecto">Prospecto</option>
              <option value="En negociación">En negociación</option>
              <option value="Contratado">Contratado</option>
              <option value="Venta perdida">Venta perdida</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Acciones: Contador de resultados y Botón verde Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
              Mostrando <strong>{companies.length}</strong> {companies.length === 1 ? 'empresa' : 'empresas'}
            </span>
            {statusFilter && (
              <span className="pill pill-orange">
                Estado: {statusFilter}
              </span>
            )}
            {query && (
              <span className="pill pill-orange">
                Filtro: "{query}"
              </span>
            )}
          </div>

          {/* Botón color verde Excel */}
          <button
            type="button"
            className="btn btn-excel"
            onClick={handleDownloadExcel}
            disabled={exporting}
            style={{ height: 44, padding: '0 18px' }}
            title="Descargar listado de empresas filtradas en Excel (.xlsx)"
          >
            {exporting ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#fff', borderTopColor: 'transparent' }} />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet size={18} />
                <span>Descargar Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Listado de empresas */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Empresas Encontradas ({companies.length})</h2>
        </div>

        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        ) : companies.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Empresa</th>
                  <th>Estado Comercial</th>
                  <th style={{ textAlign: 'center' }}>Total Visitas</th>
                  <th>Primera Visita</th>
                  <th>Última Visita</th>
                  {isManager && <th>Ejecutivos Involucrados</th>}
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const locationText = [c.city, c.department].filter(Boolean).join(', ') || c.zone;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/empresas/${c.id}`)}
                      className="table-row-clickable"
                      style={{ cursor: 'pointer' }}
                      title={`Clic para ver expediente de ${c.name}`}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <Building2 size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--ink)', display: 'block' }}>{c.name}</span>
                            {locationText && (
                              <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                                {locationText}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{getStatusBadge(c.commercial_status)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span className="pill pill-orange">{c.total_visits}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {formatDate(c.first_visit)}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {formatDate(c.last_visit)}
                      </td>
                      {isManager && (
                        <td style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                          {c.executors_names || '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Building2 size={40} />
            <p>No se encontraron empresas con los filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Modal: Agregar Empresa */}
      {showAddModal && createPortal(
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
          onClick={() => !addSubmitting && setShowAddModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 600,
              width: '100%',
              maxHeight: 'min(90vh, 700px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 22px',
                borderBottom: '1px solid var(--line)',
                flexShrink: 0,
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  style={{
                    background: 'var(--primary-subtle)',
                    padding: 8,
                    borderRadius: 10,
                    color: 'var(--primary)',
                    display: 'flex',
                  }}
                >
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--ink)', margin: 0, fontWeight: 700 }}>
                    Registrar Nueva Empresa
                  </h2>
                  <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
                    Carga de empresa en la cartera comercial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn btn-secondary btn-icon"
                disabled={addSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario con Scroll Interno */}
            <form
              onSubmit={handleCreateCompany}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <div
                style={{
                  padding: '20px 22px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div className="field">
                  <label htmlFor="add-empresa-nombre" style={{ fontWeight: 700 }}>
                    Nombre de la Empresa *
                  </label>
                  <input
                    id="add-empresa-nombre"
                    type="text"
                    required
                    placeholder="Ej. Distribuidora del Este S.A."
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    autoFocus
                    style={{ height: 42 }}
                  />
                </div>

                {/* Localización INE: Departamento y Ciudad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 14px' }}>
                  <div className="field">
                    <label htmlFor="add-empresa-depto" style={{ fontWeight: 700 }}>
                      Departamento (INE) *
                    </label>
                    <select
                      id="add-empresa-depto"
                      value={addDepartment}
                      onChange={(e) => {
                        const dept = e.target.value;
                        setAddDepartment(dept);
                        const cities = getCiudadesPorDepartamento(dept);
                        if (cities.length > 0) setAddCity(cities[0]);
                        else setAddCity('');
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
                    <label htmlFor="add-empresa-ciudad" style={{ fontWeight: 700 }}>
                      Ciudad / Municipio (INE) *
                    </label>
                    <select
                      id="add-empresa-ciudad"
                      value={addCity}
                      onChange={(e) => setAddCity(e.target.value)}
                      required
                      style={{ height: 42, fontWeight: 600 }}
                    >
                      {getCiudadesPorDepartamento(addDepartment).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="add-empresa-zona" style={{ fontWeight: 700 }}>
                    Dirección o barrio específico (opcional)
                  </label>
                  <input
                    id="add-empresa-zona"
                    type="text"
                    placeholder="Ej. B° Villa Morra, Av. Mcal. López c/ San Martín"
                    value={addZone}
                    onChange={(e) => setAddZone(e.target.value)}
                    style={{ height: 42 }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="add-empresa-maps" style={{ fontWeight: 700 }}>
                    Enlace Google Maps (opcional)
                  </label>
                  <input
                    id="add-empresa-maps"
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={addMapsUrl}
                    onChange={(e) => setAddMapsUrl(e.target.value)}
                    style={{ height: 42 }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="add-empresa-status" style={{ fontWeight: 700 }}>
                    Estado Comercial Inicial
                  </label>
                  <select
                    id="add-empresa-status"
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    style={{ height: 42, fontWeight: 600 }}
                  >
                    <option value="Prospecto">Prospecto</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Contratado">Contratado</option>
                    <option value="Venta perdida">Venta perdida</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="add-empresa-notas" style={{ fontWeight: 700 }}>
                    Notas / Observaciones generales de la empresa (opcional)
                  </label>
                  <textarea
                    id="add-empresa-notas"
                    rows={3}
                    placeholder="Contacto principal, rubro, teléfono o comentarios..."
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer Fijo Siempre Visible */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  padding: '12px 22px',
                  background: '#F8FAFC',
                  borderTop: '1px solid var(--line)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={addSubmitting}
                >
                  Cancelar
                </button>
                <button
                  id="btn-guardar-nueva-empresa"
                  type="submit"
                  disabled={addSubmitting}
                  className="btn btn-primary"
                >
                  <Building2 size={16} />
                  <span>{addSubmitting ? 'Registrando...' : 'Registrar Empresa'}</span>
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
