import express, { Express } from 'express';
import cors from 'cors';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

import { verifyDatabaseConnection } from './db/pool';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email', 'x-user-role', 'idempotency-key'],
    })
  );

  app.use(express.json());

  // Health check endpoint - accurately verifies live database connection
  app.get('/health', async (req, res) => {
    if (!env.DATABASE_URL) {
      res.status(200).json({
        status: 'fallback_mode',
        service: 'Real-Time Inventory & Order Reservation Backend',
        timestamp: new Date().toISOString(),
        database: 'Transactional Memory Engine Active (DATABASE_URL is not configured)',
        storage: 'Transactional Memory Engine',
      });
      return;
    }

    const check = await verifyDatabaseConnection();
    if (check.connected) {
      res.status(200).json({
        status: 'ok',
        service: 'Real-Time Inventory & Order Reservation Backend',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL Connected',
        storage: 'Supabase PostgreSQL',
        databaseName: check.database,
      });
    } else {
      res.status(503).json({
        status: 'degraded',
        service: 'Real-Time Inventory & Order Reservation Backend',
        timestamp: new Date().toISOString(),
        database: `PostgreSQL Connection Failed: ${check.error}`,
        storage: 'Transactional Memory Engine Active (Fallback)',
      });
    }
  });

  // API Routes
  app.use('/api', apiRoutes);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
