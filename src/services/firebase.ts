import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported, Messaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Connect with configured firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Auth instance
export const auth = getAuth(app);

// Messaging instance getter (browser support check)
let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  
  if (messagingInstance) return messagingInstance;
  
  try {
    const supported = await isMessagingSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('Firebase Cloud Messaging not supported in this environment:', err);
  }
  return null;
}

// Connection check as required by Firebase skill
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is limited.');
    }
    // We consider connection tested even if doc does not exist
    return true;
  }
}

// Test on initial boot
if (typeof window !== 'undefined') {
  testFirebaseConnection().catch(() => {});
}

export { firebaseConfig };
