import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Car,
  Building2,
  TrendingUp,
  PlusCircle,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ManagerInsights from '../components/ManagerInsights';

interface KPIs {
  total_jornadas: string | number;
  total_km: string | number;
  total_visitas: string | number;
  empresas_distintas: string | number;
  contrataciones: string | number;
}

interface MonthlyCounterData {
  month: string;
  rows: Array<{
    userId: string;
    userName: string;
    [stage: string]: string | number;
    total: number;
  }>;
  totals: Record<string, number>;
  stages: string[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyCounterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Cargar meses disponibles al iniciar
  useEffect(() => {
    async function fetchMonths() {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      try {
        const res = await api.get<string[]>('/dashboard/available-months');
        let months = res.data;

        // Asegurar que el mes en curso siempre esté presente en las opciones
        if (!months.includes(currentMonth)) {
          months = [currentMonth, ...months];
        }

        setAvailableMonths(months);
        // Siempre arrancar en el mes actual
        setSelectedMonth(currentMonth);
      } catch (err) {
        console.error('Error al cargar meses:', err);
        setAvailableMonths([currentMonth]);
        setSelectedMonth(currentMonth);
      }
    }
    fetchMonths();
  }, []);

  // Cargar datos al cambiar de mes
  useEffect(() => {
    if (!selectedMonth) return;
    loadDashboardData(selectedMonth);
  }, [selectedMonth]);

  async function loadDashboardData(month: string) {
    try {
      setLoading(true);
      const [kpiRes, counterRes] = await Promise.all([
        api.get<KPIs>(`/dashboard/kpis?month=${month}`),
        api.get<MonthlyCounterData>(`/dashboard/monthly-counter?month=${month}`),
      ]);
      setKpis(kpiRes.data);
      setMonthlyData(counterRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar datos del tablero');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    if (!selectedMonth) return;
    setRefreshing(true);
    loadDashboardData(selectedMonth);
  }

  const formatMonthLabel = (m: string) => {
    if (!m) return '';
    const [year, month] = m.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const idx = parseInt(month, 10) - 1;
    return `${monthNames[idx] || month} ${year}`;
  };

  return (
    <div className="dashboard-page">
      {/* Encabezado con selector de mes y acciones */}
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Panel de Control Comercial
          </h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {user?.role === 'ejecutivo'
              ? `Bienvenida/o, ${user.fullName}. Visualizando tu desempeño.`
              : `Bienvenida/o, ${user?.fullName}. Resumen consolidado del equipo comercial.`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
              Período:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--line-dark)',
                background: '#fff',
                fontWeight: 600,
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {availableMonths.length > 0 ? (
                availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))
              ) : (
                <option value={selectedMonth}>{formatMonthLabel(selectedMonth)}</option>
              )}
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
            <span>Actualizar</span>
          </button>

          <Link to="/nueva-jornada" className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Registrar Jornada</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Tarjetas KPI */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon">
                <Calendar size={24} />
              </div>
              <div className="kpi-label">Jornadas</div>
              <div className="kpi-value">{kpis?.total_jornadas || 0}</div>
              <div className="subtle" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Días de salida registrados
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon">
                <Car size={24} />
              </div>
              <div className="kpi-label">Km Recorridos</div>
              <div className="kpi-value">
                {Number(kpis?.total_km || 0).toLocaleString('es-PY')}
              </div>
              <div className="subtle" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Kilómetros auditables
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon">
                <TrendingUp size={24} />
              </div>
              <div className="kpi-label">Total Visitas</div>
              <div className="kpi-value">{kpis?.total_visitas || 0}</div>
              <div className="subtle" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Reuniones comerciales
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon">
                <Building2 size={24} />
              </div>
              <div className="kpi-label">Empresas Distintas</div>
              <div className="kpi-value">{kpis?.empresas_distintas || 0}</div>
              <div className="subtle" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Cuentas contactadas
              </div>
            </div>

            <div className="kpi-card" style={{ borderColor: 'var(--green)', background: '#f5fdf9' }}>
              <div className="kpi-icon" style={{ color: 'var(--green)' }}>
                <FileCheck size={24} />
              </div>
              <div className="kpi-label" style={{ color: 'var(--green)' }}>
                Contrataciones
              </div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {kpis?.contrataciones || 0}
              </div>
              <div className="subtle" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Contratos / Suscripciones
              </div>
            </div>
          </div>

          {/* Indicadores para gerencia comercial */}
          {['admin', 'gerente'].includes(user?.role || '') && selectedMonth && (
            <ManagerInsights month={selectedMonth} key={`${selectedMonth}-${refreshing}`} />
          )}

          {/* Tabla Pivot: Contador Mensual por Ejecutivo y Etapa */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  Contador Mensual por Etapa del Embudo ({formatMonthLabel(selectedMonth)})
                </h2>
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  Progreso detallado del embudo de ventas por ejecutivo/a comercial
                </p>
              </div>
              {['admin', 'gerente'].includes(user?.role || '') && (
                <Link to="/exportacion" className="btn btn-ghost btn-sm">
                  Descargar reporte Excel →
                </Link>
              )}
            </div>

            {monthlyData && monthlyData.rows.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Ejecutivo/a</th>
                      {monthlyData.stages.map((st) => (
                        <th key={st} style={{ textAlign: 'center' }}>
                          {st}
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', background: 'var(--primary-light)' }}>
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.rows.map((row) => (
                      <tr key={row.userId}>
                        <td style={{ fontWeight: 600 }}>{row.userName}</td>
                        {monthlyData.stages.map((st) => {
                          const val = Number(row[st] || 0);
                          return (
                            <td
                              key={st}
                              style={{
                                textAlign: 'center',
                                fontWeight: val > 0 ? 600 : 400,
                                color: val > 0 ? 'var(--ink)' : 'var(--ink-subtle)',
                              }}
                            >
                              {val > 0 ? (
                                <span
                                  className="pill"
                                  style={{
                                    background:
                                      st === 'Contrato' || st === 'Venta ganada / Suscripción'
                                        ? 'var(--green-bg)'
                                        : 'var(--primary-light)',
                                    color:
                                      st === 'Contrato' || st === 'Venta ganada / Suscripción'
                                        ? 'var(--green)'
                                        : 'var(--primary-dark)',
                                  }}
                                >
                                  {val}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        })}
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 800,
                            background: 'var(--primary-lighter)',
                            color: 'var(--primary-dark)',
                          }}
                        >
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)', fontWeight: 800, borderTop: '2px solid var(--line)' }}>
                      <td>TOTAL GENERAL</td>
                      {monthlyData.stages.map((st) => (
                        <td key={st} style={{ textAlign: 'center' }}>
                          {monthlyData.totals[st] || 0}
                        </td>
                      ))}
                      <td
                        style={{
                          textAlign: 'center',
                          color: 'var(--primary)',
                          fontSize: '1rem',
                        }}
                      >
                        {monthlyData.totals.total || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Building2 size={40} />
                <p>No se encontraron visitas registradas para el período seleccionado.</p>
                <div style={{ marginTop: 12 }}>
                  <Link to="/nueva-jornada" className="btn btn-secondary btn-sm">
                    Registrar primera jornada
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
