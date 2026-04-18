import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyBo9hKh0xt_9L9gI3SfWzIQT8a2DN6MhP0",
  authDomain: "guardrail-security-layer.firebaseapp.com",
  projectId: "guardrail-security-layer",
  storageBucket: "guardrail-security-layer.firebasestorage.app",
  messagingSenderId: "428591962866",
  appId: "1:428591962866:web:e53578084b4f2258dece6b",
  measurementId: "G-X0P16ZYQY5",
}

const firebaseConfig = {
  apiKey: FIREBASE_WEB_CONFIG.apiKey,
  authDomain: FIREBASE_WEB_CONFIG.authDomain,
  projectId: FIREBASE_WEB_CONFIG.projectId,
  storageBucket: FIREBASE_WEB_CONFIG.storageBucket,
  messagingSenderId: FIREBASE_WEB_CONFIG.messagingSenderId,
  appId: FIREBASE_WEB_CONFIG.appId,
  measurementId: FIREBASE_WEB_CONFIG.measurementId,
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