import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /empresas — buscar con autocompletado y catálogo global
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q = '', page = '1', limit = '50', filter = 'all' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isManager = ['admin', 'gerente'].includes(req.user!.role);

    let whereClause = 'WHERE cs.company_name ILIKE $1';
    const params: unknown[] = [`%${q}%`];

    // Si un ejecutivo filtra explícitamente "Mis empresas", solo mostramos las que él visitó
    if (!isManager && filter === 'my') {
      whereClause += ` AND cs.company_id IN (SELECT company_id FROM visits WHERE user_id = $2)`;
      params.push(req.user!.userId);
    }

    const data = await pool.query(`
      SELECT cs.company_id AS id, cs.company_name AS name, cs.commercial_status,
             cs.zone, cs.maps_url, cs.notes,
             cs.total_visits, cs.first_visit, cs.last_visit, cs.executors_names
      FROM company_summary cs
      ${whereClause}
      ORDER BY cs.company_name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM company_summary cs ${whereClause}
    `, params);

    res.json({
      data: data.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('Error al obtener empresas:', err);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// GET /empresas/:id — historial completo de una empresa (expediente de cuenta)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const company = await pool.query(
      'SELECT * FROM companies WHERE id = $1',
      [req.params.id]
    );
    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    // Todos los miembros autorizados pueden ver el historial del cliente para dar seguimiento coherente
    const visitsQuery = await pool.query(`
      SELECT v.*, u.full_name AS user_name, wd.km_total
      FROM visits v
      JOIN users u ON u.id = v.user_id
      JOIN work_days wd ON wd.id = v.work_day_id
      WHERE v.company_id = $1
      ORDER BY v.date DESC, v.created_at DESC
    `, [req.params.id]);

    res.json({ company: company.rows[0], visits: visitsQuery.rows });
  } catch (err) {
    console.error('Error al obtener expediente de empresa:', err);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

// POST /empresas/:id/visitas — registrar seguimiento o visita directa a empresa existente
router.post('/:id/visitas', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    date = new Date().toISOString().slice(0, 10),
    visitType = 'Prospecto en seguimiento',
    zone,
    mapsUrl,
    reason = 'Seguimiento comercial',
    funnelStage = 'Negociación',
    result = 'En negociación',
    uberRefGs,
    boltRefGs,
    notes,
    kmStart,
    kmEnd,
    workDayId,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar que la empresa exista
    const companyCheck = await client.query('SELECT id, name FROM companies WHERE id = $1', [id]);
    if (companyCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    // 2. Resolver o asociar jornada de trabajo (work_day_id)
    let targetWorkDayId = workDayId;
    if (!targetWorkDayId) {
      // Buscar si el usuario ya tiene una jornada para esa fecha
      const existingDay = await client.query(
        'SELECT id FROM work_days WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC LIMIT 1',
        [req.user!.userId, date]
      );

      if (existingDay.rows.length > 0) {
        targetWorkDayId = existingDay.rows[0].id;
      } else {
        // Si no existe, crear jornada automática
        const start = parseInt(kmStart || '0', 10);
        const end = parseInt(kmEnd || '0', 10);
        const newDay = await client.query(`
          INSERT INTO work_days (user_id, date, km_start, km_end, notes)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          req.user!.userId,
          date,
          start,
          Math.max(start, end),
          kmStart ? 'Jornada comercial con vehículo' : 'Seguimiento comercial / Transporte Uber-Bolt',
        ]);
        targetWorkDayId = newDay.rows[0].id;
      }
    }

    // 3. Crear registro de visita enlazado a la empresa existente
    const visitResult = await client.query(`
      INSERT INTO visits (
        work_day_id, user_id, company_id, date,
        visit_type, zone, maps_url, reason, funnel_stage, result,
        uber_ref_gs, bolt_ref_gs, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      targetWorkDayId,
      req.user!.userId,
      id,
      date,
      visitType,
      zone || null,
      mapsUrl || null,
      reason,
      funnelStage,
      result,
      uberRefGs ? parseInt(uberRefGs, 10) : null,
      boltRefGs ? parseInt(boltRefGs, 10) : null,
      notes || null,
    ]);

    // 4. Actualizar estado comercial y datos principales de la empresa
    if (zone || mapsUrl) {
      await client.query(`
        UPDATE companies
        SET zone = COALESCE(NULLIF($1, ''), zone),
            maps_url = COALESCE(NULLIF($2, ''), maps_url),
            updated_at = NOW()
        WHERE id = $3
      `, [zone ? zone.trim() : null, mapsUrl ? mapsUrl.trim() : null, id]);
    }

    if (result === 'Contratado' || funnelStage === 'Contrato' || funnelStage === 'Venta ganada / Suscripción') {
      await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [id]);
    } else if (result === 'En negociación' || funnelStage === 'Negociación') {
      await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [id]);
    } else if (result === 'Sin interés') {
      await client.query("UPDATE companies SET commercial_status = 'Sin interés', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [id]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Seguimiento registrado exitosamente',
      visit: visitResult.rows[0],
      companyName: companyCheck.rows[0].name,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al registrar seguimiento en empresa:', err);
    res.status(500).json({ error: 'Error al registrar seguimiento' });
  } finally {
    client.release();
  }
});

// PUT /empresas/:id — actualizar datos generales de la empresa (nombre, zona, maps_url, notas, estado)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, zone, mapsUrl, notes, commercialStatus } = req.body;

    const existing = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const updates: string[] = [];
    const params: unknown[] = [id];
    let pIdx = 2;

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const normalized = trimmedName.toLowerCase().replace(/\s+/g, ' ');
      updates.push(`name = $${pIdx++}`, `normalized_name = $${pIdx++}`);
      params.push(trimmedName, normalized);
    }

    if (zone !== undefined) {
      updates.push(`zone = $${pIdx++}`);
      params.push(zone && zone.trim() ? zone.trim() : null);
    }

    if (mapsUrl !== undefined) {
      updates.push(`maps_url = $${pIdx++}`);
      params.push(mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${pIdx++}`);
      params.push(notes && notes.trim() ? notes.trim() : null);
    }

    if (commercialStatus) {
      const validStatuses = ['Prospecto', 'En negociación', 'Contratado', 'Sin interés', 'Inactivo'];
      if (validStatuses.includes(commercialStatus)) {
        updates.push(`commercial_status = $${pIdx++}`);
        params.push(commercialStatus);
      }
    }

    if (updates.length === 0) {
      return res.json({ message: 'Sin cambios requeridos', company: existing.rows[0] });
    }

    updates.push(`updated_at = NOW()`);

    const result = await pool.query(`
      UPDATE companies
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    res.json({
      message: 'Datos de la empresa actualizados exitosamente',
      company: result.rows[0],
    });
  } catch (err: any) {
    console.error('Error al actualizar datos de empresa:', err);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

// PATCH /empresas/:id/status — actualizar estado comercial (admin/gerente)
router.patch('/:id/status', async (req: Request, res: Response) => {
  if (!['admin', 'gerente'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }
  const { commercialStatus } = req.body;
  const validStatuses = ['Prospecto', 'En negociación', 'Contratado', 'Sin interés', 'Inactivo'];
  if (!validStatuses.includes(commercialStatus)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    await pool.query(
      'UPDATE companies SET commercial_status = $1, updated_at = NOW() WHERE id = $2',
      [commercialStatus, req.params.id]
    );
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

export default router;
