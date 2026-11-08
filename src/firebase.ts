// Connects the app to Firebase using the values in .env.local.
// If those values are missing, `firebaseApp` is null and the app still runs,
// so you can work on screens before the Firebase project exists.
import { initializeApp, type FirebaseApp } from 'firebase/app'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(config.apiKey && config.projectId)

export const firebaseApp: FirebaseApp | null = firebaseConfigured
  ? initializeApp(config)
  : null
