import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /visitas — filtradas por rol
router.get('/', async (req: Request, res: Response) => {
  try {
    const isManager = ['admin', 'gerente'].includes(req.user!.role);
    const { page = '1', limit = '15', userId, companyId, dateFrom, dateTo, result, funnelStage, stage } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (!isManager) {
      conditions.push(`v.user_id = $${pIdx++}`);
      params.push(req.user!.userId);
    } else if (userId) {
      conditions.push(`v.user_id = $${pIdx++}`);
      params.push(userId);
    }

    if (companyId) { conditions.push(`v.company_id = $${pIdx++}`); params.push(companyId); }
    if (dateFrom) { conditions.push(`v.date >= $${pIdx++}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`v.date <= $${pIdx++}`); params.push(dateTo); }
    if (result) { conditions.push(`v.result = $${pIdx++}`); params.push(result); }
    const stageVal = funnelStage || stage;
    if (stageVal) { conditions.push(`v.funnel_stage = $${pIdx++}`); params.push(stageVal); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const data = await pool.query(`
      SELECT
        v.id, v.date, v.visit_type, v.zone, v.maps_url, v.reason,
        v.funnel_stage, v.result, v.uber_ref_gs, v.bolt_ref_gs, v.notes,
        v.created_at,
        u.id AS user_id, u.full_name AS user_name,
        c.id AS company_id, c.name AS company_name,
        wd.id AS work_day_id, wd.km_total
      FROM visits v
      JOIN users u ON u.id = v.user_id
      JOIN companies c ON c.id = v.company_id
      JOIN work_days wd ON wd.id = v.work_day_id
      ${where}
      ORDER BY v.date DESC, v.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `, [...params, parseInt(limit), offset]);

    const countResult = await pool.query(`SELECT COUNT(*) FROM visits v ${where}`, params);

    res.json({
      data: data.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
});

export default router;
