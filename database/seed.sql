-- ============================================================
-- BICSA Sistema Comercial — Datos de demostración
-- Septiembre y Octubre 2026 (datos ficticios)
-- ============================================================

-- Superadmin (contraseña: Adm1m+789 — hasheada con bcrypt rounds=12)
-- NOTA: El backend reemplaza este hash al inicializar si detecta el usuario ya existe
INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'matiasmart7@gmail.com',
   '$2b$12$placeholder_will_be_replaced_by_seeder',
   'Administrador BICSA',
   'admin',
   TRUE)
ON CONFLICT (email) DO NOTHING;

-- Ejecutivas demo
INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_by) VALUES
  ('00000000-0000-0000-0000-000000000002',
   'daisy.ozorio@bicsa.com.py',
   '$2b$12$placeholder_daisy',
   'Daisy Ozorio',
   'ejecutivo',
   TRUE,
   '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003',
   'jacqueline.aguilera@bicsa.com.py',
   '$2b$12$placeholder_jacqueline',
   'Jacqueline Aguilera',
   'ejecutivo',
   TRUE,
   '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004',
   'luis.reyes@bicsa.com.py',
   '$2b$12$placeholder_gerente',
   'Luis Reyes',
   'gerente',
   TRUE,
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO NOTHING;

-- Empresas demo
INSERT INTO companies (id, name, normalized_name, commercial_status, created_by) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Comercial Horizonte S.A.', 'comercial horizonte s.a.', 'En negociación', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000002', 'Distribuidora Central SRL', 'distribuidora central srl', 'Contratado', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000003', 'Servicios Ñandutí S.A.', 'servicios ñandutí s.a.', 'En negociación', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000004', 'Electrodomésticos del Este S.A.', 'electrodomésticos del este s.a.', 'En negociación', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000005', 'Logística Guaraní SRL', 'logística guaraní srl', 'Contratado', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000006', 'Grupo Mercado Sur S.A.', 'grupo mercado sur s.a.', 'En negociación', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000007', 'Soluciones Integrales PY', 'soluciones integrales py', 'Contratado', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000008', 'Ferretería Tres Ciudades', 'ferretería tres ciudades', 'En negociación', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000009', 'Tecnología Atlas SRL', 'tecnología atlas srl', 'Prospecto', '00000000-0000-0000-0000-000000000001'),
  ('c0000001-0000-0000-0000-000000000010', 'Comercial San Jorge', 'comercial san jorge', 'Prospecto', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (normalized_name) DO NOTHING;

-- Jornadas - Octubre 2026 - Daisy (u2)
INSERT INTO work_days (id, user_id, date, km_start, km_end) VALUES
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '2026-10-05', 42310, 42382),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '2026-10-07', 42405, 42458),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '2026-10-09', 42490, 42557),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '2026-10-13', 42610, 42678)
ON CONFLICT DO NOTHING;

-- Jornadas - Octubre 2026 - Jacqueline (u3)
INSERT INTO work_days (id, user_id, date, km_start, km_end) VALUES
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '2026-10-06', 35800, 35861),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '2026-10-08', 35890, 35945),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', '2026-10-12', 35980, 36054),
  ('d0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', '2026-10-14', 36090, 36147)
ON CONFLICT DO NOTHING;

-- Jornadas - Septiembre 2026 - Daisy
INSERT INTO work_days (id, user_id, date, km_start, km_end) VALUES
  ('d0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', '2026-09-17', 41900, 41948),
  ('d0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', '2026-09-22', 42020, 42077)
ON CONFLICT DO NOTHING;

-- Jornadas - Septiembre 2026 - Jacqueline
INSERT INTO work_days (id, user_id, date, km_start, km_end) VALUES
  ('d0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', '2026-09-18', 35220, 35286),
  ('d0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', '2026-09-25', 35400, 35459)
ON CONFLICT DO NOTHING;

-- Visitas Octubre - Daisy
INSERT INTO visits (work_day_id, user_id, company_id, date, visit_type, zone, reason, funnel_stage, result, uber_ref_gs, notes) VALUES
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', '2026-10-05', 'Nueva visita', 'San Lorenzo', 'Prospección', 'Prospección', 'Pendiente', 18000, 'Primer contacto, interés moderado'),
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', '2026-10-05', 'Prospecto en seguimiento', 'San Lorenzo', 'Presentación de servicios', 'Contacto con decisor', 'Propuesta enviada', NULL, 'Se presentó propuesta inicial'),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000003', '2026-10-07', 'Nueva visita', 'Asunción', 'Prospección', 'Prospección', 'Pendiente', 25000, 'Reunión con encargado'),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000006', '2026-10-07', 'Prospecto en seguimiento', 'Asunción', 'Negociación', 'Negociación', 'En negociación', NULL, 'Negociando condiciones'),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000004', '2026-10-09', 'Nueva visita', 'Luque', 'Presentación de servicios', 'Contacto con decisor', 'Propuesta enviada', 36000, 'Propuesta enviada post visita'),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', '2026-10-09', 'Prospecto en seguimiento', 'San Lorenzo', 'Seguimiento comercial', 'Negociación', 'En negociación', NULL, 'Segunda visita, avanzando'),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', '2026-10-13', 'Prospecto en seguimiento', 'San Lorenzo', 'Negociación', 'Contrato', 'Contratado', 44000, 'Contrato firmado'),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000009', '2026-10-13', 'Nueva visita', 'Asunción', 'Prospección', 'Prospección', 'Pendiente', NULL, 'Primer acercamiento');

-- Visitas Octubre - Jacqueline
INSERT INTO visits (work_day_id, user_id, company_id, date, visit_type, zone, reason, funnel_stage, result, uber_ref_gs, notes) VALUES
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000005', '2026-10-06', 'Nueva visita', 'Luque', 'Prospección', 'Prospección', 'Pendiente', 16000, 'Registro ficticio para demostración'),
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000007', '2026-10-06', 'Prospecto en seguimiento', 'Luque', 'Seguimiento comercial', 'Contacto con decisor', 'Propuesta enviada', NULL, 'Segunda reunión con decisor'),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000008', '2026-10-08', 'Nueva visita', 'Asunción', 'Presentación de servicios', 'Prospección', 'Pendiente', 23000, 'Primer contacto favorable'),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000010', '2026-10-08', 'Prospecto en seguimiento', 'Asunción', 'Negociación', 'Negociación', 'En negociación', NULL, 'En negociación de precios'),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000005', '2026-10-12', 'Prospecto en seguimiento', 'Luque', 'Presentación de servicios', 'Contacto con decisor', 'En negociación', 33000, 'Avanzando en cierre'),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000003', '2026-10-12', 'Prospecto en seguimiento', 'Asunción', 'Seguimiento comercial', 'Contacto con decisor', 'Propuesta enviada', NULL, 'Enviada propuesta revisada'),
  ('d0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000007', '2026-10-14', 'Prospecto en seguimiento', 'Luque', 'Negociación', 'Contrato', 'Contratado', 41000, 'Contrato cerrado exitosamente'),
  ('d0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000008', '2026-10-14', 'Prospecto en seguimiento', 'Asunción', 'Seguimiento comercial', 'Negociación', 'En negociación', NULL, 'Pendiente respuesta de dirección');

-- Visitas Septiembre - Daisy
INSERT INTO visits (work_day_id, user_id, company_id, date, visit_type, zone, reason, funnel_stage, result, notes) VALUES
  ('d0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', '2026-09-17', 'Nueva visita', 'San Lorenzo', 'Prospección', 'Prospección', 'Pendiente', 'Registro ficticio septiembre'),
  ('d0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000003', '2026-09-17', 'Prospecto en seguimiento', 'Asunción', 'Seguimiento comercial', 'Contacto con decisor', 'Propuesta enviada', 'Segunda reunión septiembre'),
  ('d0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000004', '2026-09-22', 'Prospecto en seguimiento', 'Luque', 'Negociación', 'Negociación', 'En negociación', 'Negociando septiembre'),
  ('d0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000009', '2026-09-22', 'Nueva visita', 'Asunción', 'Prospección', 'Prospección', 'Pendiente', 'Primera visita septiembre');

-- Visitas Septiembre - Jacqueline
INSERT INTO visits (work_day_id, user_id, company_id, date, visit_type, zone, reason, funnel_stage, result, notes) VALUES
  ('d0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000005', '2026-09-18', 'Nueva visita', 'Luque', 'Prospección', 'Prospección', 'Pendiente', 'Inicio gestión septiembre'),
  ('d0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000006', '2026-09-18', 'Prospecto en seguimiento', 'Asunción', 'Presentación de servicios', 'Contacto con decisor', 'Propuesta enviada', 'Presentación septiembre'),
  ('d0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000008', '2026-09-25', 'Prospecto en seguimiento', 'Asunción', 'Negociación', 'Negociación', 'En negociación', 'Avanzando negociación septiembre'),
  ('d0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000010', '2026-09-25', 'Nueva visita', 'San Lorenzo', 'Prospección', 'Prospección', 'Pendiente', 'Nuevo cliente potencial septiembre');
