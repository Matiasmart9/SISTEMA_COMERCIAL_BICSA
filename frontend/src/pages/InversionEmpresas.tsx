import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  Building2,
  Calendar,
  FileSpreadsheet,
  Search,
  Users,
  Car,
  Smartphone,
  Coffee,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatGs, formatDate } from '../utils/formatters';

interface CompanyInvestment {
  company_id: string;
  company_name: string;
  department: string | null;
  city: string | null;
  commercial_status: string;
  total_visits: number;
  total_fuel_gs: string | number;
  total_platform_gs: string | number;
  total_other_gs: string | number;
  total_invested_gs: string | number;
  last_visit_date: string | null;
  executives: string[];
}

interface VisitExpenseDetail {
  id: string;
  date: string;
  company_id: string;
  company_name: string;
  executive_name: string;
  mobility_type: string;
  platform_used: string | null;
  transport_cost_gs: number;
  fuel_allocated_gs: number;
  other_expenses_gs: number;
  total_cost_gs: number;
  reason: string;
  funnel_stage: string;
  result: string;
  notes: string | null;
}

interface KPIs {
  grandTotalInvested: number;
  grandTotalFuel: number;
  grandTotalPlatform: number;
  grandTotalOther: number;
  totalCompanies: number;
  totalVisits: number;
  averagePerCompany: number;
  averagePerVisit: number;
}

interface ExecutiveUser {
  id: string;
  full_name: string;
  email: string;
}

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'Contratado':
      return <span className="pill pill-green">Contratado</span>;
    case 'En negociación':
      return <span className="pill pill-orange">En negociación</span>;
    case 'Venta perdida':
      return <span className="pill pill-red">Venta perdida</span>;
    case 'Prospecto':
      return <span className="pill pill-gray">Prospecto</span>;
    default:
      return <span className="pill pill-gray">{status || 'Prospecto'}</span>;
  }
}

export default function InversionEmpresasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const startYear = 2026;
  const availableYears = Array.from(
    { length: Math.max(1, currentYear - startYear + 1) },
    (_, i) => currentYear - i
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'empresas' | 'visitas'>('empresas');

  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [companies, setCompanies] = useState<CompanyInvestment[]>([]);
  const [visits, setVisits] = useState<VisitExpenseDetail[]>([]);
  const [executives, setExecutives] = useState<ExecutiveUser[]>([]);
  const [kpis, setKpis] = useState<KPIs>({
    grandTotalInvested: 0,
    grandTotalFuel: 0,
    grandTotalPlatform: 0,
    grandTotalOther: 0,
    totalCompanies: 0,
    totalVisits: 0,
    averagePerCompany: 0,
    averagePerVisit: 0,
  });

  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  const fetchResumen = async () => {
    try {
      setLoading(true);
      const params: any = {
        month: selectedMonth,
        year: selectedYear,
      };
      if (selectedUser) params.userId = selectedUser;

      const res = await api.get('/inversion/resumen', { params });
      setCompanies(res.data.companies || []);
      setVisits(res.data.visits || []);
      setKpis(res.data.kpis || {});
      setExecutives(res.data.executives || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar la información de inversión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, [selectedMonth, selectedYear, selectedUser]);

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      toast.loading('Generando reporte Excel...', { id: 'excel-inversion' });

      const params: any = {
        month: selectedMonth,
        year: selectedYear,
      };
      if (selectedUser) params.userId = selectedUser;

      const res = await api.get('/inversion/export/excel', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Inversion_Empresas_BICSA_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Reporte Excel descargado exitosamente', { id: 'excel-inversion' });
    } catch (err) {
      console.error(err);
      toast.error('Error al descargar el archivo Excel', { id: 'excel-inversion' });
    } finally {
      setExporting(false);
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
    (c.department && c.department.toLowerCase().includes(searchQuery.toLowerCase().trim()))
  );

  const filteredVisits = visits.filter(v =>
    v.company_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    v.executive_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="inversion-page" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              }}
            >
              <DollarSign size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                Costos Empresa
              </h1>
              <p className="muted" style={{ fontSize: '0.9rem', margin: '2px 0 0' }}>
                Medición y control de costos comerciales invertidos por cliente/empresa en cada mes
              </p>
            </div>
          </div>
        </div>

        {/* Botón Verde Excel */}
        <button
          type="button"
          className="btn btn-excel"
          onClick={handleDownloadExcel}
          disabled={exporting || loading}
          style={{ height: 44, padding: '0 20px', fontWeight: 800, fontSize: '0.92rem' }}
          title="Descargar consolidado mensual y detalle en Excel"
        >
          {exporting ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#fff', borderTopColor: 'transparent' }} />
              <span>Generando Excel...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet size={18} />
              <span>Descargar Reporte Excel</span>
            </>
          )}
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="card" style={{ padding: 18, marginBottom: 24, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Mes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={17} color="var(--primary)" />
            <label htmlFor="filter-month" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
              Mes:
            </label>
            <select
              id="filter-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--line-dark)',
                fontWeight: 700,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="filter-year" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
              Año:
            </label>
            <select
              id="filter-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--line-dark)',
                fontWeight: 700,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Ejecutivo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={17} color="var(--ink-muted)" />
            <label htmlFor="filter-user" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
              Ejecutivo:
            </label>
            <select
              id="filter-user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--line-dark)',
                fontWeight: 600,
                background: '#fff',
                minWidth: 180,
                cursor: 'pointer',
              }}
            >
              <option value="">Todos los ejecutivos</option>
              {executives.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Búsqueda por texto */}
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar por empresa o ciudad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: 40,
                  width: '100%',
                  paddingLeft: 36,
                  paddingRight: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--line-dark)',
                }}
              />
              <Search
                size={16}
                color="var(--ink-muted)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TARJETAS KPI */}
      <div className="grid-4" style={{ gap: 16, marginBottom: 24 }}>
        {/* Total Invertido */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-lg)',
            borderLeft: '5px solid #16A34A',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Total Invertido (Mes)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', marginTop: 8 }}>
            {formatGs(kpis.grandTotalInvested)}
          </div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            Promedio: {formatGs(kpis.averagePerCompany)} por empresa
          </div>
        </div>

        {/* Combustible Distribuido */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-lg)',
            borderLeft: '5px solid var(--primary)',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Combustible Distribuido
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFEDD5', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-dark)', marginTop: 8 }}>
            {formatGs(kpis.grandTotalFuel)}
          </div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            Vehículos propios comerciales
          </div>
        </div>

        {/* Traslados Plataformas */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-lg)',
            borderLeft: '5px solid #2563EB',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Plataformas (Uber/Bolt)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DBEAFE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1D4ED8', marginTop: 8 }}>
            {formatGs(kpis.grandTotalPlatform)}
          </div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            Costo directo por empresa
          </div>
        </div>

        {/* Otros Gastos (Almuerzos/Reuniones) */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-lg)',
            borderLeft: '5px solid #9333EA',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF5FF 100%)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Otros (Almuerzos/Reuniones)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coffee size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7E22CE', marginTop: 8 }}>
            {formatGs(kpis.grandTotalOther)}
          </div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            {kpis.totalCompanies} empresas / {kpis.totalVisits} visitas
          </div>
        </div>
      </div>

      {/* PESTAÑAS: RESUMEN POR EMPRESA vs DETALLE DE VISITAS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab('empresas')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: activeTab === 'empresas' ? 'var(--primary)' : '#E2E8F0',
            color: activeTab === 'empresas' ? '#FFFFFF' : 'var(--ink)',
            transition: 'all var(--transition)',
          }}
        >
          Resumen Consolidado por Empresa ({filteredCompanies.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('visitas')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: activeTab === 'visitas' ? 'var(--primary)' : '#E2E8F0',
            color: activeTab === 'visitas' ? '#FFFFFF' : 'var(--ink)',
            transition: 'all var(--transition)',
          }}
        >
          Detalle de Visitas y Recorridos ({filteredVisits.length})
        </button>
      </div>

      {/* TABLA PRINCIPAL */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p className="muted" style={{ fontWeight: 600 }}>Cargando datos de inversión comercial...</p>
        </div>
      ) : activeTab === 'empresas' ? (
        filteredCompanies.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', background: '#F8FAFC' }}>
            <Building2 size={42} color="var(--ink-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)' }}>
              No se registraron gastos comerciales en {MESES.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </h3>
            <p className="muted" style={{ fontSize: '0.88rem', margin: 0 }}>
              Pruebe cambiando el mes o ajustando los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Empresa / Institución</th>
                    <th>Estado Comercial</th>
                    <th style={{ textAlign: 'center' }}>Visitas</th>
                    <th style={{ textAlign: 'right' }}>Combustible (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>Plataformas (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>Otros (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL INVERTIDO (Gs.)</th>
                    <th>Ejecutivos</th>
                    <th style={{ textAlign: 'center' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => {
                    const isExpanded = expandedCompanyId === c.company_id;
                    const companyVisits = visits.filter(v => v.company_id === c.company_id);

                    return (
                      <React.Fragment key={c.company_id}>
                        <tr
                          style={{
                            cursor: 'pointer',
                            background: isExpanded ? '#FFF7ED' : undefined,
                          }}
                          onClick={() => setExpandedCompanyId(isExpanded ? null : c.company_id)}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <Building2 size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                              <div>
                                <span
                                  style={{ fontWeight: 800, color: 'var(--ink)', display: 'block', fontSize: '0.92rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/empresas/${c.company_id}`);
                                  }}
                                  title="Ver expediente completo"
                                >
                                  {c.company_name}
                                </span>
                                {(c.city || c.department) && (
                                  <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                                    {[c.city, c.department].filter(Boolean).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{getStatusBadge(c.commercial_status)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>
                            <span className="pill pill-orange">{c.total_visits}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink-muted)' }}>
                            {formatGs(Number(c.total_fuel_gs))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#1D4ED8' }}>
                            {formatGs(Number(c.total_platform_gs))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#7E22CE' }}>
                            {formatGs(Number(c.total_other_gs))}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: '0.92rem',
                                fontWeight: 900,
                                color: '#15803D',
                                background: '#DCFCE7',
                                padding: '4px 10px',
                                borderRadius: 6,
                                display: 'inline-block',
                              }}
                            >
                              {formatGs(Number(c.total_invested_gs))}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                            {c.executives ? c.executives.join(', ') : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon"
                              style={{ width: 32, height: 32 }}
                              title={isExpanded ? 'Ocultar visitas' : 'Ver visitas'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>

                        {/* FILA EXPANDIBLE CON LAS VISITAS DE ESTA EMPRESA */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} style={{ padding: '16px 20px', background: '#FFFDF9', borderBottom: '2px solid #FDBA74' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-dark)', marginBottom: 10 }}>
                                Detalle de visitas registradas a {c.company_name} en este período ({companyVisits.length}):
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {companyVisits.map((v) => (
                                  <div
                                    key={v.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: 12,
                                      padding: '10px 14px',
                                      background: '#FFFFFF',
                                      border: '1px solid var(--line)',
                                      borderRadius: 'var(--radius-md)',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>
                                        {formatDate(v.date)} — <span className="muted" style={{ fontWeight: 600 }}>por {v.executive_name}</span>
                                      </div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                                        Motivo: <strong>{v.reason}</strong> | Etapa: <strong>{v.funnel_stage}</strong> | Resultado: <strong>{v.result}</strong>
                                      </div>
                                      {v.notes && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2, fontStyle: 'italic' }}>
                                          "{v.notes}"
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      {v.fuel_allocated_gs > 0 && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#FFEDD5', color: '#C2410C', padding: '2px 8px', borderRadius: 4 }}>
                                          Combustible: {formatGs(v.fuel_allocated_gs)}
                                        </span>
                                      )}
                                      {v.transport_cost_gs > 0 && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 4 }}>
                                          {v.platform_used || 'Plataforma'}: {formatGs(v.transport_cost_gs)}
                                        </span>
                                      )}
                                      {v.other_expenses_gs > 0 && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 4 }}>
                                          Otros: {formatGs(v.other_expenses_gs)}
                                        </span>
                                      )}
                                      <span style={{ fontSize: '0.82rem', fontWeight: 900, background: '#FEF3C7', color: '#B45309', padding: '3px 9px', borderRadius: 6 }}>
                                        Total: {formatGs(v.total_cost_gs)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* TABLA DE DETALLE DE TODAS LAS VISITAS */
        filteredVisits.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', background: '#F8FAFC' }}>
            <p className="muted" style={{ fontWeight: 600, margin: 0 }}>No se encontraron visitas para mostrar.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empresa</th>
                    <th>Ejecutivo</th>
                    <th>Movilidad</th>
                    <th style={{ textAlign: 'right' }}>Combustible (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>Plataforma (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>Otros (Gs.)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL VISITA (Gs.)</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {formatDate(v.date)}
                      </td>
                      <td>
                        <span
                          style={{ fontWeight: 800, color: 'var(--ink)', cursor: 'pointer' }}
                          onClick={() => navigate(`/empresas/${v.company_id}`)}
                          title="Ver empresa"
                        >
                          {v.company_name}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{v.executive_name}</td>
                      <td>
                        <span className="pill pill-gray" style={{ fontSize: '0.72rem' }}>
                          {v.mobility_type === 'propia' ? 'Vehículo Propio' : `Plataforma (${v.platform_used || 'Bolt'})`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink-muted)' }}>
                        {formatGs(v.fuel_allocated_gs)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1D4ED8' }}>
                        {formatGs(v.transport_cost_gs)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#7E22CE' }}>
                        {formatGs(v.other_expenses_gs)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803D' }}>
                        {formatGs(v.total_cost_gs)}
                      </td>
                      <td>
                        <span className="pill pill-blue" style={{ fontSize: '0.74rem' }}>
                          {v.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
