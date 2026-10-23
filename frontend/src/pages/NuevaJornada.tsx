import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Car,
  Smartphone,
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
  TrendingUp,
  CheckCircle2,
  Search,
  Camera,
  Eye,
  X,
  Clock,
  Check,
  ChevronRight,
  HelpCircle,
  Flag,
  DollarSign,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatThousands, parseThousands, formatKm, formatGs, formatDate } from '../utils/formatters';
import { compressImageFile } from '../utils/imageCompression';
import { DEPARTAMENTOS_PARAGUAY, getCiudadesPorDepartamento } from '../data/paraguayLocations';

interface CompanySuggestion {
  id: string;
  name: string;
  commercial_status?: string;
  department?: string | null;
  city?: string | null;
  zone?: string | null;
  maps_url?: string | null;
}

interface PlatformTrip {
  id: string;
  platform: 'Bolt' | 'Uber' | 'MUV' | 'TAXI' | 'Otro';
  amount: string;
  note: string;
}

interface ActiveVisit {
  id: string;
  company_id: string;
  company_name: string;
  visit_type: string;
  department: string | null;
  city: string | null;
  zone: string | null;
  maps_url: string | null;
  reason: string;
  funnel_stage: string;
  result: string;
  notes: string | null;
  transport_cost_gs?: number;
  platform_used?: string | null;
  fuel_allocated_gs?: number;
  other_expenses_gs?: number;
  total_cost_gs?: number;
  created_at: string;
}

interface ActiveJornada {
  id: string;
  date: string;
  user_id: string;
  user_name: string;
  status: 'abierta' | 'cerrada';
  mobility_type: 'propia' | 'plataforma';
  km_start: number | null;
  km_end: number | null;
  km_total: number | null;
  km_start_photo: string | null;
  km_end_photo: string | null;
  fuel_amount_gs?: number;
  fuel_pending_at_start?: boolean;
  platform_trips: PlatformTrip[] | null;
  transport_total_gs: number;
  notes: string | null;
  created_at: string;
  visits: ActiveVisit[];
}

export default function NuevaJornadaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estado general
  const [loadingActive, setLoadingActive] = useState<boolean>(true);
  const [activeJornada, setActiveJornada] = useState<ActiveJornada | null>(null);

  // Estados para INICIAR Jornada
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [mobilityType, setMobilityType] = useState<'propia' | 'plataforma'>('propia');
  const [kmStart, setKmStart] = useState<string>('');
  const [kmStartPhoto, setKmStartPhoto] = useState<string>('');
  const [fuelAmountGs, setFuelAmountGs] = useState<string>('');
  const [fuelPendingAtStart, setFuelPendingAtStart] = useState<boolean>(false);
  const [photoStartError, setPhotoStartError] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [startNotes, setStartNotes] = useState<string>('');
  const [startingJornada, setStartingJornada] = useState<boolean>(false);



  // Estados para CERRAR Jornada (Modal)
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeKmEnd, setCloseKmEnd] = useState<string>('');
  const [closeKmEndPhoto, setCloseKmEndPhoto] = useState<string>('');
  const [closeFuelAmount, setCloseFuelAmount] = useState<string>('');
  const [photoEndError, setPhotoEndError] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [closingJornada, setClosingJornada] = useState<boolean>(false);

  // Estados para AGREGAR VISITA en jornada activa
  const [newVisitCompany, setNewVisitCompany] = useState<string>('');
  const [newVisitCompanyId, setNewVisitCompanyId] = useState<string>('');
  const [newVisitDepartment, setNewVisitDepartment] = useState<string>('Central');
  const [newVisitCity, setNewVisitCity] = useState<string>('San Lorenzo');
  const [newVisitZone, setNewVisitZone] = useState<string>('');
  const [newVisitMapsUrl, setNewVisitMapsUrl] = useState<string>('');
  const [newVisitType, setNewVisitType] = useState<'Nueva visita' | 'Prospecto en seguimiento' | 'Cliente actual'>('Nueva visita');
  const [newVisitReason, setNewVisitReason] = useState<string>('');
  const [newVisitFunnel, setNewVisitFunnel] = useState<string>('');
  const [newVisitResult, setNewVisitResult] = useState<string>('');
  const [newVisitTransportCost, setNewVisitTransportCost] = useState<string>('');
  const [newVisitPlatform, setNewVisitPlatform] = useState<string>('Bolt');
  const [newVisitNotes, setNewVisitNotes] = useState<string>('');
  const [savingVisit, setSavingVisit] = useState<boolean>(false);

  // Estados para formulario desplegable y edición de visita
  const [showVisitForm, setShowVisitForm] = useState<boolean>(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);

  // Estados para Gastos Extras al cerrar jornada
  const [hasExtraExpenses, setHasExtraExpenses] = useState<boolean>(false);
  const [extraExpensesList, setExtraExpensesList] = useState<Array<{ id: string; concept: string; amount: string; companyId: string }>>([]);

  // Modal para ver foto ampliada
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  // Sugerencias de autocompletado de empresas
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificación fotográfica
  const showPhotoSection = Boolean(user?.photoOdometerEnabled || user?.role === 'admin' || user?.role === 'gerente');

  // Cargar si existe una jornada activa al montar
  const fetchActiveJornada = async () => {
    try {
      setLoadingActive(true);
      const res = await api.get('/jornadas/activa');
      if (res.data?.activa) {
        setActiveJornada(res.data.activa);
      } else {
        setActiveJornada(null);
      }
    } catch (err) {
      console.error('Error al consultar jornada activa:', err);
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => {
    fetchActiveJornada();
  }, []);

  // Actualizar lista de ciudades al cambiar departamento en nueva visita
  const handleDepartmentChange = (dept: string) => {
    setNewVisitDepartment(dept);
    const cities = getCiudadesPorDepartamento(dept);
    if (cities.length > 0) {
      setNewVisitCity(cities[0]);
    } else {
      setNewVisitCity('');
    }
  };

  // Buscar empresas al escribir
  const handleCompanyNameSearch = (val: string) => {
    setNewVisitCompany(val);
    setNewVisitCompanyId('');
    setShowSuggestions(true);

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

  const handleSelectSuggestion = (sug: CompanySuggestion) => {
    setNewVisitCompany(sug.name);
    setNewVisitCompanyId(sug.id);
    if (sug.department && DEPARTAMENTOS_PARAGUAY.includes(sug.department)) {
      setNewVisitDepartment(sug.department);
      if (sug.city) {
        setNewVisitCity(sug.city);
      }
    }
    if (sug.zone) setNewVisitZone(sug.zone);
    if (sug.maps_url) setNewVisitMapsUrl(sug.maps_url);

    if (sug.commercial_status === 'Contratado') {
      setNewVisitType('Cliente actual');
    } else {
      setNewVisitType('Prospecto en seguimiento');
    }

    setSuggestions([]);
    setShowSuggestions(false);
    toast.success(`Datos cargados para ${sug.name}`, { icon: '📍', duration: 2500 });
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
        toast.success('Foto de tablero inicial cargada');
      } else {
        setCloseKmEndPhoto(compressed);
        setPhotoEndError(false);
        toast.success('Foto de tablero final cargada');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // INICIAR JORNADA
  const handleStartJornada = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error('Indique la fecha de la jornada');
      return;
    }

    let parsedKmStart: number | null = null;
    let parsedFuelAmount: number | null = null;
    if (mobilityType === 'propia') {
      if (!kmStart) {
        toast.error('Ingrese el kilometraje inicial de salida');
        return;
      }
      parsedKmStart = parseThousands(kmStart);
      if (parsedKmStart < 0) {
        toast.error('Kilometraje inicial no válido');
        return;
      }

      if (!fuelPendingAtStart) {
        if (!fuelAmountGs || parseThousands(fuelAmountGs) <= 0) {
          toast.error('Ingrese el monto de combustible cargado o seleccione "Agregar al Finalizar Jornada"');
          return;
        }
        parsedFuelAmount = parseThousands(fuelAmountGs);
      } else {
        parsedFuelAmount = 0;
      }

      if (user?.photoOdometerEnabled && !kmStartPhoto) {
        setPhotoStartError(true);
        toast.error('Debe cargar obligatoriamente la foto del tablero inicial');
        return;
      }
    }

    setStartingJornada(true);
    try {
      const payload = {
        date: startDate,
        mobilityType,
        kmStart: parsedKmStart,
        kmStartPhoto: kmStartPhoto || undefined,
        fuelAmountGs: parsedFuelAmount || 0,
        fuelPendingAtStart: Boolean(fuelPendingAtStart),
        platformTrips: [],
        notes: startNotes.trim() || undefined,
      };

      const res = await api.post('/jornadas/iniciar', payload);
      toast.success('¡Jornada comercial iniciada con éxito!', { icon: '🚀' });
      setActiveJornada(res.data.jornada);
      window.dispatchEvent(new CustomEvent('jornada-status-changed'));
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al iniciar jornada');
    } finally {
      setStartingJornada(false);
    }
  };

  // AGREGAR VISITA EN JORNADA ACTIVA
  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJornada) return;

    if (!newVisitCompany.trim()) {
      toast.error('Indique el nombre de la empresa / cliente');
      return;
    }
    if (!newVisitDepartment) {
      toast.error('Seleccione el Departamento (INE)');
      return;
    }
    if (!newVisitCity) {
      toast.error('Seleccione la Ciudad / Municipio (INE)');
      return;
    }
    if (!newVisitReason) {
      toast.error('Falta completar el campo obligatorio: Motivo de la visita');
      return;
    }
    if (!newVisitFunnel) {
      toast.error('Falta completar el campo obligatorio: Etapa del embudo');
      return;
    }
    if (!newVisitResult) {
      toast.error('Falta completar el campo obligatorio: Resultado comercial');
      return;
    }

    if (activeJornada.mobility_type === 'plataforma') {
      if (!newVisitTransportCost || parseThousands(newVisitTransportCost) <= 0) {
        toast.error('Debe ingresar el monto que costó llegar a esta empresa (traslado en plataforma)');
        return;
      }
    }

    setSavingVisit(true);
    try {
      const parsedTransport = activeJornada.mobility_type === 'plataforma' ? parseThousands(newVisitTransportCost) : 0;

      const payload = {
        companyName: newVisitCompany.trim(),
        companyId: newVisitCompanyId || undefined,
        department: newVisitDepartment,
        city: newVisitCity,
        zone: newVisitZone.trim() || `${newVisitCity}, ${newVisitDepartment}`,
        mapsUrl: newVisitMapsUrl.trim() || undefined,
        visitType: newVisitType,
        reason: newVisitReason,
        funnelStage: newVisitFunnel,
        result: newVisitResult,
        notes: newVisitNotes.trim() || undefined,
        transportCostGs: parsedTransport,
        platformUsed: activeJornada.mobility_type === 'plataforma' ? newVisitPlatform : undefined,
      };

      if (editingVisitId) {
        await api.put(`/jornadas/${activeJornada.id}/visitas/${editingVisitId}`, payload);
        toast.success(`Visita a "${newVisitCompany.trim()}" actualizada con éxito`, { icon: '✅' });
      } else {
        await api.post(`/jornadas/${activeJornada.id}/visitas`, payload);
        toast.success(`Visita a "${newVisitCompany.trim()}" guardada`, { icon: '✅' });
      }

      // Recargar jornada completa para sincronizar costos actualizados
      await fetchActiveJornada();

      // Resetear campos de visita y cerrar formulario
      handleCancelEdit();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al procesar visita');
    } finally {
      setSavingVisit(false);
    }
  };

  // INICIAR EDICIÓN DE VISITA
  const handleStartEditVisit = (v: ActiveVisit) => {
    setEditingVisitId(v.id);
    setNewVisitCompany(v.company_name);
    setNewVisitCompanyId(v.company_id || '');
    setNewVisitDepartment(v.department || 'Central');
    setNewVisitCity(v.city || 'San Lorenzo');
    setNewVisitZone(v.zone || '');
    setNewVisitMapsUrl(v.maps_url || '');
    setNewVisitType((v.visit_type as any) || 'Nueva visita');
    setNewVisitReason(v.reason || 'Presentación inicial');
    setNewVisitFunnel(v.funnel_stage || 'Prospección');
    setNewVisitResult(v.result || 'Pendiente');
    setNewVisitNotes(v.notes || '');
    setNewVisitTransportCost(v.transport_cost_gs ? formatThousands(String(v.transport_cost_gs)) : '');
    setNewVisitPlatform((v.platform_used as any) || 'Bolt');
    setShowVisitForm(true);

    setTimeout(() => {
      const el = document.getElementById('form-visita-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // CANCELAR EDICIÓN / OCULTAR FORMULARIO
  const handleCancelEdit = () => {
    setEditingVisitId(null);
    setNewVisitCompany('');
    setNewVisitCompanyId('');
    setNewVisitZone('');
    setNewVisitMapsUrl('');
    setNewVisitNotes('');
    setNewVisitReason('');
    setNewVisitFunnel('');
    setNewVisitResult('');
    setNewVisitTransportCost('');
    setShowVisitForm(false);
  };

  // ELIMINAR VISITA DE LA JORNADA ACTIVA
  const handleDeleteVisit = async (visitId: string, compName: string) => {
    if (!activeJornada) return;
    if (!window.confirm(`¿Desea quitar la visita a "${compName}" de la jornada en curso?`)) return;

    try {
      await api.delete(`/jornadas/${activeJornada.id}/visitas/${visitId}`);
      toast.success('Visita eliminada de la jornada');
      await fetchActiveJornada();
    } catch (err) {
      toast.error('Error al eliminar visita');
    }
  };

  // CERRAR JORNADA DEFINITIVAMENTE
  const handleConfirmCloseJornada = async () => {
    if (!activeJornada) return;

    let parsedKmEnd: number | null = null;
    let parsedFuelEnd: number | null = null;
    if (activeJornada.mobility_type === 'propia') {
      if (!closeKmEnd) {
        toast.error('Debe ingresar el kilometraje final para cerrar la jornada');
        return;
      }
      parsedKmEnd = parseThousands(closeKmEnd);
      const kmStartVal = activeJornada.km_start || 0;
      if (parsedKmEnd < kmStartVal) {
        toast.error(`El kilometraje final (${formatKm(parsedKmEnd)}) no puede ser menor al inicial (${formatKm(kmStartVal)})`);
        return;
      }

      parsedFuelEnd = parseThousands(closeFuelAmount);
      if (parsedFuelEnd <= 0) {
        toast.error('Debe ingresar el monto de combustible cargado para poder cerrar la jornada');
        return;
      }

      if (user?.photoOdometerEnabled && !closeKmEndPhoto) {
        setPhotoEndError(true);
        toast.error('Debe cargar obligatoriamente la foto del tablero final');
        return;
      }
    }

    setClosingJornada(true);
    try {
      const cleanExtraExpenses = hasExtraExpenses
        ? extraExpensesList
            .filter((e) => parseThousands(e.amount) > 0)
            .map((e) => ({
              concept: e.concept.trim() || 'Gasto extra',
              amount: parseThousands(e.amount),
              companyId: e.companyId || null,
            }))
        : [];

      const payload = {
        kmEnd: parsedKmEnd,
        kmEndPhoto: closeKmEndPhoto || undefined,
        fuelAmountGs: parsedFuelEnd || undefined,
        notes: closeNotes.trim() || undefined,
        extraExpenses: cleanExtraExpenses,
      };

      await api.post(`/jornadas/${activeJornada.id}/cerrar`, payload);
      toast.success('¡Jornada comercial finalizada y registrada con éxito!', { icon: '🏁', duration: 4000 });
      window.dispatchEvent(new CustomEvent('jornada-status-changed'));
      setShowCloseModal(false);
      navigate('/historial');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al cerrar jornada');
    } finally {
      setClosingJornada(false);
    }
  };

  // Cálculos dinámicos de km para el modal de cierre
  const startKmNum = activeJornada?.km_start || 0;
  const endKmNum = parseThousands(closeKmEnd);
  const diffKm = closeKmEnd ? endKmNum - startKmNum : 0;
  const isDiffInvalid = Boolean(closeKmEnd && endKmNum < startKmNum);

  const openCloseModal = () => {
    if (activeJornada?.mobility_type === 'propia') {
      if (activeJornada.fuel_amount_gs) {
        setCloseFuelAmount(formatThousands(String(activeJornada.fuel_amount_gs)));
      } else {
        setCloseFuelAmount('');
      }
    }
    setHasExtraExpenses(false);
    setExtraExpensesList([]);
    setShowCloseModal(true);
  };

  if (loadingActive) {
    return (
      <div style={{ maxWidth: 1000, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p className="muted" style={{ fontWeight: 600 }}>Cargando estado de jornada comercial...</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // CASO 1: HAY UNA JORNADA EN CURSO (ABIERTA)
  // ════════════════════════════════════════════════════════════
  if (activeJornada) {
    const isPropia = activeJornada.mobility_type === 'propia';

    return (
      <div className="nueva-jornada-page" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 80 }}>
        {/* BANNER DE JORNADA EN CURSO */}
        <div className="active-jornada-banner">
          <div className="active-jornada-top">
            <div className="flex items-center gap-3">
              <span className="active-jornada-status-pill">
                <span className="active-jornada-pulse" />
                Jornada en curso
              </span>
              <span style={{ fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>
                Iniciada el {formatDate(activeJornada.date)}
              </span>
            </div>
            <button
              id="btn-cerrar-jornada-top"
              type="button"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #EA4800 0%, #C2410C 100%)',
                borderColor: '#C2410C',
                padding: '9px 20px',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(234, 72, 0, 0.4)',
              }}
              onClick={openCloseModal}
            >
              <Flag size={16} />
              <span>Cerrar Jornada</span>
            </button>
          </div>

          <div className="active-jornada-stats-row">
            <div className="active-jornada-stat-item">
              <span className="active-jornada-stat-label">Medio de Movilidad</span>
              <span className="active-jornada-stat-value flex items-center gap-2">
                {isPropia ? <Car size={18} color="#FDBA74" /> : <Smartphone size={18} color="#93C5FD" />}
                {isPropia ? 'Vehículo Propio' : 'Plataforma de Transporte'}
              </span>
            </div>

            {isPropia ? (
              <>
                <div className="active-jornada-stat-item">
                  <span className="active-jornada-stat-label">Km Inicial (Salida)</span>
                  <span className="active-jornada-stat-value flex items-center gap-2">
                    <Gauge size={18} color="#FDBA74" />
                    {formatKm(activeJornada.km_start || 0)}
                    {activeJornada.km_start_photo && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg(activeJornada.km_start_photo)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                        title="Ver foto del tablero inicial"
                      >
                        <Eye size={12} /> Ver foto
                      </button>
                    )}
                  </span>
                </div>

                <div className="active-jornada-stat-item">
                  <span className="active-jornada-stat-label">Combustible Cargado</span>
                  <span className="active-jornada-stat-value" style={{ color: activeJornada.fuel_amount_gs ? '#6EE7B7' : '#FCD34D' }}>
                    {activeJornada.fuel_amount_gs && activeJornada.fuel_amount_gs > 0
                      ? formatGs(activeJornada.fuel_amount_gs)
                      : 'Pendiente al cierre'}
                  </span>
                </div>

                {activeJornada.fuel_amount_gs && activeJornada.fuel_amount_gs > 0 && activeJornada.visits.length > 0 && (
                  <div className="active-jornada-stat-item">
                    <span className="active-jornada-stat-label">Combustible / Visita</span>
                    <span className="active-jornada-stat-value" style={{ color: '#FDBA74' }}>
                      ~{formatGs(Math.round(activeJornada.fuel_amount_gs / activeJornada.visits.length))}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="active-jornada-stat-item">
                <span className="active-jornada-stat-label">Gasto en Plataformas</span>
                <span className="active-jornada-stat-value" style={{ color: '#6EE7B7' }}>
                  {formatGs(activeJornada.transport_total_gs || 0)}
                </span>
              </div>
            )}

            <div className="active-jornada-stat-item">
              <span className="active-jornada-stat-label">Visitas Registradas</span>
              <span className="active-jornada-stat-value" style={{ color: '#FCD34D' }}>
                {activeJornada.visits.length} {activeJornada.visits.length === 1 ? 'visita' : 'visitas'}
              </span>
            </div>
          </div>
        </div>

        {/* LISTADO DE VISITAS YA REGISTRADAS EN LA JORNADA */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                Visitas Registradas en esta Jornada ({activeJornada.visits.length})
              </h2>
              <p className="muted" style={{ fontSize: '0.82rem', margin: '2px 0 0' }}>
                Empresas y reuniones anotadas a lo largo de su día de trabajo.
              </p>
            </div>
          </div>

          {activeJornada.visits.length === 0 ? (
            <div className="card" style={{ padding: '30px 20px', textAlign: 'center', background: '#F8FAFC', border: '1.5px dashed var(--line)' }}>
              <Building2 size={36} color="var(--ink-muted)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>
                Aún no has registrado visitas en esta jornada
              </h3>
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                Utiliza el formulario de abajo para registrar las empresas y reuniones que vas visitando.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeJornada.visits.map((v, i) => (
                <div
                  key={v.id}
                  className="card"
                  style={{
                    padding: '14px 18px',
                    borderLeft: '4px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>
                          {v.company_name}
                        </span>
                        <span className="pill pill-orange" style={{ fontSize: '0.72rem', padding: '1px 7px' }}>
                          {v.visit_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 muted" style={{ fontSize: '0.8rem', marginTop: 3 }}>
                        <MapPin size={13} color="var(--primary)" />
                        <span>
                          {v.city ? `${v.city}, ${v.department}` : (v.zone || 'Paraguay')}
                        </span>
                        {v.maps_url && (
                          <a
                            href={v.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4 }}
                          >
                            <ExternalLink size={12} /> Mapa
                          </a>
                        )}
                      </div>

                      {/* Desglose de inversión / costo en esta visita */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                        {v.platform_used && Number(v.transport_cost_gs) > 0 && (
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 6 }}>
                            {v.platform_used}: {formatGs(v.transport_cost_gs)}
                          </span>
                        )}
                        {isPropia && (
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, background: '#FFEDD5', color: '#C2410C', padding: '2px 8px', borderRadius: 6 }}>
                            Combustible distribuido: {formatGs(v.fuel_allocated_gs || (activeJornada.fuel_amount_gs ? Math.round(activeJornada.fuel_amount_gs / activeJornada.visits.length) : 0))}
                          </span>
                        )}
                        {Number(v.other_expenses_gs) > 0 && (
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 6 }}>
                            Otros (almuerzo/etc): {formatGs(v.other_expenses_gs)}
                          </span>
                        )}
                        <span style={{ fontSize: '0.73rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: 6 }}>
                          Inversión visita: {formatGs(v.total_cost_gs || ((v.transport_cost_gs || 0) + (v.fuel_allocated_gs || (activeJornada.fuel_amount_gs ? Math.round(activeJornada.fuel_amount_gs / activeJornada.visits.length) : 0)) + (v.other_expenses_gs || 0)))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div style={{ textAlign: 'right' }}>
                      <span className="pill pill-blue" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        {v.funnel_stage}
                      </span>
                      <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: 3 }}>
                        Resultado: <strong>{v.result}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                      <button
                        type="button"
                        id={`btn-editar-visita-${i}`}
                        className="btn btn-secondary btn-icon"
                        onClick={() => handleStartEditVisit(v)}
                        title="Editar visita"
                        style={{ width: 32, height: 32, color: 'var(--primary)', borderColor: 'var(--primary-light)' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        id={`btn-eliminar-visita-${i}`}
                        className="btn btn-secondary btn-icon"
                        onClick={() => handleDeleteVisit(v.id, v.company_name)}
                        title="Eliminar visita de la jornada"
                        style={{ width: 32, height: 32, color: '#DC2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÓN O FORMULARIO PARA REGISTRAR / EDITAR VISITA */}
        {!showVisitForm ? (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <button
              type="button"
              id="btn-desplegar-visita"
              className="btn btn-primary"
              onClick={() => {
                handleCancelEdit();
                setShowVisitForm(true);
              }}
              style={{
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              }}
            >
              <Plus size={18} />
              <span>Agregar otro registro</span>
            </button>
          </div>
        ) : (
          <div
            id="form-visita-card"
            className="card"
            style={{
              padding: 24,
              border: editingVisitId ? '2px solid var(--primary)' : '1.5px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              background: editingVisitId ? '#FFFDFB' : '#FFFFFF',
              boxShadow: editingVisitId ? '0 4px 20px rgba(234, 88, 12, 0.12)' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: editingVisitId ? '#FFEDD5' : 'var(--primary-lighter)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {editingVisitId ? <Pencil size={18} /> : <Plus size={20} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                    {editingVisitId ? `Editar Visita: ${newVisitCompany || 'Empresa'}` : 'Registrar Visita a Empresa / Reunión'}
                  </h3>
                  <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
                    {editingVisitId
                      ? 'Modifique los datos de la visita comercial y guarde los cambios.'
                      : 'Añada las empresas visitadas durante su recorrido de hoy.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancelEdit}
                style={{ fontWeight: 700 }}
              >
                <X size={15} />
                <span>{editingVisitId ? 'Cancelar Edición' : 'Ocultar'}</span>
              </button>
            </div>

            <form onSubmit={handleAddVisit}>
            {/* 1. IDENTIFICACIÓN Y UBICACIÓN CON DEPARTAMENTO Y CIUDAD DEL INE */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--primary-dark)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <MapPin size={15} />
                <span>1. Identificación y Ubicación (Datos INE Paraguay)</span>
              </div>

              <div className="grid-2" style={{ gap: 14, marginBottom: 12 }}>
                {/* Nombre de la Empresa con autocompletado */}
                <div className="field" style={{ position: 'relative' }}>
                  <label htmlFor="input-empresa-nombre" style={{ fontWeight: 700 }}>
                    Nombre de la Empresa o Cliente *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="input-empresa-nombre"
                      type="text"
                      placeholder="Escriba el nombre de la empresa..."
                      value={newVisitCompany}
                      onChange={(e) => handleCompanyNameSearch(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      style={{ height: 42, paddingRight: 32, fontWeight: 600 }}
                      autoComplete="off"
                    />
                    <Search
                      size={16}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }}
                    />
                  </div>

                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '1.5px solid var(--line)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                        zIndex: 40,
                        maxHeight: 220,
                        overflowY: 'auto',
                        marginTop: 4,
                      }}
                    >
                      {suggestions.map((sug) => (
                        <div
                          key={sug.id}
                          onClick={() => handleSelectSuggestion(sug)}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--line)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-lighter)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                        >
                          <div className="flex items-center justify-between">
                            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{sug.name}</span>
                            {sug.commercial_status && (
                              <span className="pill pill-orange" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                {sug.commercial_status}
                              </span>
                            )}
                          </div>
                          {(sug.city || sug.zone) && (
                            <div className="muted" style={{ fontSize: '0.76rem', marginTop: 2 }}>
                              📍 {sug.city ? `${sug.city}, ${sug.department}` : sug.zone}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tipo de visita */}
                <div className="field">
                  <label htmlFor="select-tipo-visita" style={{ fontWeight: 700 }}>
                    Tipo de visita *
                  </label>
                  <select
                    id="select-tipo-visita"
                    value={newVisitType}
                    onChange={(e) => setNewVisitType(e.target.value as any)}
                    style={{ height: 42, fontWeight: 600 }}
                  >
                    <option value="Nueva visita">Nueva visita</option>
                    <option value="Prospecto en seguimiento">Prospecto en seguimiento</option>
                    <option value="Cliente actual">Cliente actual</option>
                  </select>
                </div>
              </div>

              {/* SELECCIÓN MANDATORIA DEPARTAMENTO Y CIUDAD (INE) */}
              <div className="grid-2" style={{ gap: 14, marginBottom: 12 }}>
                <div className="field">
                  <label htmlFor="select-departamento" style={{ fontWeight: 700 }}>
                    Departamento (INE) *
                  </label>
                  <select
                    id="select-departamento"
                    value={newVisitDepartment}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    style={{ height: 42, fontWeight: 700 }}
                  >
                    {DEPARTAMENTOS_PARAGUAY.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="select-ciudad" style={{ fontWeight: 700 }}>
                    Ciudad / Municipio (INE) *
                  </label>
                  <select
                    id="select-ciudad"
                    value={newVisitCity}
                    onChange={(e) => setNewVisitCity(e.target.value)}
                    style={{ height: 42, fontWeight: 700 }}
                  >
                    {getCiudadesPorDepartamento(newVisitDepartment).map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ubicación Google Maps y Detalle Dirección */}
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="field">
                  <label htmlFor="input-direccion" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Dirección o barrio específico (opcional)
                  </label>
                  <input
                    id="input-direccion"
                    type="text"
                    placeholder="Ej. Avda. Mariscal López c/ San Martín"
                    value={newVisitZone}
                    onChange={(e) => setNewVisitZone(e.target.value)}
                    style={{ height: 40 }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="input-maps-url" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Enlace Google Maps (opcional)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="input-maps-url"
                      type="url"
                      placeholder="https://maps.google.com/..."
                      value={newVisitMapsUrl}
                      onChange={(e) => setNewVisitMapsUrl(e.target.value)}
                      style={{ height: 40 }}
                    />
                    {newVisitMapsUrl && (
                      <a
                        href={newVisitMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-icon"
                        title="Probar y abrir mapa en pestaña nueva"
                        style={{ height: 40, width: 40, flexShrink: 0 }}
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. GESTIÓN Y RESULTADO COMERCIAL */}
            <div style={{ marginBottom: 18, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--primary-dark)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TrendingUp size={15} />
                <span>2. Gestión y Resultado Comercial</span>
              </div>

              <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
                <div className="field">
                  <label htmlFor="select-motivo" style={{ fontWeight: 700 }}>Motivo de la visita *</label>
                  <select
                    id="select-motivo"
                    value={newVisitReason}
                    onChange={(e) => setNewVisitReason(e.target.value)}
                    style={{
                      height: 42,
                      fontWeight: newVisitReason ? 700 : 400,
                      color: newVisitReason ? 'var(--ink)' : 'var(--ink-muted)',
                      border: !newVisitReason ? '1.5px solid #FDBA74' : undefined,
                    }}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Prospección">Prospección</option>
                    <option value="Presentación de servicios">Presentación de servicios</option>
                    <option value="Seguimiento comercial">Seguimiento comercial</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Fidelización">Fidelización</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="select-etapa" style={{ fontWeight: 700 }}>Etapa del embudo *</label>
                  <select
                    id="select-etapa"
                    value={newVisitFunnel}
                    onChange={(e) => setNewVisitFunnel(e.target.value)}
                    style={{
                      height: 42,
                      fontWeight: newVisitFunnel ? 700 : 400,
                      color: newVisitFunnel ? 'var(--ink)' : 'var(--ink-muted)',
                      border: !newVisitFunnel ? '1.5px solid #FDBA74' : undefined,
                    }}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Prospección">Prospección</option>
                    <option value="Contacto con decisor">Contacto con decisor</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Contrato">Contrato</option>
                    <option value="Venta ganada / Suscripción">Venta ganada / Suscripción</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="select-resultado" style={{ fontWeight: 700 }}>Resultado comercial *</label>
                  <select
                    id="select-resultado"
                    value={newVisitResult}
                    onChange={(e) => setNewVisitResult(e.target.value)}
                    style={{
                      height: 42,
                      fontWeight: newVisitResult ? 700 : 400,
                      color: newVisitResult ? 'var(--ink)' : 'var(--ink-muted)',
                      border: !newVisitResult ? '1.5px solid #FDBA74' : undefined,
                    }}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Propuesta enviada">Propuesta enviada</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Contratado">Contratado</option>
                    <option value="Venta perdida">Venta perdida</option>
                    <option value="Visita realizada">Visita realizada</option>
                  </select>
                </div>
              </div>

              {/* 3. COSTOS DE TRASLADO EN PLATAFORMA (SI APLICA) */}
              {activeJornada.mobility_type === 'plataforma' && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1.5px solid #86EFAC',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <DollarSign size={16} color="#15803D" />
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#15803D',
                        letterSpacing: '0.4px',
                      }}
                    >
                      5. Traslado en Plataforma (Bolt / Uber / Taxi)
                    </span>
                  </div>

                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="input-costo-traslado" style={{ fontWeight: 700, color: '#15803D' }}>
                        Costo de traslado a esta empresa *
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="input-costo-traslado"
                          type="text"
                          placeholder="Ej. 28.000"
                          value={newVisitTransportCost}
                          onChange={(e) => setNewVisitTransportCost(formatThousands(e.target.value))}
                          style={{ height: 40, paddingRight: 45, fontWeight: 800, background: '#fff' }}
                          required
                        />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', pointerEvents: 'none' }}>
                          Gs.
                        </span>
                      </div>
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="select-plataforma-visita" style={{ fontWeight: 700 }}>
                        Plataforma utilizada *
                      </label>
                      <select
                        id="select-plataforma-visita"
                        value={newVisitPlatform}
                        onChange={(e) => setNewVisitPlatform(e.target.value)}
                        style={{ height: 40, fontWeight: 700, background: '#fff' }}
                      >
                        <option value="Bolt">Bolt</option>
                        <option value="Uber">Uber</option>
                        <option value="MUV">MUV</option>
                        <option value="Taxi">Taxi</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="input-notas-visita" style={{ fontWeight: 600 }}>
                  Observaciones comerciales / Notas de la reunión (opcional)
                </label>
                <textarea
                  id="input-notas-visita"
                  rows={2}
                  placeholder="Detalles clave, interlocutores contactados, acuerdos pactados o próximos pasos..."
                  value={newVisitNotes}
                  onChange={(e) => setNewVisitNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* BOTONES GUARDAR VISITA / CANCELAR */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={savingVisit}
                style={{ fontWeight: 700 }}
              >
                {editingVisitId ? 'Cancelar Edición' : 'Ocultar Formulario'}
              </button>
              <button
                id="btn-guardar-visita"
                type="submit"
                className="btn btn-primary"
                disabled={savingVisit}
                style={{ padding: '10px 24px', fontWeight: 800, fontSize: '0.95rem' }}
              >
                <Save size={17} />
                <span>
                  {savingVisit
                    ? 'Guardando...'
                    : editingVisitId
                    ? 'Guardar Cambios de Visita'
                    : 'Guardar Visita Realizada'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

        {/* BARRA INFERIOR FLOTANTE PARA FINALIZAR JORNADA */}
        <div className="jornada-floating-bottom-bar">
          <div className="jornada-floating-bar-info">
            <span className="jornada-floating-status-pill">
              <span className="status-dot-pulse" />
              Jornada abierta
            </span>
            <span className="jornada-floating-bar-text">
              {activeJornada.visits.length} {activeJornada.visits.length === 1 ? 'visita guardada' : 'visitas guardadas'} hoy
            </span>
          </div>

          <button
            id="btn-finalizar-jornada-bottom"
            type="button"
            className="btn btn-primary btn-finalizar-jornada"
            onClick={openCloseModal}
          >
            <Flag size={17} />
            <span>Finalizar y Cerrar Jornada</span>
          </button>
        </div>

        {/* MODAL DE CONFIRMACIÓN PARA CERRAR JORNADA */}
        {showCloseModal &&
          createPortal(
            <div
              className="modal-backdrop"
              onClick={() => setShowCloseModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  borderRadius: 'var(--radius-xl)',
                  maxWidth: 600,
                  width: '100%',
                  padding: 28,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: '#FFF7ED',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Flag size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                        ¿Está seguro de cerrar la jornada?
                      </h3>
                      <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 0' }}>
                        Una vez cerrada, la jornada comercial quedará archivada en su historial.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={() => setShowCloseModal(false)}
                    style={{ width: 34, height: 34 }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {isPropia ? (
                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', marginBottom: 18, border: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                      <div>
                        <span className="muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                          Km Inicial (Salida)
                        </span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ink)' }}>
                          {formatKm(activeJornada.km_start || 0)}
                        </div>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="modal-km-final" style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary-dark)' }}>
                          Km Final (Retorno) *
                        </label>
                        <input
                          id="modal-km-final"
                          type="text"
                          placeholder="Ingresa KM final"
                          value={closeKmEnd}
                          onChange={(e) => setCloseKmEnd(formatThousands(e.target.value))}
                          style={{
                            height: 40,
                            maxWidth: 200,
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            borderColor: isDiffInvalid ? '#DC2626' : undefined,
                          }}
                          autoFocus
                        />
                      </div>
                    </div>

                    {isDiffInvalid ? (
                      <div style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={14} /> El kilometraje final debe ser mayor o igual al inicial ({formatKm(activeJornada.km_start || 0)})
                      </div>
                    ) : closeKmEnd ? (
                      <div style={{ color: '#059669', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={14} /> Kilómetros recorridos calculados: <strong>{formatKm(diffKm)}</strong>
                      </div>
                    ) : null}

                    {/* FOTO TABLERO FINAL SI APLICA */}
                    {showPhotoSection && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                          Foto del Tablero Final (Odómetro) {user?.photoOdometerEnabled ? '*' : '(opcional)'}
                        </label>
                        {closeKmEndPhoto ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                              src={closeKmEndPhoto}
                              alt="Tablero final"
                              style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setCloseKmEndPhoto('')}
                              style={{ color: '#DC2626' }}
                            >
                              <Trash2 size={13} /> Quitar foto
                            </button>
                          </div>
                        ) : (
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              padding: 12,
                              background: '#FFF',
                              border: photoEndError ? '2px dashed #DC2626' : '1.5px dashed var(--line)',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              style={{ display: 'none' }}
                              onChange={(e) => handlePhotoUpload(e, 'end')}
                            />
                            <Camera size={20} color="var(--primary)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                              {uploadingPhoto ? 'Procesando...' : 'Tomar o subir foto del tablero final'}
                            </span>
                          </label>
                        )}
                        {photoEndError && (
                          <span style={{ color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, marginTop: 4, display: 'block' }}>
                            Falta la foto del tablero final
                          </span>
                        )}
                      </div>
                    )}

                    {/* COMBUSTIBLE CARGADO AL CIERRE */}
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px dashed var(--line)' }}>
                      <label htmlFor="modal-combustible" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-dark)', display: 'block', marginBottom: 4 }}>
                        Monto Total de Combustible Cargado Hoy (Gs.) *
                      </label>
                      <p className="muted" style={{ fontSize: '0.78rem', margin: '0 0 8px' }}>
                        {activeJornada.visits.length > 0
                          ? `Este monto se dividirá equitativamente entre las ${activeJornada.visits.length} empresas visitadas hoy (~${formatGs(Math.round((parseThousands(closeFuelAmount) || 0) / activeJornada.visits.length))} c/u).`
                          : 'Aún no ha registrado visitas en esta jornada.'}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          maxWidth: 200,
                          height: 40,
                          background: '#FFFFFF',
                          border: (!closeFuelAmount || parseThousands(closeFuelAmount) <= 0)
                            ? '1.5px solid #DC2626'
                            : '1.5px solid var(--line)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <input
                          id="modal-combustible"
                          type="text"
                          placeholder="Ingresa monto"
                          value={closeFuelAmount}
                          onChange={(e) => setCloseFuelAmount(formatThousands(e.target.value))}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            outline: 'none',
                            padding: '0 14px',
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            background: 'transparent',
                            color: 'var(--ink)',
                            boxSizing: 'border-box',
                          }}
                          required
                        />
                        <div
                          style={{
                            padding: '0 14px',
                            background: '#F8FAFC',
                            color: 'var(--ink-muted)',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderLeft: '1px solid var(--line)',
                            userSelect: 'none',
                            flexShrink: 0,
                          }}
                        >
                          Gs.
                        </div>
                      </div>
                      {(!closeFuelAmount || parseThousands(closeFuelAmount) <= 0) && (
                        <span style={{ color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, marginTop: 4, display: 'block' }}>
                          * El monto de combustible es obligatorio antes de cerrar la jornada.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', marginBottom: 18 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                      Resumen de transporte en plataformas:
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)', margin: '4px 0' }}>
                      {formatGs(activeJornada.transport_total_gs || 0)}
                    </div>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>
                      Cargado a través de las visitas registradas en la jornada.
                    </span>
                  </div>
                )}

                {/* PREGUNTA DE GASTOS EXTRAS (ALMUERZO, REFRIGERIO, ETC.) */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    border: hasExtraExpenses ? '1.5px solid #FDBA74' : '1.5px solid var(--line)',
                    background: hasExtraExpenses ? '#FFF7ED' : '#F8FAFC',
                    marginBottom: 18,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)' }}>
                        Gasto extra obtenido
                      </div>
                      <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        Sirve para registro de gastos extra en recorrido.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        id="btn-extra-expenses-no"
                        onClick={() => {
                          setHasExtraExpenses(false);
                          setExtraExpensesList([]);
                        }}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          border: !hasExtraExpenses ? '2px solid #64748B' : '1px solid var(--line)',
                          background: !hasExtraExpenses ? '#64748B' : '#FFF',
                          color: !hasExtraExpenses ? '#FFF' : 'var(--ink)',
                          cursor: 'pointer',
                        }}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        id="btn-extra-expenses-yes"
                        onClick={() => {
                          setHasExtraExpenses(true);
                          if (extraExpensesList.length === 0) {
                            setExtraExpensesList([{
                              id: Math.random().toString(36).substring(2, 9),
                              concept: '',
                              amount: '',
                              companyId: '',
                            }]);
                          }
                        }}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          border: hasExtraExpenses ? '2px solid var(--primary)' : '1px solid var(--line)',
                          background: hasExtraExpenses ? 'var(--primary)' : '#FFF',
                          color: hasExtraExpenses ? '#FFF' : 'var(--ink)',
                          cursor: 'pointer',
                        }}
                      >
                        Sí
                      </button>
                    </div>
                  </div>

                  {hasExtraExpenses && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #FDBA74' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                          Detalle de Gastos Extras
                        </span>
                        <button
                          type="button"
                          id="btn-add-extra-expense"
                          onClick={() => {
                            setExtraExpensesList(prev => [
                              ...prev,
                              {
                                id: Math.random().toString(36).substring(2, 9),
                                concept: '',
                                amount: '',
                                companyId: '',
                              }
                            ]);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', borderColor: 'var(--primary-light)' }}
                        >
                          <Plus size={14} /> Agregar otro gasto
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {extraExpensesList.map((exp, idx) => (
                          <div
                            key={exp.id}
                            style={{
                              padding: '14px 16px',
                              background: '#FFFFFF',
                              border: '1.5px solid #FED7AA',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.04)',
                            }}
                          >
                            {/* Fila 1: Concepto y Monto con botón eliminar */}
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4 }}>
                                  Concepto / Descripción del gasto *
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ej. Almuerzo, refrigerio, peaje..."
                                  value={exp.concept}
                                  onChange={(e) => {
                                    const updated = [...extraExpensesList];
                                    updated[idx].concept = e.target.value;
                                    setExtraExpensesList(updated);
                                  }}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    height: 38,
                                    padding: '0 12px',
                                    fontSize: '0.88rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--line)',
                                    background: '#FFFFFF',
                                  }}
                                />
                              </div>

                              <div style={{ width: 150, flexShrink: 0 }}>
                                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4 }}>
                                  Monto *
                                </label>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    height: 38,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--line)',
                                    background: '#FFFFFF',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <input
                                    type="text"
                                    placeholder="0"
                                    value={exp.amount}
                                    onChange={(e) => {
                                      const updated = [...extraExpensesList];
                                      updated[idx].amount = formatThousands(e.target.value);
                                      setExtraExpensesList(updated);
                                    }}
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      width: '100%',
                                      height: '100%',
                                      border: 'none',
                                      outline: 'none',
                                      padding: '0 8px',
                                      fontWeight: 800,
                                      fontSize: '0.9rem',
                                      textAlign: 'right',
                                      boxSizing: 'border-box',
                                      background: 'transparent',
                                    }}
                                  />
                                  <div
                                    style={{
                                      padding: '0 10px',
                                      background: '#F1F5F9',
                                      color: 'var(--ink-muted)',
                                      fontSize: '0.78rem',
                                      fontWeight: 800,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderLeft: '1px solid var(--line)',
                                      userSelect: 'none',
                                      flexShrink: 0,
                                    }}
                                  >
                                    Gs.
                                  </div>
                                </div>
                              </div>

                              {extraExpensesList.length > 1 && (
                                <div style={{ paddingTop: 20, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExtraExpensesList(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="btn btn-secondary btn-icon"
                                    style={{ width: 34, height: 38, color: '#DC2626', borderColor: '#FECACA' }}
                                    title="Eliminar este gasto extra"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Fila 2: Vincular a institución / empresa */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4 }}>
                                Asignar / Vincular gasto:
                              </label>
                              <select
                                value={exp.companyId || ''}
                                onChange={(e) => {
                                  const updated = [...extraExpensesList];
                                  updated[idx].companyId = e.target.value;
                                  setExtraExpensesList(updated);
                                }}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  height: 38,
                                  fontSize: '0.85rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--line)',
                                  background: '#FFFFFF',
                                  padding: '0 10px',
                                }}
                              >
                                <option value="">-- Distribuir en partes iguales entre todas las empresas visitadas hoy --</option>
                                {activeJornada.visits.map((v) => (
                                  <option key={v.company_id} value={v.company_id}>
                                    {v.company_name} (Asignar 100% a esta empresa)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 10, textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                        Total gastos extras: {formatGs(extraExpensesList.reduce((acc, e) => acc + (parseThousands(e.amount) || 0), 0))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="field" style={{ marginBottom: 20 }}>
                  <label htmlFor="modal-notas" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Observaciones finales de la jornada (opcional)
                  </label>
                  <input
                    id="modal-notas"
                    type="text"
                    placeholder="Ej. Sin novedades, ruta normal de visitas..."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    style={{ height: 40 }}
                  />
                </div>

                <div className="close-jornada-modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCloseModal(false)}
                    disabled={closingJornada}
                  >
                    Volver atrás
                  </button>
                  <button
                    id="btn-confirmar-cierre"
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmCloseJornada}
                    disabled={closingJornada || isDiffInvalid}
                    style={{
                      background: 'linear-gradient(135deg, #EA4800 0%, #C2410C 100%)',
                      borderColor: '#C2410C',
                      fontWeight: 800,
                    }}
                  >
                    <Flag size={16} />
                    <span>{closingJornada ? 'Cerrando jornada...' : 'Sí, Cerrar Jornada Ahora'}</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* MODAL DE PREVISUALIZACIÓN DE FOTOS */}
        {previewModalImg &&
          createPortal(
            <div
              className="modal-backdrop"
              onClick={() => setPreviewModalImg(null)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                padding: 16,
              }}
            >
              <div style={{ position: 'relative', maxWidth: 800, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                <img
                  src={previewModalImg}
                  alt="Previsualización"
                  style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  style={{ position: 'absolute', top: 10, right: 10, background: '#fff' }}
                  onClick={() => setPreviewModalImg(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // CASO 2: NO HAY JORNADA ABIERTA -> PANTALLA INICIADORA DEL DÍA
  // ════════════════════════════════════════════════════════════
  return (
    <div className="nueva-jornada-page" style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 60 }}>
      {/* Encabezado */}
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Navigation size={24} color="var(--primary)" />
            <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              Iniciar Jornada Comercial
            </h1>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
            Inicie su día de trabajo antes de salir a visitas o reuniones fuera de oficina.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 28, borderRadius: 'var(--radius-xl)' }}>
        <form onSubmit={handleStartJornada}>
          {/* Fecha */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="fecha-jornada" style={{ fontWeight: 700 }}>
              Fecha de la jornada *
            </label>
            <input
              id="fecha-jornada"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ height: 42, maxWidth: 260, fontWeight: 600 }}
              required
            />
          </div>

          {/* Selector de Movilidad */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--ink)' }}>
              ¿Con qué medio se va a movilizar hoy? *
            </label>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 10px' }}>
              Elija su medio de transporte para este día de gestión comercial.
            </p>

            <div className="mobility-options-grid">
              <div
                className={`mobility-card-option ${mobilityType === 'propia' ? 'selected' : ''}`}
                onClick={() => setMobilityType('propia')}
              >
                <div className="mobility-card-icon">
                  <Car size={24} />
                </div>
                <div className="mobility-card-body">
                  <div className="mobility-card-title">Movilidad Propia</div>
                  <div className="mobility-card-desc">
                    Vehículo o motocicleta. Registra el kilometraje de odómetro inicial y final.
                  </div>
                </div>
              </div>

              <div
                className={`mobility-card-option ${mobilityType === 'plataforma' ? 'selected' : ''}`}
                onClick={() => setMobilityType('plataforma')}
              >
                <div className="mobility-card-icon">
                  <Smartphone size={24} />
                </div>
                <div className="mobility-card-body">
                  <div className="mobility-card-title">Plataforma de Transporte</div>
                  <div className="mobility-card-desc">
                    Bolt, Uber, MUV, Taxi. Los costos de traslado se registran directamente con cada visita.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SI ELIGE MOVILIDAD PROPIA */}
          {mobilityType === 'propia' && (
            <div className="mobility-propia-card">
              <div className="flex items-center gap-2 mb-3">
                <Gauge size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                  Kilometraje Inicial de Salida
                </h3>
              </div>

              <div className="field" style={{ maxWidth: 240, marginBottom: 14 }}>
                <label htmlFor="km-inicial-input" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Km Inicial (Salida) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="km-inicial-input"
                    type="text"
                    placeholder="Ingresa KM"
                    value={kmStart}
                    onChange={(e) => setKmStart(formatThousands(e.target.value))}
                    style={{
                      height: 42,
                      width: '100%',
                      paddingRight: 45,
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      border: '1.5px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      background: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--ink-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    km
                  </span>
                </div>
              </div>

              {/* FOTO TABLERO INICIAL */}
              {showPhotoSection && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                    Foto del Tablero Inicial (Auto o Moto) {user?.photoOdometerEnabled ? '*' : '(opcional)'}
                  </label>
                  <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 8px' }}>
                    Capture o adjunte la foto de su odómetro antes de partir.
                  </p>

                  {kmStartPhoto ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={kmStartPhoto}
                        alt="Tablero inicial"
                        style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setKmStartPhoto('')}
                        style={{ color: '#DC2626' }}
                      >
                        <Trash2 size={13} /> Quitar foto
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 16,
                        background: '#FFFFFF',
                        border: photoStartError ? '2px dashed #DC2626' : '1.5px dashed var(--line)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, 'start')}
                      />
                      <Camera size={26} color="var(--primary)" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {uploadingPhoto ? 'Procesando foto...' : 'Tomar o subir foto inicial'}
                      </span>
                      <span className="muted" style={{ fontSize: '0.74rem' }}>
                        Tablero antes de salir (Km: {kmStart || '—'})
                      </span>
                    </label>
                  )}
                  {photoStartError && (
                    <div style={{ color: '#DC2626', fontSize: '0.78rem', fontWeight: 700, marginTop: 4 }}>
                      <AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />
                      Falta cargar la foto del tablero inicial
                    </div>
                  )}
                </div>
              )}

              {/* CARGA DE COMBUSTIBLE AL INICIAR JORNADA */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={18} color="var(--primary)" />
                  <label htmlFor="input-combustible-inicio" style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)', margin: 0 }}>
                    Combustible Cargado para la Jornada {!fuelPendingAtStart && '*'}
                  </label>
                </div>
                <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 12px' }}>
                  Indique el monto cargado para su recorrido, o seleccione la opción de postergar la carga al finalizar el día.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
                    <input
                      id="input-combustible-inicio"
                      type="text"
                      placeholder={fuelPendingAtStart ? "Se cargará al finalizar" : "Ingresa monto"}
                      value={fuelAmountGs}
                      disabled={fuelPendingAtStart}
                      onChange={(e) => setFuelAmountGs(formatThousands(e.target.value))}
                      style={{
                        height: 42,
                        width: '100%',
                        paddingRight: 45,
                        paddingLeft: 14,
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        border: '1.5px solid var(--line)',
                        borderRadius: 'var(--radius-md)',
                        background: fuelPendingAtStart ? '#F8FAFC' : '#FFFFFF',
                        color: fuelPendingAtStart ? 'var(--ink-muted)' : 'var(--ink)',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s ease',
                      }}
                      required={!fuelPendingAtStart}
                    />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink-muted)', pointerEvents: 'none' }}>
                      Gs.
                    </span>
                  </div>

                  <label
                    htmlFor="fuel-pending-check"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: fuelPendingAtStart ? 'var(--primary-dark)' : 'var(--ink)',
                      background: fuelPendingAtStart ? '#FFF7ED' : '#F8FAFC',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: fuelPendingAtStart ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      id="fuel-pending-check"
                      type="checkbox"
                      checked={fuelPendingAtStart}
                      onChange={(e) => {
                        setFuelPendingAtStart(e.target.checked);
                        if (e.target.checked) setFuelAmountGs('');
                      }}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>Agregar al finalizar jornada</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Observaciones iniciales */}
          <div className="field" style={{ marginBottom: 24 }}>
            <label htmlFor="notas-iniciales" style={{ fontWeight: 600 }}>
              Observaciones de inicio (opcional)
            </label>
            <input
              id="notas-iniciales"
              type="text"
              placeholder="Ej. Salida desde Asunción con lluvia, visitas programadas en Luque y San Lorenzo"
              value={startNotes}
              onChange={(e) => setStartNotes(e.target.value)}
              style={{ height: 42 }}
            />
          </div>

          {/* Botón Iniciar Día */}
          <div className="iniciar-jornada-btn-wrapper">
            <button
              id="btn-iniciar-jornada"
              type="submit"
              className="btn btn-primary"
              disabled={startingJornada}
              style={{
                padding: '12px 32px',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: '0 4px 16px rgba(234, 72, 0, 0.35)',
              }}
            >
              <Navigation size={18} />
              <span>{startingJornada ? 'Iniciando jornada...' : 'Iniciar Jornada Comercial'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* MODAL DE PREVISUALIZACIÓN DE FOTOS */}
      {previewModalImg &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={() => setPreviewModalImg(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: 16,
            }}
          >
            <div style={{ position: 'relative', maxWidth: 800, width: '100%' }} onClick={(e) => e.stopPropagation()}>
              <img
                src={previewModalImg}
                alt="Previsualización"
                style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ position: 'absolute', top: 10, right: 10, background: '#fff' }}
                onClick={() => setPreviewModalImg(null)}
              >
                <X size={18} />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
