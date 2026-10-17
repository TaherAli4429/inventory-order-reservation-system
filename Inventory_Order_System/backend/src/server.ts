import { app } from './app';
import { env, validateEnv } from './config/env';
import { initializeFirebase } from './config/firebase';
import { verifyDatabaseConnection } from './db/pool';

async function bootstrap() {
  validateEnv();
  initializeFirebase();

  if (env.DATABASE_URL) {
    const dbStatus = await verifyDatabaseConnection();
    if (dbStatus.connected) {
      console.log('[PostgreSQL] Connected to Supabase/PostgreSQL database successfully.');
    } else {
      console.warn(`[PostgreSQL] Warning: Database connection check failed (${dbStatus.error}). Ensure DATABASE_URL is valid.`);
    }
  } else {
    console.log('[Database] Note: DATABASE_URL is not set. Operating in in-memory mode.');
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[Backend] Express server running on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`[Backend] API surface mounted at http://localhost:${env.PORT}/api`);
    console.log(`[Backend] Health check: http://localhost:${env.PORT}/health`);
  });

  const shutdown = () => {
    console.log('[Backend] Gracefully shutting down server...');
    server.close(() => {
      console.log('[Backend] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Backend] Fatal startup failure:', err);
  process.exit(1);
});
