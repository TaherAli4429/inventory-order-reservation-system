import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for backend .env in multiple possible locations depending on execution CWD
const candidatePaths = [
  path.resolve(__dirname, '../../.env'),       // from src/config
  path.resolve(__dirname, '../.env'),          // from dist/config
  path.resolve(process.cwd(), 'backend/.env'),  // if started from root
  path.resolve(process.cwd(), '.env'),          // if started from backend/
  path.resolve(process.cwd(), '../.env.local'), // frontend fallback
  path.resolve(process.cwd(), '.env.local'),    // frontend fallback
];

let loadedEnvPath: string | null = null;
for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (!loadedEnvPath && envPath.includes('.env')) {
      loadedEnvPath = envPath;
    }
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

export function validateEnv() {
  if (env.isProduction) {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing mandatory production environment variables: ${missing.join(', ')}`);
    }
  }
}
