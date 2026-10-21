import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authMiddleware, isAnyRole, isAdmin } from '../middleware/auth';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// GET /jornadas/activa — consultar si el usuario tiene una jornada abierta
router.get('/activa', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT wd.*, u.full_name AS user_name
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      WHERE wd.user_id = $1 AND wd.status = 'abierta'
      ORDER BY wd.created_at DESC
      LIMIT 1
    `, [req.user!.userId]);

    if (result.rows.length === 0) {
      return res.json({ activa: null });
    }

    const jornada = result.rows[0];
    const visits = await pool.query(`
      SELECT v.*, c.name AS company_name
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      WHERE v.work_day_id = $1
      ORDER BY v.created_at ASC
    `, [jornada.id]);

    res.json({ activa: { ...jornada, visits: visits.rows } });
  } catch (err) {
    console.error('Error al obtener jornada activa:', err);
    res.status(500).json({ error: 'Error al obtener jornada activa' });
  }
});

// GET /jornadas/en-curso — listar todas las jornadas en curso para monitoreo en tiempo real (admin y gerente)
router.get('/en-curso', async (req: Request, res: Response) => {
  try {
    const isManager = ['admin', 'gerente'].includes(req.user!.role) || req.user!.email === 'matiasmart7@gmail.com';
    if (!isManager) {
      return res.status(403).json({ error: 'Acceso restringido a administradores y gerencia comercial' });
    }

    const result = await pool.query(`
      SELECT 
        wd.*, 
        u.full_name AS user_name, 
        u.email AS user_email, 
        u.role AS user_role,
        (SELECT COUNT(*) FROM visits v WHERE v.work_day_id = wd.id)::int AS visits_count
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      WHERE wd.status = 'abierta'
      ORDER BY wd.created_at DESC
    `);

    // Obtener las visitas de cada jornada abierta
    const jornadasWithVisits = await Promise.all(
      result.rows.map(async (jornada: any) => {
        const visits = await pool.query(`
          SELECT 
            v.*, 
            c.name AS company_name, 
            c.department AS company_department, 
            c.city AS company_city
          FROM visits v
          JOIN companies c ON c.id = v.company_id
          WHERE v.work_day_id = $1
          ORDER BY v.created_at ASC
        `, [jornada.id]);

        return {
          ...jornada,
          visits: visits.rows,
        };
      })
    );

    res.json({
      timestamp: new Date().toISOString(),
      count: jornadasWithVisits.length,
      jornadas: jornadasWithVisits,
    });
  } catch (err) {
    console.error('Error al obtener jornadas en curso:', err);
    res.status(500).json({ error: 'Error al obtener jornadas en curso' });
  }
});

// GET /jornadas — listar (propio para ejecutivo, todo para admin/gerente)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', dateFrom, dateTo, userId, status } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isManager = ['admin', 'gerente'].includes(req.user!.role);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    // Ejecutivos solo ven sus propias jornadas
    if (!isManager) {
      conditions.push(`wd.user_id = $${pIdx++}`);
      params.push(req.user!.userId);
    } else if (userId) {
      conditions.push(`wd.user_id = $${pIdx++}`);
      params.push(userId);
    }

    if (status) {
      conditions.push(`wd.status = $${pIdx++}`);
      params.push(status);
    }

    if (dateFrom) { conditions.push(`wd.date >= $${pIdx++}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`wd.date <= $${pIdx++}`); params.push(dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        wd.id, wd.date, wd.km_start, wd.km_end, wd.km_total,
        wd.km_start_photo, wd.km_end_photo, wd.notes,
        wd.status, wd.mobility_type, wd.platform_trips, wd.transport_total_gs, wd.closed_at,
        wd.fuel_amount_gs, wd.extra_expenses,
        wd.created_at, wd.updated_at,
        u.id AS user_id, u.full_name AS user_name,
        COUNT(v.id) AS visit_count,
        (SELECT COUNT(*) FROM audit_log al WHERE al.entity_id = wd.id)::int AS audit_count
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      LEFT JOIN visits v ON v.work_day_id = wd.id
      ${where}
      GROUP BY wd.id, u.id
      ORDER BY wd.date DESC, wd.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `, [...params, parseInt(limit), offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM work_days wd ${where}
    `, params);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener jornadas' });
  }
});

// POST /jornadas/iniciar — iniciar el día de trabajo (Jornada abierta)
router.post('/iniciar', async (req: Request, res: Response) => {
  const {
    date,
    mobilityType = 'propia',
    kmStart,
    kmStartPhoto,
    fuelAmountGs,
    fuelPendingAtStart,
    platformTrips,
    notes,
  } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Indique la fecha de la jornada' });
  }

  // Verificar si ya tiene una jornada abierta
  const existingActive = await pool.query(
    "SELECT id FROM work_days WHERE user_id = $1 AND status = 'abierta'",
    [req.user!.userId]
  );
  if (existingActive.rows.length > 0) {
    return res.status(400).json({
      error: 'Ya tiene una jornada en curso abierta. Debe cerrarla antes de iniciar una nueva.',
      jornadaId: existingActive.rows[0].id
    });
  }

  let kmStartVal: number | null = null;
  let fuelVal = 0;
  if (mobilityType === 'propia') {
    if (kmStart === undefined || kmStart === null || kmStart === '') {
      return res.status(400).json({ error: 'Debe ingresar el kilometraje inicial' });
    }
    kmStartVal = parseInt(String(kmStart).replace(/\D/g, ''), 10);
    if (isNaN(kmStartVal) || kmStartVal < 0) {
      return res.status(400).json({ error: 'Kilometraje inicial no válido' });
    }
    if (!fuelPendingAtStart && fuelAmountGs) {
      fuelVal = parseInt(String(fuelAmountGs).replace(/\D/g, ''), 10) || 0;
    }
  }

  const trips = Array.isArray(platformTrips) ? platformTrips : [];
  const transportTotal = mobilityType === 'propia'
    ? fuelVal
    : trips.reduce((acc: number, t: any) => acc + (parseInt(String(t.amount || 0).replace(/\D/g, ''), 10) || 0), 0);

  const client = await pool.connect();
  try {
    const insertResult = await client.query(`
      INSERT INTO work_days (
        user_id, date, km_start, km_start_photo, status, mobility_type, platform_trips, transport_total_gs,
        fuel_amount_gs, fuel_pending_at_start, notes
      ) VALUES ($1, $2, $3, $4, 'abierta', $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.user!.userId,
      date,
      kmStartVal,
      kmStartPhoto || null,
      mobilityType,
      JSON.stringify(trips),
      transportTotal,
      fuelVal,
      Boolean(fuelPendingAtStart),
      notes ? notes.trim() : null
    ]);

    res.status(201).json({
      message: 'Jornada iniciada con éxito',
      jornada: { ...insertResult.rows[0], visits: [] }
    });
  } catch (err) {
    console.error('Error al iniciar jornada:', err);
    res.status(500).json({ error: 'Error al iniciar jornada comercial' });
  } finally {
    client.release();
  }
});

// Helper para distribuir combustible y sincronizar costos de la jornada
async function syncWorkdayCosts(client: any, workDayId: string) {
  const jdRes = await client.query('SELECT mobility_type, fuel_amount_gs FROM work_days WHERE id = $1', [workDayId]);
  if (jdRes.rows.length === 0) return;
  const jd = jdRes.rows[0];

  const vRes = await client.query('SELECT id, transport_cost_gs, other_expenses_gs FROM visits WHERE work_day_id = $1 ORDER BY created_at ASC', [workDayId]);
  const visits = vRes.rows;

  if (jd.mobility_type === 'propia') {
    const fuelTotal = jd.fuel_amount_gs || 0;
    const count = visits.length;
    if (count > 0) {
      const baseShare = Math.floor(fuelTotal / count);
      const remainder = fuelTotal - (baseShare * count);
      for (let i = 0; i < count; i++) {
        const fuelAlloc = baseShare + (i < remainder ? 1 : 0);
        const transportCost = visits[i].transport_cost_gs || 0;
        const otherCost = visits[i].other_expenses_gs || 0;
        const totalCost = transportCost + fuelAlloc + otherCost;
        await client.query(`
          UPDATE visits
          SET fuel_allocated_gs = $1, total_cost_gs = $2
          WHERE id = $3
        `, [fuelAlloc, totalCost, visits[i].id]);
      }
    }
    const otherTotal = visits.reduce((acc: number, v: any) => acc + (v.other_expenses_gs || 0), 0);
    await client.query('UPDATE work_days SET transport_total_gs = $1 WHERE id = $2', [fuelTotal + otherTotal, workDayId]);
  } else {
    for (const v of visits) {
      const transportCost = v.transport_cost_gs || 0;
      const otherCost = v.other_expenses_gs || 0;
      await client.query(`
        UPDATE visits
        SET fuel_allocated_gs = 0, total_cost_gs = $1
        WHERE id = $2
      `, [transportCost + otherCost, v.id]);
    }
    const transTotal = visits.reduce((acc: number, v: any) => acc + (v.transport_cost_gs || 0) + (v.other_expenses_gs || 0), 0);
    await client.query('UPDATE work_days SET transport_total_gs = $1 WHERE id = $2', [transTotal, workDayId]);
  }
}

// POST /jornadas/:id/visitas — registrar una visita en una jornada abierta
router.post('/:id/visitas', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    companyName,
    companyId: incomingCompanyId,
    department,
    city,
    zone,
    mapsUrl,
    visitType = 'Nueva visita',
    reason,
    funnelStage,
    result,
    notes,
    transportCostGs,
    platformUsed,
    otherExpensesGs,
  } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
  }
  if (!department || !department.trim()) {
    return res.status(400).json({ error: 'El departamento es obligatorio' });
  }
  if (!city || !city.trim()) {
    return res.status(400).json({ error: 'La ciudad es obligatoria' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'El motivo de la visita es obligatorio' });
  }
  if (!funnelStage || !funnelStage.trim()) {
    return res.status(400).json({ error: 'La etapa del embudo comercial es obligatoria' });
  }
  if (!result || !result.trim()) {
    return res.status(400).json({ error: 'El resultado comercial es obligatorio' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validar jornada
    const jdResult = await client.query(`
      SELECT * FROM work_days WHERE id = $1
    `, [id]);
    if (jdResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }
    const jornada = jdResult.rows[0];

    // Buscar o crear empresa
    let companyId = incomingCompanyId;
    const normalized = companyName.toLowerCase().trim().replace(/\s+/g, ' ');

    if (!companyId) {
      const compCheck = await client.query('SELECT id FROM companies WHERE normalized_name = $1', [normalized]);
      if (compCheck.rows.length === 0) {
        const newComp = await client.query(`
          INSERT INTO companies (name, normalized_name, department, city, zone, maps_url, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          companyName.trim(),
          normalized,
          department.trim(),
          city.trim(),
          zone ? zone.trim() : `${city.trim()}, ${department.trim()}`,
          mapsUrl ? mapsUrl.trim() : null,
          req.user!.userId
        ]);
        companyId = newComp.rows[0].id;
      } else {
        companyId = compCheck.rows[0].id;
        await client.query(`
          UPDATE companies
          SET department = COALESCE(NULLIF($1, ''), department),
              city = COALESCE(NULLIF($2, ''), city),
              zone = COALESCE(NULLIF($3, ''), zone),
              maps_url = COALESCE(NULLIF($4, ''), maps_url),
              updated_at = NOW()
          WHERE id = $5
        `, [
          department.trim(),
          city.trim(),
          zone ? zone.trim() : null,
          mapsUrl ? mapsUrl.trim() : null,
          companyId
        ]);
      }
    }

    const transportCost = parseInt(String(transportCostGs || 0).replace(/\D/g, ''), 10) || 0;
    const otherCost = parseInt(String(otherExpensesGs || 0).replace(/\D/g, ''), 10) || 0;
    const platform = platformUsed ? String(platformUsed).trim() : (jornada.mobility_type === 'plataforma' ? 'Bolt' : null);

    const visitResult = await client.query(`
      INSERT INTO visits (
        work_day_id, user_id, company_id, date,
        visit_type, department, city, zone, maps_url,
        reason, funnel_stage, result, notes,
        transport_cost_gs, platform_used, other_expenses_gs, total_cost_gs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      id,
      jornada.user_id,
      companyId,
      jornada.date,
      visitType || 'Nueva visita',
      department.trim(),
      city.trim(),
      zone ? zone.trim() : `${city.trim()}, ${department.trim()}`,
      mapsUrl ? mapsUrl.trim() : null,
      reason.trim(),
      funnelStage.trim(),
      result.trim(),
      notes ? notes.trim() : null,
      transportCost,
      platform,
      otherCost,
      transportCost + otherCost
    ]);

    // Actualizar estado comercial de la empresa según el resultado
    if (result === 'Contratado' || funnelStage === 'Contrato' || funnelStage === 'Venta ganada / Suscripción') {
      await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [companyId]);
    } else if (result === 'En negociación' || funnelStage === 'Negociación') {
      await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
    } else if (result === 'Venta perdida' || result === 'Sin interés') {
      await client.query("UPDATE companies SET commercial_status = 'Venta perdida', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
    }

    // Sincronizar distribución de combustible o traslados
    await syncWorkdayCosts(client, id);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Visita registrada con éxito',
      visit: { ...visitResult.rows[0], company_name: companyName.trim() }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al agregar visita:', err);
    res.status(500).json({ error: 'Error al registrar visita' });
  } finally {
    client.release();
  }
});

// PUT /jornadas/:id/visitas/:visitId — actualizar una visita de una jornada
router.put('/:id/visitas/:visitId', async (req: Request, res: Response) => {
  const { id, visitId } = req.params;
  const {
    companyName,
    companyId: incomingCompanyId,
    department,
    city,
    zone,
    mapsUrl,
    visitType = 'Nueva visita',
    reason,
    funnelStage,
    result,
    notes,
    transportCostGs,
    platformUsed,
  } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
  }
  if (!department || !department.trim()) {
    return res.status(400).json({ error: 'El departamento es obligatorio' });
  }
  if (!city || !city.trim()) {
    return res.status(400).json({ error: 'La ciudad es obligatoria' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'El motivo de la visita es obligatorio' });
  }
  if (!funnelStage || !funnelStage.trim()) {
    return res.status(400).json({ error: 'La etapa del embudo comercial es obligatoria' });
  }
  if (!result || !result.trim()) {
    return res.status(400).json({ error: 'El resultado comercial es obligatorio' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jdResult = await client.query('SELECT * FROM work_days WHERE id = $1', [id]);
    if (jdResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }
    const jornada = jdResult.rows[0];

    const vCheck = await client.query('SELECT * FROM visits WHERE id = $1 AND work_day_id = $2', [visitId, id]);
    if (vCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visita no encontrada en esta jornada' });
    }

    // Buscar o crear empresa
    let companyId = incomingCompanyId;
    const normalized = companyName.toLowerCase().trim().replace(/\s+/g, ' ');

    if (!companyId) {
      const compCheck = await client.query('SELECT id FROM companies WHERE normalized_name = $1', [normalized]);
      if (compCheck.rows.length === 0) {
        const newComp = await client.query(`
          INSERT INTO companies (name, normalized_name, department, city, zone, maps_url, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          companyName.trim(),
          normalized,
          department.trim(),
          city.trim(),
          zone ? zone.trim() : `${city.trim()}, ${department.trim()}`,
          mapsUrl ? mapsUrl.trim() : null,
          req.user!.userId
        ]);
        companyId = newComp.rows[0].id;
      } else {
        companyId = compCheck.rows[0].id;
        await client.query(`
          UPDATE companies
          SET department = COALESCE(NULLIF($1, ''), department),
              city = COALESCE(NULLIF($2, ''), city),
              zone = COALESCE(NULLIF($3, ''), zone),
              maps_url = COALESCE(NULLIF($4, ''), maps_url),
              updated_at = NOW()
          WHERE id = $5
        `, [
          department.trim(),
          city.trim(),
          zone ? zone.trim() : null,
          mapsUrl ? mapsUrl.trim() : null,
          companyId
        ]);
      }
    }

    const transportCost = parseInt(String(transportCostGs || 0).replace(/\D/g, ''), 10) || 0;
    const platform = platformUsed ? String(platformUsed).trim() : (jornada.mobility_type === 'plataforma' ? 'Bolt' : null);

    const updateResult = await client.query(`
      UPDATE visits
      SET company_id = $1,
          visit_type = $2,
          department = $3,
          city = $4,
          zone = $5,
          maps_url = $6,
          reason = $7,
          funnel_stage = $8,
          result = $9,
          notes = $10,
          transport_cost_gs = $11,
          platform_used = $12,
          updated_at = NOW()
      WHERE id = $13 AND work_day_id = $14
      RETURNING *
    `, [
      companyId,
      visitType || 'Nueva visita',
      department.trim(),
      city.trim(),
      zone ? zone.trim() : `${city.trim()}, ${department.trim()}`,
      mapsUrl ? mapsUrl.trim() : null,
      reason.trim(),
      funnelStage.trim(),
      result.trim(),
      notes ? notes.trim() : null,
      transportCost,
      platform,
      visitId,
      id
    ]);

    // Actualizar estado comercial de la empresa según el resultado
    if (result === 'Contratado' || funnelStage === 'Contrato' || funnelStage === 'Venta ganada / Suscripción') {
      await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [companyId]);
    } else if (result === 'En negociación' || funnelStage === 'Negociación') {
      await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
    } else if (result === 'Venta perdida' || result === 'Sin interés') {
      await client.query("UPDATE companies SET commercial_status = 'Venta perdida', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
    }

    // Sincronizar costos
    await syncWorkdayCosts(client, id);

    await client.query('COMMIT');

    res.json({
      message: 'Visita actualizada con éxito',
      visit: { ...updateResult.rows[0], company_name: companyName.trim() }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar visita:', err);
    res.status(500).json({ error: 'Error al actualizar visita' });
  } finally {
    client.release();
  }
});

// DELETE /jornadas/:id/visitas/:visitId — eliminar visita de una jornada
router.delete('/:id/visitas/:visitId', async (req: Request, res: Response) => {
  const { id, visitId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM visits WHERE id = $1 AND work_day_id = $2', [visitId, id]);
    await syncWorkdayCosts(client, id);
    await client.query('COMMIT');
    res.json({ message: 'Visita eliminada' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar visita:', err);
    res.status(500).json({ error: 'Error al eliminar visita' });
  } finally {
    client.release();
  }
});

// PUT /jornadas/:id/traslados — actualizar lista de traslados de plataforma
router.put('/:id/traslados', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { platformTrips } = req.body;
  try {
    const trips = Array.isArray(platformTrips) ? platformTrips : [];
    const total = trips.reduce((acc: number, t: any) => acc + (parseInt(String(t.amount || 0).replace(/\D/g, ''), 10) || 0), 0);
    const result = await pool.query(`
      UPDATE work_days
      SET platform_trips = $1, transport_total_gs = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [JSON.stringify(trips), total, id]);

    res.json({ message: 'Traslados actualizados', jornada: result.rows[0] });
  } catch (err) {
    console.error('Error al actualizar traslados:', err);
    res.status(500).json({ error: 'Error al actualizar traslados' });
  }
});

// POST /jornadas/:id/cerrar — finalizar la jornada comercial
router.post('/:id/cerrar', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { kmEnd, kmEndPhoto, notes, platformTrips, fuelAmountGs, extraExpenses } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT * FROM work_days WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }
    const current = check.rows[0];

    let targetKmEnd: number | null = current.km_end;
    let targetKmEndPhoto = kmEndPhoto !== undefined ? (kmEndPhoto || null) : current.km_end_photo;
    let trips = current.platform_trips || [];
    let finalFuelAmount = current.fuel_amount_gs || 0;

    if (current.mobility_type === 'propia') {
      if (kmEnd === undefined || kmEnd === null || kmEnd === '') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debe ingresar el kilometraje final para cerrar la jornada' });
      }
      targetKmEnd = parseInt(String(kmEnd).replace(/\D/g, ''), 10);
      if (isNaN(targetKmEnd) || targetKmEnd < (current.km_start || 0)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El kilometraje final debe ser mayor o igual al inicial' });
      }

      if (fuelAmountGs !== undefined && fuelAmountGs !== null && String(fuelAmountGs).trim() !== '') {
        finalFuelAmount = parseInt(String(fuelAmountGs).replace(/\D/g, ''), 10) || 0;
      }
      if (finalFuelAmount <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debe ingresar el monto de combustible cargado para poder cerrar la jornada' });
      }
    } else {
      if (Array.isArray(platformTrips)) {
        trips = platformTrips;
      }
    }

    // Normalizar y limpiar gastos extras
    const rawExpenses = Array.isArray(extraExpenses) ? extraExpenses : [];
    const cleanExpenses = rawExpenses
      .map((e: any) => ({
        id: e.id || String(Math.random()).substring(2, 9),
        concept: String(e.concept || '').trim() || 'Gasto extra',
        amount: parseInt(String(e.amount || 0).replace(/\D/g, ''), 10) || 0,
        companyId: e.companyId ? String(e.companyId).trim() : null,
      }))
      .filter((e: any) => e.amount > 0);

    const updatedResult = await client.query(`
      UPDATE work_days
      SET status = 'cerrada',
          closed_at = NOW(),
          km_end = $1,
          km_end_photo = $2,
          platform_trips = $3,
          fuel_amount_gs = $4,
          fuel_pending_at_start = false,
          extra_expenses = $5,
          notes = COALESCE(NULLIF($6, ''), notes),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      targetKmEnd,
      targetKmEndPhoto,
      JSON.stringify(trips),
      finalFuelAmount,
      JSON.stringify(cleanExpenses),
      notes ? notes.trim() : null,
      id
    ]);

    // Distribuir los gastos extras a las visitas del día
    await client.query('UPDATE visits SET other_expenses_gs = 0 WHERE work_day_id = $1', [id]);

    const vRes = await client.query('SELECT id, company_id FROM visits WHERE work_day_id = $1 ORDER BY created_at ASC', [id]);
    const dayVisits = vRes.rows;

    if (dayVisits.length > 0 && cleanExpenses.length > 0) {
      const expensesByVisitId: { [visitId: string]: number } = {};
      for (const v of dayVisits) {
        expensesByVisitId[v.id] = 0;
      }

      for (const exp of cleanExpenses) {
        if (exp.companyId) {
          const matched = dayVisits.filter((v: any) => v.company_id === exp.companyId);
          if (matched.length > 0) {
            const share = Math.floor(exp.amount / matched.length);
            const rem = exp.amount - (share * matched.length);
            matched.forEach((v: any, idx: number) => {
              expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
            });
          } else {
            // Si la empresa vinculada no coincide en las visitas, se divide entre todas
            const share = Math.floor(exp.amount / dayVisits.length);
            const rem = exp.amount - (share * dayVisits.length);
            dayVisits.forEach((v: any, idx: number) => {
              expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
            });
          }
        } else {
          // Sin vinculación específica: se divide equitativamente entre todas las visitas del día
          const share = Math.floor(exp.amount / dayVisits.length);
          const rem = exp.amount - (share * dayVisits.length);
          dayVisits.forEach((v: any, idx: number) => {
            expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
          });
        }
      }

      for (const v of dayVisits) {
        await client.query('UPDATE visits SET other_expenses_gs = $1 WHERE id = $2', [expensesByVisitId[v.id] || 0, v.id]);
      }
    }

    // Recalcular y distribuir costos a las visitas
    await syncWorkdayCosts(client, id);

    await client.query('COMMIT');

    const visits = await pool.query(`
      SELECT v.*, c.name AS company_name
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      WHERE v.work_day_id = $1
      ORDER BY v.created_at ASC
    `, [id]);

    res.json({
      message: 'Jornada comercial cerrada exitosamente',
      jornada: { ...updatedResult.rows[0], visits: visits.rows }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al cerrar jornada:', err);
    res.status(500).json({ error: 'Error al cerrar jornada comercial' });
  } finally {
    client.release();
  }
});

// GET /jornadas/:id — detalle con visitas
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const isManager = ['admin', 'gerente'].includes(req.user!.role);
    const result = await pool.query(`
      SELECT wd.*, u.full_name AS user_name,
        (SELECT COUNT(*) FROM audit_log al WHERE al.entity_id = wd.id)::int AS audit_count
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      WHERE wd.id = $1 ${!isManager ? 'AND wd.user_id = $2' : ''}
    `, isManager ? [req.params.id] : [req.params.id, req.user!.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }

    const visits = await pool.query(`
      SELECT v.*, c.name AS company_name
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      WHERE v.work_day_id = $1
      ORDER BY v.created_at ASC
    `, [req.params.id]);

    res.json({ ...result.rows[0], visits: visits.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener jornada' });
  }
});

// POST /jornadas — crear jornada completa + visitas de una sola vez
router.post('/',
  [
    body('date').isDate(),
    body('visits').isArray({ min: 1 }),
    body('visits.*.companyName').trim().notEmpty(),
    body('visits.*.department').trim().notEmpty(),
    body('visits.*.city').trim().notEmpty(),
    body('visits.*.visitType').isIn(['Nueva visita', 'Prospecto en seguimiento', 'Cliente actual']),
    body('visits.*.reason').isIn(['Prospección', 'Presentación de servicios', 'Seguimiento comercial', 'Negociación', 'Fidelización', 'Otro']),
    body('visits.*.funnelStage').isIn(['Prospección', 'Contacto con decisor', 'Negociación', 'Contrato', 'Venta ganada / Suscripción']),
    body('visits.*.result').isIn(['Pendiente', 'Propuesta enviada', 'En negociación', 'Contratado', 'Venta perdida', 'Sin interés', 'Visita realizada']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      date,
      mobilityType = 'propia',
      kmStart,
      kmEnd,
      kmStartPhoto,
      kmEndPhoto,
      platformTrips,
      notes,
      visits
    } = req.body;

    let kmStartNum: number | null = null;
    let kmEndNum: number | null = null;

    if (mobilityType === 'propia') {
      kmStartNum = parseInt(String(kmStart).replace(/\D/g, ''), 10);
      kmEndNum = parseInt(String(kmEnd).replace(/\D/g, ''), 10);
      if (isNaN(kmStartNum) || isNaN(kmEndNum) || kmEndNum < kmStartNum) {
        return res.status(400).json({ error: 'El kilometraje final debe ser mayor o igual al inicial' });
      }
    }

    const trips = Array.isArray(platformTrips) ? platformTrips : [];
    const transportTotal = trips.reduce((acc: number, t: any) => acc + (parseInt(String(t.amount || 0).replace(/\D/g, ''), 10) || 0), 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Crear jornada
      const dayResult = await client.query(`
        INSERT INTO work_days (
          user_id, date, km_start, km_end, km_start_photo, km_end_photo,
          status, mobility_type, platform_trips, transport_total_gs, closed_at, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'cerrada', $7, $8, $9, NOW(), $10)
        RETURNING *
      `, [
        req.user!.userId,
        date,
        kmStartNum,
        kmEndNum,
        kmStartPhoto || null,
        kmEndPhoto || null,
        mobilityType,
        JSON.stringify(trips),
        transportTotal,
        notes || null
      ]);

      const workDay = dayResult.rows[0];

      // Procesar visitas
      const createdVisits = [];
      for (const v of visits) {
        let companyId: string = v.companyId;
        const normalized = (v.companyName as string).toLowerCase().trim().replace(/\s+/g, ' ');

        if (!companyId) {
          const companyResult = await client.query(
            'SELECT id FROM companies WHERE normalized_name = $1',
            [normalized]
          );

          if (companyResult.rows.length === 0) {
            const newCompany = await client.query(`
              INSERT INTO companies (name, normalized_name, department, city, zone, maps_url, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id
            `, [
              v.companyName.trim(),
              normalized,
              v.department ? v.department.trim() : null,
              v.city ? v.city.trim() : null,
              v.zone ? v.zone.trim() : (v.city && v.department ? `${v.city.trim()}, ${v.department.trim()}` : null),
              v.mapsUrl ? v.mapsUrl.trim() : null,
              req.user!.userId
            ]);
            companyId = newCompany.rows[0].id;
          } else {
            companyId = companyResult.rows[0].id;
            await client.query(`
              UPDATE companies
              SET department = COALESCE(NULLIF($1, ''), department),
                  city = COALESCE(NULLIF($2, ''), city),
                  zone = COALESCE(NULLIF($3, ''), zone),
                  maps_url = COALESCE(NULLIF($4, ''), maps_url),
                  updated_at = NOW()
              WHERE id = $5
            `, [
              v.department ? v.department.trim() : null,
              v.city ? v.city.trim() : null,
              v.zone ? v.zone.trim() : null,
              v.mapsUrl ? v.mapsUrl.trim() : null,
              companyId
            ]);
          }
        }

        const visitResult = await client.query(`
          INSERT INTO visits (
            work_day_id, user_id, company_id, date,
            visit_type, department, city, zone, maps_url,
            reason, funnel_stage, result, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          workDay.id,
          req.user!.userId,
          companyId,
          date,
          v.visitType,
          v.department ? v.department.trim() : null,
          v.city ? v.city.trim() : null,
          v.zone ? v.zone.trim() : (v.city && v.department ? `${v.city.trim()}, ${v.department.trim()}` : null),
          v.mapsUrl || null,
          v.reason,
          v.funnelStage,
          v.result || 'Pendiente',
          v.notes || null,
        ]);

        if (v.result === 'Contratado' || v.funnelStage === 'Contrato' || v.funnelStage === 'Venta ganada / Suscripción') {
          await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [companyId]);
        } else if (v.result === 'En negociación' || v.funnelStage === 'Negociación') {
          await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
        } else if (v.result === 'Venta perdida' || v.result === 'Sin interés') {
          await client.query("UPDATE companies SET commercial_status = 'Venta perdida', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
        }

        createdVisits.push({ ...visitResult.rows[0], companyName: v.companyName.trim() });
      }

      await client.query('COMMIT');

      res.status(201).json({
        ...workDay,
        visits: createdVisits,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al guardar jornada:', err);
      res.status(500).json({ error: 'Error al guardar jornada' });
    } finally {
      client.release();
    }
  }
);

// PUT /jornadas/:id — editar jornada existente, anexar visitas y registrar en auditoría
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const isManager = ['admin', 'gerente'].includes(req.user!.role);
  const {
    date,
    mobilityType,
    kmStart,
    kmEnd,
    kmStartPhoto,
    kmEndPhoto,
    platformTrips,
    status,
    notes,
    auditReason,
    newVisits,
    fuelAmountGs,
    extraExpenses,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkQuery = await client.query(`
      SELECT wd.*, u.full_name AS user_name, u.email AS user_email
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      WHERE wd.id = $1 ${!isManager ? 'AND wd.user_id = $2' : ''}
    `, isManager ? [id] : [id, req.user!.userId]);

    if (checkQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jornada no encontrada o sin permisos para editar' });
    }

    const current = checkQuery.rows[0];
    const targetMobility = mobilityType !== undefined ? mobilityType : (current.mobility_type || 'propia');
    const targetStatus = status !== undefined ? status : current.status;

    let targetKmStart = current.km_start;
    let targetKmEnd = current.km_end;

    if (targetMobility === 'propia') {
      if (kmStart !== undefined && kmStart !== '') {
        targetKmStart = parseInt(String(kmStart).replace(/\D/g, ''), 10);
      }
      if (kmEnd !== undefined && kmEnd !== '') {
        targetKmEnd = parseInt(String(kmEnd).replace(/\D/g, ''), 10);
      }
      if (targetKmEnd !== null && targetKmStart !== null && targetKmEnd < targetKmStart) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El kilometraje final debe ser mayor o igual al inicial' });
      }
    }

    let targetFuelAmount = current.fuel_amount_gs || 0;
    if (targetMobility === 'propia') {
      if (fuelAmountGs !== undefined && fuelAmountGs !== null) {
        targetFuelAmount = parseInt(String(fuelAmountGs).replace(/\D/g, ''), 10) || 0;
      }
    } else {
      targetFuelAmount = 0;
    }

    let cleanExpenses = current.extra_expenses || [];
    if (extraExpenses !== undefined) {
      const rawExpenses = Array.isArray(extraExpenses) ? extraExpenses : [];
      cleanExpenses = rawExpenses
        .map((e: any) => ({
          id: e.id || String(Math.random()).substring(2, 9),
          concept: String(e.concept || '').trim() || 'Gasto extra',
          amount: parseInt(String(e.amount || 0).replace(/\D/g, ''), 10) || 0,
          companyId: e.companyId ? String(e.companyId).trim() : null,
        }))
        .filter((e: any) => e.amount > 0);
    }

    const targetKmStartPhoto = kmStartPhoto !== undefined ? (kmStartPhoto || null) : current.km_start_photo;
    const targetKmEndPhoto = kmEndPhoto !== undefined ? (kmEndPhoto || null) : current.km_end_photo;
    const targetNotes = notes !== undefined ? notes : current.notes;
    let targetDateStr = current.date ? new Date(current.date).toISOString().slice(0, 10) : '';
    if (date) {
      targetDateStr = typeof date === 'string' && date.includes('T') ? date.split('T')[0] : date;
    }

    const trips = platformTrips !== undefined ? platformTrips : current.platform_trips;
    const tripsArr = Array.isArray(trips) ? trips : [];
    const transportTotal = tripsArr.reduce((acc: number, t: any) => acc + (parseInt(String(t.amount || 0).replace(/\D/g, ''), 10) || 0), 0);

    // Auditoría
    const changes: Record<string, { old: any; new: any; label: string }> = {};
    if (targetKmStart !== current.km_start) {
      changes['km_start'] = { old: current.km_start, new: targetKmStart, label: 'Km Inicial' };
    }
    if (targetKmEnd !== current.km_end) {
      changes['km_end'] = { old: current.km_end, new: targetKmEnd, label: 'Km Final' };
    }
    if (targetMobility !== current.mobility_type) {
      changes['mobility_type'] = { old: current.mobility_type, new: targetMobility, label: 'Medio de Movilidad' };
    }
    if (targetStatus !== current.status) {
      changes['status'] = { old: current.status, new: targetStatus, label: 'Estado de Jornada' };
    }
    if (targetFuelAmount !== (current.fuel_amount_gs || 0)) {
      changes['fuel_amount_gs'] = { old: current.fuel_amount_gs || 0, new: targetFuelAmount, label: 'Costo de Combustible' };
    }
    if (extraExpenses !== undefined && JSON.stringify(cleanExpenses) !== JSON.stringify(current.extra_expenses || [])) {
      changes['extra_expenses'] = { old: current.extra_expenses || [], new: cleanExpenses, label: 'Gastos Extras' };
    }

    await client.query(`
      UPDATE work_days
      SET km_start = $1,
          km_end = $2,
          km_start_photo = $3,
          km_end_photo = $4,
          date = $5,
          notes = $6,
          mobility_type = $7,
          status = $8,
          platform_trips = $9,
          transport_total_gs = $10,
          fuel_amount_gs = $11,
          extra_expenses = $12,
          updated_at = NOW()
      WHERE id = $13
    `, [
      targetKmStart,
      targetKmEnd,
      targetKmStartPhoto,
      targetKmEndPhoto,
      targetDateStr,
      targetNotes,
      targetMobility,
      targetStatus,
      JSON.stringify(tripsArr),
      transportTotal,
      targetFuelAmount,
      JSON.stringify(cleanExpenses),
      id
    ]);

    // Anexar nuevas visitas
    const addedVisitsSummary: any[] = [];
    if (Array.isArray(newVisits) && newVisits.length > 0) {
      for (const v of newVisits) {
        if (!v.companyName || !v.companyName.trim()) continue;
        const normalized = (v.companyName as string).toLowerCase().trim().replace(/\s+/g, ' ');
        let companyId = v.companyId;

        if (!companyId) {
          const compCheck = await client.query('SELECT id FROM companies WHERE normalized_name = $1', [normalized]);
          if (compCheck.rows.length === 0) {
            const newComp = await client.query(`
              INSERT INTO companies (name, normalized_name, department, city, zone, maps_url, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id
            `, [
              v.companyName.trim(),
              normalized,
              v.department ? v.department.trim() : null,
              v.city ? v.city.trim() : null,
              v.zone ? v.zone.trim() : (v.city && v.department ? `${v.city.trim()}, ${v.department.trim()}` : null),
              v.mapsUrl ? v.mapsUrl.trim() : null,
              req.user!.userId
            ]);
            companyId = newComp.rows[0].id;
          } else {
            companyId = compCheck.rows[0].id;
            await client.query(`
              UPDATE companies
              SET department = COALESCE(NULLIF($1, ''), department),
                  city = COALESCE(NULLIF($2, ''), city),
                  zone = COALESCE(NULLIF($3, ''), zone),
                  maps_url = COALESCE(NULLIF($4, ''), maps_url),
                  updated_at = NOW()
              WHERE id = $5
            `, [
              v.department ? v.department.trim() : null,
              v.city ? v.city.trim() : null,
              v.zone ? v.zone.trim() : null,
              v.mapsUrl ? v.mapsUrl.trim() : null,
              companyId
            ]);
          }
        }

        const visitResult = await client.query(`
          INSERT INTO visits (
            work_day_id, user_id, company_id, date,
            visit_type, department, city, zone, maps_url,
            reason, funnel_stage, result, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          id,
          current.user_id,
          companyId,
          targetDateStr,
          v.visitType || 'Nueva visita',
          v.department ? v.department.trim() : null,
          v.city ? v.city.trim() : null,
          v.zone ? v.zone.trim() : (v.city && v.department ? `${v.city.trim()}, ${v.department.trim()}` : null),
          v.mapsUrl ? v.mapsUrl.trim() : null,
          v.reason || 'Seguimiento comercial',
          v.funnelStage || 'Prospección',
          v.result || 'Pendiente',
          v.notes ? v.notes.trim() : null,
        ]);

        if (v.result === 'Contratado' || v.funnelStage === 'Contrato' || v.funnelStage === 'Venta ganada / Suscripción') {
          await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [companyId]);
        } else if (v.result === 'En negociación' || v.funnelStage === 'Negociación') {
          await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
        }

        addedVisitsSummary.push({
          id: visitResult.rows[0].id,
          companyName: v.companyName.trim(),
          funnelStage: v.funnelStage || 'Prospección',
          result: v.result || 'Pendiente',
          department: v.department || null,
          city: v.city || null,
        });
      }
    }

    // Distribuir los gastos extras a las visitas del día
    await client.query('UPDATE visits SET other_expenses_gs = 0 WHERE work_day_id = $1', [id]);

    const vRes = await client.query('SELECT id, company_id FROM visits WHERE work_day_id = $1 ORDER BY created_at ASC', [id]);
    const dayVisits = vRes.rows;

    if (dayVisits.length > 0 && cleanExpenses.length > 0) {
      const expensesByVisitId: { [visitId: string]: number } = {};
      for (const v of dayVisits) {
        expensesByVisitId[v.id] = 0;
      }

      for (const exp of cleanExpenses) {
        if (exp.companyId) {
          const matched = dayVisits.filter((v: any) => v.company_id === exp.companyId);
          if (matched.length > 0) {
            const share = Math.floor(exp.amount / matched.length);
            const rem = exp.amount - (share * matched.length);
            matched.forEach((v: any, idx: number) => {
              expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
            });
          } else {
            const share = Math.floor(exp.amount / dayVisits.length);
            const rem = exp.amount - (share * dayVisits.length);
            dayVisits.forEach((v: any, idx: number) => {
              expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
            });
          }
        } else {
          const share = Math.floor(exp.amount / dayVisits.length);
          const rem = exp.amount - (share * dayVisits.length);
          dayVisits.forEach((v: any, idx: number) => {
            expensesByVisitId[v.id] += share + (idx < rem ? 1 : 0);
          });
        }
      }

      for (const v of dayVisits) {
        await client.query('UPDATE visits SET other_expenses_gs = $1 WHERE id = $2', [expensesByVisitId[v.id] || 0, v.id]);
      }
    }

    // Recalcular y sincronizar costos de la jornada (combustible distribuido y total costos)
    await syncWorkdayCosts(client, id);

    const auditDetails = {
      changes,
      added_visits_count: addedVisitsSummary.length,
      added_visits: addedVisitsSummary,
      audit_reason: auditReason || 'Modificación de jornada / visitas anexadas',
      target_user_name: current.user_name,
    };

    await client.query(`
      INSERT INTO audit_log (action, entity_type, entity_id, target_user_id, performed_by, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'UPDATE_WORK_DAY',
      'WORK_DAY',
      id,
      current.user_id,
      req.user!.userId,
      JSON.stringify(auditDetails),
    ]);

    await client.query('COMMIT');

    const updatedDay = await pool.query(`
      SELECT wd.*, u.full_name AS user_name,
        (SELECT COUNT(*) FROM audit_log al WHERE al.entity_id = wd.id)::int AS audit_count
      FROM work_days wd
      JOIN users u ON u.id = wd.user_id
      WHERE wd.id = $1
    `, [id]);

    const updatedVisits = await pool.query(`
      SELECT v.*, c.name AS company_name
      FROM visits v
      JOIN companies c ON c.id = v.company_id
      WHERE v.work_day_id = $1
      ORDER BY v.created_at ASC
    `, [id]);

    res.json({
      message: 'Jornada actualizada exitosamente',
      jornada: updatedDay.rows[0],
      visits: updatedVisits.rows,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error al editar jornada:', err);
    res.status(500).json({ error: 'Error al actualizar jornada' });
  } finally {
    client.release();
  }
});

// GET /jornadas/:id/auditoria — consultar historial detallado de cambios (solo admin)
router.get('/:id/auditoria', isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        a.id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.created_at,
        u.id AS performer_id,
        u.full_name AS performer_name,
        u.email AS performer_email,
        u.role AS performer_role
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.performed_by
      WHERE a.entity_id = $1
      ORDER BY a.created_at DESC
    `, [id]);

    res.json({ audits: result.rows });
  } catch (err: any) {
    console.error('Error al consultar auditoría de jornada:', err);
    res.status(500).json({ error: 'Error al consultar registro de auditoría' });
  }
});

export default router;
