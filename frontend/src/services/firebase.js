import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore"

import { syncAuthUserProfile } from "./api"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

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
  return getAuth(app)
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

  let clientSynced = false

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
      clientSynced = true
    }
  } catch {
    clientSynced = false
  }

  // Always attempt backend sync as the source of truth (Admin SDK bypasses client rules).
  try {
    if (typeof user.getIdToken === "function") {
      const idToken = await user.getIdToken()
      if (idToken) {
        await syncAuthUserProfile({
          idToken,
          displayName: user.displayName || "",
        })
        return true
      }
    }
  } catch {
    if (clientSynced) {
      return true
    }
  }

  if (clientSynced) {
    return true
  }

  throw new Error("Unable to sync user profile to Firestore. Check backend Firebase config and auth token.")
}