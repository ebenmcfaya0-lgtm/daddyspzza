import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase safely
let app;
let auth: any;
let db: any;

try {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'undefined') {
    throw new Error('Firebase API Key is missing or undefined');
  }
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Create a dummy app if initialization fails to prevent top-level crashes
  // We use a try-catch for each service to be safe
  app = getApps().length > 0 ? getApp() : initializeApp({ apiKey: 'dummy-key', projectId: 'dummy-id' });
  try { auth = getAuth(app); } catch (e) { auth = { onAuthStateChanged: () => () => {} }; }
  try { db = getFirestore(app); } catch (e) { db = {}; }
}

export { auth, db };
