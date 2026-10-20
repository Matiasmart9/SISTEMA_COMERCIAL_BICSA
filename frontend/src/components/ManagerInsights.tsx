import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  AlertTriangle,
} from 'lucide-react';

interface Totals {
  jornadas: string | number;
  km: string | number;
  visitas: string | number;
  empresas: string | number;
  contrataciones: string | number;
}

interface Insights {
  month: string;
  prevMonth: string;
  current: Totals;
  previous: Totals;
  funnel: Array<{ stage: string; count: number }>;
  ranking: Array<{
    id: string;
    full_name: string;
    visitas: string | number;
    empresas: string | number;
    cierres: string | number;
    km: string | number;
    jornadas: string | number;
  }>;
  daily: Array<{ day: number; count: string | number }>;
  reasons: Array<{ label: string; count: string | number }>;
  zones: Array<{ label: string; count: string | number }>;
  pendingFollowUps: Array<{
    id: string;
    name: string;
    status: string;
    last_visit: string;
    days_since: number;
    executive: string;
  }>;
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

function Delta({ cur, prev, prevLabel }: { cur: number; prev: number; prevLabel: string }) {
  if (prev === 0 && cur === 0) {
    return <span className="mi-delta mi-delta-flat"><Minus size={13} /> Sin datos previos</span>;
  }
  if (prev === 0) {
    return <span className="mi-delta mi-delta-up"><TrendingUp size={13} /> Nuevo vs {prevLabel}</span>;
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) {
    return <span className="mi-delta mi-delta-flat"><Minus size={13} /> Igual que {prevLabel}</span>;
  }
  const up = pct > 0;
  return (
    <span className={`mi-delta ${up ? 'mi-delta-up' : 'mi-delta-down'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '+' : ''}{pct}% vs {prevLabel}
    </span>
  );
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

  const cur = data.current;
  const prev = data.previous;
  const prevLabel = monthLabel(data.prevMonth).split(' ')[0];

  const visitas = num(cur.visitas);
  const empresas = num(cur.empresas);
  const contrataciones = num(cur.contrataciones);
  const km = num(cur.km);

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const daysInMonth = new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5)), 0).getDate();
  const dailyMap = new Map(data.daily.map((d) => [d.day, num(d.count)]));
  const dailySeries = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, count: dailyMap.get(i + 1) || 0 }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));
  const maxReason = Math.max(1, ...data.reasons.map((r) => num(r.count)));
  const maxZone = Math.max(1, ...data.zones.map((z) => num(z.count)));
  const maxRankVisits = Math.max(1, ...data.ranking.map((r) => num(r.visitas)));

  return (
    <div className="mi-wrap">
      {/* Comparativo contra mes anterior */}
      <div className="mi-compare-grid">
        <div className="mi-compare-card">
          <span className="mi-compare-label">Visitas del mes</span>
          <strong className="mi-compare-value">{visitas}</strong>
          <Delta cur={visitas} prev={num(prev.visitas)} prevLabel={prevLabel} />
        </div>
        <div className="mi-compare-card">
          <span className="mi-compare-label">Km recorridos</span>
          <strong className="mi-compare-value">{km.toLocaleString('es-PY')}</strong>
          <Delta cur={km} prev={num(prev.km)} prevLabel={prevLabel} />
        </div>
        <div className="mi-compare-card">
          <span className="mi-compare-label">Empresas contactadas</span>
          <strong className="mi-compare-value">{empresas}</strong>
          <Delta cur={empresas} prev={num(prev.empresas)} prevLabel={prevLabel} />
        </div>
        <div className="mi-compare-card mi-compare-green">
          <span className="mi-compare-label">Contrataciones</span>
          <strong className="mi-compare-value">{contrataciones}</strong>
          <Delta cur={contrataciones} prev={num(prev.contrataciones)} prevLabel={prevLabel} />
        </div>
      </div>

      <div className="mi-two-col">
        {/* Embudo */}
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

        {/* Ranking */}
        <div className="card">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={18} color="var(--primary)" /> Ranking de ejecutivos
          </h2>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 14 }}>Ordenado por cantidad de visitas del mes</p>
          {data.ranking.length === 0 ? (
            <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin ejecutivos activos.</p>
          ) : (
            <div className="mi-rank-list">
              {data.ranking.map((r, i) => (
                <div className="mi-rank-row" key={r.id}>
                  <span className={`mi-rank-pos mi-rank-pos-${i + 1}`}>{i + 1}</span>
                  <div className="mi-rank-main">
                    <div className="mi-rank-name">{r.full_name}</div>
                    <div className="mi-bar-track mi-bar-track-sm">
                      <div className="mi-bar-fill" style={{ width: `${(num(r.visitas) / maxRankVisits) * 100}%` }} />
                    </div>
                    <div className="mi-rank-meta">
                      {num(r.visitas)} visitas · {num(r.empresas)} empresas · {num(r.km).toLocaleString('es-PY')} km · {num(r.jornadas)} jornadas
                    </div>
                  </div>
                  <span className="pill pill-green" title="Contrataciones">{num(r.cierres)} {num(r.cierres) === 1 ? 'cierre' : 'cierres'}</span>
                </div>
              ))}
            </div>
          )}
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
        {/* Motivos y zonas */}
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
          <h2 className="card-title" style={{ marginTop: 22 }}>Zonas más visitadas</h2>
          <div className="mi-bars" style={{ marginTop: 12 }}>
            {data.zones.length === 0 && <p className="subtle" style={{ fontSize: '0.85rem' }}>Sin datos en el período.</p>}
            {data.zones.map((z) => (
              <div className="mi-bar-row" key={z.label}>
                <span className="mi-bar-label">{z.label}</span>
                <div className="mi-bar-track"><div className="mi-bar-fill mi-bar-dark" style={{ width: `${(num(z.count) / maxZone) * 100}%` }} /></div>
                <span className="mi-bar-value">{num(z.count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seguimientos pendientes */}
        <div className="card">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="var(--yellow)" /> Seguimientos pendientes
          </h2>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
            Prospectos y negociaciones sin visita hace más de 14 días
          </p>
          {data.pendingFollowUps.length === 0 ? (
            <div className="mi-ok">Todo al día: no hay cuentas abiertas sin seguimiento reciente.</div>
          ) : (
            <div className="mi-pending-list">
              {data.pendingFollowUps.map((p) => (
                <Link to={`/empresas/${p.id}`} className="mi-pending-row" key={p.id}>
                  <div>
                    <div className="mi-pending-name">{p.name}</div>
                    <div className="mi-pending-meta">{p.status} · último contacto: {p.executive}</div>
                  </div>
                  <span className={`pill ${p.days_since > 30 ? 'pill-red' : 'pill-yellow'}`}>{p.days_since} días</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
