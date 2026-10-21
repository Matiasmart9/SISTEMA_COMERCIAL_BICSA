import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../db/pool';
import { authMiddleware, isAdminOrGerente } from '../middleware/auth';

const router = Router();
router.use(authMiddleware, isAdminOrGerente);

// GET /inversion/resumen
router.get('/resumen', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = parseInt(String(req.query.year || now.getFullYear()), 10);
    const month = parseInt(String(req.query.month || now.getMonth() + 1), 10);
    const userId = req.query.userId ? String(req.query.userId).trim() : null;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Mes o año no válidos' });
    }

    const params: any[] = [year, month];
    let userFilterVisits = '';
    if (userId) {
      params.push(userId);
      userFilterVisits = `AND v.user_id = $${params.length}`;
    }

    // 1. Resumen agrupado por empresa
    const companiesResult = await pool.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        c.department,
        c.city,
        c.commercial_status,
        COUNT(v.id)::int AS total_visits,
        COALESCE(SUM(v.fuel_allocated_gs), 0)::bigint AS total_fuel_gs,
        COALESCE(SUM(v.transport_cost_gs), 0)::bigint AS total_platform_gs,
        COALESCE(SUM(v.other_expenses_gs), 0)::bigint AS total_other_gs,
        COALESCE(SUM(v.total_cost_gs), 0)::bigint AS total_invested_gs,
        MAX(v.date)::text AS last_visit_date,
        ARRAY_AGG(DISTINCT u.full_name) AS executives
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      JOIN users u ON u.id = v.user_id
      JOIN work_days wd ON wd.id = v.work_day_id
      WHERE EXTRACT(YEAR FROM v.date) = $1
        AND EXTRACT(MONTH FROM v.date) = $2
        ${userFilterVisits}
      GROUP BY c.id, c.name, c.department, c.city, c.commercial_status
      ORDER BY total_invested_gs DESC, total_visits DESC, c.name ASC
    `, params);

    // 2. Detalle de todas las visitas del período
    const visitsResult = await pool.query(`
      SELECT 
        v.id,
        v.date::text,
        v.company_id,
        c.name AS company_name,
        u.full_name AS executive_name,
        wd.mobility_type,
        v.platform_used,
        COALESCE(v.transport_cost_gs, 0)::int AS transport_cost_gs,
        COALESCE(v.fuel_allocated_gs, 0)::int AS fuel_allocated_gs,
        COALESCE(v.other_expenses_gs, 0)::int AS other_expenses_gs,
        COALESCE(v.total_cost_gs, 0)::int AS total_cost_gs,
        v.reason,
        v.funnel_stage,
        v.result,
        v.notes
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      JOIN users u ON u.id = v.user_id
      JOIN work_days wd ON wd.id = v.work_day_id
      WHERE EXTRACT(YEAR FROM v.date) = $1
        AND EXTRACT(MONTH FROM v.date) = $2
        ${userFilterVisits}
      ORDER BY v.date DESC, v.created_at DESC
    `, params);

    // 3. KPIs generales
    const companies = companiesResult.rows;
    const visits = visitsResult.rows;

    const grandTotalInvested = companies.reduce((acc, c) => acc + Number(c.total_invested_gs), 0);
    const grandTotalFuel = companies.reduce((acc, c) => acc + Number(c.total_fuel_gs), 0);
    const grandTotalPlatform = companies.reduce((acc, c) => acc + Number(c.total_platform_gs), 0);
    const grandTotalOther = companies.reduce((acc, c) => acc + Number(c.total_other_gs), 0);
    const totalCompanies = companies.length;
    const totalVisits = visits.length;

    // 4. Lista de ejecutivos para el filtro
    const executivesResult = await pool.query(`
      SELECT id, full_name, email FROM users WHERE is_active = true ORDER BY full_name ASC
    `);

    res.json({
      month,
      year,
      kpis: {
        grandTotalInvested,
        grandTotalFuel,
        grandTotalPlatform,
        grandTotalOther,
        totalCompanies,
        totalVisits,
        averagePerCompany: totalCompanies > 0 ? Math.round(grandTotalInvested / totalCompanies) : 0,
        averagePerVisit: totalVisits > 0 ? Math.round(grandTotalInvested / totalVisits) : 0,
      },
      companies,
      visits,
      executives: executivesResult.rows,
    });
  } catch (err) {
    console.error('Error al obtener resumen de inversión:', err);
    res.status(500).json({ error: 'Error al obtener resumen de inversión por empresa' });
  }
});

// GET /inversion/export/excel
router.get('/export/excel', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = parseInt(String(req.query.year || now.getFullYear()), 10);
    const month = parseInt(String(req.query.month || now.getMonth() + 1), 10);
    const userId = req.query.userId ? String(req.query.userId).trim() : null;

    const params: any[] = [year, month];
    let userFilterVisits = '';
    if (userId) {
      params.push(userId);
      userFilterVisits = `AND v.user_id = $${params.length}`;
    }

    const companiesResult = await pool.query(`
      SELECT 
        c.name AS company_name,
        c.department,
        c.city,
        c.commercial_status,
        COUNT(v.id)::int AS total_visits,
        COALESCE(SUM(v.fuel_allocated_gs), 0)::bigint AS total_fuel_gs,
        COALESCE(SUM(v.transport_cost_gs), 0)::bigint AS total_platform_gs,
        COALESCE(SUM(v.other_expenses_gs), 0)::bigint AS total_other_gs,
        COALESCE(SUM(v.total_cost_gs), 0)::bigint AS total_invested_gs,
        MAX(v.date)::text AS last_visit_date,
        ARRAY_TO_STRING(ARRAY_AGG(DISTINCT u.full_name), ', ') AS executives
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      JOIN users u ON u.id = v.user_id
      JOIN work_days wd ON wd.id = v.work_day_id
      WHERE EXTRACT(YEAR FROM v.date) = $1
        AND EXTRACT(MONTH FROM v.date) = $2
        ${userFilterVisits}
      GROUP BY c.id, c.name, c.department, c.city, c.commercial_status
      ORDER BY total_invested_gs DESC, total_visits DESC, c.name ASC
    `, params);

    const visitsResult = await pool.query(`
      SELECT 
        v.date::text,
        c.name AS company_name,
        u.full_name AS executive_name,
        wd.mobility_type,
        v.platform_used,
        COALESCE(v.transport_cost_gs, 0)::int AS transport_cost_gs,
        COALESCE(v.fuel_allocated_gs, 0)::int AS fuel_allocated_gs,
        COALESCE(v.other_expenses_gs, 0)::int AS other_expenses_gs,
        COALESCE(v.total_cost_gs, 0)::int AS total_cost_gs,
        v.reason,
        v.funnel_stage,
        v.result,
        v.notes
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      JOIN users u ON u.id = v.user_id
      JOIN work_days wd ON wd.id = v.work_day_id
      WHERE EXTRACT(YEAR FROM v.date) = $1
        AND EXTRACT(MONTH FROM v.date) = $2
        ${userFilterVisits}
      ORDER BY v.date DESC, v.created_at DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BICSA Gestión Comercial';
    workbook.created = new Date();

    const GREEN_COLOR = 'FF16A34A';
    const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };

    // --- HOJA 1: RESUMEN POR EMPRESA ---
    const sheet1 = workbook.addWorksheet('Inversión por Empresa', {
      views: [{ showGridLines: true }]
    });

    sheet1.columns = [
      { header: 'Empresa / Institución', key: 'company_name', width: 34 },
      { header: 'Departamento', key: 'department', width: 18 },
      { header: 'Ciudad', key: 'city', width: 18 },
      { header: 'Estado Comercial', key: 'commercial_status', width: 18 },
      { header: 'Cant. Visitas', key: 'total_visits', width: 14 },
      { header: 'Combustible Distribuido (Gs.)', key: 'total_fuel_gs', width: 24 },
      { header: 'Plataformas (Uber/Bolt/Taxi) (Gs.)', key: 'total_platform_gs', width: 26 },
      { header: 'Otros Gastos (Gs.)', key: 'total_other_gs', width: 18 },
      { header: 'TOTAL INVERTIDO (Gs.)', key: 'total_invested_gs', width: 22 },
      { header: 'Ejecutivos Involucrados', key: 'executives', width: 28 },
      { header: 'Última Visita', key: 'last_visit_date', width: 15 },
    ];

    const h1 = sheet1.getRow(1);
    h1.height = 30;
    h1.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_COLOR } };
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    let rowIdx = 2;
    for (const c of companiesResult.rows) {
      const r = sheet1.addRow({
        company_name: c.company_name,
        department: c.department,
        city: c.city,
        commercial_status: c.commercial_status,
        total_visits: Number(c.total_visits),
        total_fuel_gs: Number(c.total_fuel_gs),
        total_platform_gs: Number(c.total_platform_gs),
        total_other_gs: Number(c.total_other_gs),
        total_invested_gs: Number(c.total_invested_gs),
        executives: c.executives,
        last_visit_date: c.last_visit_date,
      });

      r.getCell('total_visits').alignment = { horizontal: 'center' };
      r.getCell('last_visit_date').alignment = { horizontal: 'center' };
      r.getCell('total_fuel_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_platform_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_other_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_invested_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_invested_gs').font = { bold: true };
      rowIdx++;
    }

    // Fila Totalizadora
    if (companiesResult.rows.length > 0) {
      const totalRow = sheet1.addRow({
        company_name: 'TOTAL GENERAL',
        total_visits: { formula: `SUM(E2:E${rowIdx - 1})` },
        total_fuel_gs: { formula: `SUM(F2:F${rowIdx - 1})` },
        total_platform_gs: { formula: `SUM(G2:G${rowIdx - 1})` },
        total_other_gs: { formula: `SUM(H2:H${rowIdx - 1})` },
        total_invested_gs: { formula: `SUM(I2:I${rowIdx - 1})` },
      });
      totalRow.font = { bold: true };
      totalRow.getCell('total_fuel_gs').numFmt = '#,##0 "Gs."';
      totalRow.getCell('total_platform_gs').numFmt = '#,##0 "Gs."';
      totalRow.getCell('total_other_gs').numFmt = '#,##0 "Gs."';
      totalRow.getCell('total_invested_gs').numFmt = '#,##0 "Gs."';
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }

    // --- HOJA 2: DETALLE DE VISITAS ---
    const sheet2 = workbook.addWorksheet('Detalle de Gastos por Visita', {
      views: [{ showGridLines: true }]
    });

    sheet2.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Empresa / Institución', key: 'company_name', width: 32 },
      { header: 'Ejecutivo Comercial', key: 'executive_name', width: 24 },
      { header: 'Tipo Movilidad', key: 'mobility_type', width: 16 },
      { header: 'Plataforma', key: 'platform_used', width: 16 },
      { header: 'Gasto Traslado (Gs.)', key: 'transport_cost_gs', width: 20 },
      { header: 'Combustible Distribuido (Gs.)', key: 'fuel_allocated_gs', width: 22 },
      { header: 'Otros Gastos (Gs.)', key: 'other_expenses_gs', width: 18 },
      { header: 'Total Inversión Visita (Gs.)', key: 'total_cost_gs', width: 22 },
      { header: 'Motivo', key: 'reason', width: 20 },
      { header: 'Etapa Embudo', key: 'funnel_stage', width: 22 },
      { header: 'Resultado', key: 'result', width: 20 },
      { header: 'Notas / Observaciones', key: 'notes', width: 36 },
    ];

    const h2 = sheet2.getRow(1);
    h2.height = 30;
    h2.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    for (const v of visitsResult.rows) {
      const mobLabel = v.mobility_type === 'propia' ? 'Movilidad Propia' : 'Plataforma';
      const r = sheet2.addRow({
        date: v.date,
        company_name: v.company_name,
        executive_name: v.executive_name,
        mobility_type: mobLabel,
        platform_used: v.platform_used || '-',
        transport_cost_gs: Number(v.transport_cost_gs),
        fuel_allocated_gs: Number(v.fuel_allocated_gs),
        other_expenses_gs: Number(v.other_expenses_gs),
        total_cost_gs: Number(v.total_cost_gs),
        reason: v.reason,
        funnel_stage: v.funnel_stage,
        result: v.result,
        notes: v.notes || '',
      });

      r.getCell('date').alignment = { horizontal: 'center' };
      r.getCell('mobility_type').alignment = { horizontal: 'center' };
      r.getCell('platform_used').alignment = { horizontal: 'center' };
      r.getCell('transport_cost_gs').numFmt = '#,##0 "Gs."';
      r.getCell('fuel_allocated_gs').numFmt = '#,##0 "Gs."';
      r.getCell('other_expenses_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_cost_gs').numFmt = '#,##0 "Gs."';
      r.getCell('total_cost_gs').font = { bold: true };
    }

    const filename = `Inversion_BICSA_${year}_${String(month).padStart(2, '0')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error al exportar inversión a Excel:', err);
    res.status(500).json({ error: 'Error al exportar reporte de inversión a Excel' });
  }
});

export default router;
