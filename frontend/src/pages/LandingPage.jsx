import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const spotlightRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="landing-root">
      {/* Noise grain overlay */}
      <div className="grain" />

      {/* Spotlight that follows cursor */}
      <div
        className="spotlight"
        style={{
          background: `radial-gradient(ellipse 520px 380px at ${mousePos.x}% ${mousePos.y}%,
            rgba(124, 58, 237, 0.18) 0%,
            rgba(191, 0, 255, 0.10) 35%,
            transparent 70%)`,
        }}
      />

      {/* Fixed spotlight on tagline always */}
      <div className="spotlight-fixed" />

      {/* Grid pattern */}
      <div className="grid-overlay" />

      {/* Top bar */}
      <nav className={`topbar ${mounted ? "topbar--in" : ""}`}>
        <div className="topbar-logo">
          <span className="logo-shield">⬡</span>
          <span className="logo-text">BharatGuard</span>
        </div>
        <div className="topbar-badge">AI Security Layer · v1.0</div>
      </nav>

      {/* Main hero content */}
      <main className="hero">
        <div className={`hero-inner ${mounted ? "hero--in" : ""}`}>
          {/* Eyebrow label */}
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            GenAI Middleware Security · Hackathon Edition
          </div>

          {/* Main tagline with spotlight text effect */}
          <h1 className="tagline">
            <span className="tagline-line">Secure Every</span>
            <span className="tagline-line tagline-line--accent">
              <span className="spotlight-text">Prompt.</span>
            </span>
            <span className="tagline-line">Redact. Enable.</span>
          </h1>

          {/* Subtitle */}
          <p className="subtitle">
            A plug-in guardrail layer for any LLM — built for India,
            <br />
            with native Aadhaar, PAN, UPI & GST protection.
          </p>

          {/* CTA Buttons */}
          <div className="cta-group">
            <button
              className="btn btn--primary"
              onClick={() => navigate("/solution")}
            >
              <span className="btn-icon">◈</span>
              Our Solution
            </button>
            <button
              className="btn btn--secondary"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <span className="btn-arrow">→</span>
            </button>
          </div>

          {/* Floating stat pills */}
          <div className="stat-strip">
            <div className="stat-pill">
              <span className="stat-num">6</span>
              <span className="stat-label">Indian PII Types</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <span className="stat-num">30+</span>
              <span className="stat-label">Jailbreak Patterns</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <span className="stat-num">0</span>
              <span className="stat-label">Code Changes Needed</span>
            </div>
          </div>
        </div>

        {/* Right side — abstract shield visual */}
        <div className={`hero-visual ${mounted ? "visual--in" : ""}`}>
          <div className="shield-ring ring-1" />
          <div className="shield-ring ring-2" />
          <div className="shield-ring ring-3" />
          <div className="shield-core">
            <span className="shield-icon">⬡</span>
            <span className="shield-label">PROTECTED</span>
          </div>
          <div className="orbit-dot dot-1" />
          <div className="orbit-dot dot-2" />
          <div className="orbit-dot dot-3" />
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="bottom-bar">
        <span></span>
        <span className="bottom-divider">·</span>
        <span></span>
      </footer>
    </div>
  );
}
