-- ============================================================
-- BICSA Sistema Comercial — Schema PostgreSQL
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum: Roles de usuario
CREATE TYPE user_role AS ENUM ('ejecutivo', 'gerente', 'admin');

-- Enum: Tipo de visita
CREATE TYPE visit_type AS ENUM ('Nueva visita', 'Prospecto en seguimiento', 'Cliente actual');

-- Enum: Motivo de visita
CREATE TYPE visit_reason AS ENUM (
  'Prospección',
  'Presentación de servicios',
  'Seguimiento comercial',
  'Negociación',
  'Fidelización',
  'Otro'
);

-- Enum: Etapa del embudo
CREATE TYPE funnel_stage AS ENUM (
  'Prospección',
  'Contacto con decisor',
  'Negociación',
  'Contrato',
  'Venta ganada / Suscripción'
);

-- Enum: Resultado de visita
CREATE TYPE visit_result AS ENUM (
  'Pendiente',
  'Propuesta enviada',
  'En negociación',
  'Contratado',
  'Sin interés',
  'Visita realizada'
);

-- Enum: Estado comercial de empresa
CREATE TYPE company_status AS ENUM (
  'Prospecto',
  'En negociación',
  'Contratado',
  'Sin interés',
  'Inactivo'
);

-- ============================================================
-- TABLA: Usuarios
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'ejecutivo',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  photo_odometer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================
-- TABLA: Empresas
-- ============================================================
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,  -- lowercase, sin espacios extra
  commercial_status company_status NOT NULL DEFAULT 'Prospecto',
  zone            VARCHAR(255),            -- Ciudad / Zona / Dirección principal
  maps_url        VARCHAR(500),            -- Enlace Google Maps principal
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_companies_normalized ON companies(normalized_name);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_status ON companies(commercial_status);

-- ============================================================
-- TABLA: Jornadas de trabajo
-- ============================================================
CREATE TABLE work_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  date        DATE NOT NULL,
  km_start    INTEGER NOT NULL CHECK (km_start >= 0),
  km_end      INTEGER NOT NULL CHECK (km_end >= 0),
  km_total    INTEGER GENERATED ALWAYS AS (km_end - km_start) STORED,
  km_start_photo TEXT,
  km_end_photo   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_km_order CHECK (km_end >= km_start)
);

CREATE INDEX idx_work_days_user_id ON work_days(user_id);
CREATE INDEX idx_work_days_date ON work_days(date);
CREATE INDEX idx_work_days_user_date ON work_days(user_id, date);

-- ============================================================
-- TABLA: Visitas (múltiples por jornada)
-- ============================================================
CREATE TABLE visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_day_id   UUID NOT NULL REFERENCES work_days(id) ON DELETE RESTRICT,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  date          DATE NOT NULL,
  visit_type    visit_type NOT NULL,
  zone          VARCHAR(255),
  maps_url      VARCHAR(500),
  reason        visit_reason NOT NULL,
  funnel_stage  funnel_stage NOT NULL,
  result        visit_result NOT NULL DEFAULT 'Pendiente',
  uber_ref_gs   INTEGER CHECK (uber_ref_gs >= 0),  -- referencia Uber solo ida (Gs.)
  bolt_ref_gs   INTEGER CHECK (bolt_ref_gs >= 0),  -- referencia Bolt solo ida (Gs.)
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visits_work_day_id ON visits(work_day_id);
CREATE INDEX idx_visits_user_id ON visits(user_id);
CREATE INDEX idx_visits_company_id ON visits(company_id);
CREATE INDEX idx_visits_date ON visits(date);
CREATE INDEX idx_visits_funnel_stage ON visits(funnel_stage);
CREATE INDEX idx_visits_result ON visits(result);
-- Índice para consultas por usuario y fecha
CREATE INDEX idx_visits_user_date ON visits(user_id, date);

-- ============================================================
-- TABLA: Auditoría de usuarios
-- ============================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          VARCHAR(100) NOT NULL,  -- 'CREATE_USER', 'DEACTIVATE_USER', 'CHANGE_ROLE', 'UPDATE_WORK_DAY', etc.
  entity_type     VARCHAR(50) DEFAULT 'USER', -- 'USER', 'WORK_DAY', 'COMPANY'
  entity_id       UUID,
  target_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_target ON audit_log(target_user_id);
CREATE INDEX idx_audit_performed_by ON audit_log(performed_by);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_work_days_updated_at
  BEFORE UPDATE ON work_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VISTA: Contador mensual por ejecutivo y etapa
-- ============================================================
CREATE OR REPLACE VIEW monthly_stage_counter AS
SELECT
  DATE_TRUNC('month', v.date)::DATE AS period_month,
  TO_CHAR(v.date, 'YYYY-MM') AS period_key,
  u.id AS user_id,
  u.full_name AS user_name,
  v.funnel_stage,
  COUNT(*) AS visit_count
FROM visits v
JOIN users u ON u.id = v.user_id
GROUP BY DATE_TRUNC('month', v.date), TO_CHAR(v.date, 'YYYY-MM'), u.id, u.full_name, v.funnel_stage;

-- ============================================================
-- VISTA: Resumen de empresa
-- ============================================================
CREATE OR REPLACE VIEW company_summary AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  c.commercial_status,
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
GROUP BY c.id, c.name, c.commercial_status, c.zone, c.maps_url, c.notes;
