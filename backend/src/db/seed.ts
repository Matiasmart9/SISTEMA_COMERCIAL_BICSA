import bcrypt from 'bcrypt';
import { pool } from './pool';
import { logger } from '../utils/logger';

/**
 * Crea el superadmin inicial si no existe.
 * Usa las variables de entorno SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME.
 */
export async function seedSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || 'Administrador BICSA';

  if (!email || !password) {
    logger.warn('⚠️  SUPERADMIN_EMAIL o SUPERADMIN_PASSWORD no configurados, saltando seed.');
    return;
  }

  try {
    const existing = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].password_hash.includes('placeholder')) {
        const hash = await bcrypt.hash(password, 12);
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [hash, email]
        );
        logger.info(`✅ Contraseña del superadmin actualizada: ${email}`);
      } else {
        logger.info(`ℹ️  Superadmin ya existe: ${email}`);
      }
    } else {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)`,
        [email, hash, name]
      );
      logger.info(`✅ Superadmin creado: ${email}`);
    }

    // Actualizar contraseñas de usuarios demo que tengan hash placeholder
    const demoPassword = process.env.DEMO_USER_PASSWORD || 'Bicsa123!';
    const demoHash = await bcrypt.hash(demoPassword, 12);
    const demoUpdated = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE password_hash LIKE '%placeholder%' RETURNING email`,
      [demoHash]
    );
    if (demoUpdated.rows.length > 0) {
      logger.info(`✅ Contraseñas de usuarios demo actualizadas (${demoPassword}): ${demoUpdated.rows.map(r => r.email).join(', ')}`);
    }
  } catch (err) {
    logger.error('Error al inicializar usuarios en seeder:', err);
  }
}
