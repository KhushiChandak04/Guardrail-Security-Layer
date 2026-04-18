import { useEffect, useState } from "react"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth"

import { getFirebaseAuth } from "../services/firebase"

export default function AuthPanel() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [createMode, setCreateMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const auth = getFirebaseAuth()

  useEffect(() => {
    if (!auth) {
      return () => {}
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })
  }, [auth])

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase auth config is missing in frontend/.env")
      return
    }

    setBusy(true)
    setError("")
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (authError) {
      setError(authError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleEmailAuth = async (event) => {
    event.preventDefault()
    if (!auth) {
      setError("Firebase auth config is missing in frontend/.env")
      return
    }

    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    setBusy(true)
    setError("")
    try {
      if (createMode) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      setPassword("")
    } catch (authError) {
      setError(authError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    if (!auth) {
      return
    }

    setBusy(true)
    setError("")
    try {
      await signOut(auth)
    } catch (authError) {
      setError(authError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-panel">
      <div className="auth-header">
        <h2>User Authentication</h2>
        <p>
          Sign in with Google or email/password. The backend verifies your Firebase token
          before logging interactions.
        </p>
      </div>

      <div className="auth-status-row">
        <span className={user ? "auth-badge auth-badge-live" : "auth-badge"}>
          {user ? "Authenticated" : "Anonymous mode"}
        </span>
        {user ? (
          <button className="auth-button auth-button-muted" onClick={handleSignOut} disabled={busy}>
            Sign Out
          </button>
        ) : null}
      </div>

      {user ? (
        <p className="auth-user">Signed in as: {user.email || user.uid}</p>
      ) : (
        <form className="auth-form" onSubmit={handleEmailAuth}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="auth-actions">
            <button className="auth-button" type="submit" disabled={busy}>
              {createMode ? "Create Account" : "Sign In"}
            </button>
            <button
              className="auth-button auth-button-muted"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              Google Sign-In
            </button>
          </div>
          <button
            className="auth-toggle"
            type="button"
            onClick={() => setCreateMode((previous) => !previous)}
            disabled={busy}
          >
            {createMode ? "Have an account? Switch to sign-in" : "Need an account? Switch to sign-up"}
          </button>
        </form>
      )}

      {error ? <p className="auth-error">{error}</p> : null}
    </section>
  )
}