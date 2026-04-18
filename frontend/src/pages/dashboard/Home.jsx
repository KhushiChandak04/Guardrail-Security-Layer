import React from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../hooks/useAuth.jsx";

export default function DashboardHome() {
  const { logout, user } = useAuth();

  const stats = {
    promptsToday: 386,
    blocked: 12,
    piiRedacted: 28,
    safePassed: 341,
    cleanRate: 96.4,
    attackRate: 3.1,
  };

  const activitySeries = [
    { label: "Mon", value: 32 },
    { label: "Tue", value: 55 },
    { label: "Wed", value: 41 },
    { label: "Thu", value: 72 },
    { label: "Fri", value: 64 },
    { label: "Sat", value: 38 },
    { label: "Sun", value: 49 },
  ];

  const decisionMix = [
    { label: "Passed", value: 68, color: "var(--success)" },
    { label: "Redacted", value: 20, color: "var(--warning)" },
    { label: "Blocked", value: 12, color: "var(--danger)" },
  ];

  const decisionGradient = `conic-gradient(
    ${decisionMix[0].color} 0% ${decisionMix[0].value}%,
    ${decisionMix[1].color} ${decisionMix[0].value}% ${decisionMix[0].value + decisionMix[1].value}%,
    ${decisionMix[2].color} ${decisionMix[0].value + decisionMix[1].value}% 100%
  )`;

  const riskBuckets = [
    { label: "Low", value: 42, color: "var(--success)" },
    { label: "Medium", value: 31, color: "var(--gold)" },
    { label: "High", value: 19, color: "var(--warning)" },
    { label: "Critical", value: 8, color: "var(--danger)" },
  ];

  return (
    <div className="page" style={{ flexDirection: "row" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          overflowX: "hidden",
          overflowY: "auto",
          padding: "1.25rem",
          paddingBottom: "2rem",
          marginLeft: "210px",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
          height: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.4rem",
              color: "var(--brown-dark)",
            }}
          >
            Overview
          </h2>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <Link to="/" className="btn btn-outline btn-sm">
              Back to landing
            </Link>
            <button
              type="button"
              onClick={logout}
              className="btn btn-outline btn-sm"
            >
              Sign out
            </button>
            <div
              className="badge"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success)",
                color: "var(--success-text)",
                padding: "5px 12px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "var(--success)",
                  marginRight: "8px",
                  animation: "pulse 1.5s infinite",
                }}
              ></span>
              Live · Monitoring
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.875rem",
          }}
        >
          <StatCard
            label="PROMPTS TODAY"
            value={stats.promptsToday}
            sub="total interactions"
          />
          <StatCard
            label="BLOCKED"
            value={stats.blocked}
            sub={`${stats.attackRate}% attack rate`}
            color="var(--danger)"
          />
          <StatCard
            label="PII REDACTED"
            value={stats.piiRedacted}
            sub="from model responses"
            color="var(--gold)"
          />
          <StatCard
            label="SAFE PASSED"
            value={stats.safePassed}
            sub={`${stats.cleanRate}% clean rate`}
            color="var(--success)"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "0.875rem",
          }}
        >
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <h3 className="label-style">THREAT ACTIVITY</h3>
            <div className="mini-chart">
              {activitySeries.map((item) => (
                <div key={item.label} className="mini-chart__col">
                  <div
                    className="mini-chart__bar"
                    style={{ height: `${item.value}%` }}
                  ></div>
                  <span className="mini-chart__label">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="chart-subtext">
              Weekly risk events across all protected apps.
            </p>
          </div>
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <h3 className="label-style">DECISION MIX</h3>
            <div className="donut" style={{ background: decisionGradient }}>
              <div className="donut-hole">100%</div>
            </div>
            <div className="legend">
              {decisionMix.map((item) => (
                <div key={item.label} className="legend-row">
                  <span
                    className="legend-dot"
                    style={{ background: item.color }}
                  ></span>
                  <span>{item.label}</span>
                  <span className="legend-value">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "0.875rem",
            minHeight: "320px",
          }}
        >
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <h3 className="label-style">RISK DISTRIBUTION</h3>
            <div className="risk-bars">
              {riskBuckets.map((bucket) => (
                <div key={bucket.label} className="risk-row">
                  <span className="risk-label">{bucket.label}</span>
                  <div className="risk-track">
                    <div
                      className="risk-fill"
                      style={{
                        width: `${bucket.value}%`,
                        background: bucket.color,
                      }}
                    ></div>
                  </div>
                  <span className="risk-value">{bucket.value}%</span>
                </div>
              ))}
            </div>
            <p className="chart-subtext">
              Calculated from the last 7 days of traffic.
            </p>
          </div>
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <h3 className="label-style">USER INFO</h3>
            <div className="user-line">
              <span className="user-label">Name</span>
              <span className="user-value">
                {user?.name || "Underdog Member"}
              </span>
            </div>
            <div className="user-line">
              <span className="user-label">Email</span>
              <span className="user-value">
                {user?.email || "member@underdog.ai"}
              </span>
            </div>
            <div className="user-line">
              <span className="user-label">Company</span>
              <span className="user-value">
                {user?.company || "Underdog Labs"}
              </span>
            </div>
            <div className="user-line">
              <span className="user-label">Role</span>
              <span className="user-value">
                {user?.role || "Security Lead"}
              </span>
            </div>
            <div className="user-line">
              <span className="user-label">Plan</span>
              <span className="user-value">Enterprise Trial</span>
            </div>
          </div>
        </div>
      </main>
      <style>{`
        .label-style {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brown-light);
          margin-bottom: 0.75rem;
        }
        .mini-chart {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.5rem;
          align-items: end;
          height: 160px;
          margin-top: 0.5rem;
        }
        .mini-chart__col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
        }
        .mini-chart__bar {
          width: 100%;
          background: linear-gradient(180deg, rgba(217, 164, 65, 0.9), rgba(217, 164, 65, 0.35));
          border-radius: 10px;
          min-height: 16px;
        }
        .mini-chart__label {
          font-size: 0.7rem;
          color: var(--brown-light);
        }
        .chart-subtext {
          margin-top: 0.75rem;
          font-size: 0.78rem;
          color: var(--brown-light);
        }
        .donut {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          margin: 0 auto;
          position: relative;
        }
        .donut-hole {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          background: var(--surface);
          display: grid;
          place-items: center;
          font-size: 0.85rem;
          color: var(--brown-dark);
          font-weight: 600;
          box-shadow: inset 0 0 0 1px var(--border);
        }
        .legend {
          display: grid;
          gap: 0.4rem;
        }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--brown-mid);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .legend-value {
          margin-left: auto;
          font-weight: 600;
          color: var(--brown-dark);
        }
        .risk-bars {
          display: grid;
          gap: 0.6rem;
        }
        .risk-row {
          display: grid;
          grid-template-columns: 80px 1fr 46px;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--brown-mid);
        }
        .risk-track {
          height: 6px;
          background: var(--border);
          border-radius: 999px;
          overflow: hidden;
        }
        .risk-fill {
          height: 100%;
          border-radius: 999px;
        }
        .risk-value {
          text-align: right;
          font-weight: 600;
          color: var(--brown-dark);
        }
        .user-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
        }
        .user-label {
          color: var(--brown-light);
        }
        .user-value {
          color: var(--brown-dark);
          font-weight: 600;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, sub, color = "var(--gold)" }) {
  return (
    <div className="card" style={{ padding: "0.9rem" }}>
      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--brown-light)",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1.8rem",
          color,
          marginTop: "4px",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--brown-mid)" }}>
        {sub}
      </div>
    </div>
  );
}
