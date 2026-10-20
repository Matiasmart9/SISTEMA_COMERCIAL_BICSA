/**
 * Utilidades de formateo consistentes para todo el Sistema Comercial BICSA
 */

/**
 * Formatea fechas de forma segura evitando "Invalid Date" o desfases horarios.
 * Soporta formatos ISO (con 'T') o 'YYYY-MM-DD'.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString(
          'es-PY',
          options || {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }
        );
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-PY', options);
  } catch {
    return '-';
  }
}

/**
 * Formatea fechas en formato corto estándar DD/MM/AAAA.
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  return formatDate(dateStr, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatea un valor numérico o string agregando puntos de miles (ej: "30000" -> "30.000").
 */
export function formatThousands(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return Number(clean).toLocaleString('es-PY');
}

/**
 * Convierte un string con puntos de miles a número entero limpio (ej: "30.000" -> 30000).
 */
export function parseThousands(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

/**
 * Formatea importes en Guaraníes con prefijo "Gs." y puntos de miles.
 */
export function formatGs(val: string | number | null | undefined): string {
  const num = typeof val === 'number' ? val : parseThousands(val);
  if (!num) return '-';
  return `Gs. ${num.toLocaleString('es-PY')}`;
}

/**
 * Formatea kilometraje con sufijo "km".
 */
export function formatKm(val: string | number | null | undefined): string {
  const num = typeof val === 'number' ? val : parseThousands(val);
  return `${num.toLocaleString('es-PY')} km`;
}
