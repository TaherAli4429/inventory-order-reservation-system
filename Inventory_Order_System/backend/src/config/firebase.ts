import * as admin from 'firebase-admin';
import { env } from './env';

let firebaseApp: admin.app.App | null = null;
let isFCMInitialized = false;

export function initializeFirebase(): admin.app.App | null {
  if (isFCMInitialized && firebaseApp) {
    return firebaseApp;
  }

  try {
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      let cleanKey = env.FIREBASE_PRIVATE_KEY.trim();
      // Remove any wrapping quotes that might have been preserved from .env
      if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
        cleanKey = cleanKey.slice(1, -1);
      }
      cleanKey = cleanKey.replace(/\\n/g, '\n');

      // Check if it's a placeholder (like the example key with ellipsis or length < 500)
      const isPlaceholder = cleanKey.includes('...') || cleanKey.length < 500 || !cleanKey.includes('-----BEGIN PRIVATE KEY-----');

      if (isPlaceholder) {
        console.log('[FCM] Firebase private key is unconfigured or a placeholder; operating in local log mode.');
        return null;
      }

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleanKey,
        }),
      });
      isFCMInitialized = true;
      console.log('[FCM] Firebase Admin SDK initialized successfully.');
    } else {
      console.log('[FCM] Firebase credentials not fully configured; operating in local log mode.');
    }
  } catch (err: unknown) {
    console.warn('[FCM] Firebase initialization note (operating in local log mode):', err instanceof Error ? err.message : err);
  }

  return firebaseApp;
}

export async function sendFcmNotification(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
  tokens?: string[];
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const app = initializeFirebase();
  if (!app) {
    // Graceful fallback: logs event without crashing
    return { sent: false, error: 'FCM not configured with live credentials.' };
  }

  try {
    if (payload.tokens && payload.tokens.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      return { sent: response.successCount > 0 };
    } else {
      // Send to general 'inventory-events' topic
      const messageId = await admin.messaging().send({
        topic: 'inventory-events',
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      return { sent: true, messageId };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'FCM send error';
    console.error('[FCM] Error sending message:', errorMsg);
    return { sent: false, error: errorMsg };
  }
}
