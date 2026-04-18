import React from "react";
import Navbar from "../components/Navbar";
import BirdAnimation from "../components/BirdAnimation";
import { Link } from "react-router-dom";

export default function OurSolutions() {
  const features = [
    {
      title: "Input Guard",
      description:
        "Inspects every user prompt for jailbreaks, prompt injection, and PII before it reaches the LLM.",
      color: "var(--danger)",
    },
    {
      title: "Output Guard",
      description:
        "Scans LLM responses and masks sensitive data like Aadhaar, PAN, and UPI IDs before delivery to the user.",
      color: "var(--success)",
    },
    {
      title: "Decision Engine",
      description:
        "Assigns a risk score and decides whether to BLOCK, REDACT, or ALLOW each interaction based on your policies.",
      color: "var(--gold)",
    },
    {
      title: "Audit Logs",
      description:
        "Logs every single interaction with a full audit trail, providing visibility and compliance.",
      color: "var(--warning)",
    },
    {
      title: "Indian PII Specialization",
      description:
        "Natively understands and protects against leakage of Indian-specific sensitive data.",
      color: "#A78BFA",
    },
    {
      title: "Policy Management",
      description:
        "Fine-tune the guardrail's behavior with custom rules and thresholds to match your security posture.",
      color: "var(--brown-mid)",
    },
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
          padding: "6rem 1rem 2rem",
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "2.5rem",
            color: "var(--brown-dark)",
            marginBottom: "1rem",
          }}
        >
          Our Solutions
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--brown-light)",
            maxWidth: "600px",
            lineHeight: 1.7,
            marginBottom: "3rem",
          }}
        >
          Underdog provides a multi-layered defense system to secure your AI
          applications, from input to output.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            width: "100%",
            maxWidth: "1000px",
            marginBottom: "3rem",
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="card"
              style={{
                textAlign: "left",
                borderLeft: `4px solid ${feature.color}`,
              }}
            >
              <h3
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.2rem",
                  color: "var(--brown-dark)",
                  marginBottom: "0.5rem",
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--brown-light)",
                  lineHeight: 1.6,
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
        <Link to="/secure-chat" className="btn btn-cta">
          Try the Demo
        </Link>
      </main>
    </div>
  );
}
