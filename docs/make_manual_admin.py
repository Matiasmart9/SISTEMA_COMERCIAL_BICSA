# -*- coding: utf-8 -*-
"""
Generador del Manual de Usuario - Perfil Administrador - BICSA V1.3
"""

import os
import subprocess

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(DOCS_DIR, "MANUAL_USUARIO_ADMINISTRADOR_BICSA.html")
PDF_FILE = os.path.join(DOCS_DIR, "MANUAL_USUARIO_ADMINISTRADOR_BICSA.pdf")
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_PATH):
    EDGE_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

HTML_CONTENT = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual de Usuario - Perfil Administrador - BICSA V1.3</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 18mm 18mm 18mm;
      @bottom-left {
        content: "BICSA S.A. | Manual de Usuario - Perfil Administrador V1.3";
        font-size: 8pt;
        color: #94A3B8;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      @bottom-right {
        content: "Página " counter(page);
        font-size: 8pt;
        color: #64748B;
        font-weight: bold;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #1E293B;
      line-height: 1.55;
      font-size: 9.5pt;
      margin: 0;
      padding: 0;
    }
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100vh;
      box-sizing: border-box;
      padding: 20mm 10mm 10mm 10mm;
    }
    .cover-top {
      border-top: 6px solid #FF6000;
      padding-top: 30px;
    }
    .cover-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 26pt;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: -0.02em;
    }
    .cover-brand span.orange { color: #FF6000; }
    .cover-badge {
      display: inline-block;
      margin-top: 15px;
      padding: 6px 14px;
      background: #FFF7ED;
      color: #EA4800;
      border: 1px solid #FFEDD5;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 9pt;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .cover-title {
      font-size: 28pt;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.15;
      margin: 25px 0 10px 0;
    }
    .cover-subtitle {
      font-size: 13pt;
      color: #475569;
      font-weight: 400;
      line-height: 1.4;
      max-width: 600px;
    }
    .cover-meta {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 20px 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 40px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.04em;
    }
    .meta-value {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    .cover-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 14px;
      font-size: 8pt;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }
    
    .toc {
      page-break-after: always;
      padding-top: 10px;
    }
    .toc-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0F172A;
      border-bottom: 2px solid #FF6000;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .toc-list { list-style: none; padding: 0; margin: 0; }
    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px dotted #CBD5E1;
      font-size: 9.5pt;
    }
    .toc-item span.num {
      font-weight: 700;
      color: #FF6000;
      margin-right: 8px;
      width: 20px;
      display: inline-block;
    }
    .toc-item span.name { font-weight: 600; color: #1E293B; flex: 1; }
    .toc-item span.page { font-weight: 700; color: #64748B; }

    h1 {
      font-size: 16pt;
      font-weight: 800;
      color: #0F172A;
      border-left: 5px solid #FF6000;
      padding-left: 10px;
      margin: 26px 0 12px 0;
      page-break-after: avoid;
    }
    h2 {
      font-size: 12pt;
      font-weight: 700;
      color: #1E293B;
      margin: 18px 0 8px 0;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin: 12px 0 6px 0;
      page-break-after: avoid;
    }
    p { margin: 0 0 10px 0; color: #334155; text-align: justify; }
    ul, ol { margin: 0 0 12px 0; padding-left: 22px; color: #334155; }
    li { margin-bottom: 4px; }

    .callout {
      border-radius: 8px;
      padding: 12px 16px;
      margin: 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    .callout-info { background: #EFF6FF; border-left: 4px solid #3B82F6; color: #1E40AF; }
    .callout-warn { background: #FFFBEB; border-left: 4px solid #F59E0B; color: #92400E; }
    .callout-tip { background: #ECFDF5; border-left: 4px solid #10B981; color: #065F46; }
    .callout-bicsa { background: #FFF7ED; border-left: 4px solid #FF6000; color: #9A3412; }
    .callout-title { font-weight: 800; font-size: 9.5pt; margin-bottom: 4px; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }
    th {
      background: #0F172A;
      color: #FFFFFF;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #1E293B;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #E2E8F0;
      color: #334155;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #F8FAFC; }

    .pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pill-green { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
    .pill-orange { background: #FFEDD5; color: #C2410C; border: 1px solid #FED7AA; }
    .pill-blue { background: #DBEAFE; color: #1D4ED8; border: 1px solid #BFDBFE; }
    .pill-red { background: #FEE2E2; color: #B91C1C; border: 1px solid #FECACA; }
    .pill-gray { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }

    .step-card {
      display: flex;
      gap: 12px;
      margin: 12px 0;
      page-break-inside: avoid;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #FF6000;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 10pt;
      flex-shrink: 0;
    }
    .step-body { flex: 1; }
    .step-body strong { color: #0F172A; }

    .page-break { page-break-after: always; }
  </style>
</head>
<body>

  <!-- PORTADA -->
  <div class="cover">
    <div class="cover-top">
      <div class="cover-brand">
        <span>bicsa</span><span class="orange">.</span>
      </div>
      <div class="cover-badge">Manual Operativo de Alta Administración</div>
      <div class="cover-title">Manual de Usuario: Perfil Administrador</div>
      <div class="cover-subtitle">
        Guía integral para el control de usuarios, auditoría y corrección de jornadas, monitoreo en tiempo real, gestión de inversiones por empresa, exportación de reportes a Excel y gobernanza de datos.
      </div>

      <div class="cover-meta">
        <div class="meta-item">
          <span class="meta-label">Perfil de Usuario</span>
          <span class="meta-value">Administrador Global (Admin)</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Versión del Sistema</span>
          <span class="meta-value">Release V1.3</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Alcance de Permisos</span>
          <span class="meta-value">Acceso Total (Operativo, Auditoría y Usuarios)</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Publicación</span>
          <span class="meta-value">Octubre 2026 · BICSA S.A.</span>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>© 2026 BICSA S.A. | Documentación Confidencial de Administración</span>
      <span>Asunción, Paraguay</span>
    </div>
  </div>

  <!-- ÍNDICE -->
  <div class="toc">
    <div class="toc-title">Contenido del Manual</div>
    <ul class="toc-list">
      <li class="toc-item"><span class="num">1.</span><span class="name">Alcance y Responsabilidades del Administrador</span><span class="page">3</span></li>
      <li class="toc-item"><span class="num">2.</span><span class="name">Gestión Integral de Usuarios (Módulo Exclusivo)</span><span class="page">3</span></li>
      <li class="toc-item"><span class="num">3.</span><span class="name">Monitoreo en Tiempo Real: Jornadas en Curso</span><span class="page">6</span></li>
      <li class="toc-item"><span class="num">4.</span><span class="name">Historial Global, Resumen de Cierre y Filtros</span><span class="page">7</span></li>
      <li class="toc-item"><span class="num">5.</span><span class="name">Auditoría, Corrección y Edición de Jornadas Cerradas</span><span class="page">8</span></li>
      <li class="toc-item"><span class="num">6.</span><span class="name">Módulo de Costos e Inversión por Empresa</span><span class="page">9</span></li>
      <li class="toc-item"><span class="num">7.</span><span class="name">Exportación Oficial de Reportes Comerciales en Excel</span><span class="page">10</span></li>
      <li class="toc-item"><span class="num">8.</span><span class="name">Directorio Maestro de Empresas y Normalización</span><span class="page">11</span></li>
      <li class="toc-item"><span class="num">9.</span><span class="name">Políticas de Seguridad y Gobierno de Datos</span><span class="page">12</span></li>
    </ul>
  </div>

  <!-- SECCIÓN 1 -->
  <h1>1. Alcance y Responsabilidades del Administrador</h1>
  <p>
    El <strong>Administrador del Sistema</strong> ostenta el rol de mayor jerarquía operativa y de configuración en BICSA Gestión Comercial. Tiene la potestad exclusiva de crear y gestionar usuarios, reestablecer contraseñas, supervisar en vivo las salidas de todo el equipo comercial, auditar y corregir jornadas cerradas, controlar los gastos de movilidad y exportar los libros contables consolidados.
  </p>

  <div class="callout callout-bicsa">
    <div class="callout-title">Diferencia Clave con el Perfil Gerente Comercial</div>
    El perfil <strong>Administrador</strong> es el <strong>único autorizado</strong> para acceder al módulo de <strong>Usuarios</strong>. El Gerente Comercial cuenta con todas las herramientas de visualización, auditoría, KPIs y exportación, pero no tiene acceso a la administración ni modificación de cuentas de usuarios.
  </div>

  <!-- SECCIÓN 2 -->
  <h1>2. Gestión Integral de Usuarios (Módulo Exclusivo)</h1>
  <p>
    Al ingresar al menú lateral <strong>"Usuarios"</strong> (<code class="inline">/usuarios</code>), el Administrador accede al panel central de colaboradores del sistema.
  </p>

  <h2>2.1. Alta de un Nuevo Usuario</h2>
  <div class="step-card">
    <div class="step-num">1</div>
    <div class="step-body">
      Pulsa el botón superior <strong>"+ Nuevo Usuario"</strong>. Se desplegará el modal de registro.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>Nombre y Apellido:</strong> Ingresa el nombre completo del colaborador (ej. <em>Daisy Ozorio</em>).
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">3</div>
    <div class="step-body">
      <strong>Correo Electrónico:</strong> Ingresa el correo corporativo (ej. <em>daisy.ozorio@bicsa.com.py</em>). Este será su usuario de acceso.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">4</div>
    <div class="step-body">
      <strong>Contraseña Inicial:</strong> Define una contraseña segura temporal que el usuario utilizará en su primer acceso.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">5</div>
    <div class="step-body">
      <strong>Asignación de Rol:</strong>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Rol</th>
            <th>Nivel de Acceso</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="pill pill-blue">Ejecutivo</span></td>
            <td>Registra sus propias jornadas, visitas en calle, historial personal y directorio de empresas.</td>
          </tr>
          <tr>
            <td><span class="pill pill-orange">Gerente</span></td>
            <td>Supervisa a todo el equipo, monitorea jornadas en vivo, analiza KPIs, costos y exporta a Excel. No administra usuarios.</td>
          </tr>
          <tr>
            <td><span class="pill pill-red">Administrador</span></td>
            <td>Control total: gestión de usuarios, reseteo de claves, auditoría de jornadas y configuración global.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">6</div>
    <div class="step-body">
      <strong>Foto de Odómetro Obligatoria:</strong> Activa este switch si deseas exigirle al colaborador que capture la fotografía del velocímetro del vehículo al iniciar y finalizar la jornada con movilidad propia.
    </div>
  </div>

  <div class="page-break"></div>

  <h2>2.2. Bloqueo, Desactivación y Reactivación de Cuentas</h2>
  <p>
    Cuando un colaborador deja de pertenecer a la empresa o entra en período de licencia, <strong>nunca se debe eliminar su usuario de la base de datos</strong>, ya que esto rompería la integridad de las visitas y contratos históricos asociados. En su lugar, el sistema provee el mecanismo de <em>Desactivación / Bloqueo</em>:
  </p>
  <ul>
    <li>Al desactivar un usuario, su estado pasa a <span class="pill pill-red">Inactivo</span> y sus credenciales quedan inmediatamente revocadas.</li>
    <li>Todo su historial de jornadas, kilometrajes, reuniones pasadas y estadísticas de ventas se mantienen 100% intactos y auditables en los reportes de la empresa.</li>
    <li>Si el colaborador se reincorpora, el Administrador puede pulsar <strong>"Reactivar"</strong> con un solo clic.</li>
  </ul>

  <h2>2.3. Reestablecimiento de Contraseñas Olvidadas</h2>
  <p>
    Si un ejecutivo o gerente olvida su contraseña, el Administrador puede generar una nueva clave de acceso de manera instantánea:
  </p>
  <div class="step-card">
    <div class="step-num">1</div>
    <div class="step-body">
      En la lista de usuarios, localice al colaborador mediante el buscador rápido.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">2</div>
    <div class="step-body">
      Haga clic en el botón de edición (ícono de lápiz) o <strong>"Reset Clave"</strong>.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">3</div>
    <div class="step-body">
      Escriba la nueva contraseña temporal y presione <strong>"Guardar"</strong>. El hash criptográfico se actualizará de inmediato en PostgreSQL.
    </div>
  </div>

  <h2>2.4. Auditoría de Conexiones</h2>
  <p>
    La tabla de usuarios muestra la columna <strong>"Último Acceso"</strong>, la cual registra la fecha y hora exacta (<code class="inline">last_login_at</code>) en la que el usuario inició sesión por última vez, facilitando la detección de cuentas inactivas.
  </p>

  <!-- SECCIÓN 3 -->
  <h1>3. Monitoreo en Tiempo Real: Jornadas en Curso</h1>
  <p>
    En el menú <strong>"Jornada en Curso"</strong> (<code class="inline">/jornada-en-curso</code>), el Administrador cuenta con una pantalla de monitoreo en vivo del personal desplegado en calle:
  </p>
  <ul>
    <li><strong>Quiénes están en la calle:</strong> Lista de ejecutivos con jornada actualmente abierta en la fecha de hoy.</li>
    <li><strong>Medio de Movilidad:</strong> Si se desplazan en vehículo propio (con su odómetro inicial) o mediante plataformas de transporte (Bolt, Uber, Taxi).</li>
    <li><strong>Hora de Apertura:</strong> Momento exacto en que inició la jornada comercial.</li>
    <li><strong>Visitas en Tiempo Real:</strong> Cantidad de reuniones que el ejecutivo ya cargó durante el transcurso del día.</li>
  </ul>

  <div class="page-break"></div>

  <!-- SECCIÓN 4 -->
  <h1>4. Historial Global, Resumen de Cierre y Filtros</h1>
  <p>
    El módulo <strong>"Historial"</strong> (<code class="inline">/historial</code>) consolida la memoria operativa de BICSA con capacidades de filtrado de alto rendimiento:
  </p>

  <h2>4.1. Barra de Filtros Compacta</h2>
  <ul>
    <li><strong>Año:</strong> Selector compacto que arranca en 2026 y avanzará dinámicamente con los años.</li>
    <li><strong>Mes:</strong> Opciones mensuales y la opción <strong><code>-- Todos --</code></strong> para balances anuales completos.</li>
    <li><strong>Fecha (Día):</strong> Permite acotar el análisis a un día específico (ej. <em>23</em>) o ver <strong><code>-- Todos --</code></strong> los días del mes. Se ajusta automáticamente a 28, 29, 30 o 31 días según el calendario.</li>
    <li><strong>Ejecutivo/a:</strong> Selector con ancho optimizado para filtrar por un asesor puntual o seleccionar <em>"Todos los ejecutivos"</em> para consolidar al equipo completo.</li>
    <li><strong>Filtros Adicionales en Visitas:</strong> Al cambiar a la pestaña <em>"Detalle de Visitas"</em>, se habilitan los filtros por <em>Etapa del Embudo</em> (ej. Negociación, Contrato) y <em>Resultado Comercial</em> (ej. Contratado, Propuesta enviada).</li>
    <li><strong>Botón "Limpiar filtros":</strong> Restablece inmediatamente todos los criterios.</li>
  </ul>

  <h2>4.2. Tarjetas de Métricas de Resumen de Cierre</h2>
  <p>
    Las tarjetas superiores presentan los 5 indicadores clave del período, calculados en tiempo real por la base de datos con tipografía centrada y balance visual:
  </p>
  <table>
    <thead>
      <tr>
        <th>Métrica</th>
        <th>Concepto Auditado</th>
        <th>Utilidad de Negocio</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>JORNADAS</strong></td>
        <td>Días de salida registrados en el período</td>
        <td>Mide la regularidad y disciplina de salidas a terreno del equipo.</td>
      </tr>
      <tr>
        <td><strong>KM RECORRIDOS</strong></td>
        <td>Suma de odómetros finales menos iniciales</td>
        <td>Base para el cálculo de desgaste y control de rutas comerciales.</td>
      </tr>
      <tr>
        <td><strong>TOTAL VISITAS</strong></td>
        <td>Cantidad de reuniones realizadas</td>
        <td>Volumen de actividad y contacto corporativo.</td>
      </tr>
      <tr>
        <td><strong>EMPRESAS DISTINTAS</strong></td>
        <td>Cuentas únicas contactadas</td>
        <td>Diversificación de cartera vs reiteración sobre los mismos clientes.</td>
      </tr>
      <tr>
        <td><strong>CONTRATACIONES</strong></td>
        <td>Contratos y suscripciones cerradas</td>
        <td>Efectividad de conversión comercial y nuevos ingresos para BICSA.</td>
      </tr>
    </tbody>
  </table>

  <!-- SECCIÓN 5 -->
  <h1>5. Auditoría, Corrección y Edición de Jornadas Cerradas</h1>
  <p>
    Uno de los mayores desafíos en la gestión comercial son los errores humanos involuntarios (un ejecutivo anotó mal un dígito del odómetro o olvidó registrar una reunión antes de cerrar la jornada). Para resolver esto sin comprometer la seguridad contable, el Administrador dispone de la <strong>Edición Auditada Inmutable</strong>:
  </p>

  <div class="step-card">
    <div class="step-num">1</div>
    <div class="step-body">
      <strong>Botón "Editar" en Jornada:</strong> En cualquier jornada cerrada de la lista, presione <strong>"Editar"</strong>. Se abrirá el modal de corrección administrativa.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>Campos Modificables:</strong>
      <ul>
        <li>Odómetro inicial y final (el sistema recalcula automáticamente los KM).</li>
        <li>Carga de combustible y gastos extras.</li>
        <li><strong>Anexo de Visitas Olvidadas:</strong> Se pueden incorporar las visitas omitidas con su respectiva empresa, ciudad, etapa del embudo y costo de traslado.</li>
      </ul>
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">3</div>
    <div class="step-body">
      <strong>Motivo de Auditoría Obligatorio:</strong> El Administrador <strong>debe escribir obligatoriamente el motivo de la corrección</strong> (ej. <em>"Corrección de odómetro final por error de tipografía del ejecutivo según foto adjunta"</em>). Sin este campo, el sistema no permite guardar.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">4</div>
    <div class="step-body">
      <strong>Registro Inmutable en audit_log:</strong> El sistema guarda los cambios en la jornada y genera un registro histórico que almacena el usuario administrador que hizo el cambio, la fecha y hora exacta, el motivo y el estado previo.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">5</div>
    <div class="step-body">
      <strong>Botón "Auditoría":</strong> Al presionar <strong>"Auditoría"</strong> en cualquier jornada que haya sufrido modificaciones, se desplegará el historial cronológico completo de cambios para inspección directiva.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECCIÓN 6 -->
  <h1>6. Módulo de Costos e Inversión por Empresa</h1>
  <p>
    En <strong>"Costos Empresa"</strong> (<code class="inline">/inversion-empresas</code>), el Administrador visualiza cuánto le cuesta a BICSA comercializar con cada cliente o prospecto:
  </p>
  <ul>
    <li><strong>Prorrateo de Combustible:</strong> Distribuye matemáticamente el combustible de cada jornada entre las empresas visitadas en ese día.</li>
    <li><strong>Costos de Plataformas:</strong> Asigna los importes de Bolt, Uber y Taxi directamente a la empresa correspondiente.</li>
    <li><strong>Gastos Extras:</strong> Computa almuerzos ejecutivos, peajes y viáticos asociados a cada cuenta.</li>
    <li><strong>Costo de Adquisición (CAC):</strong> Permite contrastar cuánto se invirtió en una empresa frente a si se logró el contrato o sigue en negociación.</li>
    <li><strong>Exportación a Excel:</strong> Botón <em>"Descargar Reporte Excel"</em> para emitir el detalle de costos del mes seleccionado.</li>
  </ul>

  <!-- SECCIÓN 7 -->
  <h1>7. Exportación Oficial de Reportes Comerciales en Excel</h1>
  <p>
    En el menú <strong>"Exportar"</strong> (<code class="inline">/exportacion</code>), el Administrador puede generar en segundos los libros oficiales de Excel requeridos por gerencia general y contabilidad:
  </p>
  <ul>
    <li><strong>Configuración de Filtros:</strong> Seleccione el Año, el Mes (o <em>"Todo el año"</em>) y el Ejecutivo (o <em>"Todos los ejecutivos (consolidado)"</em>).</li>
    <li><strong>Estructura del Libro Oficial (.xlsx):</strong>
      <ol>
        <li><strong>Hoja de Resumen:</strong> Cabecera institucional BICSA, parámetros de exportación y tarjetas consolidadas de KPIs.</li>
        <li><strong>Hoja de Jornadas:</strong> Tabla detallada con fecha, ejecutivo, medio de movilidad, odómetro inicial, final, km recorridos, fotos, combustible, viajes en plataforma y estado.</li>
        <li><strong>Hoja de Visitas:</strong> Registro exhaustivo de cada reunión: empresa, departamento, ciudad, etapa del embudo, resultado comercial, notas del cliente y costos asignados.</li>
      </ol>
    </li>
  </ul>

  <!-- SECCIÓN 8 -->
  <h1>8. Directorio Maestro de Empresas y Normalización</h1>
  <p>
    En <strong>"Empresas"</strong> (<code class="inline">/empresas</code>), el Administrador gestiona la base de datos de clientes:
  </p>
  <ul>
    <li><strong>Búsqueda Ágil:</strong> Cuadro compacto <em>"Buscar empresa"</em>.</li>
    <li><strong>Agregar Empresa:</strong> Botón <em>"+ Agregar Empresa"</em> para cargar cuentas de manera anticipada.</li>
    <li><strong>Normalización Anti-Duplicados:</strong> El sistema procesa los nombres de empresas en minúsculas y sin espacios superfluos, impidiendo que se creen duplicados como <em>"Casa Paraná"</em> y <em>"casa parana"</em>.</li>
  </ul>

  <!-- SECCIÓN 9 -->
  <h1>9. Políticas de Seguridad y Gobierno de Datos</h1>
  <ul>
    <li><strong>Auto-Cierre a Medianoche:</strong> Todos los días a las 00:00:00 se cierran automáticamente las sesiones activas en navegadores y smartphones.</li>
    <li><strong>Cierre de Jornadas Diarias:</strong> Instar a los ejecutivos a no dejar jornadas abiertas durante la noche.</li>
    <li><strong>Custodia de Contraseñas:</strong> Utilice contraseñas complejas (mínimo 8 caracteres alfanuméricos con mayúsculas y símbolos) para los roles de Administrador.</li>
  </ul>

  <div class="callout callout-tip" style="margin-top: 25px;">
    <div class="callout-title">Garantía de Auditoría Institucional</div>
    El sistema BICSA Gestión Comercial V1.3 cumple con las mejores prácticas de gobernanza corporativa, garantizando que cada registro cuente con responsable, fecha y trazabilidad inviolable.
  </div>

</body>
</html>
"""

def generate_pdf():
    print("Escribiendo archivo HTML del Manual de Administrador...")
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)
    print(f"HTML generado en: {HTML_FILE}")

    print("Compilando HTML a PDF profesional con Microsoft Edge...")
    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={PDF_FILE}",
        HTML_FILE
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(PDF_FILE):
        size_kb = os.path.getsize(PDF_FILE) / 1024
        print(f"Éxito: {PDF_FILE} generado ({size_kb:.1f} KB)")
    else:
        print("Error: No se pudo generar el archivo PDF.")

if __name__ == "__main__":
    generate_pdf()
