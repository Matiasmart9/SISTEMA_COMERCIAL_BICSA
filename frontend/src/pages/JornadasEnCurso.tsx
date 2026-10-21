import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Radio,
  RefreshCw,
  Building2,
  Car,
  Navigation,
  Clock,
  Calendar,
  Eye,
  X,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VisitItem {
  id: string;
  company_id: string;
  company_name: string;
  company_department?: string | null;
  company_city?: string | null;
  zone?: string | null;
  reason?: string;
  funnel_stage?: string;
  result?: string;
  notes?: string;
  created_at: string;
  date: string;
}

interface ActiveJornada {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  date: string;
  status: string;
  mobility_type: string;
  km_start: number | null;
  km_start_photo: string | null;
  created_at: string;
  visits_count: number;
  visits: VisitItem[];
}

export default function JornadasEnCursoPage() {
  const [jornadas, setJornadas] = useState<ActiveJornada[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchJornadasEnCurso = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await api.get<{ jornadas: ActiveJornada[]; timestamp: string }>(
        '/jornadas/en-curso'
      );
      setJornadas(res.data.jornadas || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      if (!isBackground) {
        toast.error('Error al actualizar las jornadas en curso');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJornadasEnCurso();

    // Auto-refresh en tiempo real cada 20 segundos
    const timer = setInterval(() => {
      fetchJornadasEnCurso(true);
    }, 20000);

    return () => clearInterval(timer);
  }, []);

  const formatHour = (isoString: string) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m} hs`;
    } catch {
      return '--:--';
    }
  };

  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const clean = isoDate.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'gerente':
        return 'Gerente Comercial';
      default:
        return 'Ejecutivo/a Comercial';
    }
  };

  const getInitials = (name: string) => {
    return (name || '')
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getResultBadge = (result?: string) => {
    if (!result) return null;
    switch (result) {
      case 'Contratado':
        return <span className="pill pill-green">Contratado</span>;
      case 'En negociación':
        return <span className="pill pill-orange">En negociación</span>;
      case 'Propuesta enviada':
        return <span className="pill pill-yellow">Propuesta enviada</span>;
      case 'Venta perdida':
        return <span className="pill pill-red">Venta perdida</span>;
      case 'Visita realizada':
        return <span className="pill pill-blue">Visita realizada</span>;
      default:
        return <span className="pill pill-gray">{result}</span>;
    }
  };

  return (
    <div className="jornadas-en-curso-page">
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
              Jornada en Curso
            </h1>
            <span
              className="pill pill-green flex items-center gap-1"
              style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 800 }}
              title="Monitoreo activo"
            >
              <span className="pulse-dot" style={{ width: 8, height: 8 }} />
              EN VIVO
            </span>
          </div>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 2 }}>
            Monitoreo en tiempo real de las jornadas activas iniciadas por los integrantes comerciales
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Última actualización: {lastUpdated.toLocaleTimeString('es-PY')}
          </span>
          <button
            onClick={() => fetchJornadasEnCurso(false)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Refrescar estado en vivo"
          >
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading" style={{ minHeight: 280 }}>
          <div className="spinner" />
          <p className="muted" style={{ marginTop: 14 }}>
            Consultando jornadas activas en tiempo real...
          </p>
        </div>
      ) : jornadas.length === 0 ? (
        /* Empty State requerido */
        <div
          className="card empty-state"
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #ffffff 0%, #FAFCFF 100%)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#FFF1E8',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 4px 14px rgba(255, 90, 0, 0.15)',
            }}
          >
            <Radio size={36} />
          </div>
          <h2
            style={{
              fontSize: '1.35rem',
              color: 'var(--ink)',
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            No hay Registro de Jornadas Activas en este momento
          </h2>
          <p
            className="muted"
            style={{
              maxWidth: 540,
              fontSize: '0.92rem',
              lineHeight: 1.55,
              margin: '0 auto 20px',
            }}
          >
            Los ejecutivos comerciales no tienen jornadas iniciadas en este horario. En cuanto un
            integrante inicie su salida comercial desde su smartphone o portal, aparecerá aquí
            automáticamente con sus visitas en tiempo real.
          </p>
          <button
            onClick={() => fetchJornadasEnCurso(false)}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={refreshing ? 'spinner' : ''} />
            <span>Verificar nuevamente</span>
          </button>
        </div>
      ) : (
        /* Listado de Jornadas Activas */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--primary-dark)',
            }}
          >
            Mostrando {jornadas.length} {jornadas.length === 1 ? 'jornada en curso' : 'jornadas en curso'}:
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 20,
            }}
          >
            {jornadas.map((j) => {
              const isVehicle = j.mobility_type === 'vehiculo_propio';
              return (
                <div
                  key={j.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    border: '1.5px solid #FFD9C2',
                    boxShadow: '0 8px 24px rgba(255, 90, 0, 0.08)',
                    borderRadius: 'var(--radius-lg)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Barra superior indicadora */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, var(--primary), #FFA45C)',
                    }}
                  />

                  {/* Cabecera del Ejecutivo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FF6B00 0%, #D84500 100%)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(255, 107, 0, 0.25)',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(j.user_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>
                          {j.user_name}
                        </div>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          <span className="pill pill-orange" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            {getRoleLabel(j.user_role)}
                          </span>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            {j.user_email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className="pill pill-green flex items-center gap-1"
                      style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px' }}
                    >
                      <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                      En Curso
                    </span>
                  </div>

                  {/* Datos de inicio y movilidad */}
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 10,
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <div className="muted flex items-center gap-1" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                        <Clock size={12} />
                        <span>Hora de inicio:</span>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {formatHour(j.created_at)}
                      </div>
                    </div>

                    <div>
                      <div className="muted flex items-center gap-1" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                        <Calendar size={12} />
                        <span>Fecha:</span>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {formatDateLabel(j.date)}
                      </div>
                    </div>

                    <div>
                      <div className="muted flex items-center gap-1" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                        {isVehicle ? <Car size={12} /> : <Navigation size={12} />}
                        <span>Movilidad:</span>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        {isVehicle ? 'Vehículo propio' : 'Plataforma'}
                      </div>
                    </div>

                    {isVehicle && j.km_start !== null && (
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                          Km Inicial:
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>
                            {Number(j.km_start).toLocaleString('es-PY')} km
                          </span>
                          {j.km_start_photo && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhoto(j.km_start_photo)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              title="Ver foto odómetro inicial"
                            >
                              <Eye size={12} />
                              <span>Foto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visitas registradas hasta el momento */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        borderBottom: '1px solid var(--line)',
                        paddingBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--ink)' }}>
                        Visitas Registradas ({j.visits.length})
                      </span>
                      <span className="muted" style={{ fontSize: '0.78rem' }}>
                        Hoy
                      </span>
                    </div>

                    {j.visits.length === 0 ? (
                      <div
                        style={{
                          background: '#fff',
                          border: '1px dashed var(--line-dark)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '16px',
                          textAlign: 'center',
                          color: 'var(--ink-muted)',
                          fontSize: '0.82rem',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span>Jornada recién iniciada · A la espera del primer registro de visita</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                        {j.visits.map((v, idx) => {
                          const location = [v.company_city, v.company_department].filter(Boolean).join(', ') || v.zone;
                          return (
                            <div
                              key={v.id || idx}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Link
                                  to={`/empresas/${v.company_id}`}
                                  className="flex items-center gap-1"
                                  style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}
                                >
                                  <Building2 size={14} color="var(--primary)" />
                                  <span>{v.company_name}</span>
                                </Link>
                                <span className="muted" style={{ fontSize: '0.75rem' }}>
                                  {formatHour(v.created_at)}
                                </span>
                              </div>

                              {location && (
                                <div className="muted" style={{ fontSize: '0.76rem' }}>
                                  📍 {location}
                                </div>
                              )}

                              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 2 }}>
                                {v.funnel_stage && (
                                  <span className="pill pill-gray" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                                    {v.funnel_stage}
                                  </span>
                                )}
                                {getResultBadge(v.result)}
                              </div>

                              {v.notes && (
                                <div
                                  style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--ink-muted)',
                                    marginTop: 3,
                                    fontStyle: 'italic',
                                  }}
                                >
                                  "{v.notes}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer del Card */}
                  <div
                    style={{
                      borderTop: '1px solid var(--line)',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      ID Jornada: {j.id.slice(0, 8)}...
                    </span>
                    <Link
                      to="/historial"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    >
                      <FileText size={13} />
                      <span>Ver historial</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal visor de foto de odómetro inicial */}
      {previewPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              maxWidth: 500,
              width: '100%',
              padding: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: '1rem', color: 'var(--ink)' }}>Foto Odómetro Inicial</strong>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="btn btn-secondary btn-icon"
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={previewPhoto}
              alt="Odómetro inicial"
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
