import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authMiddleware, isAnyRole, isAdmin } from '../middleware/auth';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// GET /jornadas — listar (propio para ejecutivo, todo para admin/gerente)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', dateFrom, dateTo, userId } = req.query as Record<string, string>;
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

    if (dateFrom) { conditions.push(`wd.date >= $${pIdx++}`); params.push(dateFrom); }
    if (dateTo) { conditions.push(`wd.date <= $${pIdx++}`); params.push(dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        wd.id, wd.date, wd.km_start, wd.km_end, wd.km_total,
        wd.km_start_photo, wd.km_end_photo, wd.notes,
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

// POST /jornadas — crear jornada + visitas (transaccional)
router.post('/',
  [
    body('date').isDate(),
    body('kmStart').isInt({ min: 0 }),
    body('kmEnd').isInt({ min: 0 }),
    body('visits').isArray({ min: 1 }),
    body('visits.*.companyName').trim().notEmpty(),
    body('visits.*.visitType').isIn(['Nueva visita', 'Prospecto en seguimiento', 'Cliente actual']),
    body('visits.*.reason').isIn(['Prospección', 'Presentación de servicios', 'Seguimiento comercial', 'Negociación', 'Fidelización', 'Otro']),
    body('visits.*.funnelStage').isIn(['Prospección', 'Contacto con decisor', 'Negociación', 'Contrato', 'Venta ganada / Suscripción']),
    body('visits.*.result').isIn(['Pendiente', 'Propuesta enviada', 'En negociación', 'Contratado', 'Sin interés', 'Visita realizada']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, kmStart, kmEnd, kmStartPhoto, kmEndPhoto, notes, visits } = req.body;

    if (kmEnd < kmStart) {
      return res.status(400).json({ error: 'El kilometraje final debe ser mayor o igual al inicial' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Crear jornada
      const dayResult = await client.query(`
        INSERT INTO work_days (user_id, date, km_start, km_end, km_start_photo, km_end_photo, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [req.user!.userId, date, kmStart, kmEnd, kmStartPhoto || null, kmEndPhoto || null, notes || null]);

      const workDay = dayResult.rows[0];

      // Procesar visitas
      const createdVisits = [];
      for (const v of visits) {
        let companyId: string = v.companyId;

        if (!companyId) {
          // Normalizar y buscar/crear empresa
          const normalized = (v.companyName as string).toLowerCase().trim().replace(/\s+/g, ' ');
          const companyResult = await client.query(
            'SELECT id FROM companies WHERE normalized_name = $1',
            [normalized]
          );

          if (companyResult.rows.length === 0) {
            const newCompany = await client.query(`
              INSERT INTO companies (name, normalized_name, zone, maps_url, created_by)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, [
              v.companyName.trim(),
              normalized,
              v.zone ? v.zone.trim() : null,
              v.mapsUrl ? v.mapsUrl.trim() : null,
              req.user!.userId
            ]);
            companyId = newCompany.rows[0].id;
          } else {
            companyId = companyResult.rows[0].id;
            // Si la empresa ya existía y se proporcionó zona o enlace maps, actualizarla como principal
            if (v.zone || v.mapsUrl) {
              await client.query(`
                UPDATE companies
                SET zone = COALESCE(NULLIF($1, ''), zone),
                    maps_url = COALESCE(NULLIF($2, ''), maps_url),
                    updated_at = NOW()
                WHERE id = $3
              `, [
                v.zone ? v.zone.trim() : null,
                v.mapsUrl ? v.mapsUrl.trim() : null,
                companyId
              ]);
            }
          }
        }

        const visitResult = await client.query(`
          INSERT INTO visits (work_day_id, user_id, company_id, date, visit_type, zone, maps_url, reason, funnel_stage, result, uber_ref_gs, bolt_ref_gs, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          workDay.id,
          req.user!.userId,
          companyId,
          date,
          v.visitType,
          v.zone || null,
          v.mapsUrl || null,
          v.reason,
          v.funnelStage,
          v.result || 'Pendiente',
          v.uberRefGs || null,
          v.boltRefGs || null,
          v.notes || null,
        ]);

        // Actualizar estado comercial de la empresa según el resultado de la visita
        if (v.result === 'Contratado' || v.funnelStage === 'Contrato' || v.funnelStage === 'Venta ganada / Suscripción') {
          await client.query("UPDATE companies SET commercial_status = 'Contratado', updated_at = NOW() WHERE id = $1", [companyId]);
        } else if (v.result === 'En negociación' || v.funnelStage === 'Negociación') {
          await client.query("UPDATE companies SET commercial_status = 'En negociación', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
        } else if (v.result === 'Sin interés') {
          await client.query("UPDATE companies SET commercial_status = 'Sin interés', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [companyId]);
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
    kmStart,
    kmEnd,
    kmStartPhoto,
    kmEndPhoto,
    notes,
    auditReason,
    newVisits,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener la jornada actual y validar propiedad o rol gerencial
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

    const targetKmStart = kmStart !== undefined && kmStart !== '' ? parseInt(String(kmStart).replace(/\D/g, ''), 10) : current.km_start;
    const targetKmEnd = kmEnd !== undefined && kmEnd !== '' ? parseInt(String(kmEnd).replace(/\D/g, ''), 10) : current.km_end;
    const targetKmStartPhoto = kmStartPhoto !== undefined ? (kmStartPhoto || null) : current.km_start_photo;
    const targetKmEndPhoto = kmEndPhoto !== undefined ? (kmEndPhoto || null) : current.km_end_photo;
    const targetNotes = notes !== undefined ? notes : current.notes;
    let targetDateStr = current.date ? new Date(current.date).toISOString().slice(0, 10) : '';
    if (date) {
      targetDateStr = typeof date === 'string' && date.includes('T') ? date.split('T')[0] : date;
    }

    if (targetKmEnd < targetKmStart) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El kilometraje final debe ser mayor o igual al inicial' });
    }

    // 2. Registrar diferencias para auditoría
    const changes: Record<string, { old: any; new: any; label: string }> = {};

    if (targetKmStart !== current.km_start) {
      changes['km_start'] = { old: current.km_start, new: targetKmStart, label: 'Km Inicial' };
    }
    if (targetKmEnd !== current.km_end) {
      changes['km_end'] = { old: current.km_end, new: targetKmEnd, label: 'Km Final' };
    }
    if (kmStartPhoto !== undefined && kmStartPhoto !== current.km_start_photo) {
      changes['km_start_photo'] = { old: current.km_start_photo ? 'Foto existente' : 'Sin foto', new: kmStartPhoto ? 'Nueva foto cargada' : 'Foto eliminada', label: 'Foto Tablero Inicial' };
    }
    if (kmEndPhoto !== undefined && kmEndPhoto !== current.km_end_photo) {
      changes['km_end_photo'] = { old: current.km_end_photo ? 'Foto existente' : 'Sin foto', new: kmEndPhoto ? 'Nueva foto cargada' : 'Foto eliminada', label: 'Foto Tablero Final' };
    }
    const currentTotal = current.km_end - current.km_start;
    const newTotal = targetKmEnd - targetKmStart;
    if (newTotal !== currentTotal) {
      changes['km_total'] = { old: currentTotal, new: newTotal, label: 'Km Recorridos' };
    }
    const curDateClean = current.date ? new Date(current.date).toISOString().slice(0, 10) : '';
    if (targetDateStr && targetDateStr !== curDateClean) {
      changes['date'] = { old: curDateClean, new: targetDateStr, label: 'Fecha de jornada' };
    }
    if ((targetNotes || '') !== (current.notes || '')) {
      changes['notes'] = { old: current.notes || '-', new: targetNotes || '-', label: 'Observaciones' };
    }

    // 3. Actualizar la jornada
    await client.query(`
      UPDATE work_days
      SET km_start = $1,
          km_end = $2,
          km_start_photo = $3,
          km_end_photo = $4,
          date = $5,
          notes = $6,
          updated_at = NOW()
      WHERE id = $7
    `, [targetKmStart, targetKmEnd, targetKmStartPhoto, targetKmEndPhoto, targetDateStr, targetNotes, id]);

    // 4. Procesar nuevas visitas anexadas
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
              INSERT INTO companies (name, normalized_name, zone, maps_url, created_by)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, [
              v.companyName.trim(),
              normalized,
              v.zone ? v.zone.trim() : null,
              v.mapsUrl ? v.mapsUrl.trim() : null,
              req.user!.userId
            ]);
            companyId = newComp.rows[0].id;
          } else {
            companyId = compCheck.rows[0].id;
            if (v.zone || v.mapsUrl) {
              await client.query(`
                UPDATE companies
                SET zone = COALESCE(NULLIF($1, ''), zone),
                    maps_url = COALESCE(NULLIF($2, ''), maps_url),
                    updated_at = NOW()
                WHERE id = $3
              `, [v.zone ? v.zone.trim() : null, v.mapsUrl ? v.mapsUrl.trim() : null, companyId]);
            }
          }
        }

        const visitResult = await client.query(`
          INSERT INTO visits (
            work_day_id, user_id, company_id, date,
            visit_type, zone, maps_url, reason, funnel_stage, result,
            uber_ref_gs, bolt_ref_gs, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          id,
          current.user_id,
          companyId,
          targetDateStr,
          v.visitType || 'Nueva visita',
          v.zone ? v.zone.trim() : null,
          v.mapsUrl ? v.mapsUrl.trim() : null,
          v.reason || 'Seguimiento comercial',
          v.funnelStage || 'Prospección',
          v.result || 'Pendiente',
          v.uberRefGs ? parseInt(String(v.uberRefGs).replace(/\D/g, ''), 10) : null,
          v.boltRefGs ? parseInt(String(v.boltRefGs).replace(/\D/g, ''), 10) : null,
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
          zone: v.zone || null,
        });
      }
    }

    // 5. Registrar en la tabla audit_log
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

    // 6. Consultar estado final actualizado
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
      message: 'Jornada actualizada y registrada en auditoría exitosamente',
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

// GET /jornadas/:id/auditoria — consultar historial detallado de cambios (solo rol admin)
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
