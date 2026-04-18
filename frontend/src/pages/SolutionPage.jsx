import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SolutionPage.css";

const features = [
  {
    icon: "◈",
    title: "Redact & Continue",
    desc: "Strips Aadhaar, PAN, UPI from prompts silently. User experience uninterrupted.",
    accent: "#bf00ff",
  },
  {
    icon: "⟳",
    title: "Multi-Turn Risk",
    desc: "Session-level jailbreak detection across the full conversation, not just one message.",
    accent: "#7c3aed",
  },
  {
    icon: "◉",
    title: "LLM-as-Judge",
    desc: "Borderline prompts (score 40–70) get a secondary AI classification before decision.",
    accent: "#e040fb",
  },
  {
    icon: "⬡",
    title: "Indian PII Native",
    desc: "Aadhaar · PAN · UPI · GST · Voter ID · Mobile — no competitor has this.",
    accent: "#a78bfa",
  },
  {
    icon: "◫",
    title: "Honeypot Mode",
    desc: "Attackers get convincing fake responses while the full session is logged silently.",
    accent: "#bf00ff",
  },
  {
    icon: "⊕",
    title: "1-Line SDK",
    desc: "Plug-in decorator pattern — zero refactoring of your existing chatbot code.",
    accent: "#7c3aed",
  },
];

const piiChips = [
  { label: "Aadhaar", pattern: "XXXX-XXXX-XXXX" },
  { label: "PAN", pattern: "ABCDE1234F" },
  { label: "UPI", pattern: "name@upi" },
  { label: "GST", pattern: "22AAAAA0000A1Z5" },
  { label: "Mobile", pattern: "+91-XXXXXXXXXX" },
  { label: "Voter ID", pattern: "ABC1234567" },
];

export default function SolutionPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="solution-root">
      <div className="sol-grain" />
      <div className="sol-grid" />

      {/* Nav */}
      <nav className={`sol-nav ${mounted ? "sol-nav--in" : ""}`}>
        <button className="back-btn" onClick={() => navigate("/")}>
          ← BharatGuard
        </button>
        <div className="sol-nav-title">Our Solution</div>
        <button className="sol-cta" onClick={() => navigate("/auth")}>
          Get Started →
        </button>
      </nav>

      {/* Body — two columns */}
      <div className={`sol-body ${mounted ? "sol-body--in" : ""}`}>
        {/* Left — headline + flow + PII */}
        <div className="sol-left">
          <div className="sol-label">HOW IT WORKS</div>
          <h2 className="sol-heading">
            Every prompt.
            <br />
            <span className="sol-heading--glow">Inspected.</span>
          </h2>

          {/* Flow diagram */}
          <div className="flow">
            {[
              "User Message",
              "Input Guard",
              "LLM API",
              "Output Guard",
              "Safe Response",
            ].map((step, i) => (
              <div key={step} className="flow-row">
                <div
                  className={`flow-node ${i === 1 || i === 3 ? "flow-node--guard" : ""}`}
                >
                  {step}
                </div>
                {i < 4 && <div className="flow-arrow">→</div>}
              </div>
            ))}
          </div>

          {/* Indian PII chips */}
          <div className="pii-section">
            <div className="pii-label">Indian PII — natively detected</div>
            <div className="pii-chips">
              {piiChips.map((chip) => (
                <div className="pii-chip" key={chip.label}>
                  <span className="pii-chip-label">{chip.label}</span>
                  <span className="pii-chip-pattern">{chip.pattern}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — feature cards */}
        <div className="sol-right">
          <div className="sol-label">KEY INNOVATIONS</div>
          <div className="feature-grid">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`feature-card ${activeFeature === i ? "feature-card--active" : ""}`}
                style={{ "--accent": f.accent }}
                onMouseEnter={() => setActiveFeature(i)}
              >
                <span className="feature-icon" style={{ color: f.accent }}>
                  {f.icon}
                </span>
                <div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="sol-footer">
        <span>
          Risk Score 0–100 · Block / Redact / Warn / Allow · Full Audit Log
        </span>
      </footer>
    </div>
  );
}
