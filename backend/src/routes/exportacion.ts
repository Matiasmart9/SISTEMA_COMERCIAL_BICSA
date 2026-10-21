import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../db/pool';
import { authMiddleware, isAdminOrGerente } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, isAdminOrGerente);

const STAGES = [
  'Prospección',
  'Contacto con decisor',
  'Negociación',
  'Contrato',
  'Venta ganada / Suscripción',
];

const ORANGE = 'FFE66A16';
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFA94A0C' } },
      bottom: { style: 'medium', color: { argb: 'FFA94A0C' } },
      left: { style: 'thin', color: { argb: 'FFA94A0C' } },
      right: { style: 'thin', color: { argb: 'FFA94A0C' } },
    };
  });
  row.height = 30;
}

// GET /exportacion/excel
router.get('/excel', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, userId } = req.query as Record<string, string>;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const uuidRe = /^[0-9a-fA-F-]{36}$/;
    if ((dateFrom && !dateRe.test(dateFrom)) || (dateTo && !dateRe.test(dateTo)) || (userId && !uuidRe.test(userId))) {
      return res.status(400).json({ error: 'Parámetros de filtro inválidos' });
    }

    const dateCondition = `
      ${dateFrom ? `AND wd.date >= '${dateFrom}'` : ''}
      ${dateTo ? `AND wd.date <= '${dateTo}'` : ''}
    `;
    const visitDateCondition = `
      ${dateFrom ? `AND v.date >= '${dateFrom}'` : ''}
      ${dateTo ? `AND v.date <= '${dateTo}'` : ''}
    `;
    const userCondition = userId ? `AND wd.user_id = '${userId}'` : '';
    const visitUserCondition = userId ? `AND v.user_id = '${userId}'` : '';

    // ─── Consultas de datos ────────────────────────
    const [jornadas, visitas, empresasSummary, usuarios] = await Promise.all([
      pool.query(`
        SELECT
          wd.id,
          TO_CHAR(wd.date, 'DD/MM/YYYY') AS fecha_formateada,
          wd.date,
          u.full_name AS ejecutivo,
          wd.mobility_type,
          wd.transport_total_gs,
          wd.status,
          wd.km_start,
          wd.km_end,
          wd.km_total,
          wd.notes,
          COUNT(v.id) AS cantidad_empresas,
          COALESCE(
            (SELECT string_agg(DISTINCT v.reason::text, ', ')
             FROM visits v WHERE v.work_day_id = wd.id AND v.reason IS NOT NULL),
            ''
          ) AS motivos_visita,
          COALESCE(
            (SELECT string_agg(DISTINCT LOWER(v.zone), ' / ')
             FROM visits v WHERE v.work_day_id = wd.id AND v.zone IS NOT NULL AND v.zone != ''),
            ''
          ) AS zonas_visita,
          COALESCE(
            (SELECT string_agg(DISTINCT c.name, ', ')
             FROM visits v
             JOIN companies c ON c.id = v.company_id
             WHERE v.work_day_id = wd.id AND c.name IS NOT NULL),
            ''
          ) AS empresas_visita
        FROM work_days wd
        JOIN users u ON u.id = wd.user_id
        LEFT JOIN visits v ON v.work_day_id = wd.id
        WHERE TRUE ${dateCondition} ${userCondition}
        GROUP BY wd.id, u.full_name
        ORDER BY wd.date DESC, u.full_name ASC
      `),
      pool.query(`
        SELECT
          TO_CHAR(v.date, 'DD/MM/YYYY') AS date,
          u.full_name AS ejecutivo,
          c.name AS empresa,
          v.visit_type AS tipo,
          v.department AS departamento,
          v.city AS ciudad,
          v.zone AS ciudad_zona,
          v.maps_url AS ubicacion,
          v.reason AS motivo,
          v.funnel_stage AS etapa,
          v.result AS resultado,
          v.uber_ref_gs AS uber_ref_gs,
          v.bolt_ref_gs AS bolt_ref_gs,
          v.notes AS observaciones
        FROM visits v
        JOIN users u ON u.id = v.user_id
        JOIN companies c ON c.id = v.company_id
        WHERE TRUE ${visitDateCondition} ${visitUserCondition}
        ORDER BY v.date DESC, u.full_name ASC
      `),
      pool.query(`
        SELECT cs.company_name AS empresa, cs.total_visits AS total_visitas,
               cs.first_visit AS primera_visita, cs.last_visit AS ultima_visita,
               cs.commercial_status AS ultimo_estado, cs.executors_names AS ejecutivos
        FROM company_summary cs
        WHERE cs.total_visits > 0
        ORDER BY cs.company_name
      `),
      pool.query(`
        SELECT id, full_name FROM users WHERE role = 'ejecutivo' ORDER BY full_name
      `),
    ]);

    // ─── Contador mensual ──────────────────────────
    const monthlyRaw = await pool.query(`
      SELECT TO_CHAR(v.date, 'YYYY-MM') AS mes, v.user_id, u.full_name AS ejecutivo,
             v.funnel_stage, COUNT(*) AS count
      FROM visits v
      JOIN users u ON u.id = v.user_id
      WHERE TRUE ${visitDateCondition} ${visitUserCondition}
      GROUP BY TO_CHAR(v.date, 'YYYY-MM'), v.user_id, u.full_name, v.funnel_stage
      ORDER BY mes DESC, u.full_name
    `);

    const months = [...new Set(monthlyRaw.rows.map((r: any) => r.mes))].sort().reverse();
    const monthlyRows: any[] = [];
    for (const mes of months) {
      for (const u of usuarios.rows) {
        const stageCounts: Record<string, number> = {};
        let total = 0;
        for (const stage of STAGES) {
          const found = monthlyRaw.rows.find((r: any) => r.mes === mes && r.user_id === u.id && r.funnel_stage === stage);
          stageCounts[stage] = found ? parseInt(found.count) : 0;
          total += stageCounts[stage];
        }
        if (total > 0) {
          monthlyRows.push({ mes, ejecutivo: u.full_name, ...stageCounts, total });
        }
      }
    }

    // ─── Construir Libro de Excel ───────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BICSA Sistema Comercial';
    wb.created = new Date();

    // ═════════════════════════════════════════════════
    // HOJA 1: PLANILLA DE MOVILIDAD (MODELO OFICIAL SOLICITADO)
    // ═════════════════════════════════════════════════
    const wsMovilidad = wb.addWorksheet('Planilla de Movilidad');
    wsMovilidad.columns = [
      { header: 'FECHA', key: 'fecha', width: 14 },
      { header: 'EJECUTIVO', key: 'ejecutivo', width: 22 },
      { header: 'MOTIVO DE VISITA', key: 'motivo', width: 32 },
      { header: 'DESTINO/CLIENTE', key: 'destino_cliente', width: 44 },
      { header: 'KM RECORRIDOS', key: 'km_recorridos', width: 16 },
      { header: 'TARIFA REFERENCIA POR KM', key: 'tarifa_ref', width: 18 },
      { header: 'SUBTOTAL REFERENCIA', key: 'subtotal_ref', width: 20 },
      { header: 'PLUS P/ MANTENIMIENTO 5%', key: 'plus_mantenimiento', width: 20 },
      { header: 'GASTO DE COMBUSTIBLE (FACTURA)', key: 'gasto_combustible', width: 22 },
    ];
    styleHeader(wsMovilidad.getRow(1));

    jornadas.rows.forEach((r: any) => {
      let destinoCliente = '';
      if (r.zonas_visita && r.empresas_visita) {
        destinoCliente = `${r.zonas_visita} (${r.empresas_visita})`;
      } else if (r.zonas_visita) {
        destinoCliente = r.zonas_visita;
      } else if (r.empresas_visita) {
        destinoCliente = r.empresas_visita;
      } else {
        destinoCliente = r.notes || '-';
      }

      const motivo = r.motivos_visita || (r.notes ? 'Gestión comercial' : '-');
      const km = Number(r.km_total || 0);

      const row = wsMovilidad.addRow({
        fecha: r.fecha_formateada,
        ejecutivo: r.ejecutivo ? r.ejecutivo.toUpperCase() : '',
        motivo: motivo,
        destino_cliente: destinoCliente,
        km_recorridos: km,
        tarifa_ref: '-',
        subtotal_ref: '',
        plus_mantenimiento: '-',
        gasto_combustible: '',
      });

      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (colNumber === 6 || colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 7 || colNumber === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 22;
    });

    // Fila Total al pie de la Planilla de Movilidad
    const totalDataRows = jornadas.rows.length;
    const lastRowIndex = totalDataRows + 1;

    const totalRow = wsMovilidad.addRow({
      fecha: 'TOTAL GENERAL',
      ejecutivo: '',
      motivo: '',
      destino_cliente: '',
      km_recorridos: totalDataRows > 0 ? { formula: `=SUM(E2:E${lastRowIndex})` } : 0,
      tarifa_ref: '-',
      subtotal_ref: totalDataRows > 0 ? { formula: `=SUM(G2:G${lastRowIndex})` } : '',
      plus_mantenimiento: '-',
      gasto_combustible: totalDataRows > 0 ? { formula: `=SUM(I2:I${lastRowIndex})` } : '',
    });

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'double', color: { argb: 'FF4B5563' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 5 || colNumber === 7 || colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
    totalRow.height = 24;

    // ═════════════════════════════════════════════════
    // HOJA 2: RESUMEN EJECUTIVO
    // ═════════════════════════════════════════════════
    const wsResumen = wb.addWorksheet('Resumen ejecutivo');
    wsResumen.columns = [
      { header: 'Indicador', key: 'indicador', width: 35 },
      { header: 'Valor', key: 'valor', width: 22 },
    ];
    styleHeader(wsResumen.getRow(1));
    wsResumen.addRows([
      { indicador: 'Total jornadas registradas', valor: jornadas.rows.length },
      { indicador: 'Total km recorridos', valor: jornadas.rows.reduce((s: number, r: any) => s + (Number(r.km_total) || 0), 0) },
      { indicador: 'Total visitas comerciales', valor: visitas.rows.length },
      { indicador: 'Empresas distintas contactadas', valor: new Set(visitas.rows.map((r: any) => r.empresa)).size },
      { indicador: 'Contrataciones / Ventas ganadas', valor: visitas.rows.filter((r: any) => r.etapa === 'Contrato' || r.etapa === 'Venta ganada / Suscripción').length },
      { indicador: 'Período desde', valor: dateFrom || 'Histórico completo' },
      { indicador: 'Período hasta', valor: dateTo || 'Histórico completo' },
      { indicador: 'Generado el', valor: new Date().toLocaleDateString('es-PY') },
    ]);
    wsResumen.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          if (colNumber === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            if (typeof cell.value === 'number') cell.numFmt = '#,##0';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
        row.height = 20;
      }
    });

    // ═════════════════════════════════════════════════
    // HOJA 3: JORNADAS (SIN COLUMNA ID JORNADA)
    // ═════════════════════════════════════════════════
    const wsJornadas = wb.addWorksheet('Jornadas');
    wsJornadas.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Ejecutivo/a', key: 'ejecutivo', width: 25 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Movilidad', key: 'mobility_type', width: 16 },
      { header: 'Km inicial', key: 'km_start', width: 14 },
      { header: 'Km final', key: 'km_end', width: 14 },
      { header: 'Km recorridos', key: 'km_total', width: 16 },
      { header: 'Gasto Plataforma (Gs.)', key: 'transport_total_gs', width: 22 },
      { header: 'Empresas visitadas', key: 'cantidad_empresas', width: 20 },
      { header: 'Observaciones', key: 'notes', width: 35 },
    ];
    styleHeader(wsJornadas.getRow(1));

    jornadas.rows.forEach((r: any) => {
      const mobilityLabel = r.mobility_type === 'plataforma' ? 'Plataforma (Bolt/Uber)' : 'Vehículo Propio';
      const statusLabel = r.status === 'abierta' ? 'En curso' : 'Cerrada';
      const row = wsJornadas.addRow({
        date: r.fecha_formateada,
        ejecutivo: r.ejecutivo,
        status: statusLabel,
        mobility_type: mobilityLabel,
        km_start: r.km_start !== null ? Number(r.km_start) : '',
        km_end: r.km_end !== null ? Number(r.km_end) : '',
        km_total: r.km_total !== null ? Number(r.km_total) : '',
        transport_total_gs: r.transport_total_gs ? Number(r.transport_total_gs) : '',
        cantidad_empresas: Number(r.cantidad_empresas || 0),
        notes: r.notes || '-',
      });
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber >= 5 && colNumber <= 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 20;
    });

    // ═════════════════════════════════════════════════
    // HOJA 4: DETALLE VISITAS (SIN ID VISITA NI ID JORNADA)
    // ═════════════════════════════════════════════════
    const wsVisitas = wb.addWorksheet('Detalle visitas');
    wsVisitas.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Ejecutivo/a', key: 'ejecutivo', width: 25 },
      { header: 'Empresa', key: 'empresa', width: 35 },
      { header: 'Tipo', key: 'tipo', width: 22 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Ciudad', key: 'ciudad', width: 22 },
      { header: 'Ciudad / Zona', key: 'ciudad_zona', width: 22 },
      { header: 'Ubicación (Maps)', key: 'ubicacion', width: 30 },
      { header: 'Motivo', key: 'motivo', width: 28 },
      { header: 'Etapa', key: 'etapa', width: 28 },
      { header: 'Resultado', key: 'resultado', width: 22 },
      { header: 'Observaciones', key: 'observaciones', width: 40 },
    ];
    styleHeader(wsVisitas.getRow(1));

    visitas.rows.forEach((r: any) => {
      const row = wsVisitas.addRow({
        date: r.date,
        ejecutivo: r.ejecutivo,
        empresa: r.empresa,
        tipo: r.tipo,
        departamento: r.departamento || '-',
        ciudad: r.ciudad || '-',
        ciudad_zona: r.ciudad_zona || '-',
        ubicacion: r.ubicacion || '-',
        motivo: r.motivo,
        etapa: r.etapa,
        resultado: r.resultado,
        observaciones: r.observaciones || '-',
      });
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 20;
    });

    // ═════════════════════════════════════════════════
    // HOJA 5: CONTADOR MENSUAL
    // ═════════════════════════════════════════════════
    const wsMensual = wb.addWorksheet('Contador mensual');
    wsMensual.columns = [
      { header: 'Mes', key: 'mes', width: 14 },
      { header: 'Ejecutivo/a', key: 'ejecutivo', width: 25 },
      ...STAGES.map((s) => ({ header: s, key: s, width: 24 })),
      { header: 'TOTAL', key: 'total', width: 12 },
    ];
    styleHeader(wsMensual.getRow(1));

    monthlyRows.forEach((r: any) => {
      const row = wsMensual.addRow(r);
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber >= 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 20;
    });

    // ═════════════════════════════════════════════════
    // HOJA 6: RESUMEN POR EMPRESA
    // ═════════════════════════════════════════════════
    const wsEmpresas = wb.addWorksheet('Resumen empresa');
    wsEmpresas.columns = [
      { header: 'Empresa', key: 'empresa', width: 38 },
      { header: 'Total visitas', key: 'total_visitas', width: 16 },
      { header: 'Primera visita', key: 'primera_visita', width: 18 },
      { header: 'Última visita', key: 'ultima_visita', width: 18 },
      { header: 'Estado comercial', key: 'ultimo_estado', width: 24 },
      { header: 'Ejecutivos involucrados', key: 'ejecutivos', width: 40 },
    ];
    styleHeader(wsEmpresas.getRow(1));

    empresasSummary.rows.forEach((r: any) => {
      const row = wsEmpresas.addRow({
        empresa: r.empresa,
        total_visitas: Number(r.total_visitas || 0),
        primera_visita: r.primera_visita ? new Date(r.primera_visita).toLocaleDateString('es-PY') : '-',
        ultima_visita: r.ultima_visita ? new Date(r.ultima_visita).toLocaleDateString('es-PY') : '-',
        ultimo_estado: r.ultimo_estado,
        ejecutivos: r.ejecutivos,
      });
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (colNumber === 3 || colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 20;
    });

    // ─── Enviar respuesta con archivo binario ─────
    const filename = `BICSA_Planilla_Movilidad_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar exportación Excel' });
  }
});

export default router;
