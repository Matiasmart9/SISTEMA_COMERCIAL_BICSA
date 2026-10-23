# Sistema Comercial BICSA — Memoria de Proyecto y Contexto Operativo

Este documento contiene las directrices arquitectónicas, decisiones de diseño, reglas de negocio y procedimientos de despliegue para el mantenimiento y evolución continua del **Sistema de Gestión Comercial BICSA**.

---

## 1. Información General del Proyecto
- **Nombre:** Sistema de Gestión Comercial BICSA
- **Versión Actual:** Release V1.3
- **Repositorio Git:** `https://github.com/Matiasmart9/SISTEMA_COMERCIAL_BICSA.git` (Rama: `main`)
- **Propósito:** Registro, supervisión, costeo y auditoría de salidas comerciales, kilometraje con odómetro vehicular, traslados en plataformas (Bolt, Uber, MUV, Taxi), gastos de combustible y viáticos, embudo de ventas y cartera de empresas.

---

## 2. Arquitectura de Despliegue en Producción (Oracle Cloud)
- **Servidor:** Instancia de Cómputo Ubuntu Linux en **Oracle Cloud Infrastructure (OCI)**.
- **Topología de Contenedores Docker:**
  1. `bicsa_comercial_postgres` (PostgreSQL 16 Alpine, puerto host `5434 -> 5432`, volumen `postgres_data`).
  2. `bicsa_comercial_backend` (Node.js 20 LTS, Express, TypeScript, puerto interno `3001`).
  3. `bicsa_comercial_frontend` (React 18, Vite 5, PWA, puerto interno `4173`).
  4. `bicsa_comercial_nginx` (Proxy Inverso Nginx Alpine, puerto host `8088 -> 80`).
- **Redes Docker:** `bicsa_net` (interna aislada) y `coolify` (red de proxy externa).
- **Comandos oficiales para actualizar cambios en el servidor Oracle Cloud:**
  ```bash
  cd ~/SISTEMA_COMERCIAL_BICSA
  git pull origin main
  docker compose build frontend
  docker compose up -d --force-recreate frontend
  docker compose restart nginx
  ```

---

## 3. Decisiones Críticas de UI/UX y Estilos
- **Cero Emojis:** Nunca usar emojis en textos, botones o estados. Emplear íconos Lucide o SVGs vectoriales.
- **Paleta de Colores:**
  - Naranja primario: `#FF6000` (gradientes `#FF6000` a `#EA4800`)
  - Fondo sutil: `#F8FAFC`, superficie `#FFFFFF`
  - Textos: `#0F172A` (títulos), `#334155` (cuerpo), `#64748B` / `#94A3B8` (secundarios)
  - Éxito / Contrataciones: `#16A34A` / `#F0FDF4`
- **Íconos de Movilidad (`frontend/src/components/MobilityIcons.tsx`):**
  - **Movilidad Propia:** `CarFrontCustomIcon` — silueta frontal de automóvil deportivo (parabrisas, faros angulares, placa y espejos).
  - **Plataformas de Transporte:** `GoogleMapsPinCustomIcon` — pin oficial de Google Maps con los 4 colores (`#EA4335`, `#4285F4`, `#34A853`, `#FBBC04`) y centro blanco, montado sobre tarjeta `.is-maps` de fondo blanco puro.
- **Buscador de Empresas (`frontend/src/pages/Empresas.tsx`):**
  - Placeholder exacto: `"Buscar empresa"`.
  - Ancho compacto (máximo `320px`), evitando campos estirados.
- **Filtros de Historial (`frontend/src/pages/Historial.tsx`):**
  - Barra compacta: Año (110px), Mes (155px con opción `-- Todos --`), Fecha (115px con `-- Todos --` y cálculo dinámico de 28 a 31 días según mes/año), Ejecutivo/a (220px, sin estiramientos excesivos) y botón Limpiar filtros alineado.
  - **Resumen de Cierre:** Tarjetas de KPIs con todos sus datos completamente centrados (ícono, etiqueta, cifra en grande y descripción).
- **Selector de Años en Filtros (`Exportacion.tsx`, `InversionEmpresas.tsx`):**
  - Año de inicio del sistema: `startYear = 2026`.
  - No mostrar 2024 ni 2025. En 2026 solo muestra `2026`, en 2027 mostrará `[2027, 2026]`, etc.

---

## 4. Reglas de Negocio y Seguridad
1. **Auto-cierre de sesión a Medianoche (`AuthContext.tsx`):**
   - Todas las sesiones se cierran automáticamente al llegar las `00:00:01` de cada noche, forzando un nuevo login al día siguiente y garantizando la coherencia diaria.
2. **Una sola jornada por usuario y día:**
   - No se permiten jornadas concurrentes abiertas para el mismo usuario.
3. **Matriz de Roles:**
   - `ejecutivo`: Registro de salidas, visitas en calle, historial propio y directorio de empresas.
   - `gerente`: Supervisión de salidas en vivo, historial global de todo el equipo, KPIs consolidados, costos por empresa y exportación a Excel. **NO tiene acceso al módulo de Usuarios**.
   - `admin`: Superusuario con acceso total + **acceso exclusivo a Gestión de Usuarios** (`/usuarios`) para crear cuentas, cambiar contraseñas y activar la obligatoriedad de fotos de odómetro.
4. **Auditoría Inmutable de Jornadas (`audit_log`):**
   - Cualquier edición de jornada cerrada por parte del Administrador exige escribir una justificación obligatoria que queda registrada de forma permanente para consultas de auditoría.

---

## 5. Documentación Oficial en PDF
Los 4 manuales institucionales están en `c:\SISTEMA_COMERCIAL_BICSA\docs\`:
- `MANUAL_TECNICO_SISTEMA_BICSA.pdf` (Arquitectura, Docker, PostgreSQL, Oracle Cloud, DNS, SSL y Backups)
- `MANUAL_USUARIO_EJECUTIVO_BICSA.pdf` (Guía paso a paso de uso operativo y PWA móvil)
- `MANUAL_USUARIO_ADMINISTRADOR_BICSA.pdf` (Gestión de usuarios, auditoría, corrección de jornadas y costos)
- `MANUAL_USUARIO_GERENTE_COMERCIAL_BICSA.pdf` (Supervisión comercial, embudo de ventas, rentabilidad y reportes)
- Script maestro de compilación: `python docs/build_all_manuals.py`
