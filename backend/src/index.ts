import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool } from './db/pool';
import { runMigrations } from './db/migrations';
import { seedSuperAdmin } from './db/seed';
import authRouter from './routes/auth';
import jornadasRouter from './routes/jornadas';
import visitasRouter from './routes/visitas';
import empresasRouter from './routes/empresas';
import usuariosRouter from './routes/usuarios';
import exportacionRouter from './routes/exportacion';
import dashboardRouter from './routes/dashboard';
import inversionRouter from './routes/inversion';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Detrás de Nginx: confiar en el primer proxy para obtener la IP real (rate limiting)
app.set('trust proxy', 1);

// ─── Seguridad ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'http://localhost'
    : '*',
  credentials: true,
}));

// Rate limiting global (relajado para pruebas y uso continuo)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Demasiadas solicitudes, intente en unos minutos.' },
});
app.use(limiter);

// ─── Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health check ─────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// ─── Rutas ───────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/jornadas', jornadasRouter);
app.use('/visitas', visitasRouter);
app.use('/empresas', empresasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/exportacion', exportacionRouter);
app.use('/dashboard', dashboardRouter);
app.use('/inversion', inversionRouter);

// ─── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ─── Error handler global ────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Inicialización ───────────────────────────────────────
async function start() {
  try {
    // Verificar conexión a BD
    await pool.query('SELECT 1');
    logger.info('✅ Conexión a PostgreSQL establecida');

    // Ejecutar migraciones automáticas
    await runMigrations();

    // Seed superadmin
    await seedSuperAdmin();

    app.listen(PORT, () => {
      logger.info(`🚀 BICSA Backend corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    logger.error('❌ Error al inicializar el servidor:', err);
    process.exit(1);
  }
}

start();
