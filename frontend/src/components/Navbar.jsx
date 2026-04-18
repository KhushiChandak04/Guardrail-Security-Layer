import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      style={{
        height: "64px",
        position: "fixed",
        top: 0,
        width: "100%",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.5rem",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "var(--brown-dark)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span role="img" aria-label="shield">
            🛡️
          </span>
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.3rem",
            }}
          >
            Underdog
          </span>
        </Link>
      </div>
      <div className="nav-links" style={{ display: "flex", gap: "1.5rem" }}>
        <Link to="/" className="nav-link">
          Home
        </Link>
        <Link to="/solutions" className="nav-link">
          Our Solutions
        </Link>
        <Link to="/secure-chat" className="nav-link">
          Demo
        </Link>
        <Link to="/#about" className="nav-link">
          About
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link to="/login" className="btn btn-cta">
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
      <style>{`
        .nav-link {
          font-size: 0.875rem;
          color: var(--brown-mid);
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--gold);
        }
        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
