import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is missing.");
  console.log("Available Environment Variables:", Object.keys(process.env).filter(key => key.startsWith("NEXT_PUBLIC_")));
  console.log("Full Config:", JSON.stringify(firebaseConfig, null, 2));
}

const auth = getAuth(app);

// Ensure session persists across browser restarts and tabs
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});

const db = initializeFirestore(app, { experimentalForceLongPolling: true });

export { app, auth, db };
