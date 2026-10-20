# BICSA — Sistema de Gestión de Visitas Comerciales

Sistema web responsive y PWA (instalable en Android / APK / iOS) para la gestión, auditoría y seguimiento de salidas comerciales, control de kilometraje de vehículos y visitas a empresas para **BICSA** (Burós de Información Comercial S.A. - Paraguay).

---

## 🚀 Arquitectura Tecnológica

El sistema se ejecuta completamente contenedorizado mediante **Docker Compose**:

- **Base de Datos:** PostgreSQL 16 con vistas analíticas de contador mensual y resúmenes de empresa.
- **Backend:** Node.js 20 + TypeScript + Express + JWT + bcrypt + ExcelJS (generación nativa de hojas de cálculo).
- **Frontend:** React 18 + Vite + TypeScript + React Router + Lucide Icons + PWA (`vite-plugin-pwa`).
- **Reverse Proxy / Web Server:** Nginx 1.25 gestionando routing y compresión.

---

## 👥 Usuarios y Credenciales Demo

El sistema inicializa automáticamente los usuarios de demostración con sus roles y permisos:

| Rol | Correo Electrónico | Contraseña por Defecto | Nombre |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `matiasmart7@gmail.com` | `Adm1m+789` | Administrador BICSA |
| **Gerente Comercial** | `gerente.comercial@bicsa.com.py` | `Bicsa123!` | Gerente Comercial |
| **Ejecutiva** | `daisy.ozorio@bicsa.com.py` | `Bicsa123!` | Daisy Ozorio |
| **Ejecutiva** | `jacqueline.aguilera@bicsa.com.py` | `Bicsa123!` | Jacqueline Aguilera |

---

## 🛠️ Puesta en Marcha Rápida (Docker)

### 1. Clonar y verificar variables de entorno
Asegúrese de contar con el archivo `.env` configurado (tome de referencia `.env.example`).

### 2. Construir e iniciar contenedores
En la raíz del proyecto (`c:\SISTEMA_COMERCIAL_BICSA`):

```bash
docker compose up -d --build
```

### 3. Acceso a la aplicación
- **Web App / PWA:** [http://localhost](http://localhost) (o puerto 80)
- **API Backend directa:** [http://localhost:3001/api](http://localhost:3001/api)
- **Base de Datos PostgreSQL:** `localhost:5432` (usuario: `bicsa_user`, bd: `bicsa_comercial`)

### 4. Ver logs en tiempo real
```bash
docker compose logs -f backend
```

---

## 📱 Instalación como APK / App Móvil (PWA)

1. Ingrese a la URL desde el navegador móvil (ej. Chrome en Android).
2. Toque el menú de opciones (tres puntos) o el aviso inferior emergente.
3. Seleccione **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
4. La aplicación funcionará a pantalla completa como una app nativa, con icono institucional BICSA y soporte offline con Service Worker.

---

## 📊 Módulos Principales

1. **Tablero de Control (Dashboard):**
   - Selector dinámico de período mensual.
   - KPIs de jornadas, km recorridos, visitas totales, cuentas alcanzadas y contrataciones.
   - Tabla pivot interactiva de avance por etapas de embudo vs. ejecutivo.

2. **Registro de Jornada Comercial:**
   - Carga de odómetro inicial y final con cálculo automático de km.
   - Carga dinámica de visitas con autocompletado en tiempo real de empresas.
   - Clasificación por etapa de embudo, resultado y referencias de movilidad (Uber/Bolt).

3. **Historial de Jornadas y Visitas:**
   - Vista por jornadas diarias con odómetro y botón de inspección modal.
   - Vista desglosada de visitas con filtros por rango de fecha, ejecutivo y resultado.

4. **Directorio y Expediente de Empresas:**
   - Directorio de cuentas con estado comercial.
   - Expediente histórico de visitas y reuniones por empresa.
   - Modificación de estado comercial (exclusivo gerencia/administración).

5. **Exportación Oficial Excel (.xlsx):**
   - Descarga de libro de 6 pestañas con encabezados naranjas BICSA:
     1. Resumen Ejecutivo
     2. Jornadas
     3. Detalle Visitas
     4. Contador Mensual
     5. Resumen Empresa
     6. Combustible (Administración)

6. **Gestión de Usuarios y Accesos:**
   - Alta de usuarios con validación de contraseña robusta.
   - Asignación de roles (`ejecutivo`, `gerente`, `admin`).
   - Activación/desactivación auditada y reseteo de claves.
