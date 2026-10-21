import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Wallet,
  MapPin,
} from 'lucide-react';

interface Totals {
  jornadas: string | number;
  km: string | number;
  visitas: string | number;
  empresas: string | number;
  contrataciones: string | number;
}

interface RankingItem {
  id: string;
  full_name: string;
  role?: string;
  visitas: string | number;
  empresas: string | number;
  cierres: string | number;
  combustible_gs?: string | number;
  movilidad_gs?: string | number;
  otros_gastos_gs?: string | number;
  total_gastos_gs?: string | number;
  km: string | number;
  jornadas: string | number;
}

interface Insights {
  month: string;
  prevMonth: string;
  current: Totals;
  previous: Totals;
  funnel: Array<{ stage: string; count: number }>;
  ranking: RankingItem[];
  daily: Array<{ day: number; count: string | number }>;
  reasons: Array<{ label: string; count: string | number }>;
  cities?: Array<{ label: string; count: string | number }>;
  zones?: Array<{ label: string; count: string | number }>;
  departments?: Array<{ label: string; count: string | number }>;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const num = (v: string | number | undefined) => Number(v || 0);

function monthLabel(m: string) {
  const [y, mm] = m.split('-');
  return `${MONTH_NAMES[parseInt(mm, 10) - 1]} ${y}`;
}

export default function ManagerInsights({ month }: { month: string }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    api.get<Insights>(`/dashboard/insights?month=${month}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [month]);

  if (error) return null;
  if (!data) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-loading" style={{ minHeight: 120 }}><div className="spinner" /></div>
      </div>
    );
  }

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const daysInMonth = new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5)), 0).getDate();
  const dailyMap = new Map(data.daily.map((d) => [d.day, num(d.count)]));
  const dailySeries = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, count: dailyMap.get(i + 1) || 0 }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));
  const maxReason = Math.max(1, ...data.reasons.map((r) => num(r.count)));
  const citiesList = data.cities || data.zones || [];
  const deptList = data.departments || [];
  const maxCity = Math.max(1, ...citiesList.map((z) => num(z.count)));
  const maxDept = Math.max(1, ...deptList.map((d) => num(d.count)));
  const maxRankExpenses = Math.max(1, ...data.ranking.map((r) => num(r.total_gastos_gs)));
  const totalTeamExpenses = data.ranking.reduce((acc, r) => acc + num(r.total_gastos_gs), 0);

  return (
    <div className="mi-wrap">
      <div className="mi-two-col">
        {/* Embudo comercial */}
        <div className="card">
          <h2 className="card-title">Embudo comercial del mes</h2>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 14 }}>Visitas registradas según la etapa en que quedó cada gestión</p>
          <div className="mi-bars">
            {data.funnel.map((f, i) => {
              const isWin = f.stage === 'Contrato' || f.stage === 'Venta ganada / Suscripción';
              return (
                <div className="mi-bar-row" key={f.stage}>
                  <span className="mi-bar-label">{f.stage}</span>
                  <div className="mi-bar-track">
                    <div
                      className={`mi-bar-fill ${isWin ? 'mi-bar-green' : ''}`}
                      style={{ width: `${(f.count / maxFunnel) * 100}%`, opacity: isWin ? 1 : 1 - i * 0.12 }}
                    />
                  </div>
                  <span className="mi-bar-value">{f.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gastos del mes por integrante comercial */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={18} color="var(--primary)" /> Gastos del mes por integrante comercial
              </h2>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                Inversión acumulada en combustible, movilidad y gastos extras ({monthLabel(data.month)})
              </p>
            </div>
            {totalTeamExpenses > 0 && (
              <span className="pill pill-orange" style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                Total: Gs. {totalTeamExpenses.toLocaleString('es-PY')}
              </span>
            )}
          </div>

          {data.ranking.length === 0 ? (
            <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin registros para este mes.</p>
          ) : (
            <div className="mi-rank-list">
              {data.ranking.map((r, i) => {
                const totalGastos = num(r.total_gastos_gs);
                const combustible = num(r.combustible_gs);
                const movilidad = num(r.movilidad_gs);
                const otros = num(r.otros_gastos_gs);
                const pct = maxRankExpenses > 0 ? (totalGastos / maxRankExpenses) * 100 : 0;
                const isGerente = r.role === 'gerente';

                return (
                  <div className="mi-rank-row" key={r.id} style={{ alignItems: 'flex-start', padding: '12px 0' }}>
                    <span className={`mi-rank-pos mi-rank-pos-${i + 1}`} style={{ marginTop: 2 }}>
                      {i + 1}
                    </span>
                    <div className="mi-rank-main" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.full_name}</span>
                          {isGerente && (
                            <span className="pill pill-gray" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              Gerencia
                            </span>
                          )}
                        </div>
                        <strong style={{ color: totalGastos > 0 ? 'var(--primary-dark)' : 'var(--ink-muted)', fontSize: '0.95rem' }}>
                          Gs. {totalGastos.toLocaleString('es-PY')}
                        </strong>
                      </div>

                      <div className="mi-bar-track mi-bar-track-sm" style={{ margin: '6px 0 8px' }}>
                        <div
                          className="mi-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: totalGastos > 0 ? 'linear-gradient(90deg, var(--primary), #FFA45C)' : '#E2E8F0',
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                        {combustible > 0 && (
                          <span style={{ background: '#FFF3EB', color: '#D84500', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                            ⛽ Combustible: Gs. {combustible.toLocaleString('es-PY')}
                          </span>
                        )}
                        {movilidad > 0 && (
                          <span style={{ background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                            🚗 Movilidad: Gs. {movilidad.toLocaleString('es-PY')}
                          </span>
                        )}
                        {otros > 0 && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                            🍽️ Otros: Gs. {otros.toLocaleString('es-PY')}
                          </span>
                        )}
                        {totalGastos === 0 && (
                          <span className="muted" style={{ fontStyle: 'italic' }}>
                            Sin gastos registrados
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {num(r.visitas)} {num(r.visitas) === 1 ? 'visita' : 'visitas'} ({num(r.jornadas)} {num(r.jornadas) === 1 ? 'jornada' : 'jornadas'})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', textAlign: 'right' }}>
            <Link to="/inversion" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem' }}>
              Ver desglose en Costos Empresa →
            </Link>
          </div>
        </div>
      </div>

      {/* Tendencia diaria */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="card-title">Actividad diaria</h2>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>Visitas registradas por día del mes</p>
        <div className="mi-spark">
          {dailySeries.map((d) => (
            <div className="mi-spark-col" key={d.day} title={`Día ${d.day}: ${d.count} visita(s)`}>
              <div className="mi-spark-bar" style={{ height: `${Math.max(d.count > 0 ? 8 : 2, (d.count / maxDaily) * 100)}%`, opacity: d.count > 0 ? 1 : 0.25 }} />
              <span className="mi-spark-day">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mi-two-col">
        {/* Motivos y Ciudades */}
        <div className="card">
          <h2 className="card-title">Motivos de visita</h2>
          <div className="mi-bars" style={{ marginTop: 12 }}>
            {data.reasons.length === 0 && <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin datos en el período.</p>}
            {data.reasons.map((r) => (
              <div className="mi-bar-row" key={r.label}>
                <span className="mi-bar-label">{r.label}</span>
                <div className="mi-bar-track"><div className="mi-bar-fill" style={{ width: `${(num(r.count) / maxReason) * 100}%` }} /></div>
                <span className="mi-bar-value">{num(r.count)}</span>
              </div>
            ))}
          </div>
          <h2 className="card-title" style={{ marginTop: 22 }}>Ciudades más visitadas</h2>
          <div className="mi-bars" style={{ marginTop: 12 }}>
            {citiesList.length === 0 && <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin datos en el período.</p>}
            {citiesList.map((z) => (
              <div className="mi-bar-row" key={z.label}>
                <span className="mi-bar-label" title={z.label}>{z.label}</span>
                <div className="mi-bar-track"><div className="mi-bar-fill mi-bar-dark" style={{ width: `${(num(z.count) / maxCity) * 100}%` }} /></div>
                <span className="mi-bar-value">{num(z.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Departamentos más visitados */}
        <div className="card">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} color="var(--primary)" /> Departamentos más visitados
          </h2>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 14 }}>
            Distribución geográfica de visitas comerciales en Paraguay
          </p>
          <div className="mi-bars" style={{ marginTop: 12 }}>
            {deptList.length === 0 && <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin datos en el período.</p>}
            {deptList.map((d) => (
              <div className="mi-bar-row" key={d.label}>
                <span className="mi-bar-label" title={d.label}>{d.label}</span>
                <div className="mi-bar-track">
                  <div
                    className="mi-bar-fill"
                    style={{
                      width: `${(num(d.count) / maxDept) * 100}%`,
                      background: 'linear-gradient(90deg, #FF6200, #F97316)',
                    }}
                  />
                </div>
                <span className="mi-bar-value">{num(d.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
