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
    // 1. Migrar/actualizar gerente comercial si aún tiene el correo viejo
    await pool.query(`
      UPDATE users 
      SET email = 'luis.reyes@bicsa.com.py', full_name = 'Luis Reyes' 
      WHERE email = 'gerente.comercial@bicsa.com.py' OR id = '00000000-0000-0000-0000-000000000004'
    `);

    // 2. Garantizar que el superadmin tenga la contraseña correcta configurada
    const adminHash = await bcrypt.hash(password, 12);
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE users SET password_hash = $1, is_active = true WHERE email = $2',
        [adminHash, email]
      );
      logger.info(`✅ Contraseña del superadmin sincronizada: ${email}`);
    } else {
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)`,
        [email, adminHash, name]
      );
      logger.info(`✅ Superadmin creado: ${email}`);
    }

    // 3. Garantizar que todos los usuarios del equipo tengan su contraseña activa (Bicsa123!)
    const demoPassword = process.env.DEMO_USER_PASSWORD || 'Bicsa123!';
    const demoHash = await bcrypt.hash(demoPassword, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, is_active = true WHERE email != $2`,
      [demoHash, email]
    );
    logger.info(`✅ Contraseñas del equipo sincronizadas: Bicsa123!`);
  } catch (err) {
    logger.error('Error al inicializar usuarios en seeder:', err);
  }
}
