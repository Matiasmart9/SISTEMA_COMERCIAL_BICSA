# -*- coding: utf-8 -*-
"""
Generador del Manual de Usuario - Perfil Gerente Comercial - BICSA V1.3
"""

import os
import subprocess

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(DOCS_DIR, "MANUAL_USUARIO_GERENTE_COMERCIAL_BICSA.html")
PDF_FILE = os.path.join(DOCS_DIR, "MANUAL_USUARIO_GERENTE_COMERCIAL_BICSA.pdf")
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_PATH):
    EDGE_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

HTML_CONTENT = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual de Usuario - Perfil Gerente Comercial - BICSA V1.3</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 18mm 18mm 18mm;
      @bottom-left {
        content: "BICSA S.A. | Manual de Usuario - Perfil Gerente Comercial V1.3";
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

    .card-kpi-preview {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
      display: inline-block;
      width: 140px;
      margin: 4px;
    }
    .kpi-title { font-size: 7pt; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .kpi-value { font-size: 14pt; font-weight: 800; color: #FF6000; margin: 4px 0; }
    .kpi-sub { font-size: 6.5pt; color: #94A3B8; }

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
      <div class="cover-badge">Manual Operativo de Liderazgo Comercial</div>
      <div class="cover-title">Manual de Usuario: Perfil Gerente Comercial</div>
      <div class="cover-subtitle">
        Guía directiva para el monitoreo de fuerza de ventas en tiempo real, análisis del embudo de conversión, evaluación de costos e inversión por empresa, supervisión de KPIs y generación de libros ejecutivos en Excel.
      </div>

      <div class="cover-meta">
        <div class="meta-item">
          <span class="meta-label">Perfil de Usuario</span>
          <span class="meta-value">Gerente Comercial (Gerencia)</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Versión del Sistema</span>
          <span class="meta-value">Release V1.3</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Enfoque Operativo</span>
          <span class="meta-value">Supervisión, Métricas, Costos y Exportación</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Publicación</span>
          <span class="meta-value">Octubre 2026 · BICSA S.A.</span>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>© 2026 BICSA S.A. | Documento Confidencial de Gerencia</span>
      <span>Asunción, Paraguay</span>
    </div>
  </div>

  <!-- ÍNDICE -->
  <div class="toc">
    <div class="toc-title">Contenido del Manual</div>
    <ul class="toc-list">
      <li class="toc-item"><span class="num">1.</span><span class="name">Propósito del Rol de Gerente Comercial</span><span class="page">3</span></li>
      <li class="toc-item"><span class="num">2.</span><span class="name">Matriz de Permisos: Diferenciación con el Administrador</span><span class="page">3</span></li>
      <li class="toc-item"><span class="num">3.</span><span class="name">Monitoreo de Salidas en Tiempo Real (Jornada en Curso)</span><span class="page">5</span></li>
      <li class="toc-item"><span class="num">4.</span><span class="name">Análisis de Desempeño Comercial en Historial Global</span><span class="page">6</span></li>
      <li class="toc-item"><span class="num">5.</span><span class="name">Supervisión del Embudo de Ventas y Resultados de Visitas</span><span class="page">8</span></li>
      <li class="toc-item"><span class="num">6.</span><span class="name">Evaluación de Inversión Financiera y Rentabilidad por Empresa</span><span class="page">9</span></li>
      <li class="toc-item"><span class="num">7.</span><span class="name">Generación y Descarga de Libros Oficiales de Excel</span><span class="page">10</span></li>
      <li class="toc-item"><span class="num">8.</span><span class="name">Directorio de Empresas y Cartera Estratégica</span><span class="page">11</span></li>
      <li class="toc-item"><span class="num">9.</span><span class="name">Guía de Toma de Decisiones Comerciales basada en Datos</span><span class="page">12</span></li>
    </ul>
  </div>

  <!-- SECCIÓN 1 -->
  <h1>1. Propósito del Rol de Gerente Comercial</h1>
  <p>
    El <strong>Gerente Comercial</strong> es el líder estratégico de la fuerza de ventas de BICSA. A través de esta plataforma, dispone de visibilidad integral y en tiempo real del despliegue en calle de todos sus ejecutivos, del avance de las negociaciones corporativas, de los costos incurridos en movilidad (combustibles, Bolt, Uber, viáticos) y de los resultados tangibles en contratos y suscripciones cerradas.
  </p>

  <!-- SECCIÓN 2 -->
  <h1>2. Matriz de Permisos: Diferenciación con el Administrador</h1>
  <p>
    Para garantizar la separación institucional de funciones y la seguridad informática de BICSA, el perfil de <strong>Gerente Comercial</strong> se distingue claramente del perfil de <strong>Administrador</strong>:
  </p>

  <div class="callout callout-bicsa">
    <div class="callout-title">Diferencia Fundamental: Módulo de Usuarios</div>
    El Gerente Comercial cuenta con <strong>acceso pleno a todas las funcionalidades comerciales, analíticas, operativas, de costos, de auditoría y de exportación</strong> de la empresa. La <strong>única diferencia</strong> con el perfil Administrador es que el Gerente <strong>NO accede al módulo de administración técnica de Usuarios</strong> (creación de cuentas, modificación de roles y reseteo de claves de acceso), tarea que queda asignada exclusivamente al Administrador de TI.
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Módulo o Funcionalidad</th>
        <th style="text-align: center; width: 30%;">Gerente Comercial</th>
        <th style="text-align: center; width: 30%;">Administrador</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Monitoreo en Tiempo Real (Jornada en Curso)</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Historial Global de Todo el Equipo</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Resumen de Cierre y KPIs Consolidados</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Análisis de Costos e Inversión por Empresa</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Exportación Oficial de Reportes a Excel</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Directorio Maestro de Empresas y Clientes</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Inspección de Auditoría de Jornadas</strong></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Total</span></td>
      </tr>
      <tr>
        <td><strong>Creación y Edición de Cuentas de Usuarios</strong></td>
        <td style="text-align: center;"><span class="pill pill-red">Sin Acceso</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Exclusivo</span></td>
      </tr>
      <tr>
        <td><strong>Reestablecimiento de Contraseñas</strong></td>
        <td style="text-align: center;"><span class="pill pill-red">Sin Acceso</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Exclusivo</span></td>
      </tr>
      <tr>
        <td><strong>Asignación de Roles y Permisos de Sistema</strong></td>
        <td style="text-align: center;"><span class="pill pill-red">Sin Acceso</span></td>
        <td style="text-align: center;"><span class="pill pill-green">Acceso Exclusivo</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- SECCIÓN 3 -->
  <h1>3. Monitoreo de Salidas en Tiempo Real (Jornada en Curso)</h1>
  <p>
    En la vista <strong>"Jornada en Curso"</strong> (<code class="inline">/jornada-en-curso</code>), el Gerente Comercial cuenta con una torre de control en vivo para responder a preguntas críticas del día:
  </p>
  <ul>
    <li><em>¿Quiénes del equipo salieron hoy a terreno?</em> Lista activa con nombres y avatares de los ejecutivos con jornada abierta.</li>
    <li><em>¿A qué hora iniciaron sus recorridos?</em> Marca temporal exacta de inicio de la jornada comercial.</li>
    <li><em>¿Qué medio de movilidad están empleando?</em> Indicador de si el asesor se desplaza en <strong>Vehículo Propio</strong> (con su kilometraje inicial de salida) o en <strong>Plataforma de Transporte</strong> (Bolt, Uber, Taxi).</li>
    <li><em>¿Cuántas reuniones comerciales llevan registradas?</em> Contador dinámico que se incrementa en tiempo real a medida que los ejecutivos cargan visitas en sus teléfonos.</li>
  </ul>

  <!-- SECCIÓN 4 -->
  <h1>4. Análisis de Desempeño Comercial en Historial Global</h1>
  <p>
    En <strong>"Historial"</strong> (<code class="inline">/historial</code>), el Gerente Comercial evalúa la productividad comercial con los filtros más modernos del sistema:
  </p>

  <h2>4.1. Filtros de Búsqueda de Alta Precisión</h2>
  <ul>
    <li><strong>Año:</strong> Selector compacto con año de inicio 2026 y progresión automática.</li>
    <li><strong>Mes:</strong> Permite analizar un mes específico o seleccionar <strong><code>-- Todos --</code></strong> para comparar períodos consolidados.</li>
    <li><strong>Fecha (Día):</strong> Selector inteligente que calcula la cantidad real de días del mes elegido (28, 29, 30 o 31 días) para auditar un día particular o elegir <strong><code>-- Todos --</code></strong>.</li>
    <li><strong>Ejecutivo/a:</strong> Menú desplegable con ancho balanceado (220px) que permite seleccionar a un asesor específico (ej. <em>Daisy Ozorio, Jacqueline Aguilera</em>) o <em>"Todos los ejecutivos"</em> para métricas globales de equipo.</li>
  </ul>

  <h2>4.2. Tarjetas de Resumen de Cierre (KPIs)</h2>
  <p>
    El panel de Resumen de Cierre presenta los 5 pilares operativos con datos simétricamente centrados:
  </p>
  <div style="text-align: center; margin: 15px 0;">
    <div class="card-kpi-preview">
      <div class="kpi-title">Jornadas</div>
      <div class="kpi-value">21</div>
      <div class="kpi-sub">Salidas de campo</div>
    </div>
    <div class="card-kpi-preview">
      <div class="kpi-title">KM Recorridos</div>
      <div class="kpi-value">2.129</div>
      <div class="kpi-sub">Km auditados</div>
    </div>
    <div class="card-kpi-preview">
      <div class="kpi-title">Total Visitas</div>
      <div class="kpi-value">30</div>
      <div class="kpi-sub">Reuniones</div>
    </div>
    <div class="card-kpi-preview">
      <div class="kpi-title">Empresas</div>
      <div class="kpi-value">13</div>
      <div class="kpi-sub">Cuentas contactadas</div>
    </div>
    <div class="card-kpi-preview" style="background: #F0FDF4; border-color: #BBF7D0;">
      <div class="kpi-title" style="color: #15803D;">Contrataciones</div>
      <div class="kpi-value" style="color: #15803D;">2</div>
      <div class="kpi-sub" style="color: #166534;">Nuevos Contratos</div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECCIÓN 5 -->
  <h1>5. Supervisión del Embudo de Ventas y Resultados de Visitas</h1>
  <p>
    Cambiando a la pestaña <strong>"Detalle de Visitas"</strong> en el Historial, el Gerente Comercial puede filtrar y analizar la efectividad del pipeline comercial:
  </p>

  <h2>5.1. Etapas del Embudo (Funnel de Ventas)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Etapa</th>
        <th>Interpretación y Seguimiento Requerido</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="pill pill-blue">Prospección</span></td>
        <td>Primer acercamiento con la empresa. Evaluar si el perfil encaja con el cliente ideal de BICSA.</td>
      </tr>
      <tr>
        <td><span class="pill pill-orange">Contacto con decisor</span></td>
        <td>Reunión con gerente de compras o director general. Evaluar nivel de interés real y necesidades.</td>
      </tr>
      <tr>
        <td><span class="pill pill-orange">Negociación</span></td>
        <td>Propuesta económica presentada. Seguimiento de objeciones de precio o condiciones contractuales.</td>
      </tr>
      <tr>
        <td><span class="pill pill-green">Contrato</span></td>
        <td>Acuerdo verbal alcanzado. En proceso de firma de documentación y alta de servicios.</td>
      </tr>
      <tr>
        <td><span class="pill pill-green">Venta ganada / Suscripción</span></td>
        <td>Cierre exitoso definitivo. Incorporación formal de la cuenta a la cartera activa de BICSA.</td>
      </tr>
    </tbody>
  </table>

  <h2>5.2. Resultados Comerciales de Visita</h2>
  <p>
    Monitoree la proporción de visitas con resultado <span class="pill pill-green">Contratado</span> o <span class="pill pill-blue">Propuesta enviada</span> frente a <span class="pill pill-red">Venta perdida</span> o <span class="pill pill-gray">Sin interés</span> para calibrar el discurso comercial del equipo.
  </p>

  <!-- SECCIÓN 6 -->
  <h1>6. Evaluación de Inversión Financiera y Rentabilidad por Empresa</h1>
  <p>
    En <strong>"Costos Empresa"</strong> (<code class="inline">/inversion-empresas</code>), el Gerente Comercial ejerce el control presupuestario de las ventas:
  </p>
  <ul>
    <li><strong>Inversión Total en la Cuenta:</strong> Suma de combustible prorrateado de visitas, costos de viajes en Bolt/Uber y gastos extras (almuerzos, peajes).</li>
    <li><strong>Costo por Visita Realizada:</strong> Promedio de gasto incurrido por cada reunión con el cliente.</li>
    <li><strong>Retorno de Inversión (ROI):</strong> Permite identificar cuentas en las que se ha invertido recurrentemente sin lograr avances hacia el contrato, orientando al equipo a reenfocar recursos en prospectos de mayor viabilidad.</li>
    <li><strong>Descarga en Excel:</strong> Botón <em>"Descargar Reporte Excel"</em> para auditar las cuentas en reuniones de presupuesto.</li>
  </ul>

  <!-- SECCIÓN 7 -->
  <h1>7. Generación y Descarga de Libros Oficiales de Excel</h1>
  <p>
    El módulo <strong>"Exportar"</strong> (<code class="inline">/exportacion</code>) es la herramienta fundamental del Gerente Comercial para presentar informes periódicos al Directorio de BICSA:
  </p>
  <ul>
    <li>Permite exportar por mes, año completo o por ejecutivo específico.</li>
    <li>Descarga un libro de Microsoft Excel (.xlsx) con formato institucional, carátula ejecutiva y pestañas de <strong>Resumen de KPIs</strong>, <strong>Jornadas Auditadas</strong> y <strong>Detalle Exhaustivo de Visitas</strong>.</li>
  </ul>

  <div class="page-break"></div>

  <!-- SECCIÓN 8 -->
  <h1>8. Directorio de Empresas y Cartera Estratégica</h1>
  <p>
    En la pestaña <strong>"Empresas"</strong> (<code class="inline">/empresas</code>), el Gerente supervisa el padrón global de cuentas:
  </p>
  <ul>
    <li><strong>Buscador Compacto:</strong> Cuadro <em>"Buscar empresa"</em> optimizado para localizar rápidamente antecedentes.</li>
    <li><strong>Cartera por Estado:</strong> Permite filtrar qué clientes están en <em>"En negociación"</em> o <em>"Prospecto"</em> para apoyar al ejecutivo en el cierre de la cuenta.</li>
    <li><strong>Trazabilidad entre Ejecutivos:</strong> Visualice qué asesores han visitado previamente una misma empresa, evitando duplicidad de gestiones y conflictos de cartera.</li>
  </ul>

  <!-- SECCIÓN 9 -->
  <h1>9. Guía de Toma de Decisiones Comerciales basada en Datos</h1>

  <div class="step-card">
    <div class="step-num">1</div>
    <div class="step-body">
      <strong>Revisión Diaria Matutina:</strong> Ingrese a <em>"Jornada en Curso"</em> a las 09:30 AM para verificar que todos los ejecutivos programados hayan iniciado su jornada con su medio de transporte debidamente registrado.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>Control Semanal de Conversión:</strong> Filtre el Historial por la etapa <em>"Negociación"</em> y <em>"Propuesta enviada"</em> para coordinar con los ejecutivos acciones de cierre antes de fin de semana.
    </div>
  </div>
  <div class="step-card">
    <div class="step-num">3</div>
    <div class="step-body">
      <strong>Cierre Mensual de Desempeño:</strong> A fin de mes, genere el reporte oficial de Excel para evaluar el cumplimiento de metas individuales y el balance general de gastos de movilidad versus contratos ganados.
    </div>
  </div>

  <div class="callout callout-tip" style="margin-top: 25px;">
    <div class="callout-title">Liderazgo y Excelencia Comercial</div>
    La información precisa y en tiempo real es el motor que impulsa el liderazgo de la Gerencia Comercial de BICSA hacia el cumplimiento de los objetivos corporativos.
  </div>

</body>
</html>
"""

def generate_pdf():
    print("Escribiendo archivo HTML del Manual de Gerente Comercial...")
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
