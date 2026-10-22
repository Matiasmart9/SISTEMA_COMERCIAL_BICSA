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
  avatar_url?: string | null;
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

  const rankingList = [...data.ranking].sort((a, b) => num(b.total_gastos_gs) - num(a.total_gastos_gs));

  function getInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  return (
    <div className="mi-wrap">
      <div className="mi-two-col">
        {/* Embudo comercial */}
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <h2 className="card-title">Embudo comercial del mes</h2>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Visitas registradas según la etapa en que quedó cada gestión
            </p>
          </div>
          <div className="mi-bars" style={{ gap: 14 }}>
            {data.funnel.map((f) => {
              const isWin = f.stage === 'Contrato' || f.stage === 'Venta ganada / Suscripción';
              const pct = maxFunnel > 0 ? (f.count / maxFunnel) * 100 : 0;
              return (
                <div key={f.stage} className="mi-funnel-item">
                  <div className="mi-funnel-header">
                    <span className="mi-funnel-label">{f.stage}</span>
                    <span className={`mi-funnel-val ${isWin && f.count > 0 ? 'mi-funnel-val-win' : ''}`}>
                      {f.count}
                    </span>
                  </div>
                  <div className="mi-funnel-track">
                    <div
                      className={`mi-funnel-fill ${
                        f.count === 0
                          ? 'mi-funnel-fill-zero'
                          : isWin
                            ? 'mi-funnel-fill-win'
                            : 'mi-funnel-fill-pipeline'
                      }`}
                      style={{ width: `${f.count > 0 ? Math.max(6, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gastos del mes por integrante comercial */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={18} color="var(--primary)" /> Gastos del mes por integrante comercial
              </h2>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                Inversión acumulada en combustible, movilidad y viáticos ({monthLabel(data.month)})
              </p>
            </div>
            {totalTeamExpenses > 0 && (
              <span className="pill pill-orange" style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                Total: Gs. {totalTeamExpenses.toLocaleString('es-PY')}
              </span>
            )}
          </div>

          {rankingList.length === 0 ? (
            <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin registros para este mes.</p>
          ) : (
            <div className="mi-rank-list">
              {rankingList.map((r, i) => {
                const totalGastos = num(r.total_gastos_gs);
                const combustible = num(r.combustible_gs);
                const movilidad = num(r.movilidad_gs);
                const otros = num(r.otros_gastos_gs);
                const pct = maxRankExpenses > 0 ? (totalGastos / maxRankExpenses) * 100 : 0;
                const isGerente = r.role === 'gerente';
                const initials = getInitials(r.full_name);

                return (
                  <div className="mi-rank-card" key={r.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                        <div className="mi-avatar-initials" style={{ width: 38, height: 38, overflow: 'hidden', padding: 0, flexShrink: 0 }}>
                          {r.avatar_url ? (
                            <img
                              src={r.avatar_url}
                              alt={r.full_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="truncate min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.90rem' }}>{r.full_name}</span>
                            {isGerente && (
                              <span className="pill pill-gray" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>
                                Gerencia
                              </span>
                            )}
                          </div>
                          <div className="subtle" style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                            {num(r.visitas)} {num(r.visitas) === 1 ? 'visita' : 'visitas'} • {num(r.jornadas)} {num(r.jornadas) === 1 ? 'jornada' : 'jornadas'}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, color: totalGastos > 0 ? 'var(--ink)' : 'var(--ink-subtle)', fontSize: '0.95rem' }}>
                          Gs. {totalGastos.toLocaleString('es-PY')}
                        </div>
                      </div>
                    </div>

                    <div className="mi-bar-track" style={{ height: 4, margin: '6px 0 9px', background: '#E2E8F0' }}>
                      <div
                        className="mi-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: totalGastos > 0 ? 'linear-gradient(90deg, #EA580C, #F97316)' : '#CBD5E1',
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {combustible > 0 && (
                        <span className="mi-expense-tag mi-expense-tag-fuel">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3h7l3 3v15H7z"/><path d="M14 3v4h4"/><path d="M10 11h4M10 15h4"/><path d="M3 8v9a2 2 0 0 0 2 2h2"/><path d="M17 10h2l2 2v5h-2"/><circle cx="18.5" cy="19" r="1.5"/>
                          </svg>
                          Combustible: Gs. {combustible.toLocaleString('es-PY')}
                        </span>
                      )}
                      {movilidad > 0 && (
                        <span className="mi-expense-tag mi-expense-tag-mobility">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 13 2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5"/><path d="M3 13h18v5H3z"/><path d="M5 18v2M19 18v2"/><circle cx="7" cy="15.5" r=".7" fill="currentColor"/><circle cx="17" cy="15.5" r=".7" fill="currentColor"/><path d="M6 11h12"/>
                          </svg>
                          Movilidad: Gs. {movilidad.toLocaleString('es-PY')}
                        </span>
                      )}
                      {otros > 0 && (
                        <span className="mi-expense-tag mi-expense-tag-other">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="m8 11 1.5 1.5L12 10M13.5 12H16"/><path d="m8 16 1.5 1.5L12 15M13.5 17H16"/>
                          </svg>
                          Viáticos / Otros: Gs. {otros.toLocaleString('es-PY')}
                        </span>
                      )}
                      {totalGastos === 0 && (
                        <span className="mi-expense-tag mi-expense-tag-none">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Sin gastos imputados en el período
                        </span>
                      )}
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
