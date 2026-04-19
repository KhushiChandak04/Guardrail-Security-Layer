import { getApp, getApps, initializeApp } from "firebase/app"
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth"
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

let authInstance = null
let authPersistenceConfigured = false

function hasRequiredConfig() {
  const required = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.storageBucket,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
  ]
  return required.every(Boolean)
}

export function getFirebaseApp() {
  if (!hasRequiredConfig()) {
    return null
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirebaseAuth() {
  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  if (!authInstance) {
    authInstance = getAuth(app)
  }

  if (!authPersistenceConfigured) {
    authPersistenceConfigured = true
    setPersistence(authInstance, browserSessionPersistence).catch(() => {
      // Ignore persistence setup failures and keep auth usable.
    })
  }

  return authInstance
}

export function getFirestoreDb() {
  const app = getFirebaseApp()
  if (!app) {
    return null
  }
  return getFirestore(app)
}

export async function syncAuthUserToFirestore(user, role = "user") {
  if (!user?.uid) {
    return false
  }

  // Try client-side Firestore write first when rules allow it.
  try {
    const db = getFirestoreDb()
    if (db) {
      const userRef = doc(db, "users", user.uid)
      const snapshot = await getDoc(userRef)

      const payload = {
        email: user.email || "",
        role,
        updated_at: serverTimestamp(),
      }

      if (user.displayName) {
        payload.display_name = user.displayName
      }

      if (!snapshot.exists()) {
        payload.created_at = serverTimestamp()
      }

      await setDoc(userRef, payload, { merge: true })
      return true
    }
  } catch {
    return false
  }

  return false
}