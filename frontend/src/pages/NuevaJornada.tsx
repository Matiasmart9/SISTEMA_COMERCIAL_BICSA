import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Car,
  Building2,
  Plus,
  Trash2,
  Save,
  MapPin,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Gauge,
  Navigation,
  Compass,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Search,
  Camera,
  Eye,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatThousands, parseThousands, formatKm } from '../utils/formatters';
import { compressImageFile } from '../utils/imageCompression';

interface CompanySuggestion {
  id: string;
  name: string;
  commercial_status?: string;
  zone?: string | null;
  maps_url?: string | null;
}

interface VisitItem {
  id: string; // id temporal para key en React
  companyName: string;
  visitType: 'Nueva visita' | 'Prospecto en seguimiento' | 'Cliente actual';
  zone: string;
  mapsUrl: string;
  reason: 'Prospección' | 'Presentación de servicios' | 'Seguimiento comercial' | 'Negociación' | 'Fidelización' | 'Otro';
  funnelStage: 'Prospección' | 'Contacto con decisor' | 'Negociación' | 'Contrato' | 'Venta ganada / Suscripción';
  result: 'Pendiente' | 'Propuesta enviada' | 'En negociación' | 'Contratado' | 'Sin interés' | 'Visita realizada';
  uberRefGs: string;
  boltRefGs: string;
  notes: string;
}

const INITIAL_VISIT = (): VisitItem => ({
  id: Math.random().toString(36).substring(2, 9),
  companyName: '',
  visitType: 'Nueva visita',
  zone: '',
  mapsUrl: '',
  reason: 'Prospección',
  funnelStage: 'Prospección',
  result: 'Pendiente',
  uberRefGs: '',
  boltRefGs: '',
  notes: '',
});

export default function NuevaJornadaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados de la jornada
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [kmStart, setKmStart] = useState<string>('');
  const [kmEnd, setKmEnd] = useState<string>('');
  const [kmStartPhoto, setKmStartPhoto] = useState<string>('');
  const [kmEndPhoto, setKmEndPhoto] = useState<string>('');
  const [photoStartError, setPhotoStartError] = useState<boolean>(false);
  const [photoEndError, setPhotoEndError] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [visits, setVisits] = useState<VisitItem[]>([INITIAL_VISIT()]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Verificación fotográfica activa
  const showPhotoSection = Boolean(user?.photoOdometerEnabled || user?.role === 'admin' || user?.role === 'gerente');

  // Autocompletado de empresas
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cálculo de km totales con parseThousands
  const kmStartNum = parseThousands(kmStart);
  const kmEndNum = parseThousands(kmEnd);
  const kmTotal = kmEnd && kmStart ? kmEndNum - kmStartNum : 0;
  const isKmInvalid = Boolean(kmEnd && kmStart && kmEndNum < kmStartNum);

  // Buscar empresas al escribir
  const handleCompanyNameChange = (index: number, val: string) => {
    updateVisit(index, 'companyName', val);
    setActiveSuggestionIdx(index);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<{ data: CompanySuggestion[] }>(
          `/empresas?q=${encodeURIComponent(val)}&limit=8`
        );
        setSuggestions(res.data.data || []);
      } catch (err) {
        console.error('Error al autocompletar empresas:', err);
      }
    }, 200);
  };

  const selectSuggestion = (index: number, sug: CompanySuggestion) => {
    setVisits((prev) =>
      prev.map((v, i) => {
        if (i !== index) return v;
        let nextType = v.visitType;
        if (sug.commercial_status === 'Contratado') {
          nextType = 'Cliente actual';
        } else {
          nextType = 'Prospecto en seguimiento';
        }
        return {
          ...v,
          companyName: sug.name,
          zone: sug.zone || v.zone,
          mapsUrl: sug.maps_url || v.mapsUrl,
          visitType: nextType,
        };
      })
    );
    setSuggestions([]);
    setActiveSuggestionIdx(null);

    if (sug.zone || sug.maps_url) {
      toast.success(`Ubicación autocompletada para ${sug.name}`, {
        icon: '📍',
        duration: 2500,
      });
    }
  };

  // Manejo de visitas dinámicas
  const addVisit = () => {
    setVisits((prev) => [...prev, INITIAL_VISIT()]);
  };

  const removeVisit = (index: number) => {
    if (visits.length <= 1) {
      toast.error('Debe registrar al menos una visita en la jornada');
      return;
    }
    setVisits((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVisit = (index: number, field: keyof VisitItem, value: any) => {
    setVisits((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  // Carga y compresión de fotos de tablero
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const compressed = await compressImageFile(file);
      if (type === 'start') {
        setKmStartPhoto(compressed);
        setPhotoStartError(false);
        toast.success('Foto del tablero inicial cargada');
      } else {
        setKmEndPhoto(compressed);
        setPhotoEndError(false);
        toast.success('Foto del tablero final cargada');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      toast.error('Indique la fecha de la jornada');
      return;
    }

    if (!kmStart || kmStartNum < 0) {
      toast.error('Ingrese un kilometraje inicial válido');
      return;
    }

    if (!kmEnd || kmEndNum < 0) {
      toast.error('Ingrese un kilometraje final válido');
      return;
    }

    if (kmEndNum < kmStartNum) {
      toast.error('El kilometraje final debe ser mayor o igual al inicial');
      return;
    }

    // Validar fotos obligatorias si la verificación está activa o si se empezó a cargar alguna
    if (showPhotoSection) {
      const missingStart = !kmStartPhoto;
      const missingEnd = !kmEndPhoto;
      const isMandatory = Boolean(user?.photoOdometerEnabled) || Boolean(kmStartPhoto || kmEndPhoto);

      if (isMandatory) {
        if (missingStart && missingEnd) {
          setPhotoStartError(true);
          setPhotoEndError(true);
          toast.error('Debe cargar obligatoriamente ambas fotos del tablero (Inicial y Final)');
          document.getElementById('registro-fotografico-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (missingStart) {
          setPhotoStartError(true);
          toast.error('Falta cargar la Foto del Tablero Inicial');
          document.getElementById('registro-fotografico-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (missingEnd) {
          setPhotoEndError(true);
          toast.error('Falta cargar la Foto del Tablero Final');
          document.getElementById('registro-fotografico-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }

    // Validar visitas
    for (let i = 0; i < visits.length; i++) {
      const v = visits[i];
      if (!v.companyName.trim()) {
        toast.error(`Indique el nombre de la empresa en la visita #${i + 1}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        kmStart: kmStartNum,
        kmEnd: kmEndNum,
        kmStartPhoto: kmStartPhoto || undefined,
        kmEndPhoto: kmEndPhoto || undefined,
        notes: notes.trim() || undefined,
        visits: visits.map((v) => ({
          companyName: v.companyName.trim(),
          visitType: v.visitType,
          zone: v.zone.trim() || undefined,
          mapsUrl: v.mapsUrl.trim() || undefined,
          reason: v.reason,
          funnelStage: v.funnelStage,
          result: v.result,
          uberRefGs: v.uberRefGs ? parseThousands(v.uberRefGs) : undefined,
          boltRefGs: v.boltRefGs ? parseThousands(v.boltRefGs) : undefined,
          notes: v.notes.trim() || undefined,
        })),
      };

      await api.post('/jornadas', payload);
      toast.success('¡Jornada comercial registrada con éxito!');
      navigate('/historial');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Error al guardar la jornada';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nueva-jornada-page" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Encabezado */}
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Navigation size={24} color="var(--primary)" />
            <h1 style={{ fontSize: '1.75rem', color: 'var(--ink)', margin: 0, fontWeight: 800 }}>
              Registrar Jornada Comercial
            </h1>
          </div>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            Cargue su kilometraje de salida/retorno del vehículo y las reuniones o visitas a empresas realizadas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off">
        {/* Tarjeta 1: Datos de la Jornada y Odómetro */}
        <div className="card" style={{ marginBottom: 24, borderTop: '4px solid var(--primary)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
            <h2 className="card-title flex items-center gap-2" style={{ fontSize: '1.15rem' }}>
              <Car size={20} color="var(--primary)" />
              <span>Control Diario de Movilidad y Kilometraje</span>
            </h2>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Los kilómetros recorridos se calculan automáticamente (Final - Inicial)
            </span>
          </div>

          <div className="grid-3" style={{ alignItems: 'flex-start' }}>
            <div className="field">
              <label htmlFor="jornada-fecha" style={{ fontWeight: 600 }}>Fecha de la jornada *</label>
              <input
                id="jornada-fecha"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ height: 44, fontWeight: 600 }}
              />
            </div>

            <div className="field">
              <label htmlFor="km-start" style={{ fontWeight: 600 }}>Km Inicial (Salida) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="km-start"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 42.310"
                  required
                  value={formatThousands(kmStart)}
                  onChange={(e) => setKmStart(e.target.value.replace(/\D/g, ''))}
                  style={{ height: 44, paddingRight: 40, fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--ink-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  km
                </span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="km-end" style={{ fontWeight: 600 }}>Km Final (Retorno) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="km-end"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 42.382"
                  required
                  className={isKmInvalid ? 'error' : ''}
                  value={formatThousands(kmEnd)}
                  onChange={(e) => setKmEnd(e.target.value.replace(/\D/g, ''))}
                  style={{ height: 44, paddingRight: 40, fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--ink-muted)',
                    pointerEvents: 'none',
                  }}
                >
                  km
                </span>
              </div>
            </div>
          </div>

          {/* Panel resumen del Odómetro */}
          {kmStart && kmEnd && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              {isKmInvalid ? (
                <div
                  className="alert alert-error"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--red-bg)',
                    color: 'var(--red)',
                    border: '1px solid #FECACA',
                  }}
                >
                  <AlertTriangle size={18} />
                  <span>El Km final ({formatThousands(kmEnd)} km) no puede ser menor al inicial ({formatThousands(kmStart)} km). Verifique el odómetro.</span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'linear-gradient(135deg, #FFF0E6 0%, #FFE4D3 100%)',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid #FFD0B3',
                    color: 'var(--primary-dark)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Gauge size={20} color="var(--primary)" />
                  <div>
                    <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 800, display: 'block' }}>
                      Distancia calculada
                    </span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>
                      Total recorrido hoy: {formatKm(kmTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fotos del Odómetro / Tablero (si el usuario lo tiene habilitado) */}
          {showPhotoSection && (
            <div
              id="registro-fotografico-card"
              style={{
                marginTop: 18,
                padding: 16,
                background: '#F0F7FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div className="flex items-center gap-2">
                  <Camera size={18} color="#2563EB" />
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1D4ED8' }}>
                    Registro Fotográfico del Tablero / Odómetro (Auto o Moto)
                  </span>
                </div>
                <span className="pill" style={{ background: '#DBEAFE', color: '#1D4ED8', fontSize: '0.72rem', fontWeight: 700 }}>
                  📸 Verificación habilitada
                </span>
              </div>
              <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 14px', color: '#4B5563' }}>
                Capture o adjunte la foto del tablero de su movilidad al iniciar la salida y al retornar para validar el kilometraje anotado.
              </p>

              <div className="grid-2" style={{ gap: 16 }}>
                {/* Foto Inicio */}
                <div
                  style={{
                    background: '#fff',
                    border: photoStartError ? '2px solid #EF4444' : kmStartPhoto ? '2px solid #10B981' : '1.5px dashed #93C5FD',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    boxShadow: photoStartError ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: photoStartError ? '#DC2626' : '#1E293B' }}>
                      1. Foto Tablero Inicial
                    </span>
                    {kmStartPhoto ? (
                      <span className="pill pill-green" style={{ fontSize: '0.7rem' }}>Cargada</span>
                    ) : photoStartError ? (
                      <span className="pill pill-red" style={{ fontSize: '0.7rem' }}>Requerida</span>
                    ) : null}
                  </div>

                  {kmStartPhoto ? (
                    <div style={{ width: '100%', position: 'relative' }}>
                      <img
                        src={kmStartPhoto}
                        alt="Tablero inicial"
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setPreviewModalImg(kmStartPhoto)}
                        title="Clic para ver foto"
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 14px', fontSize: '0.78rem', width: 'auto' }}
                          onClick={() => setPreviewModalImg(kmStartPhoto)}
                        >
                          <Eye size={13} />
                          <span>Ver Foto</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 12px', fontSize: '0.78rem', width: 'auto' }}
                          onClick={() => {
                            setKmStartPhoto('');
                            setPhotoStartError(false);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      style={{
                        width: '100%',
                        minHeight: 120,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        gap: 8,
                        padding: 16,
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, 'start')}
                      />
                      <Camera size={28} color="#2563EB" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563EB', textAlign: 'center' }}>
                        {uploadingPhoto ? 'Procesando foto...' : 'Tomar o subir foto inicial'}
                      </span>
                      <span className="muted" style={{ fontSize: '0.72rem' }}>
                        Tablero antes de salir (Km: {kmStart || '—'})
                      </span>
                    </label>
                  )}
                  {photoStartError && (
                    <div style={{ color: '#DC2626', fontSize: '0.76rem', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} /> Falta cargar la Foto del Tablero Inicial
                    </div>
                  )}
                </div>

                {/* Foto Fin */}
                <div
                  style={{
                    background: '#fff',
                    border: photoEndError ? '2px solid #EF4444' : kmEndPhoto ? '2px solid #10B981' : '1.5px dashed #93C5FD',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    boxShadow: photoEndError ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: photoEndError ? '#DC2626' : '#1E293B' }}>
                      2. Foto Tablero Final
                    </span>
                    {kmEndPhoto ? (
                      <span className="pill pill-green" style={{ fontSize: '0.7rem' }}>Cargada</span>
                    ) : photoEndError ? (
                      <span className="pill pill-red" style={{ fontSize: '0.7rem' }}>Requerida</span>
                    ) : null}
                  </div>

                  {kmEndPhoto ? (
                    <div style={{ width: '100%', position: 'relative' }}>
                      <img
                        src={kmEndPhoto}
                        alt="Tablero final"
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setPreviewModalImg(kmEndPhoto)}
                        title="Clic para ver foto"
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 14px', fontSize: '0.78rem', width: 'auto' }}
                          onClick={() => setPreviewModalImg(kmEndPhoto)}
                        >
                          <Eye size={13} />
                          <span>Ver Foto</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 12px', fontSize: '0.78rem', width: 'auto' }}
                          onClick={() => {
                            setKmEndPhoto('');
                            setPhotoEndError(false);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      style={{
                        width: '100%',
                        minHeight: 120,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        gap: 8,
                        padding: 16,
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, 'end')}
                      />
                      <Camera size={28} color="#2563EB" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563EB', textAlign: 'center' }}>
                        {uploadingPhoto ? 'Procesando foto...' : 'Tomar o subir foto final'}
                      </span>
                      <span className="muted" style={{ fontSize: '0.72rem' }}>
                        Tablero al regresar (Km: {kmEnd || '—'})
                      </span>
                    </label>
                  )}
                  {photoEndError && (
                    <div style={{ color: '#DC2626', fontSize: '0.76rem', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} /> Falta cargar la Foto del Tablero Final
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="jornada-notas">Observaciones generales de la jornada (opcional)</label>
            <input
              id="jornada-notas"
              type="text"
              placeholder="Ej. Salida con lluvia, desvío por obras en Luque, ruta San Lorenzo - Asunción"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ height: 42 }}
            />
          </div>
        </div>

        {/* Sección: Empresas y Reuniones */}
        <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--ink)', fontWeight: 800, margin: 0 }}>
              Visitas a Empresas y Reuniones ({visits.length})
            </h2>
            <p className="muted" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>
              Al escribir o elegir una empresa registrada, se autocompletará su dirección y mapa (modificable).
            </p>
          </div>
          <button
            id="btn-agregar-visita"
            type="button"
            onClick={addVisit}
            className="btn btn-secondary"
            style={{ fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>Agregar otra empresa</span>
          </button>
        </div>

        {visits.map((visit, index) => (
          <div
            key={visit.id}
            className="visit-card"
            style={{
              position: 'relative',
              marginBottom: 20,
              padding: 22,
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--line)',
              borderLeft: '5px solid var(--primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Cabecera de la visita */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
                paddingBottom: 12,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    boxShadow: '0 2px 6px rgba(255, 90, 0, 0.35)',
                  }}
                >
                  {index + 1}
                </span>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)' }}>
                    {visit.companyName.trim() || `Empresa o Visita #${index + 1}`}
                  </span>
                  {visit.zone && (
                    <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>
                      📍 {visit.zone}
                    </span>
                  )}
                </div>
              </div>

              {visits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVisit(index)}
                  className="btn btn-danger btn-sm"
                  title="Eliminar esta visita"
                >
                  <Trash2 size={15} />
                  <span>Quitar</span>
                </button>
              )}
            </div>

            {/* Grupo 1: Empresa & Ubicación */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--primary-dark)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Building2 size={14} />
                <span>1. Identificación y Ubicación</span>
              </div>

              <div className="grid-3">
                {/* Autocompletado de Empresa */}
                <div className="field" style={{ position: 'relative' }}>
                  <label style={{ fontWeight: 600 }}>Nombre de la Empresa *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      placeholder="Escriba o busque empresa..."
                      value={visit.companyName}
                      onChange={(e) => handleCompanyNameChange(index, e.target.value)}
                      onFocus={() => setActiveSuggestionIdx(index)}
                      style={{ height: 42, paddingLeft: 36, fontWeight: 600 }}
                    />
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--ink-subtle)',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Menú de sugerencias autocompletadas */}
                    {activeSuggestionIdx === index && suggestions.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 30,
                          background: '#fff',
                          border: '2px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                          maxHeight: 230,
                          overflowY: 'auto',
                          marginTop: 4,
                        }}
                      >
                        <div style={{ padding: '6px 12px', fontSize: '0.72rem', background: 'var(--surface-2)', fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: '0.5px' }}>
                          EMPRESAS REGISTRADAS (CLICK PARA AUTOCOMPLETAR)
                        </div>
                        {suggestions.map((sug) => (
                          <div
                            key={sug.id}
                            onClick={() => selectSuggestion(index, sug)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--line)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-lighter)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                          >
                            <div className="flex items-center justify-between">
                              <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.92rem' }}>
                                {sug.name}
                              </span>
                              {sug.commercial_status && (
                                <span className="pill pill-orange" style={{ fontSize: '0.7rem', padding: '1px 8px' }}>
                                  {sug.commercial_status}
                                </span>
                              )}
                            </div>
                            {sug.zone && (
                              <span className="muted" style={{ fontSize: '0.78rem' }}>
                                📍 {sug.zone}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontWeight: 600 }}>Tipo de visita *</label>
                  <select
                    value={visit.visitType}
                    onChange={(e) => updateVisit(index, 'visitType', e.target.value)}
                    style={{ height: 42 }}
                  >
                    <option value="Nueva visita">Nueva visita</option>
                    <option value="Prospecto en seguimiento">Prospecto en seguimiento</option>
                    <option value="Cliente actual">Cliente actual</option>
                  </select>
                </div>

                <div className="field">
                  <label style={{ fontWeight: 600 }} className="flex items-center gap-1">
                    <MapPin size={13} color="var(--primary)" />
                    <span>Ciudad / Zona (Dirección)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Asunción - Villa Morra"
                    value={visit.zone}
                    onChange={(e) => updateVisit(index, 'zone', e.target.value)}
                    style={{ height: 42 }}
                  />
                </div>
              </div>

              {/* Enlace Google Maps */}
              <div className="field" style={{ marginTop: 8 }}>
                <label className="flex items-center gap-1" style={{ fontSize: '0.85rem' }}>
                  <Compass size={13} color="var(--primary)" />
                  <span>Enlace Google Maps (opcional — se guardará como ubicación principal de la empresa)</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={visit.mapsUrl}
                    onChange={(e) => updateVisit(index, 'mapsUrl', e.target.value)}
                    style={{ height: 40 }}
                  />
                  {visit.mapsUrl && (
                    <a
                      href={visit.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-icon"
                      title="Probar y abrir mapa en nueva pestaña"
                      style={{ height: 40, width: 40, flexShrink: 0 }}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Grupo 2: Avance Comercial (Motivo, Etapa, Resultado) */}
            <div style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--primary-dark)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TrendingUp size={14} />
                <span>2. Gestión y Resultado Comercial</span>
              </div>

              <div className="grid-3">
                <div className="field">
                  <label style={{ fontWeight: 600 }}>Motivo de la visita *</label>
                  <select
                    value={visit.reason}
                    onChange={(e) => updateVisit(index, 'reason', e.target.value)}
                    style={{ height: 42 }}
                  >
                    <option value="Prospección">Prospección</option>
                    <option value="Presentación de servicios">Presentación de servicios</option>
                    <option value="Seguimiento comercial">Seguimiento comercial</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Fidelización">Fidelización</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="field">
                  <label style={{ fontWeight: 600 }}>Etapa del Embudo *</label>
                  <select
                    value={visit.funnelStage}
                    onChange={(e) => updateVisit(index, 'funnelStage', e.target.value)}
                    style={{ height: 42 }}
                  >
                    <option value="Prospección">Prospección</option>
                    <option value="Contacto con decisor">Contacto con decisor</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Contrato">Contrato</option>
                    <option value="Venta ganada / Suscripción">Venta ganada / Suscripción</option>
                  </select>
                </div>

                <div className="field">
                  <label style={{ fontWeight: 600 }}>Resultado comercial *</label>
                  <select
                    value={visit.result}
                    onChange={(e) => updateVisit(index, 'result', e.target.value)}
                    style={{ height: 42 }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Propuesta enviada">Propuesta enviada</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Contratado">Contratado</option>
                    <option value="Sin interés">Sin interés</option>
                    <option value="Visita realizada">Visita realizada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grupo 3: Gastos de Movilidad Referencial (Uber / Bolt) con formato de puntos automático */}
            <div style={{ marginBottom: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--primary-dark)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <DollarSign size={14} />
                <span>3. Movilidad y Transporte (Referencias solo ida en Gs.)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div className="field">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Uber ref. ida (Gs. opcional)</label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--ink-muted)',
                        pointerEvents: 'none',
                      }}
                    >
                      Gs.
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ej. 35.000"
                      value={formatThousands(visit.uberRefGs)}
                      onChange={(e) => updateVisit(index, 'uberRefGs', e.target.value.replace(/\D/g, ''))}
                      style={{ height: 42, paddingLeft: 42, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bolt ref. ida (Gs. opcional)</label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--ink-muted)',
                        pointerEvents: 'none',
                      }}
                    >
                      Gs.
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ej. 30.000"
                      value={formatThousands(visit.boltRefGs)}
                      onChange={(e) => updateVisit(index, 'boltRefGs', e.target.value.replace(/\D/g, ''))}
                      style={{ height: 42, paddingLeft: 42, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grupo 4: Observaciones */}
            <div style={{ paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }} className="flex items-center gap-1">
                  <FileText size={13} color="var(--primary)" />
                  <span>Observaciones de la visita / reunión</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle de acuerdos, próximas fechas de contacto, nombres de decisores, etc."
                  value={visit.notes}
                  onChange={(e) => updateVisit(index, 'notes', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Barra de acción inferior con resumen en vivo */}
        <div
          style={{
            position: 'sticky',
            bottom: 12,
            zIndex: 25,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 24px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.14), 0 0 0 1px var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            marginTop: 24,
          }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={addVisit}
              className="btn btn-secondary"
              style={{ fontWeight: 700 }}
            >
              <Plus size={16} />
              <span>Agregar otra empresa</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="pill pill-orange" style={{ fontWeight: 700 }}>
                {visits.length} {visits.length === 1 ? 'visita' : 'visitas'}
              </span>
              {kmStart && kmEnd && !isKmInvalid && (
                <span className="pill pill-green" style={{ fontWeight: 700 }}>
                  {formatKm(kmTotal)} recorridos
                </span>
              )}
            </div>
          </div>

          <button
            id="btn-guardar-jornada"
            type="submit"
            disabled={submitting || isKmInvalid}
            className="btn btn-primary"
            style={{ padding: '13px 32px', fontSize: '1rem', fontWeight: 800, gap: 10 }}
          >
            <Save size={18} />
            <span>{submitting ? 'Guardando jornada...' : 'Guardar Jornada Comercial'}</span>
          </button>
        </div>
      </form>

      {/* Modal para visualizar foto ampliada (con portal directo al body) */}
      {previewModalImg && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16,
          }}
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: 860,
              width: '100%',
              maxHeight: '88vh',
              background: '#0F172A',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                background: '#1E293B',
                borderBottom: '1px solid #334155',
              }}
            >
              <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={16} color="#60A5FA" />
                <span>Foto del Tablero / Odómetro</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Cerrar vista previa"
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                padding: 14,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={previewModalImg}
                alt="Foto ampliada del tablero"
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(88vh - 75px)',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
