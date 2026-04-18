import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { useTheme } from "../context/ThemeContext";
import { getStats } from "../services/api";

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
        const blendedRisk = Math.min(100, Math.max(0, Math.round((attackRate * 0.6) + ((100 - cleanRate) * 0.4))));
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
    return () => {
      isMounted = false;
    };
  }, []);

  const getRiskColor = (r) => {
    if (r <= 25) return "var(--success)";
    if (r <= 50) return "var(--warning)";
    if (r <= 75) return "var(--gold)";
    return "var(--danger)";
  };

  const riskColor = getRiskColor(risk);

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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2Z"
            stroke="var(--gold)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.1rem",
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginTop: "0.5rem",
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
                className={`badge badge-${risk > 75 ? "critical" : risk > 50 ? "high" : risk > 25 ? "medium" : "low"}`}
                style={{ fontSize: "0.6rem", padding: "2px 6px" }}
              >
                {risk > 75
                  ? "CRITICAL"
                  : risk > 50
                    ? "HIGH"
                    : risk > 25
                      ? "MEDIUM"
                      : "LOW"}
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
