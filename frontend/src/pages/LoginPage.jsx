import React, { useState } from "react";
import { Link } from "react-router-dom";
import BirdAnimation from "../components/BirdAnimation";
import { useAuth } from "../hooks/useAuth.jsx";
import { useTheme } from "../context/ThemeContext";
import loginBg from "../assets/login-bg.svg";

export default function LoginPage() {
  const { loginWithGoogle, loginWithForm } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    company: "",
    role: "",
    password: "",
  });

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your account" : "Welcome back";
  const subtitle = isSignup
    ? "Tell us a little about you to personalize your security workspace."
    : "Sign in to access your security dashboard.";
  const googleLabel = isSignup ? "Sign up with Google" : "Continue with Google";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    loginWithForm({ ...form, mode });
  };

  return (
    <div className="auth-page" style={{ backgroundImage: `url(${loginBg})` }}>
      <BirdAnimation />
      <div className="auth-topbar">
        <Link to="/login" className="btn btn-outline btn-sm">
          Get Started
        </Link>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
          style={{
            background: theme === "dark" ? "var(--gold)" : "var(--border)",
          }}
        >
          <span
            className="theme-toggle__knob"
            style={{
              transform:
                theme === "dark" ? "translateX(18px)" : "translateX(0)",
            }}
          ></span>
        </button>
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: "var(--gold)" }}
          >
            <path
              d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div className="auth-brand__title">Underdog</div>
            <div className="auth-brand__subtitle">AI SECURITY LAYER</div>
          </div>
        </div>

        <div className="auth-toggle" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={mode === "login" ? "is-active" : ""}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={mode === "signup" ? "is-active" : ""}
          >
            Sign up
          </button>
        </div>

        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              Full name
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Aarav Sharma"
                required={isSignup}
              />
            </label>
          )}
          <label className="auth-field">
            Work email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>
          {isSignup && (
            <label className="auth-field">
              Company
              <input
                type="text"
                name="company"
                value={form.company}
                onChange={handleChange}
                placeholder="Underdog Labs"
                required={isSignup}
              />
            </label>
          )}
          {isSignup && (
            <label className="auth-field">
              Role
              <input
                type="text"
                name="role"
                value={form.role}
                onChange={handleChange}
                placeholder="Security Engineer"
                required={isSignup}
              />
            </label>
          )}
          <label className="auth-field">
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />
          </label>
          <button type="submit" className="btn btn-cta auth-submit">
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-outline auth-google"
          onClick={loginWithGoogle}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 533.5 544.3"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z"
              fill="#4285f4"
            />
            <path
              d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z"
              fill="#34a853"
            />
            <path
              d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z"
              fill="#fbbc04"
            />
            <path
              d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 340.1 0 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z"
              fill="#ea4335"
            />
          </svg>
          {googleLabel}
        </button>

        <p className="auth-footnote">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
      <Link to="/" className="auth-back btn btn-outline btn-sm">
        ← Back to home
      </Link>
    </div>
  );
}
