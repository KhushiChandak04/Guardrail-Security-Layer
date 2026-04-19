import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BirdAnimation from "../components/BirdAnimation";
import { useAuth } from "../hooks/useAuth.jsx";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const logoItems = [
    { name: "Gemini", src: "/logos/gemini.png" },
    { name: "Grok", src: "/logos/grok.png" },
    { name: "Claude", src: "/logos/claude.png" },
    { name: "Cohere", src: "/logos/cohere.png" },
    { name: "Perplexity", src: "/logos/perplexity.png" },
    { name: "DeepSeek", src: "/logos/deepseek.png" },
    { name: "Qwen", src: "/logos/qwen.png" },
  ];

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
            marginTop: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          AI SECURITY MIDDLEWARE
        </div>
        <h1
          className="hero-title"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "3.4rem",
            fontWeight: 700,
            color: "var(--brown-dark)",
            lineHeight: 1.15,
            marginBottom: "1.25rem",
          }}
        >
          Secure AI Adoption
          <br />
          at Scale
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            fontWeight: 500,
            color: "var(--brown-light)",
            maxWidth: "520px",
            lineHeight: 1.75,
            marginBottom: "2.25rem",
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
          marginTop: "auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "2rem 0 2.5rem",
          zIndex: 1,
        }}
      >
        <div className="logo-marquee">
          <div className="logo-track">
            {logoItems.concat(logoItems).map((logo, idx) => (
              <div key={`${logo.name}-${idx}`} className="logo-badge">
                <img className="logo-image" src={logo.src} alt={logo.name} />
              </div>
            ))}
          </div>
        </div>
        
      </footer>
      <style>{`
        .hero-title {
          position: relative;
          display: inline-block;
          text-shadow: 0 8px 30px rgba(60, 40, 20, 0.25);
        }
        .hero-title::before {
          content: "";
          position: absolute;
          top: -70%;
          left: 50%;
          transform: translateX(-50%);
          width: 160%;
          height: 200%;
          background: radial-gradient(
            ellipse at top,
            rgba(60, 40, 20, 0.55) 0%,
            rgba(60, 40, 20, 0.28) 45%,
            rgba(60, 40, 20, 0) 72%
          );
          filter: blur(6px);
          z-index: -1;
          pointer-events: none;
        }
        body.theme-dark .hero-title::before {
          background: radial-gradient(
            ellipse at top,
            rgba(245, 210, 130, 0.55) 0%,
            rgba(245, 210, 130, 0.22) 45%,
            rgba(245, 210, 130, 0) 70%
          );
        }
        .logo-marquee {
          width: min(960px, 92%);
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
        }
        .logo-track {
          display: flex;
          gap: 1rem;
          width: max-content;
          animation: logoScroll 26s linear infinite;
        }
        .logo-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 112px;
          height: 80px;
          border-radius: 0;
          background: transparent;
          border: none;
          box-shadow: 0 10px 18px rgba(92, 62, 30, 0.08);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .logo-badge:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 0 18px rgba(241, 199, 108, 0.85);
          filter: drop-shadow(0 0 12px rgba(241, 199, 108, 0.6));
        }
        .logo-image {
          width: 78px;
          height: 52px;
          object-fit: contain;
          filter: grayscale(0.1) drop-shadow(0 2px 6px rgba(92, 62, 30, 0.25));
        }
        .logo-badge:hover .logo-image {
          filter: drop-shadow(0 0 10px rgba(241, 199, 108, 0.9));
        }
        @keyframes logoScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
