import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { useTheme } from "../context/ThemeContext";
import { getStats } from "../services/api";
import underdogLogo from "../assets/underdog-logo.png";

const SIDEBAR_POLL_INTERVAL_MS = 15000;

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const [risk, setRisk] = useState(0);
  const [riskReady, setRiskReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRisk() {
      try {
        const stats = await getStats(120);
        if (!isMounted) {
          return;
        }

        const attackRate = Number(stats?.attack_rate || 0);
        const cleanRate = Number(stats?.clean_rate || 0);

        const blendedRisk = Math.min(
          100,
          Math.max(0, Math.round(attackRate * 0.6 + (100 - cleanRate) * 0.4)),
        );

        setRisk(blendedRisk);
      } catch {
        if (isMounted) {
          setRisk(0);
        }
      } finally {
        if (isMounted) {
          setRiskReady(true);
        }
      }
    }

    loadRisk();
    const intervalId = window.setInterval(() => {
      loadRisk();
    }, SIDEBAR_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const getRiskColor = (r) => {
    if (r <= 25) return "var(--success)";
    if (r <= 50) return "var(--warning)";
    if (r <= 75) return "var(--gold)";
    return "var(--danger)";
  };

  const getRiskBand = (r) => {
    if (r > 75) return "CRITICAL";
    if (r > 50) return "HIGH";
    if (r > 25) return "MEDIUM";
    return "LOW";
  };

  const getRiskBadgeClass = (r) => {
    if (r > 75) return "critical";
    if (r > 50) return "high";
    if (r > 25) return "medium";
    return "low";
  };

  const riskColor = getRiskColor(risk);
  const riskBand = getRiskBand(risk);
  const riskBadgeClass = getRiskBadgeClass(risk);

  return (
    <aside
      style={{
        width: "210px",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
      }}
    >
      <div
        className="brand-mark"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <img
          src={underdogLogo}
          alt="Underdog logo"
          className="brand-logo brand-logo--sm"
        />
        <span
          className="brand-text"
          style={{
            fontSize: "1.3rem",
            color: "var(--brown-dark)",
          }}
        >
          Underdog
        </span>
      </div>
      <span
        style={{
          fontSize: "0.7rem",
          color: "var(--brown-light)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: "0.25rem",
        }}
      >
        AI Security Layer
      </span>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          marginTop: "2rem",
        }}
      >
        <NavLink to="/dashboard" className="sidebar-link">
          <span className="dot" style={{ "--dot-color": "var(--gold)" }}></span>
          Overview
        </NavLink>
        <NavLink to="/secure-chat" className="sidebar-link">
          <span
            className="dot"
            style={{ "--dot-color": "var(--success)" }}
          ></span>
          Secure Chat
        </NavLink>
        <NavLink to="/audit-logs" className="sidebar-link">
          <span
            className="dot"
            style={{ "--dot-color": "var(--warning)" }}
          ></span>
          Audit Logs
        </NavLink>
        <NavLink to="/policies" className="sidebar-link">
          <span className="dot" style={{ "--dot-color": "#A78BFA" }}></span>
          Policies
        </NavLink>
      </nav>

      <div style={{ marginTop: "auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              fontSize: "0.7rem",
              color: "var(--brown-light)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Session Risk
          </label>
          <div
            className="session-risk-panel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginTop: "0.5rem",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke={riskColor}
                strokeWidth="3"
                strokeDasharray={`${(risk / 100) * 100.5} 100.5`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.5rem",
                  color: riskColor,
                }}
              >
                {riskReady ? risk : "--"}
              </div>
              <div
                className={`badge badge-${riskBadgeClass}`}
                style={{ fontSize: "0.6rem", padding: "2px 6px" }}
              >
                {riskBand}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            style={{
              width: "40px",
              height: "22px",
              borderRadius: "11px",
              background: theme === "dark" ? "var(--gold)" : "var(--border)",
              position: "relative",
              cursor: "pointer",
              border: "none",
              padding: "2px",
            }}
          >
            <div
              className="theme-toggle__knob"
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "var(--surface)",
                position: "absolute",
                transition: "transform 0.2s",
                transform:
                  theme === "dark" ? "translateX(18px)" : "translateX(0)",
              }}
            ></div>
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--brown-light)" }}>
            Dark mode
          </span>
        </div>
      </div>

      <style>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.875rem;
          color: var(--brown-mid);
          cursor: pointer;
          transition: background 0.15s;
          text-decoration: none;
          border-left: 3px solid transparent;
        }
        .sidebar-link:hover {
          background: var(--overlay);
        }
        .sidebar-link.active {
          background: var(--overlay);
          border-left: 3px solid var(--gold);
          color: var(--gold);
        }
        .sidebar-link .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--dot-color);
        }
        .badge-critical { background: var(--danger-bg); color: var(--danger); }
        .badge-high { background: var(--warning-bg); color: var(--warning); }
        .badge-medium { background: #FEF3C7; color: var(--gold-dark); }
        .badge-low { background: var(--success-bg); color: var(--success); }
      `}</style>
    </aside>
  );
}
