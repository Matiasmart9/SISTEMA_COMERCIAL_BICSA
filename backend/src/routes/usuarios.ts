import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authMiddleware, isAdmin, isAdminOrGerente } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /usuarios — admin y gerente (para reportes, exportaciones y monitoreo)
router.get('/', isAdminOrGerente, async (_req: Request, res: Response) => {
  try {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'matiasmart7@gmail.com';
    const result = await pool.query(`
      SELECT id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url, last_login_at, created_at, updated_at
      FROM users
      WHERE email != $1
      ORDER BY full_name ASC
    `, [superAdminEmail]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// PUT /usuarios/perfil/avatar — cambiar o eliminar foto de perfil propia (cualquier usuario autenticado)
router.put('/perfil/avatar', async (req: Request, res: Response) => {
  const { avatarUrl } = req.body;
  const sanitizedUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

  try {
    const result = await pool.query(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url`,
      [sanitizedUrl, req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = result.rows[0];
    await pool.query(
      `INSERT INTO audit_log (action, target_user_id, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [sanitizedUrl ? 'UPDATE_PROFILE_AVATAR' : 'DELETE_PROFILE_AVATAR', u.id, req.user!.userId, JSON.stringify({ hasAvatar: Boolean(sanitizedUrl) })]
    );

    res.json({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      isActive: u.is_active,
      photoOdometerEnabled: Boolean(u.photo_odometer_enabled),
      avatarUrl: u.avatar_url,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar foto de perfil' });
  }
});

// PATCH /usuarios/:id/avatar — cambiar o eliminar foto de un usuario (solo admin)
router.patch('/:id/avatar', isAdmin, async (req: Request, res: Response) => {
  const { avatarUrl } = req.body;
  const sanitizedUrl = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

  try {
    const result = await pool.query(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url`,
      [sanitizedUrl, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = result.rows[0];
    await pool.query(
      `INSERT INTO audit_log (action, target_user_id, performed_by, details)
       VALUES ($1, $2, $3, $4)`,
      [sanitizedUrl ? 'ADMIN_UPDATE_USER_AVATAR' : 'ADMIN_DELETE_USER_AVATAR', u.id, req.user!.userId, JSON.stringify({ hasAvatar: Boolean(sanitizedUrl) })]
    );

    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar foto de perfil del usuario' });
  }
});

// POST /usuarios — crear usuario (solo admin)
router.post('/',
  isAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['ejecutivo', 'gerente', 'admin']),
    body('photoOdometerEnabled').optional().isBoolean(),
    body('avatarUrl').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, role, photoOdometerEnabled, avatarUrl } = req.body;
    const sanitizedAvatar = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role, is_active, photo_odometer_enabled, avatar_url, created_by)
        VALUES ($1, $2, $3, $4, true, $5, $6, $7)
        RETURNING id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url, created_at
      `, [email, hash, fullName, role, Boolean(photoOdometerEnabled), sanitizedAvatar, req.user!.userId]);

      // Auditoría
      await client.query(`
        INSERT INTO audit_log (action, target_user_id, performed_by, details)
        VALUES ('CREATE_USER', $1, $2, $3)
      `, [result.rows[0].id, req.user!.userId, JSON.stringify({ role, email, photo_odometer_enabled: Boolean(photoOdometerEnabled), hasAvatar: Boolean(sanitizedAvatar) })]);

      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al crear usuario' });
    } finally {
      client.release();
    }
  }
);

// PATCH /usuarios/:id/toggle — activar/desactivar (solo admin)
router.patch('/:id/toggle', isAdmin, async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ error: 'No puede desactivarse a sí mismo' });
  }
  try {
    const result = await pool.query(
      `UPDATE users
       SET is_active = NOT is_active,
           deactivated_at = CASE WHEN is_active THEN NOW() ELSE NULL END,
           deactivated_by = CASE WHEN is_active THEN $1 ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, full_name, role, is_active`,
      [req.user!.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = result.rows[0];
    await pool.query(`
      INSERT INTO audit_log (action, target_user_id, performed_by, details)
      VALUES ($1, $2, $3, $4)
    `, [
      u.is_active ? 'REACTIVATE_USER' : 'DEACTIVATE_USER',
      u.id,
      req.user!.userId,
      JSON.stringify({ email: u.email }),
    ]);

    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
});

// PATCH /usuarios/:id/photo-odometer-toggle — habilitar/deshabilitar fotos de odómetro (solo admin)
router.patch('/:id/photo-odometer-toggle', isAdmin, async (req: Request, res: Response) => {
  try {
    const hasExplicit = req.body && typeof req.body.enabled === 'boolean';
    const query = hasExplicit
      ? `UPDATE users
         SET photo_odometer_enabled = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url, last_login_at`
      : `UPDATE users
         SET photo_odometer_enabled = NOT photo_odometer_enabled,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, full_name, role, is_active, photo_odometer_enabled, avatar_url, last_login_at`;

    const params = hasExplicit ? [req.params.id, req.body.enabled] : [req.params.id];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = result.rows[0];
    await pool.query(`
      INSERT INTO audit_log (action, target_user_id, performed_by, details)
      VALUES ($1, $2, $3, $4)
    `, [
      u.photo_odometer_enabled ? 'ENABLE_PHOTO_ODOMETER' : 'DISABLE_PHOTO_ODOMETER',
      u.id,
      req.user!.userId,
      JSON.stringify({ email: u.email, photo_odometer_enabled: u.photo_odometer_enabled }),
    ]);

    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar configuración de fotos de odómetro' });
  }
});

// PATCH /usuarios/:id/role — cambiar rol (solo admin)
router.patch('/:id/role', isAdmin,
  [body('role').isIn(['ejecutivo', 'gerente', 'admin'])],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    try {
      const previous = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
      if (previous.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const result = await pool.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, role',
        [req.body.role, req.params.id]
      );

      await pool.query(`
        INSERT INTO audit_log (action, target_user_id, performed_by, details)
        VALUES ('CHANGE_ROLE', $1, $2, $3)
      `, [req.params.id, req.user!.userId, JSON.stringify({
        oldRole: previous.rows[0].role,
        newRole: req.body.role,
      })]);

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al cambiar rol' });
    }
  }
);

// PATCH /usuarios/:id/reset-password — resetear contraseña (solo admin)
router.patch('/:id/reset-password', isAdmin,
  [body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y número' });
    }
    try {
      const hash = await bcrypt.hash(req.body.newPassword, 12);
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hash, req.params.id]
      );
      await pool.query(`
        INSERT INTO audit_log (action, target_user_id, performed_by)
        VALUES ('RESET_PASSWORD', $1, $2)
      `, [req.params.id, req.user!.userId]);
      res.json({ message: 'Contraseña restablecida correctamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error al resetear contraseña' });
    }
  }
);

export default router;
