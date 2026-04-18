import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BirdAnimation from "../components/BirdAnimation";
import { useAuth } from "../hooks/useAuth.jsx";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="page">
      <Navbar />
      <BirdAnimation />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          padding: "0 1rem",
        }}
      >
        <div
          style={{
            display: "inline-block",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "4px 14px",
            borderRadius: "20px",
            fontSize: "0.75rem",
            color: "var(--brown-light)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "1.5rem",
          }}
        >
          AI SECURITY MIDDLEWARE
        </div>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "2.8rem",
            color: "var(--brown-dark)",
            lineHeight: 1.2,
            marginBottom: "1rem",
          }}
        >
          Secure AI Adoption
          <br />
          at Scale
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--brown-light)",
            maxWidth: "420px",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}
        >
          Protection for every GenAI application you build and deploy — with
          Indian PII intelligence built in.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-cta">
              Back to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-cta">
              Get Started
            </Link>
          )}
          <Link to="/solutions" className="btn btn-outline">
            Our Solutions
          </Link>
        </div>
      </main>
      <footer
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          paddingBottom: "1.5rem",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <div className="feature-pill">
            <span
              className="dot"
              style={{ "--dot-color": "var(--danger)" }}
            ></span>
            Input Guard
          </div>
          <div className="feature-pill">
            <span
              className="dot"
              style={{ "--dot-color": "var(--success)" }}
            ></span>
            Output Guard
          </div>
          <div className="feature-pill">
            <span
              className="dot"
              style={{ "--dot-color": "var(--gold)" }}
            ></span>
            Audit Logs
          </div>
        </div>
      </footer>
      <style>{`
        .feature-pill {
          border: 1px solid var(--border);
          background: var(--surface);
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.75rem;
          color: var(--brown-light);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .feature-pill .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--dot-color);
        }
      `}</style>
    </div>
  );
}
