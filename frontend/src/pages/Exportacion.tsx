import { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  CheckCircle,
  FileText,
  Layers,
  Fuel,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserOption {
  id: string;
  full_name: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function ExportacionPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => currentYear - i);
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [executors, setExecutors] = useState<UserOption[]>([]);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    api.get<any[]>('/usuarios')
      .then((res) => {
        setExecutors(res.data.filter((u) => u.is_active && (u.role === 'ejecutivo' || u.role === 'gerente')));
      })
      .catch((err) => console.error('Error al cargar ejecutivos:', err));
  }, []);

  async function handleDownloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (year) {
        const y = Number(year);
        if (month) {
          const m = Number(month);
          const lastDay = new Date(y, m, 0).getDate();
          const mm = String(m).padStart(2, '0');
          params.append('dateFrom', `${y}-${mm}-01`);
          params.append('dateTo', `${y}-${mm}-${String(lastDay).padStart(2, '0')}`);
        } else {
          params.append('dateFrom', `${y}-01-01`);
          params.append('dateTo', `${y}-12-31`);
        }
      }
      if (selectedUser) params.append('userId', selectedUser);

      const res = await api.get(`/exportacion/excel?${params.toString()}`, {
        responseType: 'blob',
      });

      // Crear enlace de descarga en el navegador
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.download = `BICSA_Resumen_Comercial_${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('¡Archivo Excel generado y descargado con éxito!');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar la exportación Excel');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="exportacion-page">
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>
            Exportación de Reportes Comerciales
          </h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Genere y descargue libros de Excel oficiales con formato institucional BICSA
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Panel de Filtros y Descarga */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Download size={20} color="var(--primary)" />
              <span>Configuración del Reporte</span>
            </h2>
          </div>

          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 18 }}>
            Seleccione el año y mes, o el ejecutivo que desea exportar. Si deja los campos en blanco, se exportarán todos los registros disponibles.
          </p>

          <div className="field">
            <label>Año</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setMonth('');
              }}
            >
              <option value="">Todos los años</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Mes</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={!year}
            >
              <option value="">{year ? 'Todo el año' : 'Seleccione un año primero'}</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1} disabled={Number(year) === currentYear && i + 1 > currentMonth}>{m}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Filtrar por Ejecutivo/a Comercial</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Todos los ejecutivos (consolidado)</option>
              {executors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="btn btn-primary w-full"
              style={{ padding: '12px 20px', fontSize: '1rem', justifyContent: 'center' }}
            >
              <FileSpreadsheet size={20} />
              <span>
                {downloading ? 'Generando libro Excel...' : 'Descargar Reporte en Excel'}
              </span>
            </button>
          </div>
        </div>

        {/* Ficha explicativa del libro de Excel generado */}
        <div className="card" style={{ background: '#fffdfb' }}>
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Layers size={20} color="var(--primary)" />
              <span>Estructura del Libro de Excel BICSA</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>1. Planilla de Movilidad (Modelo Oficial)</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Liquidación por jornada: Fecha, Ejecutivo, Motivo de visita, Destino/Cliente, Km recorridos, Referencias y columna para Factura de Combustible con sumatoria total.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>2. Resumen Ejecutivo</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Indicadores consolidados: total jornadas, km acumulados, total visitas y contrataciones.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>3. Jornadas</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Registro cronológico de salidas: fecha, ejecutivo, odómetro inicial, final, km recorridos y empresas visitadas (sin columnas de ID).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>4. Detalle de Visitas</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Reunión por reunión: empresa, tipo, zona, motivo, etapa del embudo, resultado y tarifas de referencia Uber/Bolt (sin columnas de ID).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>5. Contador Mensual</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Matriz comparativa de avance por etapas de embudo para cada ejecutivo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.92rem' }}>6. Resumen por Empresa</strong>
                <p className="subtle" style={{ fontSize: '0.8rem' }}>
                  Cuentas contactadas, frecuencia de visitas y último estado comercial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
