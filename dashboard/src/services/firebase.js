import { getApp, getApps, initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let analyticsPromise = null

function hasRequiredFirebaseConfig() {
  const requiredValues = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.storageBucket,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
  ]
  return requiredValues.every(Boolean)
}

export function getFirebaseApp() {
  if (!hasRequiredFirebaseConfig()) {
    return null
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirestoreDb() {
  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  return getFirestore(app)
}

export async function getFirebaseAnalyticsInstance() {
  if (typeof window === "undefined") {
    return null
  }

  if (!firebaseConfig.measurementId) {
    return null
  }

  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(app) : null))
      .catch(() => null)
  }

  return analyticsPromise
}
