import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { getFirebaseAuth, syncAuthUserToFirestore } from "../services/firebase";
import "./AuthPage.css";

export default function AuthPage() {
  const navigate = useNavigate();
  const auth = getFirebaseAuth();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);

    if (!auth) {
      return () => {};
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });
  }, [auth]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError("");

    if (!auth) {
      setError("Firebase auth config is missing in frontend/.env");
      return;
    }

    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (mode === "signup" && !form.name) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      const email = form.email.trim();
      const password = form.password.trim();
      let signedInUser;

      if (mode === "signup") {
        const credentials = await createUserWithEmailAndPassword(auth, email, password);
        signedInUser = credentials.user;
        if (form.name.trim()) {
          await updateProfile(credentials.user, { displayName: form.name.trim() });
        }
      } else {
        const credentials = await signInWithEmailAndPassword(auth, email, password);
        signedInUser = credentials.user;
      }

      await syncAuthUserToFirestore(signedInUser);

      setForm((previous) => ({ ...previous, password: "" }));
      navigate("/chat");
    } catch (authError) {
      setError(authError?.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase auth config is missing in frontend/.env");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const credentials = await signInWithPopup(auth, new GoogleAuthProvider());
      await syncAuthUserToFirestore(credentials.user);
      navigate("/chat");
    } catch (authError) {
      setError(authError?.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signOut(auth);
    } catch (authError) {
      setError(authError?.message || "Sign out failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-grain" />
      <div className="auth-grid" />

      {/* Left panel — branding */}
      <div className={`auth-left ${mounted ? "auth-left--in" : ""}`}>
        <button className="auth-back" onClick={() => navigate("/")}>
          ← Back to Home
        </button>

        <div className="auth-brand">
          <span className="auth-shield">⬡</span>
          <div>
            <div className="auth-brand-name">BharatGuard</div>
            <div className="auth-brand-tag">AI Security Middleware</div>
          </div>
        </div>

        <div className="auth-feature-list">
          {[
            {
              icon: "◈",
              text: "Redact sensitive Indian PII before LLM sees it",
            },
            { icon: "⟳", text: "Session-level multi-turn jailbreak detection" },
            { icon: "⬡", text: "Native Aadhaar, PAN, UPI, GST protection" },
            { icon: "⊕", text: "Plug in with a single Python decorator" },
          ].map((f) => (
            <div className="auth-feature" key={f.text}>
              <span className="auth-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <div className="auth-quote">"Secure. Redact. Enable."</div>
      </div>

      {/* Right panel — form */}
      <div className={`auth-right ${mounted ? "auth-right--in" : ""}`}>
        <div className="auth-card">
          {/* Mode toggle */}
          <div className="auth-toggle">
            <button
              className={`toggle-btn ${mode === "login" ? "toggle-btn--active" : ""}`}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Log In
            </button>
            <button
              className={`toggle-btn ${mode === "signup" ? "toggle-btn--active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Sign Up
            </button>
          </div>

          <h2 className="auth-heading">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="auth-subheading">
            {mode === "login"
              ? "Access your BharatGuard secure chat"
              : "Start securing your AI app today"}
          </p>

          {user ? (
            <div className="auth-user-state">
              <p className="auth-user-email">
                Signed in as {user.email || user.uid}
              </p>
              <div className="auth-actions">
                <button className="auth-submit" onClick={() => navigate("/chat")}>
                  Continue to Secure Chat →
                </button>
                <button
                  className="auth-submit auth-submit-secondary"
                  onClick={handleSignOut}
                  disabled={loading}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Fields */}
              <div className="auth-fields">
                {mode === "signup" && (
                  <div className="field-group">
                    <label className="field-label">Full Name</label>
                    <input
                      className="field-input"
                      type="text"
                      name="name"
                      placeholder="Arjun Sharma"
                      value={form.name}
                      onChange={handleChange}
                    />
                  </div>
                )}
                <div className="field-group">
                  <label className="field-label">Email</label>
                  <input
                    className="field-input"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Password</label>
                  <input
                    className="field-input"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {error && <div className="auth-error">{error}</div>}

              <div className="auth-actions">
                <button
                  className={`auth-submit ${loading ? "auth-submit--loading" : ""}`}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : mode === "login" ? (
                    "Log In →"
                  ) : (
                    "Create Account →"
                  )}
                </button>

                <button
                  className="auth-submit auth-submit-secondary"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </button>
              </div>

              <p className="auth-footer-text">
                {mode === "login"
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  className="auth-switch"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError("");
                  }}
                >
                  {mode === "login" ? "Sign up" : "Log in"}
                </button>
              </p>
            </>
          )}

          {user && error ? <div className="auth-error">{error}</div> : null}

          {user && (
            <p className="auth-footer-text">
              You can sign out or continue to the protected chat page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
