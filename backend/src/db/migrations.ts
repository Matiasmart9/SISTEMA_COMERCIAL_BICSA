import { pool } from './pool';
import { logger } from '../utils/logger';

export async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE work_days ALTER COLUMN km_start DROP NOT NULL;
      ALTER TABLE work_days ALTER COLUMN km_end DROP NOT NULL;
      ALTER TABLE work_days DROP CONSTRAINT IF EXISTS chk_km_order;
      ALTER TABLE work_days ADD CONSTRAINT chk_km_order CHECK (km_end IS NULL OR km_start IS NULL OR km_end >= km_start);
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'cerrada';
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS mobility_type VARCHAR(30) NOT NULL DEFAULT 'propia';
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS platform_trips JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS transport_total_gs INTEGER DEFAULT 0;
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS fuel_amount_gs INTEGER DEFAULT 0;
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS fuel_pending_at_start BOOLEAN DEFAULT false;
      ALTER TABLE work_days ADD COLUMN IF NOT EXISTS extra_expenses JSONB DEFAULT '[]'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_work_days_status ON work_days(status);
      CREATE INDEX IF NOT EXISTS idx_work_days_user_status ON work_days(user_id, status);

      ALTER TABLE visits ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS transport_cost_gs INTEGER DEFAULT 0;
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS platform_used VARCHAR(50);
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS fuel_allocated_gs INTEGER DEFAULT 0;
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS other_expenses_gs INTEGER DEFAULT 0;
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_cost_gs INTEGER DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_visits_department ON visits(department);
      CREATE INDEX IF NOT EXISTS idx_visits_city ON visits(city);

      ALTER TABLE companies ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(100);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    `);

    // Actualización de ENUMs y migración de 'Sin interés' a 'Venta perdida'
    try {
      await pool.query("ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'Venta perdida'");
    } catch (e) {
      // Ignorar si ya existe
    }
    try {
      await pool.query("ALTER TYPE visit_result ADD VALUE IF NOT EXISTS 'Venta perdida'");
    } catch (e) {
      // Ignorar si ya existe
    }

    await pool.query(`
      UPDATE companies SET commercial_status = 'Venta perdida' WHERE commercial_status::text = 'Sin interés';
      UPDATE visits SET result = 'Venta perdida' WHERE result::text = 'Sin interés';

      UPDATE visits SET department = 'Capital', city = 'Asunción' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Asunci%');
      UPDATE visits SET department = 'Central', city = 'Luque' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Luque%');
      UPDATE visits SET department = 'Central', city = 'San Lorenzo' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%San Lorenzo%');
      UPDATE visits SET department = 'Itapúa', city = 'Edelira' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Edelira%');
      UPDATE visits SET department = 'Paraguarí', city = 'La Colmena' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Colmena%');
      UPDATE visits SET department = 'Paraguarí', city = 'Carapeguá' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Carapegu%');

      UPDATE companies SET department = 'Capital', city = 'Asunción' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Asunci%');
      UPDATE companies SET department = 'Central', city = 'Luque' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Luque%');
      UPDATE companies SET department = 'Central', city = 'San Lorenzo' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%San Lorenzo%');
      UPDATE companies SET department = 'Itapúa', city = 'Edelira' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Edelira%');
      UPDATE companies SET department = 'Paraguarí', city = 'La Colmena' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Colmena%');
      UPDATE companies SET department = 'Paraguarí', city = 'Carapeguá' WHERE (department IS NULL OR department = '') AND (zone ILIKE '%Carapegu%');

      DROP VIEW IF EXISTS company_summary CASCADE;
      CREATE OR REPLACE VIEW company_summary AS
      SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.commercial_status,
        c.department,
        c.city,
        c.zone,
        c.maps_url,
        c.notes,
        COUNT(v.id) AS total_visits,
        MIN(v.date) AS first_visit,
        MAX(v.date) AS last_visit,
        COUNT(DISTINCT v.user_id) AS executors_count,
        STRING_AGG(DISTINCT u.full_name, ', ' ORDER BY u.full_name) AS executors_names
      FROM companies c
      LEFT JOIN visits v ON v.company_id = c.id
      LEFT JOIN users u ON u.id = v.user_id
      GROUP BY c.id, c.name, c.commercial_status, c.department, c.city, c.zone, c.maps_url, c.notes;
    `);

    logger.info('✅ Migraciones de esquema ejecutadas correctamente');
  } catch (err) {
    logger.error('❌ Error ejecutando migraciones de esquema:', err);
    throw err;
  }
}
