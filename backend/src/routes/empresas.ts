import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /empresas/export/excel — Descargar listado de empresas a Excel
router.get('/export/excel', async (req: Request, res: Response) => {
  try {
    const { q = '', status = '', filter = 'all' } = req.query as Record<string, string>;
    const isManager = ['admin', 'gerente'].includes(req.user!.role);

    let whereClause = 'WHERE cs.company_name ILIKE $1';
    const params: unknown[] = [`%${q}%`];

    if (status && status !== 'all' && status !== 'Todos') {
      params.push(status);
      whereClause += ` AND cs.commercial_status::text = $${params.length}`;
    }

    if (!isManager && filter === 'my') {
      params.push(req.user!.userId);
      whereClause += ` AND cs.company_id IN (SELECT company_id FROM visits WHERE user_id = $${params.length})`;
    }

    const companies = await pool.query(`
      SELECT cs.company_id AS id, cs.company_name AS name, cs.commercial_status,
             cs.department, cs.city, cs.zone, cs.maps_url, cs.notes,
             cs.total_visits, cs.first_visit, cs.last_visit, cs.executors_names
      FROM company_summary cs
      ${whereClause}
      ORDER BY cs.company_name ASC
    `, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'BICSA Gestión Comercial';
    wb.created = new Date();

    const ws = wb.addWorksheet('Directorio de Empresas', {
      views: [{ showGridLines: true }],
    });

    // Excel green theme: #107C41
    const EXCEL_GREEN = 'FF107C41';
    const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    ws.columns = [
      { header: 'EMPRESA', key: 'name', width: 34 },
      { header: 'ESTADO COMERCIAL', key: 'status', width: 22 },
      { header: 'DEPARTAMENTO', key: 'department', width: 20 },
      { header: 'CIUDAD / DISTRITO', key: 'city', width: 22 },
      { header: 'DIRECCIÓN / ZONA', key: 'zone', width: 30 },
      { header: 'TOTAL VISITAS', key: 'total_visits', width: 16 },
      { header: 'PRIMERA VISITA', key: 'first_visit', width: 16 },
      { header: 'ÚLTIMA VISITA', key: 'last_visit', width: 16 },
      { header: 'EJECUTIVOS INVOLUCRADOS', key: 'executors', width: 36 },
      { header: 'UBICACIÓN (MAPS)', key: 'maps_url', width: 32 },
      { header: 'OBSERVACIONES / NOTAS', key: 'notes', width: 40 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_GREEN } };
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0D6133' } },
        bottom: { style: 'medium', color: { argb: 'FF0D6133' } },
        left: { style: 'thin', color: { argb: 'FF0D6133' } },
        right: { style: 'thin', color: { argb: 'FF0D6133' } },
      };
    });

    companies.rows.forEach((c) => {
      const formatDateStr = (d: any) => {
        if (!d) return '-';
        const str = typeof d === 'string' ? d : d.toISOString();
        const clean = str.includes('T') ? str.split('T')[0] : str;
        const parts = clean.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : str;
      };

      const row = ws.addRow({
        name: c.name,
        status: c.commercial_status || 'Prospecto',
        department: c.department || '-',
        city: c.city || '-',
        zone: c.zone || '-',
        total_visits: Number(c.total_visits || 0),
        first_visit: formatDateStr(c.first_visit),
        last_visit: formatDateStr(c.last_visit),
        executors: c.executors_names || '-',
        maps_url: c.maps_url || '-',
        notes: c.notes || '-',
      });

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.font = { bold: true, size: 9.5 };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, size: 9 };
          if (c.commercial_status === 'Contratado') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { bold: true, color: { argb: 'FF065F46' }, size: 9 };
          } else if (c.commercial_status === 'En negociación') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
            cell.font = { bold: true, color: { argb: 'FF9A3412' }, size: 9 };
          } else if (c.commercial_status === 'Venta perdida' || c.commercial_status === 'Sin interés') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { bold: true, color: { argb: 'FF991B1B' }, size: 9 };
          } else if (c.commercial_status === 'Prospecto') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { bold: true, color: { argb: 'FF92400E' }, size: 9 };
          }
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { bold: true, size: 9.5 };
        } else if (colNumber === 7 || colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="BICSA_Empresas_${dateStamp}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error al exportar empresas a Excel:', err);
    res.status(500).json({ error: 'Error al exportar empresas a Excel' });
  }
});

// GET /empresas — buscar con autocompletado y catálogo global
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q = '', status = '', page = '1', limit = '100', filter = 'all' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isManager = ['admin', 'gerente'].includes(req.user!.role);

    let whereClause = 'WHERE cs.company_name ILIKE $1';
    const params: unknown[] = [`%${q}%`];

    if (status && status !== 'all' && status !== 'Todos') {
      params.push(status);
      whereClause += ` AND cs.commercial_status::text = $${params.length}`;
    }

    // Si un ejecutivo filtra explícitamente "Mis empresas", solo mostramos las que él visitó
    if (!isManager && filter === 'my') {
      params.push(req.user!.userId);
      whereClause += ` AND cs.company_id IN (SELECT company_id FROM visits WHERE user_id = $${params.length})`;
    }

    const data = await pool.query(`
      SELECT cs.company_id AS id, cs.company_name AS name, cs.commercial_status,
             cs.department, cs.city, cs.zone, cs.maps_url, cs.notes,
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

// POST /empresas — registrar una nueva empresa directamente desde el directorio
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, department, city, zone, mapsUrl, commercialStatus = 'Prospecto', notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la empresa es obligatorio' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ error: 'El departamento (INE) es obligatorio' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'La ciudad / municipio (INE) es obligatoria' });
    }

    const trimmedName = name.trim();
    const normalized = trimmedName.toLowerCase().replace(/\s+/g, ' ');

    // Verificar si ya existe por nombre normalizado
    const existing = await pool.query('SELECT id, name FROM companies WHERE normalized_name = $1', [normalized]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Ya existe una empresa registrada con el nombre "${existing.rows[0].name}"` });
    }

    const validStatuses = ['Prospecto', 'En negociación', 'Contratado', 'Venta perdida', 'Sin interés', 'Inactivo'];
    const status = validStatuses.includes(commercialStatus) ? commercialStatus : 'Prospecto';

    const result = await pool.query(`
      INSERT INTO companies (
        name, normalized_name, department, city, zone, maps_url, commercial_status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      trimmedName,
      normalized,
      department.trim(),
      city.trim(),
      zone && zone.trim() ? zone.trim() : `${city.trim()}, ${department.trim()}`,
      mapsUrl && mapsUrl.trim() ? mapsUrl.trim() : null,
      status,
      notes && notes.trim() ? notes.trim() : null,
      req.user!.userId,
    ]);

    res.status(201).json({
      message: 'Empresa creada exitosamente',
      company: result.rows[0],
    });
  } catch (err: any) {
    console.error('Error al crear empresa:', err);
    res.status(500).json({ error: 'Error al registrar nueva empresa' });
  }
});

// POST /empresas/:id/visitas — registrar seguimiento o visita directa a empresa existente
router.post('/:id/visitas', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    date = new Date().toISOString().slice(0, 10),
    visitType = 'Prospecto en seguimiento',
    department,
    city,
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
        visit_type, department, city, zone, maps_url, reason, funnel_stage, result,
        uber_ref_gs, bolt_ref_gs, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      targetWorkDayId,
      req.user!.userId,
      id,
      date,
      visitType,
      department ? department.trim() : null,
      city ? city.trim() : null,
      zone || (city && department ? `${city.trim()}, ${department.trim()}` : null),
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
    } else if (result === 'Venta perdida' || result === 'Sin interés') {
      await client.query("UPDATE companies SET commercial_status = 'Venta perdida', updated_at = NOW() WHERE id = $1 AND commercial_status != 'Contratado'", [id]);
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
    const { name, department, city, zone, mapsUrl, notes, commercialStatus } = req.body;

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

    if (department !== undefined) {
      updates.push(`department = $${pIdx++}`);
      params.push(department && department.trim() ? department.trim() : null);
    }

    if (city !== undefined) {
      updates.push(`city = $${pIdx++}`);
      params.push(city && city.trim() ? city.trim() : null);
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
      const validStatuses = ['Prospecto', 'En negociación', 'Contratado', 'Venta perdida', 'Sin interés', 'Inactivo'];
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
  const validStatuses = ['Prospecto', 'En negociación', 'Contratado', 'Venta perdida', 'Sin interés', 'Inactivo'];
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
