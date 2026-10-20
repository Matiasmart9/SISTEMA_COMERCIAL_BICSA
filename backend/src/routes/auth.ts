import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query(
        `SELECT id, email, password_hash, full_name, role, is_active, photo_odometer_enabled
         FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador.' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const secret = process.env.JWT_SECRET!;
      const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

      const token = jwt.sign(
        { userId: user.id, role: user.role, email: user.email },
        secret,
        { expiresIn } as jwt.SignOptions
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          photoOdometerEnabled: Boolean(user.photo_odometer_enabled),
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

// GET /auth/me — obtener perfil actual
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, photo_odometer_enabled, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      isActive: u.is_active,
      photoOdometerEnabled: Boolean(u.photo_odometer_enabled),
      createdAt: u.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /auth/change-password
router.post('/change-password',
  authMiddleware,
  [
    body('currentPassword').isLength({ min: 6 }),
    body('newPassword').isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user!.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hash, req.user!.userId]
      );

      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

export default router;
