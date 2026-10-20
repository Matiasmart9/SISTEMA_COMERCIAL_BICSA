import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const STAGES = [
  'Prospección',
  'Contacto con decisor',
  'Negociación',
  'Contrato',
  'Venta ganada / Suscripción',
] as const;

// GET /dashboard/kpis?month=2026-10 or ?dateFrom=2026-10-01&dateTo=2026-10-31&userId=...
router.get('/kpis', async (req: Request, res: Response) => {
  try {
    const { month, dateFrom, dateTo, userId } = req.query as {
      month?: string;
      dateFrom?: string;
      dateTo?: string;
      userId?: string;
    };
    const isManager = ['admin', 'gerente'].includes(req.user!.role);

    let dateFilter = '';
    if (month) {
      dateFilter = `AND TO_CHAR(date, 'YYYY-MM') = '${month.replace(/'/g, '')}'`;
    } else {
      if (dateFrom) dateFilter += ` AND date >= '${dateFrom.replace(/'/g, '')}'`;
      if (dateTo) dateFilter += ` AND date <= '${dateTo.replace(/'/g, '')}'`;
    }

    const targetUser = isManager ? (userId || '') : req.user!.userId;
    const userFilter = targetUser ? `AND user_id = '${targetUser.replace(/'/g, '')}'` : '';

    const kpis = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM work_days WHERE TRUE ${userFilter} ${dateFilter}) AS total_jornadas,
        (SELECT COALESCE(SUM(km_total), 0) FROM work_days WHERE TRUE ${userFilter} ${dateFilter}) AS total_km,
        (SELECT COUNT(*) FROM visits WHERE TRUE ${userFilter} ${dateFilter}) AS total_visitas,
        (SELECT COUNT(DISTINCT company_id) FROM visits WHERE TRUE ${userFilter} ${dateFilter}) AS empresas_distintas,
        (SELECT COUNT(DISTINCT company_id) FROM visits WHERE funnel_stage IN ('Contrato', 'Venta ganada / Suscripción') ${userFilter} ${dateFilter}) AS contrataciones
    `);

    res.json(kpis.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
});

// GET /dashboard/monthly-counter?month=2026-10
router.get('/monthly-counter', async (req: Request, res: Response) => {
  try {
    const isManager = ['admin', 'gerente'].includes(req.user!.role);
    const { month } = req.query as { month?: string };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parámetro month requerido (YYYY-MM)' });
    }

    const userFilter = isManager ? '' : `AND v.user_id = '${req.user!.userId}'`;

    // Obtener todos los ejecutivos visibles
    const users = isManager
      ? await pool.query(`SELECT id, full_name FROM users WHERE role = 'ejecutivo' AND is_active = true ORDER BY full_name`)
      : await pool.query(`SELECT id, full_name FROM users WHERE id = $1`, [req.user!.userId]);

    // Contador por usuario y etapa
    const counts = await pool.query(`
      SELECT v.user_id, v.funnel_stage, COUNT(*) AS count
      FROM visits v
      WHERE TO_CHAR(v.date, 'YYYY-MM') = $1 ${userFilter}
      GROUP BY v.user_id, v.funnel_stage
    `, [month]);

    // Armar tabla pivot
    const rows = users.rows.map((u: { id: string; full_name: string }) => {
      const stageCounts: Record<string, number> = {};
      let total = 0;
      for (const stage of STAGES) {
        const found = counts.rows.find((c: { user_id: string; funnel_stage: string; count: string }) =>
          c.user_id === u.id && c.funnel_stage === stage
        );
        stageCounts[stage] = found ? parseInt(found.count) : 0;
        total += stageCounts[stage];
      }
      return { userId: u.id, userName: u.full_name, ...stageCounts, total };
    });

    // Totales de columna
    const totals: Record<string, number> = { total: 0 };
    for (const stage of STAGES) {
      totals[stage] = rows.reduce((acc: number, r: any) => acc + (Number(r[stage]) || 0), 0);
      totals['total'] += totals[stage];
    }

    res.json({ month, rows, totals, stages: STAGES });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener contador mensual' });
  }
});

// GET /dashboard/insights?month=2026-10 — indicadores para gerencia (solo admin/gerente)
router.get('/insights', async (req: Request, res: Response) => {
  try {
    if (!['admin', 'gerente'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Acceso restringido a gerencia' });
    }
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parámetro month requerido (YYYY-MM)' });
    }

    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const kpiSql = `
      SELECT
        (SELECT COUNT(*) FROM work_days WHERE TO_CHAR(date,'YYYY-MM') = $1) AS jornadas,
        (SELECT COALESCE(SUM(km_total),0) FROM work_days WHERE TO_CHAR(date,'YYYY-MM') = $1) AS km,
        (SELECT COUNT(*) FROM visits WHERE TO_CHAR(date,'YYYY-MM') = $1) AS visitas,
        (SELECT COUNT(DISTINCT company_id) FROM visits WHERE TO_CHAR(date,'YYYY-MM') = $1) AS empresas,
        (SELECT COUNT(DISTINCT company_id) FROM visits WHERE TO_CHAR(date,'YYYY-MM') = $1
           AND funnel_stage IN ('Contrato','Venta ganada / Suscripción')) AS contrataciones
    `;

    const [cur, prev, funnel, ranking, daily, reasons, zones, pending] = await Promise.all([
      pool.query(kpiSql, [month]),
      pool.query(kpiSql, [prevMonth]),
      pool.query(
        `SELECT funnel_stage::text AS stage, COUNT(*) AS count FROM visits
         WHERE TO_CHAR(date,'YYYY-MM') = $1 GROUP BY funnel_stage`, [month]),
      pool.query(
        `SELECT u.id, u.full_name,
           COALESCE(v.visitas,0) AS visitas,
           COALESCE(v.empresas,0) AS empresas,
           COALESCE(v.cierres,0) AS cierres,
           COALESCE(w.km,0) AS km,
           COALESCE(w.jornadas,0) AS jornadas
         FROM users u
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS visitas, COUNT(DISTINCT company_id) AS empresas,
                  COUNT(DISTINCT company_id) FILTER (WHERE funnel_stage IN ('Contrato','Venta ganada / Suscripción')) AS cierres
           FROM visits WHERE TO_CHAR(date,'YYYY-MM') = $1 GROUP BY user_id
         ) v ON v.user_id = u.id
         LEFT JOIN (
           SELECT user_id, SUM(km_total) AS km, COUNT(*) AS jornadas
           FROM work_days WHERE TO_CHAR(date,'YYYY-MM') = $1 GROUP BY user_id
         ) w ON w.user_id = u.id
         WHERE u.role = 'ejecutivo' AND u.is_active = true
         ORDER BY COALESCE(v.visitas,0) DESC, u.full_name`, [month]),
      pool.query(
        `SELECT EXTRACT(DAY FROM date)::int AS day, COUNT(*) AS count FROM visits
         WHERE TO_CHAR(date,'YYYY-MM') = $1 GROUP BY 1 ORDER BY 1`, [month]),
      pool.query(
        `SELECT reason::text AS label, COUNT(*) AS count FROM visits
         WHERE TO_CHAR(date,'YYYY-MM') = $1 AND reason IS NOT NULL
         GROUP BY reason ORDER BY count DESC`, [month]),
      pool.query(
        `SELECT INITCAP(LOWER(TRIM(zone))) AS label, COUNT(*) AS count FROM visits
         WHERE TO_CHAR(date,'YYYY-MM') = $1 AND zone IS NOT NULL AND TRIM(zone) <> ''
         GROUP BY 1 ORDER BY count DESC LIMIT 5`, [month]),
      pool.query(
        `SELECT c.id, c.name, c.commercial_status::text AS status,
                lv.last_visit, (CURRENT_DATE - lv.last_visit)::int AS days_since,
                lv.executive
         FROM companies c
         JOIN LATERAL (
           SELECT v.date AS last_visit, u.full_name AS executive
           FROM visits v JOIN users u ON u.id = v.user_id
           WHERE v.company_id = c.id ORDER BY v.date DESC LIMIT 1
         ) lv ON TRUE
         WHERE c.commercial_status IN ('Prospecto','En negociación')
           AND lv.last_visit < CURRENT_DATE - INTERVAL '14 days'
         ORDER BY lv.last_visit ASC LIMIT 8`),
    ]);

    res.json({
      month,
      prevMonth,
      current: cur.rows[0],
      previous: prev.rows[0],
      funnel: STAGES.map((s) => ({
        stage: s,
        count: parseInt(funnel.rows.find((r: any) => r.stage === s)?.count || '0'),
      })),
      ranking: ranking.rows,
      daily: daily.rows,
      reasons: reasons.rows,
      zones: zones.rows,
      pendingFollowUps: pending.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener indicadores de gerencia' });
  }
});

// GET /dashboard/available-months — meses disponibles para el selector
router.get('/available-months', async (req: Request, res: Response) => {
  try {
    const isManager = ['admin', 'gerente'].includes(req.user!.role);
    const userFilter = isManager ? '' : `WHERE user_id = '${req.user!.userId}'`;

    const result = await pool.query(`
      SELECT DISTINCT month_key FROM (
        SELECT TO_CHAR(date, 'YYYY-MM') AS month_key FROM visits ${userFilter}
        UNION
        SELECT TO_CHAR(date, 'YYYY-MM') AS month_key FROM work_days ${userFilter}
        UNION
        SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM') AS month_key
      ) combined
      WHERE month_key IS NOT NULL
      ORDER BY month_key DESC
    `);

    res.json(result.rows.map((r: { month_key: string }) => r.month_key));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener meses' });
  }
});

export default router;
