import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Search,
  ChevronRight,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  zone?: string | null;
  maps_url?: string | null;
  total_visits: string | number;
  first_visit: string | null;
  last_visit: string | null;
  executors_names?: string;
}

export default function EmpresasPage() {
  const { user } = useAuth();
  const isManager = ['admin', 'gerente'].includes(user?.role || '');

  const [query, setQuery] = useState<string>('');
  const [companies, setCompanies] = useState<CompanySummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCompanies(query);
  }, []);

  const handleSearchChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCompanies(val);
    }, 280);
  };

  async function fetchCompanies(searchTerm: string) {
    setLoading(true);
    try {
      const res = await api.get<{ data: CompanySummaryItem[] }>(
        `/empresas?q=${encodeURIComponent(searchTerm)}&limit=50`
      );
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar listado de empresas');
    } finally {
      setLoading(false);
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
      case 'Sin interés':
        return <span className="pill pill-red">Sin interés</span>;
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
      </div>

      {/* Barra de búsqueda modernizada */}
      <div className="search-bar-card">
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
            Mostrando <strong>{companies.length}</strong> {companies.length === 1 ? 'empresa' : 'empresas'}
          </span>
          {query && (
            <span className="pill pill-orange">
              Filtro: "{query}"
            </span>
          )}
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
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--ink)', display: 'block' }}>{c.name}</span>
                          {c.zone && (
                            <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                              {c.zone}
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
                    <td style={{ textAlign: 'center' }}>
                      <Link
                        to={`/empresas/${c.id}`}
                        className="btn btn-secondary btn-sm"
                        title="Ver historial completo de la cuenta"
                      >
                        <span>Ver expediente</span>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Building2 size={40} />
            <p>No se encontraron empresas con el término de búsqueda ingresado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
