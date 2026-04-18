import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuthPage.css";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (mode === "signup" && !form.name) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);

    // ── Replace this block with your real auth API call ──
    // e.g. POST /api/auth/login or /api/auth/register
    // On success call navigate("/dashboard")
    setTimeout(() => {
      setLoading(false);
      navigate("/dashboard"); // ← replace with your dashboard route
    }, 1200);
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
              ? "Access your BharatGuard dashboard"
              : "Start securing your AI app today"}
          </p>

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
        </div>
      </div>
    </div>
  );
}
