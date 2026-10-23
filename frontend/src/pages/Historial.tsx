import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Building2,
  Filter,
  MapPin,
  ExternalLink,
  Eye,
  X,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  History,
  Plus,
  Trash2,
  Save,
  Search,
  Clock,
  Compass,
  AlertCircle,
  User,
  Camera,
  Car,
  Smartphone,
  TrendingUp,
  FileCheck,
  Fuel,
  Receipt,
  DollarSign,
  Utensils,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatThousands, parseThousands, formatKm, formatGs } from '../utils/formatters';
import { compressImageFile } from '../utils/imageCompression';
import { DEPARTAMENTOS_PARAGUAY, getCiudadesPorDepartamento } from '../data/paraguayLocations';

interface KPIs {
  total_jornadas: string | number;
  total_km: string | number;
  total_visitas: string | number;
  empresas_distintas: string | number;
  contrataciones: string | number;
}

const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
  { value: 'todos', label: '-- Todos --' },
];

interface Jornada {
  id: string;
  date: string;
  km_start: number | null;
  km_end: number | null;
  km_total: number | null;
  km_start_photo?: string | null;
  km_end_photo?: string | null;
  notes: string | null;
  user_id: string;
  user_name: string;
  visit_count: string | number;
  audit_count?: number;
  status?: 'abierta' | 'cerrada';
  mobility_type?: 'propia' | 'plataforma';
  platform_trips?: any[];
  transport_total_gs?: number;
  fuel_amount_gs?: number | null;
  extra_expenses?: any[];
  closed_at?: string;
  created_at: string;
  updated_at?: string;
}

interface VisitDetail {
  id: string;
  date: string;
  visit_type: string;
  department?: string | null;
  city?: string | null;
  zone: string | null;
  maps_url: string | null;
  reason: string;
  funnel_stage: string;
  result: string;
  uber_ref_gs: number | null;
  bolt_ref_gs: number | null;
  transport_cost_gs?: number | null;
  fuel_allocated_gs?: number | null;
  other_expenses_gs?: number | null;
  total_cost_gs?: number | null;
  notes: string | null;
  company_name: string;
  company_id?: string;
}

interface UserOption {
  id: string;
  full_name: string;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  performer_name: string;
  performer_email: string;
  performer_role: string;
  details: {
    changes?: Record<string, { old: any; new: any; label: string }>;
    added_visits_count?: number;
    added_visits?: Array<{ companyName: string; funnelStage: string; result: string; zone?: string; department?: string; city?: string }>;
    audit_reason?: string;
    target_user_name?: string;
  };
}

interface NewVisitItem {
  companyName: string;
  visitType: 'Nueva visita' | 'Prospecto en seguimiento' | 'Cliente actual';
  department: string;
  city: string;
  zone: string;
  mapsUrl: string;
  reason: 'Prospección' | 'Presentación de servicios' | 'Seguimiento comercial' | 'Negociación' | 'Fidelización' | 'Otro';
  funnelStage: 'Prospección' | 'Contacto con decisor' | 'Negociación' | 'Contrato' | 'Venta ganada / Suscripción';
  result: 'Pendiente' | 'Propuesta enviada' | 'En negociación' | 'Contratado' | 'Venta perdida' | 'Sin interés' | 'Visita realizada';
  uberRefGs?: string;
  boltRefGs?: string;
  notes: string;
}

interface EditExtraExpenseItem {
  id?: string;
  concept: string;
  amount: string;
  companyId: string | null;
}

const EMPTY_NEW_VISIT = (): NewVisitItem => ({
  companyName: '',
  visitType: 'Nueva visita',
  department: 'Central',
  city: 'San Lorenzo',
  zone: '',
  mapsUrl: '',
  reason: 'Prospección',
  funnelStage: 'Prospección',
  result: 'Pendiente',
  notes: '',
});

export default function HistorialPage() {
  const { user } = useAuth();
  const isManager = ['admin', 'gerente'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'jornadas' | 'visitas'>('jornadas');

  // Filtros de fecha (Año, Mes y Día/Fecha)
  const now = new Date();
  const currentYearStr = now.getFullYear().toString();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDay, setSelectedDay] = useState<string>('todos');
  const [availableYears, setAvailableYears] = useState<string[]>([currentYearStr]);

  // Días disponibles para el selector según el mes y año (28, 29, 30 o 31)
  const daysInMonth = useMemo(() => {
    if (selectedMonth === 'todos') return 31;
    const y = parseInt(selectedYear, 10) || now.getFullYear();
    const m = parseInt(selectedMonth, 10);
    return new Date(y, m, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const dayOptions = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
  }, [daysInMonth]);

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [executors, setExecutors] = useState<UserOption[]>([]);

  // KPIs de Cierre de Período
  const [periodKpis, setPeriodKpis] = useState<KPIs | null>(null);
  const [loadingKpis, setLoadingKpis] = useState<boolean>(false);

  // Helper para rango de fechas según año, mes y día
  const getDateRange = (yr: string, mo: string, dy: string = 'todos') => {
    if (mo === 'todos') {
      return { from: `${yr}-01-01`, to: `${yr}-12-31` };
    }
    if (dy && dy !== 'todos') {
      const exactDate = `${yr}-${mo}-${dy.padStart(2, '0')}`;
      return { from: exactDate, to: exactDate };
    }
    const lastDay = new Date(parseInt(yr, 10), parseInt(mo, 10), 0).getDate();
    return {
      from: `${yr}-${mo}-01`,
      to: `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  // Datos de Jornadas
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [totalJornadas, setTotalJornadas] = useState<number>(0);
  const [jornadaPage, setJornadaPage] = useState<number>(1);

  // Datos de Visitas
  const [visits, setVisits] = useState<any[]>([]);
  const [totalVisits, setTotalVisits] = useState<number>(0);
  const [visitPage, setVisitPage] = useState<number>(1);

  // Modal: Detalle de Jornada
  const [selectedJornada, setSelectedJornada] = useState<any | null>(null);

  // Modal: Edición de Jornada (corrección de km y anexar visitas olvidadas)
  const [editingJornada, setEditingJornada] = useState<Jornada | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editKmStart, setEditKmStart] = useState<string>('');
  const [editKmEnd, setEditKmEnd] = useState<string>('');
  const [editKmStartPhoto, setEditKmStartPhoto] = useState<string>('');
  const [editKmEndPhoto, setEditKmEndPhoto] = useState<string>('');
  const [editUploadingPhoto, setEditUploadingPhoto] = useState<boolean>(false);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editAuditReason, setEditAuditReason] = useState<string>('');
  const [editExistingVisits, setEditExistingVisits] = useState<VisitDetail[]>([]);
  const [editNewVisits, setEditNewVisits] = useState<NewVisitItem[]>([]);
  const [editMobilityType, setEditMobilityType] = useState<'propia' | 'plataforma'>('propia');
  const [editFuelAmount, setEditFuelAmount] = useState<string>('');
  const [editExtraExpenses, setEditExtraExpenses] = useState<EditExtraExpenseItem[]>([]);
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  // Autocompletado dentro del modal de edición
  const [editSuggestions, setEditSuggestions] = useState<any[]>([]);
  const [activeEditSugIdx, setActiveEditSugIdx] = useState<number | null>(null);
  const editDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal: Auditoría de Modificaciones (exclusivo Admin)
  const [auditModalJornada, setAuditModalJornada] = useState<Jornada | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);

  // Cargar años disponibles
  useEffect(() => {
    api.get<string[]>('/dashboard/available-months')
      .then((res) => {
        const yrs = Array.from(new Set(res.data.map((m) => m.split('-')[0]))).filter(Boolean);
        if (!yrs.includes(currentYearStr)) {
          yrs.unshift(currentYearStr);
        }
        yrs.sort((a, b) => parseInt(b) - parseInt(a));
        setAvailableYears(yrs);
      })
      .catch((err) => console.error('Error al obtener años:', err));
  }, [currentYearStr]);

  // Cargar ejecutivos para selector si es manager
  useEffect(() => {
    if (isManager) {
      api.get<any[]>('/usuarios')
        .then((res) => {
          setExecutors(res.data.filter((u) => u.role === 'ejecutivo'));
        })
        .catch((err) => console.error('Error al cargar ejecutivos:', err));
    }
  }, [isManager]);

  // Cargar KPIs de Cierre de Período
  async function loadPeriodKpis(yr: string, mo: string, dy: string, usr: string) {
    try {
      setLoadingKpis(true);
      const { from, to } = getDateRange(yr, mo, dy);
      const params = new URLSearchParams();
      if (mo !== 'todos' && (!dy || dy === 'todos')) {
        params.append('month', `${yr}-${mo}`);
      } else {
        params.append('dateFrom', from);
        params.append('dateTo', to);
      }
      if (usr) params.append('userId', usr);

      const res = await api.get<KPIs>(`/dashboard/kpis?${params.toString()}`);
      setPeriodKpis(res.data);
    } catch (err) {
      console.error('Error al cargar KPIs de período:', err);
    } finally {
      setLoadingKpis(false);
    }
  }

  useEffect(() => {
    loadPeriodKpis(selectedYear, selectedMonth, selectedDay, selectedUser);
  }, [selectedYear, selectedMonth, selectedDay, selectedUser]);

  // Cargar jornadas
  useEffect(() => {
    if (activeTab === 'jornadas') {
      loadJornadas();
    }
  }, [activeTab, jornadaPage, selectedYear, selectedMonth, selectedDay, selectedUser]);

  // Cargar visitas
  useEffect(() => {
    if (activeTab === 'visitas') {
      loadVisits();
    }
  }, [activeTab, visitPage, selectedYear, selectedMonth, selectedDay, selectedUser, stageFilter, resultFilter]);

  async function loadJornadas() {
    setLoading(true);
    try {
      const { from, to } = getDateRange(selectedYear, selectedMonth, selectedDay);
      const params = new URLSearchParams();
      params.append('page', jornadaPage.toString());
      params.append('limit', '15');
      params.append('dateFrom', from);
      params.append('dateTo', to);
      if (selectedUser) params.append('userId', selectedUser);

      const res = await api.get(`/jornadas?${params.toString()}`);
      setJornadas(res.data.data);
      setTotalJornadas(res.data.total);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar historial de jornadas');
    } finally {
      setLoading(false);
    }
  }

  async function loadVisits() {
    setLoading(true);
    try {
      const { from, to } = getDateRange(selectedYear, selectedMonth, selectedDay);
      const params = new URLSearchParams();
      params.append('page', visitPage.toString());
      params.append('limit', '15');
      params.append('dateFrom', from);
      params.append('dateTo', to);
      if (selectedUser) params.append('userId', selectedUser);
      if (stageFilter) {
        params.append('stage', stageFilter);
        params.append('funnelStage', stageFilter);
      }
      if (resultFilter) params.append('result', resultFilter);

      const res = await api.get(`/visitas?${params.toString()}`);
      setVisits(res.data.data);
      setTotalVisits(res.data.total);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar detalle de visitas');
    } finally {
      setLoading(false);
    }
  }

  async function viewJornadaDetail(jornadaId: string) {
    try {
      const res = await api.get(`/jornadas/${jornadaId}`);
      setSelectedJornada(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar detalle de la jornada');
    }
  }

  async function openEditJornada(j: Jornada) {
    try {
      const res = await api.get(`/jornadas/${j.id}`);
      const full = res.data;
      setEditingJornada(j);
      setEditDate(full.date ? full.date.split('T')[0] : '');
      setEditKmStart(formatThousands(full.km_start));
      setEditKmEnd(formatThousands(full.km_end));
      setEditKmStartPhoto(full.km_start_photo || '');
      setEditKmEndPhoto(full.km_end_photo || '');
      setEditNotes(full.notes || '');
      setEditAuditReason('Ajuste de datos de jornada');
      setEditExistingVisits(full.visits || []);
      setEditNewVisits([]);
      setEditMobilityType(full.mobility_type || 'propia');
      setEditFuelAmount(full.fuel_amount_gs ? formatThousands(full.fuel_amount_gs) : '');
      const rawExp = Array.isArray(full.extra_expenses) ? full.extra_expenses : [];
      setEditExtraExpenses(
        rawExp.map((e: any) => ({
          id: e.id || String(Math.random()).substring(2, 9),
          concept: e.concept || '',
          amount: e.amount ? formatThousands(e.amount) : '',
          companyId: e.companyId || null,
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error('Error al preparar edición de la jornada');
    }
  }

  const handlePhotoEditUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEditUploadingPhoto(true);
      const compressed = await compressImageFile(file);
      if (type === 'start') {
        setEditKmStartPhoto(compressed);
        toast.success('Foto inicial de tablero actualizada');
      } else {
        setEditKmEndPhoto(compressed);
        toast.success('Foto final de tablero actualizada');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la foto');
    } finally {
      setEditUploadingPhoto(false);
      e.target.value = '';
    }
  };

  async function openAuditModal(j: Jornada) {
    setAuditModalJornada(j);
    setAuditLoading(true);
    try {
      const res = await api.get<{ audits: AuditEntry[] }>(`/jornadas/${j.id}/auditoria`);
      setAuditEntries(res.data.audits || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al obtener auditoría');
    } finally {
      setAuditLoading(false);
    }
  }

  // Manejo de autocompletado en edición
  const handleEditCompanyNameChange = (idx: number, val: string) => {
    setEditNewVisits((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, companyName: val } : v))
    );
    setActiveEditSugIdx(idx);

    if (editDebounceTimer.current) clearTimeout(editDebounceTimer.current);
    if (val.trim().length < 2) {
      setEditSuggestions([]);
      return;
    }

    editDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<{ data: any[] }>(`/empresas?q=${encodeURIComponent(val)}&limit=6`);
        setEditSuggestions(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };

  const selectEditSuggestion = (idx: number, sug: any) => {
    setEditNewVisits((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        return {
          ...v,
          companyName: sug.name,
          department: sug.department || v.department,
          city: sug.city || v.city,
          zone: sug.zone || v.zone,
          mapsUrl: sug.maps_url || v.mapsUrl,
          visitType: sug.commercial_status === 'Contratado' ? 'Cliente actual' : 'Prospecto en seguimiento',
        };
      })
    );
    setEditSuggestions([]);
    setActiveEditSugIdx(null);
  };

  async function handleSaveJornadaEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingJornada) return;

    const kmStartNum = parseThousands(editKmStart);
    const kmEndNum = parseThousands(editKmEnd);

    if (editMobilityType === 'propia' && kmEndNum > 0 && kmEndNum < kmStartNum) {
      toast.error('El kilometraje final no puede ser menor al inicial');
      return;
    }

    const fuelNum = editMobilityType === 'propia' ? parseThousands(editFuelAmount) : 0;
    const cleanExp = editExtraExpenses
      .filter((exp) => parseThousands(exp.amount) > 0)
      .map((exp) => ({
        id: exp.id,
        concept: exp.concept.trim() || 'Gasto extra',
        amount: parseThousands(exp.amount),
        companyId: exp.companyId || null,
      }));

    const auditReasonVal = editAuditReason.trim() || 'Ajuste de datos de jornada comercial';

    setEditSubmitting(true);
    try {
      const payload = {
        date: editDate,
        mobilityType: editMobilityType,
        kmStart: editMobilityType === 'propia' ? kmStartNum : 0,
        kmEnd: editMobilityType === 'propia' ? kmEndNum : 0,
        kmStartPhoto: editKmStartPhoto || undefined,
        kmEndPhoto: editKmEndPhoto || undefined,
        notes: editNotes.trim() || undefined,
        auditReason: auditReasonVal,
        fuelAmountGs: fuelNum,
        extraExpenses: cleanExp,
        newVisits: editNewVisits
          .filter((v) => v.companyName.trim())
          .map((v) => ({
            companyName: v.companyName.trim(),
            visitType: v.visitType,
            department: v.department || 'Central',
            city: v.city || 'San Lorenzo',
            zone: v.zone.trim() || `${v.city || 'San Lorenzo'}, ${v.department || 'Central'}`,
            mapsUrl: v.mapsUrl.trim() || undefined,
            reason: v.reason,
            funnelStage: v.funnelStage,
            result: v.result,
            notes: v.notes.trim() || undefined,
          })),
      };

      const res = await api.put(`/jornadas/${editingJornada.id}`, payload);
      toast.success(res.data.message || '¡Jornada modificada y registrada en auditoría!');
      setEditingJornada(null);
      loadJornadas();
      if (selectedJornada && selectedJornada.id === editingJornada.id) {
        viewJornadaDetail(editingJornada.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al guardar modificaciones');
    } finally {
      setEditSubmitting(false);
    }
  }

  const getStagePillClass = (stage: string) => {
    switch (stage) {
      case 'Prospección': return 'pill-gray';
      case 'Contacto con decisor': return 'pill-yellow';
      case 'Negociación': return 'pill-orange';
      case 'Contrato': return 'pill-blue';
      case 'Venta ganada / Suscripción': return 'pill-green';
      default: return 'pill-gray';
    }
  };

  const getResultPillClass = (result: string) => {
    switch (result) {
      case 'Contratado': return 'pill-green';
      case 'Propuesta enviada':
      case 'En negociación': return 'pill-orange';
      case 'Venta perdida':
      case 'Sin interés': return 'pill-red';
      case 'Visita realizada': return 'pill-blue';
      default: return 'pill-gray';
    }
  };

  const clearFilters = () => {
    setSelectedYear(currentYearStr);
    setSelectedMonth(currentMonthStr);
    setSelectedDay('todos');
    setSelectedUser('');
    setStageFilter('');
    setResultFilter('');
    setJornadaPage(1);
    setVisitPage(1);
  };

  // Helper de paginación reutilizable
  const renderPagination = (currentPage: number, totalItems: number, pageSize: number, onPageChange: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    const startItem = ((currentPage - 1) * pageSize) + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, flexWrap: 'wrap', gap: 12, borderTop: '1px solid var(--line-light)', paddingTop: 14 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
          Mostrando <strong>{startItem} - {endItem}</strong> de <strong>{totalItems}</strong> registros
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="btn btn-secondary btn-sm"
          >
            ← Anterior
          </button>
          {start > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: 32, padding: '4px 8px' }}
              >
                1
              </button>
              {start > 2 && <span style={{ padding: '0 4px', color: 'var(--ink-muted)' }}>...</span>}
            </>
          )}
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minWidth: 32, padding: '4px 8px' }}
            >
              {p}
            </button>
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--ink-muted)' }}>...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: 32, padding: '4px 8px' }}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="btn btn-secondary btn-sm"
          >
            Siguiente →
          </button>
        </div>
      </div>
    );
  };

  // Cálculo en vivo para el modal de edición
  const editKmStartVal = parseThousands(editKmStart);
  const editKmEndVal = parseThousands(editKmEnd);
  const editKmTotal = editKmEnd && editKmStart ? editKmEndVal - editKmStartVal : 0;
  const isEditKmInvalid = Boolean(editKmEnd && editKmStart && editKmEndVal < editKmStartVal);

  return (
    <div className="historial-page">
      {/* Encabezado y Selector de Pestañas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Historial de Jornadas y Visitas
          </h1>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Consulte las salidas diarias de los ejecutivos y el registro completo de reuniones
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('jornadas')}
            className={`btn ${activeTab === 'jornadas' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Calendar size={16} />
            <span>Jornadas por Día</span>
          </button>
          <button
            onClick={() => setActiveTab('visitas')}
            className={`btn ${activeTab === 'visitas' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Building2 size={16} />
            <span>Detalle de Visitas</span>
          </button>
        </div>
      </div>

      {/* Panel de Filtros: Año, Mes, Ejecutivo, Etapa, Resultado */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} color="var(--primary)" />
          <h2 style={{ fontSize: '0.95rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
            Filtros de Búsqueda
          </h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {/* Año */}
          <div className="field" style={{ width: 110, minWidth: 95, flexShrink: 0, marginBottom: 0 }}>
            <label>Año</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                const newYr = e.target.value;
                setSelectedYear(newYr);
                if (selectedMonth !== 'todos' && selectedDay !== 'todos') {
                  const maxD = new Date(parseInt(newYr, 10), parseInt(selectedMonth, 10), 0).getDate();
                  if (parseInt(selectedDay, 10) > maxD) {
                    setSelectedDay('todos');
                  }
                }
                setJornadaPage(1);
                setVisitPage(1);
              }}
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Mes */}
          <div className="field" style={{ width: 155, minWidth: 140, flexShrink: 0, marginBottom: 0 }}>
            <label>Mes</label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const newMo = e.target.value;
                setSelectedMonth(newMo);
                if (newMo === 'todos') {
                  setSelectedDay('todos');
                } else if (selectedDay !== 'todos') {
                  const maxD = new Date(parseInt(selectedYear, 10), parseInt(newMo, 10), 0).getDate();
                  if (parseInt(selectedDay, 10) > maxD) {
                    setSelectedDay('todos');
                  }
                }
                setJornadaPage(1);
                setVisitPage(1);
              }}
            >
              {MONTH_OPTIONS.map((mo) => (
                <option key={mo.value} value={mo.value}>
                  {mo.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha / Día */}
          <div className="field" style={{ width: 115, minWidth: 105, flexShrink: 0, marginBottom: 0 }}>
            <label>Fecha</label>
            <select
              value={selectedDay}
              disabled={selectedMonth === 'todos'}
              title={selectedMonth === 'todos' ? 'Seleccione un mes para filtrar por día' : undefined}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setJornadaPage(1);
                setVisitPage(1);
              }}
            >
              <option value="todos">-- Todos --</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Ejecutivo */}
          {isManager && (
            <div className="field" style={{ width: 220, minWidth: 170, flexShrink: 0, marginBottom: 0 }}>
              <label>Ejecutivo/a</label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setJornadaPage(1);
                  setVisitPage(1);
                }}
              >
                <option value="">Todos los ejecutivos</option>
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'visitas' && (
            <>
              <div className="field" style={{ width: 210, minWidth: 170, flexShrink: 0, marginBottom: 0 }}>
                <label>Etapa del Embudo</label>
                <select
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value);
                    setVisitPage(1);
                  }}
                >
                  <option value="">Todas las etapas</option>
                  <option value="Prospección">Prospección</option>
                  <option value="Contacto con decisor">Contacto con decisor</option>
                  <option value="Negociación">Negociación</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Venta ganada / Suscripción">Venta ganada / Suscripción</option>
                </select>
              </div>

              <div className="field" style={{ width: 180, minWidth: 150, flexShrink: 0, marginBottom: 0 }}>
                <label>Resultado Comercial</label>
                <select
                  value={resultFilter}
                  onChange={(e) => {
                    setResultFilter(e.target.value);
                    setVisitPage(1);
                  }}
                >
                  <option value="">Todos los resultados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Propuesta enviada">Propuesta enviada</option>
                  <option value="En negociación">En negociación</option>
                  <option value="Contratado">Contratado</option>
                  <option value="Venta perdida">Venta perdida</option>
                  <option value="Visita realizada">Visita realizada</option>
                </select>
              </div>
            </>
          )}

          {/* Botón Limpiar filtros */}
          <div className="field" style={{ flexShrink: 0, marginBottom: 0 }}>
            <button
              onClick={clearFilters}
              className="btn btn-secondary"
              style={{ height: 42, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de Cierre de Período (Estilo Resumen / KPIs) */}
      <div className="card" style={{ marginBottom: 20, padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', fontWeight: 800, margin: 0 }}>
              Resumen de Cierre · {
                selectedMonth === 'todos'
                  ? `Año ${selectedYear}`
                  : selectedDay !== 'todos'
                    ? `${selectedDay} de ${MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label} de ${selectedYear}`
                    : `${MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`
              }
            </h2>
            <p className="muted" style={{ fontSize: '0.82rem', margin: '3px 0 0' }}>
              {selectedUser
                ? `Cifras de desempeño de ${executors.find((e) => e.id === selectedUser)?.full_name || 'ejecutivo seleccionado'}`
                : isManager
                  ? 'Cifras consolidadas del equipo comercial en el período seleccionado'
                  : 'Cifras consolidadas de tu gestión en el período seleccionado'}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* 1. Jornadas */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '16px 14px', border: '1px solid var(--line-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: 'var(--primary)', marginBottom: 6 }}>
              <Calendar size={16} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }}>
                Jornadas
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
              {loadingKpis ? '...' : (periodKpis?.total_jornadas || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              Días de salida registrados
            </div>
          </div>

          {/* 2. Km Recorridos */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '16px 14px', border: '1px solid var(--line-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: 'var(--primary)', marginBottom: 6 }}>
              <Car size={16} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }}>
                Km Recorridos
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-dark)', lineHeight: 1.1 }}>
              {loadingKpis ? '...' : formatThousands(periodKpis?.total_km || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              Kilómetros auditables
            </div>
          </div>

          {/* 3. Total Visitas */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '16px 14px', border: '1px solid var(--line-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: 'var(--primary)', marginBottom: 6 }}>
              <TrendingUp size={16} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }}>
                Total Visitas
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
              {loadingKpis ? '...' : (periodKpis?.total_visitas || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              Reuniones comerciales
            </div>
          </div>

          {/* 4. Empresas Distintas */}
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '16px 14px', border: '1px solid var(--line-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: 'var(--primary)', marginBottom: 6 }}>
              <Building2 size={16} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)' }}>
                Empresas Distintas
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
              {loadingKpis ? '...' : (periodKpis?.empresas_distintas || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              Cuentas contactadas
            </div>
          </div>

          {/* 5. Contrataciones */}
          <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '16px 14px', border: '1px solid #BBF7D0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#16A34A', marginBottom: 6 }}>
              <FileCheck size={16} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#15803D' }}>
                Contrataciones
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803D', lineHeight: 1.1 }}>
              {loadingKpis ? '...' : (periodKpis?.contrataciones || 0)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: 4 }}>
              Contratos / Suscripciones
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
        </div>
      ) : activeTab === 'jornadas' ? (
        /* Pestaña: Jornadas Registradas (Rectángulos Detallados) */
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <h2 className="card-title">Jornadas Registradas ({totalJornadas})</h2>
          </div>

          {jornadas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {jornadas.map((j) => {
                const canEdit = isManager || j.user_id === user?.id;
                const hasAudit = Number(j.audit_count || 0) > 0;

                return (
                  <div
                    key={j.id}
                    onClick={() => viewJornadaDetail(j.id)}
                    style={{
                      background: '#fff',
                      border: '1.5px solid var(--line-light)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease-in-out',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.07)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line-light)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Fila superior: Fecha, Ejecutivo, Badge Auditoría y Acciones */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>
                          <Calendar size={16} color="var(--primary)" />
                          <span>{formatDate(j.date)}</span>
                        </div>

                        {isManager && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#F3F4F6',
                              color: '#374151',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                            }}
                          >
                            <User size={12} />
                            {j.user_name}
                          </span>
                        )}

                        {hasAudit && (
                          <span
                            className="pill pill-orange"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 800 }}
                            title="Esta jornada fue editada posteriormente"
                          >
                            <ShieldAlert size={12} style={{ display: 'inline', marginRight: 3 }} />
                            Editada ({j.audit_count})
                          </span>
                        )}

                        {j.status === 'abierta' && (
                          <span
                            className="sidebar-pending-badge"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 800 }}
                          >
                            <span className="pulse-dot" />
                            En curso
                          </span>
                        )}
                      </div>

                      {/* Botones de acción directos */}
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {j.status === 'abierta' && j.user_id === user?.id && (
                          <a
                            href="/nueva-jornada"
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-primary btn-sm"
                            style={{
                              background: 'linear-gradient(135deg, #EA4800 0%, #C2410C 100%)',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                            }}
                          >
                            <span>Continuar / Cerrar</span>
                          </a>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewJornadaDetail(j.id);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="Ver detalle de visitas"
                        >
                          <Eye size={14} />
                          <span>Ver Detalle</span>
                        </button>

                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditJornada(j);
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Editar jornada o anexar visita olvidada"
                          >
                            <Edit3 size={14} />
                            <span>Editar</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuditModal(j);
                            }}
                            className={`btn btn-sm ${hasAudit ? 'btn-primary' : 'btn-ghost'}`}
                            title="Ver registro detallado de auditoría de modificaciones"
                            style={{ fontSize: '0.78rem' }}
                          >
                            <ShieldCheck size={14} />
                            <span>Auditoría</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fila inferior: Métricas detalladas (Km, Odómetro, Empresas, Fotos, Notas) */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      {j.mobility_type === 'plataforma' ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            color: '#15803D',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                          }}
                        >
                          <Smartphone size={15} />
                          <span>{formatGs(j.transport_total_gs || 0)} (Plataforma)</span>
                        </div>
                      ) : (
                        <>
                          {/* Km Recorridos */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: '#FFF7ED',
                              border: '1px solid #FFEDD5',
                              color: '#EA580C',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                            }}
                          >
                            <Car size={15} />
                            <span>{j.km_total !== null ? formatKm(j.km_total) : 'En curso'}</span>
                          </div>

                          {/* Odómetro Inicial -> Final */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: '#F9FAFB',
                              border: '1px solid #E5E7EB',
                              fontSize: '0.84rem',
                              color: '#4B5563',
                            }}
                          >
                            <span>Inicio: <strong>{j.km_start !== null ? formatThousands(j.km_start) : '—'} km</strong></span>
                            <span>→</span>
                            <span>Final: <strong>{j.km_end !== null ? formatThousands(j.km_end) : '—'} km</strong></span>
                          </div>
                        </>
                      )}

                      {/* Empresas / Visitas */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: '#F3F4F6',
                          fontSize: '0.84rem',
                          color: '#374151',
                          fontWeight: 600,
                        }}
                      >
                        <Building2 size={14} color="var(--primary)" />
                        <span>
                          {j.visit_count} {Number(j.visit_count) === 1 ? 'empresa' : 'empresas'}
                        </span>
                      </div>

                      {/* Combustible si aplica */}
                      {j.mobility_type === 'propia' && Number(j.fuel_amount_gs || 0) > 0 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#FFF7ED',
                            border: '1px solid #FFEDD5',
                            fontSize: '0.84rem',
                            color: '#C2410C',
                            fontWeight: 700,
                          }}
                        >
                          <Fuel size={14} color="#EA580C" />
                          <span>Combustible: {formatGs(j.fuel_amount_gs)}</span>
                        </div>
                      )}

                      {/* Gastos extras si aplica */}
                      {Array.isArray(j.extra_expenses) && j.extra_expenses.length > 0 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#FEF3C7',
                            border: '1px solid #FDE68A',
                            fontSize: '0.84rem',
                            color: '#92400E',
                            fontWeight: 700,
                          }}
                        >
                          <Receipt size={14} color="#D97706" />
                          <span>
                            Gastos Extra ({j.extra_expenses.length}):{' '}
                            {formatGs(j.extra_expenses.reduce((a: number, c: any) => a + Number(c.amount || 0), 0))}
                          </span>
                        </div>
                      )}

                      {/* Registro fotográfico */}
                      {(j.km_start_photo || j.km_end_photo) && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: '#EFF6FF',
                            border: '1px solid #DBEAFE',
                            color: '#1D4ED8',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          <Camera size={14} color="#2563EB" />
                          <span>Fotos de tablero adjuntas</span>
                        </div>
                      )}

                      {/* Observaciones si las hay */}
                      {j.notes && (
                        <div
                          style={{
                            flex: '1 1 200px',
                            fontSize: '0.82rem',
                            color: 'var(--ink-muted)',
                            fontStyle: 'italic',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={j.notes}
                        >
                          "{j.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Calendar size={40} />
              <p>No se encontraron jornadas en este período.</p>
            </div>
          )}

          {/* Paginación de Jornadas (15 por página) */}
          {renderPagination(jornadaPage, totalJornadas, 15, setJornadaPage)}
        </div>
      ) : (
        /* Pestaña: Tabla de Visitas Detalladas */
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Detalle de Visitas ({totalVisits})</h2>
          </div>

          {visits.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    {isManager && <th>Ejecutivo/a</th>}
                    <th>Empresa</th>
                    <th>Tipo</th>
                    <th>Ubicación (INE)</th>
                    <th>Motivo</th>
                    <th>Etapa Embudo</th>
                    <th>Resultado</th>
                    <th>Movilidad (Ida)</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>
                        {formatDate(v.date)}
                      </td>
                      {isManager && <td>{v.user_name}</td>}
                      <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{v.company_name}</td>
                      <td style={{ fontSize: '0.82rem' }}>{v.visit_type}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {v.city ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} color="var(--primary)" />
                            {v.city}{v.department ? `, ${v.department}` : ''}
                          </span>
                        ) : v.zone ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} color="var(--primary)" />
                            {v.zone}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{v.reason}</td>
                      <td>
                        <span className={`pill ${getStagePillClass(v.funnel_stage)}`}>
                          {v.funnel_stage}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${getResultPillClass(v.result)}`}>
                          {v.result}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                        {v.uber_ref_gs ? `Uber: ${formatGs(v.uber_ref_gs)}` : ''}
                        {v.uber_ref_gs && v.bolt_ref_gs ? ' | ' : ''}
                        {v.bolt_ref_gs ? `Bolt: ${formatGs(v.bolt_ref_gs)}` : ''}
                        {!v.uber_ref_gs && !v.bolt_ref_gs ? '-' : ''}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', maxWidth: 220 }}>
                        {v.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Building2 size={40} />
              <p>No se encontraron visitas con los filtros seleccionados.</p>
            </div>
          )}

          {/* Paginación de Visitas (15 por página) */}
          {renderPagination(visitPage, totalVisits, 15, setVisitPage)}
        </div>
      )}

      {/* Modal 1: Detalle de Jornada */}
      {selectedJornada && createPortal(
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
          onClick={() => setSelectedJornada(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--ink)' }}>
                  Detalle de Jornada: {formatDate(selectedJornada.date)}
                </h2>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Ejecutivo/a: <strong>{selectedJornada.user_name}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = jornadas.find((x) => x.id === selectedJornada.id) || selectedJornada;
                    openEditJornada(toEdit);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <Edit3 size={14} />
                  <span>Editar</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const toAudit = jornadas.find((x) => x.id === selectedJornada.id) || selectedJornada;
                      openAuditModal(toAudit);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <ShieldCheck size={14} />
                    <span>Auditoría</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedJornada(null)}
                  className="btn btn-secondary btn-icon"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Ficha técnica del odómetro */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                background: 'var(--primary-lighter)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                border: '1px solid var(--line)',
              }}
            >
              <div>
                <small className="muted">Km Inicial:</small>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {formatThousands(selectedJornada.km_start)} km
                </div>
              </div>
              <div>
                <small className="muted">Km Final:</small>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {formatThousands(selectedJornada.km_end)} km
                </div>
              </div>
              <div>
                <small className="muted">Km Recorridos:</small>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-dark)' }}>
                  {formatKm(selectedJornada.km_total)}
                </div>
              </div>
            </div>

            {/* Resumen Financiero y de Movilidad de la Jornada */}
            {(() => {
              const fuelAmount = Number(selectedJornada.fuel_amount_gs || 0);
              const rawExp: any[] = Array.isArray(selectedJornada.extra_expenses) ? selectedJornada.extra_expenses : [];
              const totalExp = rawExp.reduce((acc, e) => acc + (Number(e.amount || 0)), 0);
              const totalTransfers = selectedJornada.visits?.reduce((acc: number, v: any) => acc + (Number(v.transport_cost_gs || 0)), 0) || Number(selectedJornada.transport_total_gs || 0);
              const totalInversion = (selectedJornada.mobility_type === 'propia' ? fuelAmount : totalTransfers) + totalExp;

              return (
                <div
                  style={{
                    background: '#FFFBF9',
                    border: '1.5px solid #FED7AA',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 18px',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Fuel size={16} color="var(--primary)" />
                      MOVILIDAD, COMBUSTIBLE Y GASTOS DE LA JORNADA
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9A3412', background: '#FFEDD5', padding: '4px 12px', borderRadius: 20 }}>
                      Inversión Total: {formatGs(totalInversion)}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {/* Medio de Movilidad */}
                    <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #FFEDD5' }}>
                      <small className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Medio de Movilidad:</small>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        {selectedJornada.mobility_type === 'plataforma' ? (
                          <>
                            <Smartphone size={16} color="#15803D" />
                            <span>Plataforma (Bolt/Uber)</span>
                          </>
                        ) : (
                          <>
                            <Car size={16} color="var(--primary)" />
                            <span>Vehículo Propio</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Costo de Combustible o Traslados */}
                    <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #FFEDD5' }}>
                      <small className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                        {selectedJornada.mobility_type === 'plataforma' ? 'Costo Traslados Plataforma:' : 'Combustible Cargado:'}
                      </small>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-dark)', marginTop: 3 }}>
                        {selectedJornada.mobility_type === 'plataforma'
                          ? formatGs(totalTransfers)
                          : formatGs(fuelAmount)}
                      </div>
                    </div>

                    {/* Gastos Extras */}
                    <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #FFEDD5' }}>
                      <small className="muted" style={{ fontSize: '0.75rem', display: 'block' }}>Gastos Extra en Recorrido:</small>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: totalExp > 0 ? '#B45309' : 'var(--ink-muted)', marginTop: 3 }}>
                        {formatGs(totalExp)}
                      </div>
                    </div>
                  </div>

                  {/* Detalle de Gastos Extras desglosados */}
                  {rawExp.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FDBA74' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9A3412', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Receipt size={14} color="#EA580C" />
                        Desglose de Gastos Extra Obtenidos ({rawExp.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {rawExp.map((exp: any, i: number) => {
                          const matchedCompany = selectedJornada.visits?.find((v: any) => v.company_id === exp.companyId)?.company_name;
                          return (
                            <div
                              key={exp.id || i}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#fff',
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: '0.82rem',
                                border: '1px solid #FED7AA',
                              }}
                            >
                              <div>
                                <strong>{exp.concept || 'Gasto extra'}</strong>
                                <span className="muted" style={{ fontSize: '0.75rem', marginLeft: 8 }}>
                                  {matchedCompany ? `· Vinculado a: ${matchedCompany}` : '· Distribuido entre visitas'}
                                </span>
                              </div>
                              <span style={{ fontWeight: 800, color: '#EA580C' }}>
                                {formatGs(exp.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Evidencia fotográfica de odómetro en detalle */}
            {(selectedJornada.km_start_photo || selectedJornada.km_end_photo) && (
              <div
                style={{
                  background: '#F0F7FF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  marginBottom: 20,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Camera size={16} color="#2563EB" />
                  <strong style={{ fontSize: '0.9rem', color: '#1D4ED8' }}>
                    Evidencia Fotográfica de Odómetro / Tablero (Auto o Moto)
                  </strong>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                      1. Foto Tablero Inicial (Km: {formatThousands(selectedJornada.km_start)})
                    </span>
                    {selectedJornada.km_start_photo ? (
                      <div
                        onClick={() => setPreviewPhotoModal(selectedJornada.km_start_photo)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid #93C5FD',
                          height: 120,
                          background: '#000',
                          position: 'relative',
                        }}
                        title="Clic para ver foto"
                      >
                        <img
                          src={selectedJornada.km_start_photo}
                          alt="Tablero inicial"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'rgba(15,23,42,0.75)',
                            color: '#fff',
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontWeight: 600,
                          }}
                        >
                          <Eye size={12} /> Ver Foto
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 120,
                          background: '#F1F5F9',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94A3B8',
                          fontSize: '0.8rem',
                        }}
                      >
                        Sin foto registrada
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                      2. Foto Tablero Final (Km: {formatThousands(selectedJornada.km_end)})
                    </span>
                    {selectedJornada.km_end_photo ? (
                      <div
                        onClick={() => setPreviewPhotoModal(selectedJornada.km_end_photo)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid #93C5FD',
                          height: 120,
                          background: '#000',
                          position: 'relative',
                        }}
                        title="Clic para ver foto"
                      >
                        <img
                          src={selectedJornada.km_end_photo}
                          alt="Tablero final"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'rgba(15,23,42,0.75)',
                            color: '#fff',
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontWeight: 600,
                          }}
                        >
                          <Eye size={12} /> Ver Foto
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 120,
                          background: '#F3F4F6',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#9CA3AF',
                          fontSize: '0.8rem',
                        }}
                      >
                        Sin foto registrada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedJornada.notes && (
              <p style={{ marginBottom: 16, fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
                <strong>Observaciones de la jornada:</strong> {selectedJornada.notes}
              </p>
            )}

            {/* Listado de visitas dentro de la jornada */}
            <h3 style={{ marginBottom: 12, fontSize: '1.05rem', color: 'var(--ink)' }}>
              Empresas Visitadas ({selectedJornada.visits?.length || 0})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedJornada.visits?.map((v: VisitDetail, idx: number) => (
                <div
                  key={v.id}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    background: '#fffdfb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '1rem', color: 'var(--ink)' }}>{v.company_name}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`pill ${getStagePillClass(v.funnel_stage)}`}>{v.funnel_stage}</span>
                      <span className={`pill ${getResultPillClass(v.result)}`}>{v.result}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
                    <div>
                      <span className="muted">Tipo:</span> {v.visit_type}
                    </div>
                    <div>
                      <span className="muted">Motivo:</span> {v.reason}
                    </div>
                    <div>
                      <span className="muted">Ubicación (INE):</span>{' '}
                      {v.city ? `${v.city}, ${v.department}` : (v.zone || '—')}
                    </div>
                    {v.maps_url && (
                      <div>
                        <a
                          href={v.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                          style={{ fontSize: '0.85rem' }}
                        >
                          <MapPin size={13} />
                          <span>Ver ubicación Maps</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>

                  {(v.uber_ref_gs || v.bolt_ref_gs) && (
                    <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                      <strong>Ref. Movilidad: </strong>
                      {v.uber_ref_gs ? `Uber: ${formatGs(v.uber_ref_gs)} ` : ''}
                      {v.bolt_ref_gs ? `Bolt: ${formatGs(v.bolt_ref_gs)}` : ''}
                    </div>
                  )}

                  {/* Desglose de inversión comercial de la visita */}
                  {(Number(v.total_cost_gs || 0) > 0 || Number(v.fuel_allocated_gs || 0) > 0 || Number(v.transport_cost_gs || 0) > 0 || Number(v.other_expenses_gs || 0) > 0) && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: '#FFF7ED',
                        border: '1px solid #FFEDD5',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {Number(v.fuel_allocated_gs || 0) > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Fuel size={13} color="#EA580C" />
                            Combustible: <strong>{formatGs(v.fuel_allocated_gs)}</strong>
                          </span>
                        )}
                        {Number(v.transport_cost_gs || 0) > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Smartphone size={13} color="#15803D" />
                            Traslado: <strong>{formatGs(v.transport_cost_gs)}</strong>
                          </span>
                        )}
                        {Number(v.other_expenses_gs || 0) > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Utensils size={13} color="#D97706" />
                            Gasto extra: <strong>{formatGs(v.other_expenses_gs)}</strong>
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>
                        Inversión Visita: {formatGs(v.total_cost_gs || (Number(v.fuel_allocated_gs || 0) + Number(v.transport_cost_gs || 0) + Number(v.other_expenses_gs || 0)))}
                      </div>
                    </div>
                  )}

                  {v.notes && (
                    <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--ink)' }}>
                      <strong>Notas:</strong> {v.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setSelectedJornada(null)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 2: Editar Jornada y Anexar Visitas Olvidadas */}
      {editingJornada && createPortal(
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
          onClick={() => !editSubmitting && setEditingJornada(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 820,
              width: '100%',
              height: 'min(82vh, 600px)',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera Fija */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid var(--line)',
                background: '#fff',
                flexShrink: 0,
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--primary-lighter)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--ink)', margin: 0, fontWeight: 700 }}>
                      Editar Jornada Comercial
                    </h2>
                    <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 0' }}>
                      Ejecutivo/a: <strong>{editingJornada.user_name}</strong> · Todo cambio será registrado en auditoría.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingJornada(null)}
                className="btn btn-secondary btn-icon"
                title="Cerrar"
                style={{ borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario con cuerpo scrolleable y pie fijo */}
            <form
              onSubmit={handleSaveJornadaEdit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div
                id="edit-scroll-body"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px 24px',
                }}
              >
                {/* Control de Fecha, Movilidad y Combustible */}
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1.5px solid #FFD0B3',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 12, letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Fuel size={15} color="var(--primary)" />
                    CONTROL DE FECHA, MOVILIDAD Y COMBUSTIBLE
                  </div>

                  <div className="grid-3" style={{ marginBottom: 12 }}>
                    <div className="field">
                      <label>Fecha de la jornada *</label>
                      <input
                        type="date"
                        required
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Medio de Movilidad</label>
                      <select
                        value={editMobilityType}
                        onChange={(e) => setEditMobilityType(e.target.value as 'propia' | 'plataforma')}
                        style={{ fontWeight: 600 }}
                      >
                        <option value="propia">🚗 Vehículo Propio</option>
                        <option value="plataforma">🚕 Plataforma (Bolt/Uber)</option>
                      </select>
                    </div>

                    {editMobilityType === 'propia' ? (
                      <div className="field">
                        <label>Costo de Combustible (Gs.)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej. 150.000"
                          value={formatThousands(editFuelAmount)}
                          onChange={(e) => setEditFuelAmount(e.target.value.replace(/\D/g, ''))}
                          style={{ fontWeight: 700, color: 'var(--primary-dark)' }}
                        />
                      </div>
                    ) : (
                      <div className="field">
                        <label>Costo de Traslados</label>
                        <div
                          style={{
                            height: 38,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 10px',
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: 'var(--radius-sm)',
                            color: '#15803D',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          Cargado por visita
                        </div>
                      </div>
                    )}
                  </div>

                  {editMobilityType === 'propia' ? (
                    <div style={{ marginBottom: 12, padding: '12px 14px', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid #FED7AA' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9A3412', marginBottom: 8, letterSpacing: '0.5px' }}>
                        CONTROL DE ODÓMETRO (VEHÍCULO PROPIO)
                      </div>
                      <div className="grid-2" style={{ gap: 12 }}>
                        <div className="field">
                          <label>Km Inicial *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            required
                            value={formatThousands(editKmStart)}
                            onChange={(e) => setEditKmStart(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>

                        <div className="field">
                          <label>Km Final *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            required
                            className={isEditKmInvalid ? 'error' : ''}
                            value={formatThousands(editKmEnd)}
                            onChange={(e) => setEditKmEnd(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>

                      {editKmStart && editKmEnd && (
                        <div style={{ marginTop: 6 }}>
                          {isEditKmInvalid ? (
                            <span style={{ color: 'var(--red)', fontSize: '0.82rem', fontWeight: 700 }}>
                              ⚠️ El Km final no puede ser menor al inicial.
                            </span>
                          ) : (
                            <span style={{ color: 'var(--primary-dark)', fontSize: '0.88rem', fontWeight: 800 }}>
                              Recorrido recalculado: {formatKm(editKmTotal)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12, padding: '10px 14px', background: '#F0FDF4', borderRadius: 'var(--radius-sm)', border: '1px solid #BBF7D0', color: '#166534', fontSize: '0.82rem' }}>
                      💡 En modalidad de Plataforma de Transporte no se requiere odómetro. Los costos de traslados se asocian a las visitas registradas.
                    </div>
                  )}

                  <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label>Observaciones generales de la jornada</label>
                    <input
                      type="text"
                      placeholder="Notas..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>

                  <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                      Motivo de la corrección / justificación (auditoría)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Corrección de combustible / odómetro / Anexar visita"
                      value={editAuditReason}
                      onChange={(e) => setEditAuditReason(e.target.value)}
                      style={{ background: '#fff', border: '1.5px solid var(--primary-light)' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem', marginTop: 3 }}>
                      Se guardará en auditoría junto a los valores originales. Si se deja en blanco, se registrará "Ajuste de datos de jornada comercial".
                    </span>
                  </div>

                {/* Fotos del Odómetro en la edición */}
                {(user?.photoOdometerEnabled || isManager || editKmStartPhoto || editKmEndPhoto) && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #BFDBFE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Camera size={15} color="#2563EB" />
                        Fotos del Tablero / Odómetro
                      </span>
                      <span className="muted" style={{ fontSize: '0.72rem' }}>Opcional: actualice la foto si hubo error</span>
                    </div>

                    <div className="grid-2" style={{ gap: 10 }}>
                      {/* Foto Inicio */}
                      <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', padding: 8 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4, color: '#4B5563', display: 'flex', justifyContent: 'space-between' }}>
                          <span>1. Foto Tablero Inicial</span>
                          {editKmStartPhoto && <span className="pill pill-green" style={{ fontSize: '0.65rem' }}>Adjunta</span>}
                        </div>
                        {editKmStartPhoto ? (
                          <div>
                            <img
                              src={editKmStartPhoto}
                              alt="Tablero inicial"
                              style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => setPreviewPhotoModal(editKmStartPhoto)}
                              title="Clic para ver foto"
                            />
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 10px', fontSize: '0.72rem', width: 'auto' }}
                                onClick={() => setPreviewPhotoModal(editKmStartPhoto)}
                              >
                                <Eye size={12} /> Ver Foto
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', width: 'auto' }}
                                onClick={() => setEditKmStartPhoto('')}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 90, cursor: 'pointer', border: '1px dashed #93C5FD', borderRadius: 4, gap: 4 }}>
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handlePhotoEditUpload(e, 'start')} />
                            <Camera size={20} color="#2563EB" />
                            <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>{editUploadingPhoto ? 'Cargando...' : 'Subir foto inicial'}</span>
                          </label>
                        )}
                      </div>

                      {/* Foto Fin */}
                      <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', padding: 8 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4, color: '#4B5563', display: 'flex', justifyContent: 'space-between' }}>
                          <span>2. Foto Tablero Final</span>
                          {editKmEndPhoto && <span className="pill pill-green" style={{ fontSize: '0.65rem' }}>Adjunta</span>}
                        </div>
                        {editKmEndPhoto ? (
                          <div>
                            <img
                              src={editKmEndPhoto}
                              alt="Tablero final"
                              style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => setPreviewPhotoModal(editKmEndPhoto)}
                              title="Clic para ver foto"
                            />
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 10px', fontSize: '0.72rem', width: 'auto' }}
                                onClick={() => setPreviewPhotoModal(editKmEndPhoto)}
                              >
                                <Eye size={12} /> Ver Foto
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', width: 'auto' }}
                                onClick={() => setEditKmEndPhoto('')}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 90, cursor: 'pointer', border: '1px dashed #93C5FD', borderRadius: 4, gap: 4 }}>
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handlePhotoEditUpload(e, 'end')} />
                            <Camera size={20} color="#2563EB" />
                            <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>{editUploadingPhoto ? 'Cargando...' : 'Subir foto final'}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gastos Extras en la edición */}
              <div
                style={{
                  background: '#FFFBF9',
                  border: '1.5px solid #FDE68A',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400E', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Receipt size={15} color="#D97706" />
                      GASTOS EXTRA OBTENIDOS EN EL RECORRIDO
                    </div>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      Sirve para registro de gastos extra en recorrido (ej. Almuerzos comerciales, café de reuniones, insumos).
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditExtraExpenses((prev) => [
                        ...prev,
                        { id: String(Math.random()).substring(2, 9), concept: '', amount: '', companyId: null }
                      ]);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700 }}
                  >
                    <Plus size={13} />
                    <span>Agregar otro gasto</span>
                  </button>
                </div>

                {editExtraExpenses.length === 0 ? (
                  <div style={{ padding: '12px', background: '#fff', borderRadius: 6, border: '1px dashed #CBD5E1', textAlign: 'center', color: '#64748B', fontSize: '0.82rem' }}>
                    No hay gastos extra registrados en esta jornada. Haga clic en "+ Agregar otro gasto" si desea registrar alguno.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {editExtraExpenses.map((exp, idx) => (
                      <div
                        key={exp.id || idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1.4fr auto',
                          gap: 8,
                          alignItems: 'center',
                          background: '#fff',
                          padding: 10,
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid #FED7AA',
                        }}
                      >
                        <div>
                          <input
                            type="text"
                            placeholder="Concepto (ej. Almuerzo comercial)"
                            value={exp.concept}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditExtraExpenses((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, concept: val } : item))
                              );
                            }}
                            style={{ height: 38, fontSize: '0.85rem' }}
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Monto Gs."
                            value={formatThousands(exp.amount)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setEditExtraExpenses((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, amount: val } : item))
                              );
                            }}
                            style={{ height: 38, fontSize: '0.85rem', fontWeight: 700 }}
                          />
                        </div>

                        <div>
                          <select
                            value={exp.companyId || ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              setEditExtraExpenses((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, companyId: val } : item))
                              );
                            }}
                            style={{ height: 38, fontSize: '0.82rem' }}
                          >
                            <option value="">Distribuir entre todas las visitas</option>
                            {editExistingVisits.map((v) => (
                              <option key={v.id} value={v.company_id || v.id}>
                                Vincular a: {v.company_name}
                              </option>
                            ))}
                            {editNewVisits.map((nv, ni) => (
                              nv.companyName.trim() ? (
                                <option key={`nv-${ni}`} value={nv.companyName}>
                                  Vincular a: {nv.companyName} (Nueva)
                                </option>
                              ) : null
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditExtraExpenses((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="btn btn-danger btn-sm"
                          style={{ height: 38, width: 38, padding: 0, display: 'grid', placeItems: 'center' }}
                          title="Eliminar gasto"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}

                    {editExtraExpenses.length > 0 && (
                      <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#9A3412', marginTop: 4 }}>
                        Total Gastos Extra: {formatGs(editExtraExpenses.reduce((sum, item) => sum + (parseThousands(item.amount) || 0), 0))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Visitas existentes (solo lectura) */}
              {editExistingVisits.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink-muted)', marginBottom: 8 }}>
                    VISITAS YA REGISTRADAS ({editExistingVisits.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                    {editExistingVisits.map((v, i) => (
                      <div
                        key={v.id}
                        style={{
                          padding: '8px 12px',
                          background: '#F8FAFC',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <strong>{i + 1}. {v.company_name}</strong>
                          {v.zone && <span className="muted"> · {v.zone}</span>}
                        </div>
                        <div className="flex gap-2">
                          <span className="pill pill-orange" style={{ fontSize: '0.7rem' }}>{v.funnel_stage}</span>
                          <span className={`pill ${getResultPillClass(v.result)}`} style={{ fontSize: '0.7rem' }}>{v.result}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anexar visitas olvidadas */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                    + ANEXAR VISITAS QUE SE PASARON
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditNewVisits((prev) => [...prev, EMPTY_NEW_VISIT()]);
                      setTimeout(() => {
                        const el = document.getElementById('edit-scroll-body');
                        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                      }, 100);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <Plus size={14} />
                    <span>Agregar visita olvidada</span>
                  </button>
                </div>

                {editNewVisits.map((nv, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1.5px dashed var(--primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      background: '#FFFDFB',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--primary-dark)' }}>
                        Nueva visita #{idx + 1}
                      </strong>
                      <button
                        type="button"
                        onClick={() => setEditNewVisits((prev) => prev.filter((_, i) => i !== idx))}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 size={13} />
                        <span>Quitar</span>
                      </button>
                    </div>

                    <div className="grid-3">
                      <div className="field" style={{ position: 'relative' }}>
                        <label>Empresa *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nombre o búsqueda..."
                          value={nv.companyName}
                          onChange={(e) => handleEditCompanyNameChange(idx, e.target.value)}
                        />
                        {activeEditSugIdx === idx && editSuggestions.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 30,
                              background: '#fff',
                              border: '1.5px solid var(--primary)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: 'var(--shadow-md)',
                              maxHeight: 160,
                              overflowY: 'auto',
                            }}
                          >
                            {editSuggestions.map((sug) => (
                              <div
                                key={sug.id}
                                onClick={() => selectEditSuggestion(idx, sug)}
                                style={{
                                  padding: '8px 10px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  borderBottom: '1px solid var(--line)',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-lighter)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                              >
                                <strong>{sug.name}</strong>
                                {sug.zone && <div className="muted" style={{ fontSize: '0.75rem' }}>📍 {sug.zone}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="field">
                        <label>Tipo *</label>
                        <select
                          value={nv.visitType}
                          onChange={(e) => setEditNewVisits((prev) => prev.map((item, i) => i === idx ? { ...item, visitType: e.target.value as any } : item))}
                        >
                          <option value="Nueva visita">Nueva visita</option>
                          <option value="Prospecto en seguimiento">Prospecto en seguimiento</option>
                          <option value="Cliente actual">Cliente actual</option>
                        </select>
                      </div>

                      <div className="field">
                        <label>Departamento (INE) *</label>
                        <select
                          value={nv.department || 'Central'}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            const cities = getCiudadesPorDepartamento(newDept);
                            setEditNewVisits((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      department: newDept,
                                      city: cities[0] || '',
                                    }
                                  : item
                              )
                            );
                          }}
                        >
                          {DEPARTAMENTOS_PARAGUAY.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid-2" style={{ marginTop: 8 }}>
                      <div className="field">
                        <label>Ciudad / Municipio (INE) *</label>
                        <select
                          value={nv.city || ''}
                          onChange={(e) =>
                            setEditNewVisits((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, city: e.target.value } : item
                              )
                            )
                          }
                        >
                          {getCiudadesPorDepartamento(nv.department || 'Central').map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Dirección / Referencia (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej. Barrio Villa Morra, calle..."
                          value={nv.zone}
                          onChange={(e) =>
                            setEditNewVisits((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, zone: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="grid-3" style={{ marginTop: 8 }}>
                      <div className="field">
                        <label>Motivo *</label>
                        <select
                          value={nv.reason}
                          onChange={(e) => setEditNewVisits((prev) => prev.map((item, i) => i === idx ? { ...item, reason: e.target.value as any } : item))}
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
                        <label>Etapa del Embudo *</label>
                        <select
                          value={nv.funnelStage}
                          onChange={(e) => setEditNewVisits((prev) => prev.map((item, i) => i === idx ? { ...item, funnelStage: e.target.value as any } : item))}
                        >
                          <option value="Prospección">Prospección</option>
                          <option value="Contacto con decisor">Contacto con decisor</option>
                          <option value="Negociación">Negociación</option>
                          <option value="Contrato">Contrato</option>
                          <option value="Venta ganada / Suscripción">Venta ganada / Suscripción</option>
                        </select>
                      </div>

                      <div className="field">
                        <label>Resultado *</label>
                        <select
                          value={nv.result}
                          onChange={(e) => setEditNewVisits((prev) => prev.map((item, i) => i === idx ? { ...item, result: e.target.value as any } : item))}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Propuesta enviada">Propuesta enviada</option>
                          <option value="En negociación">En negociación</option>
                          <option value="Contratado">Contratado</option>
                          <option value="Venta perdida">Venta perdida</option>
                          <option value="Visita realizada">Visita realizada</option>
                        </select>
                      </div>
                    </div>

                    <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                      <label>Observaciones de esta visita</label>
                      <input
                        type="text"
                        placeholder="Detalles acuerdos, decisor..."
                        value={nv.notes}
                        onChange={(e) => setEditNewVisits((prev) => prev.map((item, i) => i === idx ? { ...item, notes: e.target.value } : item))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie Fijo con Botones de Acción Siempre Visibles */}
            <div
              style={{
                padding: '14px 24px',
                background: '#F8FAFC',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                boxShadow: '0 -4px 12px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '0.85rem' }}>
                {isEditKmInvalid ? (
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                    ⚠️ Km final no puede ser menor al inicial
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-muted)' }}>
                    Recorrido: <strong style={{ color: 'var(--primary-dark)' }}>{formatKm(editKmTotal)}</strong>
                    {editNewVisits.length > 0 && (
                      <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 700 }}>
                        (+{editNewVisits.length} visita{editNewVisits.length > 1 ? 's' : ''} nueva{editNewVisits.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingJornada(null)}
                  className="btn btn-secondary"
                  disabled={editSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || isEditKmInvalid}
                  className="btn btn-primary"
                  title={isEditKmInvalid ? 'Km final no puede ser menor al inicial' : 'Guardar y registrar modificaciones'}
                >
                  <Save size={16} />
                  <span>{editSubmitting ? 'Guardando...' : 'Guardar y Registrar'}</span>
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal 3: Registro de Auditoría (Exclusivo Administrador) */}
      {auditModalJornada && createPortal(
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
          onClick={() => setAuditModalJornada(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={24} color="var(--primary)" />
                <div>
                  <h2 style={{ fontSize: '1.3rem', color: 'var(--ink)', margin: 0 }}>
                    Registro de Auditoría de Jornada
                  </h2>
                  <p className="muted" style={{ fontSize: '0.85rem', margin: '2px 0 0' }}>
                    Jornada del {formatDate(auditModalJornada.date)} · Ejecutivo/a: <strong>{auditModalJornada.user_name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalJornada(null)}
                className="btn btn-secondary btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            {auditLoading ? (
              <div className="page-loading" style={{ minHeight: 160 }}>
                <div className="spinner" />
              </div>
            ) : auditEntries.length === 0 ? (
              <div
                style={{
                  background: 'var(--green-bg)',
                  border: '1.5px solid #A7F3D0',
                  borderRadius: 'var(--radius-md)',
                  padding: 24,
                  textAlign: 'center',
                  color: '#065F46',
                }}
              >
                <ShieldCheck size={36} color="var(--green)" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ fontSize: '1.05rem', marginBottom: 4 }}>Jornada en Estado Original</h3>
                <p style={{ fontSize: '0.88rem', margin: 0 }}>
                  Esta jornada se encuentra tal como fue registrada inicialmente. No posee modificaciones o alteraciones posteriores.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)' }}>
                  Total de modificaciones registradas: {auditEntries.length}
                </div>

                {auditEntries.map((a, idx) => (
                  <div
                    key={a.id}
                    style={{
                      border: '1.5px solid var(--line)',
                      borderLeft: '4px solid var(--primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      background: '#FFFDFB',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)' }}>
                          Modificación #{auditEntries.length - idx}
                        </span>
                        <span className="pill pill-orange" style={{ fontSize: '0.7rem' }}>
                          {a.performer_role || 'usuario'}
                        </span>
                      </div>
                      <span className="muted flex items-center gap-1" style={{ fontSize: '0.8rem' }}>
                        <Clock size={12} />
                        <span>{new Date(a.created_at).toLocaleString('es-PY')}</span>
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginBottom: 10 }}>
                      <span className="muted">Realizada por:</span> <strong>{a.performer_name || a.performer_email}</strong> ({a.performer_email})
                    </div>

                    {a.details?.audit_reason && (
                      <div
                        style={{
                          background: '#FFF0E6',
                          border: '1px solid #FFD0B3',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          color: 'var(--primary-dark)',
                          marginBottom: 10,
                        }}
                      >
                        <strong>Justificación declarada:</strong> {a.details.audit_reason}
                      </div>
                    )}

                    {/* Cambios en odómetro / campos */}
                    {a.details?.changes && Object.keys(a.details.changes).length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink-muted)', marginBottom: 6 }}>
                          CAMPOS MODIFICADOS:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {Object.entries(a.details.changes).map(([fieldKey, change]) => (
                            <div
                              key={fieldKey}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: '0.85rem',
                                padding: '6px 10px',
                                background: '#fff',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--line)',
                              }}
                            >
                              <strong style={{ minWidth: 120 }}>{change.label || fieldKey}:</strong>
                              <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>
                                {typeof change.old === 'number' ? formatThousands(change.old) : String(change.old)}
                              </span>
                              <span>➔</span>
                              <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                                {typeof change.new === 'number' ? formatThousands(change.new) : String(change.new)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visitas anexadas */}
                    {a.details?.added_visits && a.details.added_visits.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink-muted)', marginBottom: 6 }}>
                          VISITAS ANEXADAS EN ESTA MODIFICACIÓN ({a.details.added_visits.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.details.added_visits.map((av, vIdx) => (
                            <div
                              key={vIdx}
                              style={{
                                fontSize: '0.82rem',
                                padding: '4px 8px',
                                background: 'var(--green-bg)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid #A7F3D0',
                                color: '#065F46',
                              }}
                            >
                              + <strong>{av.companyName}</strong> ({av.funnelStage} · {av.result})
                              {av.zone && ` - 📍 ${av.zone}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setAuditModalJornada(null)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para visualizar foto ampliada (portal directo al body) */}
      {previewPhotoModal && createPortal(
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
          onClick={() => setPreviewPhotoModal(null)}
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
                onClick={() => setPreviewPhotoModal(null)}
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
                src={previewPhotoModal}
                alt="Foto del tablero ampliada"
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
