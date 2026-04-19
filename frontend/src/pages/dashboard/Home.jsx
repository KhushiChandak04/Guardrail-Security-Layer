import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../hooks/useAuth.jsx";
import { getLogs, getStats } from "../../services/api";
import { getFirestoreDb } from "../../services/firebase";

const DASHBOARD_POLL_INTERVAL_MS = 15000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatRate(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function getTimestampMs(item) {
  const rawValue = item?.timestamp_iso || item?.timestamp;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRiskScore(item) {
  const input = Number(item?.input_risk_score || 0);
  const output = Number(item?.output_risk_score || 0);
  return Math.max(input, output);
}

function getDecision(item) {
  const decision = String(item?.decision || "").toLowerCase();
  if (decision === "blocked") {
    return "Blocked";
  }
  if (decision === "modified" || Boolean(item?.redacted)) {
    return "Redacted";
  }
  return "Passed";
}

function toPercentShares(items) {
  const normalized = items.map((item) => ({
    ...item,
    count: Math.max(0, Number(item.count || 0)),
  }));

  const total = normalized.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) {
    return normalized.map((item) => ({ ...item, value: 0 }));
  }

  const breakdown = normalized.map((item, index) => {
    const exact = (item.count / total) * 100;
    const floored = Math.floor(exact);
    return {
      index,
      item,
      floored,
      fraction: exact - floored,
    };
  });

  const baseSum = breakdown.reduce((sum, entry) => sum + entry.floored, 0);
  let remainder = Math.max(0, 100 - baseSum);

  breakdown.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < breakdown.length && remainder > 0; i += 1) {
    breakdown[i].floored += 1;
    remainder -= 1;
  }

  breakdown.sort((a, b) => a.index - b.index);
  return breakdown.map((entry) => ({
    ...entry.item,
    value: entry.floored,
  }));
}

function buildDecisionGradient(decisionMix) {
  if (!decisionMix.length) {
    return "conic-gradient(var(--border) 0% 100%)";
  }

  let cursor = 0;
  const segments = [];

  decisionMix.forEach((item) => {
    const start = cursor;
    cursor += item.value;
    segments.push(`${item.color} ${start}% ${cursor}%`);
  });

  if (cursor < 100) {
    segments.push(`var(--border) ${cursor}% 100%`);
  }

  return `conic-gradient(${segments.join(", ")})`;
}

function buildDashboardData(statsPayload, logItems, source) {
  const stats = statsPayload && typeof statsPayload === "object" ? statsPayload : {};
  const logs = Array.isArray(logItems) ? logItems : [];

  const today = new Date();
  const todayKey = today.toDateString();
  const weeklyCutoff = new Date(today);
  weeklyCutoff.setHours(0, 0, 0, 0);
  weeklyCutoff.setDate(weeklyCutoff.getDate() - 6);

  const weeklyRiskCounts = Object.fromEntries(WEEKDAY_LABELS.map((label) => [label, 0]));
  const riskBucketCounts = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  let promptsTodayFromLogs = 0;
  let blockedFromLogs = 0;
  let redactedFromLogs = 0;
  let passedFromLogs = 0;

  logs.forEach((item) => {
    const decision = getDecision(item);
    if (decision === "Blocked") {
      blockedFromLogs += 1;
    } else if (decision === "Redacted") {
      redactedFromLogs += 1;
    } else {
      passedFromLogs += 1;
    }

    const timestamp = toDate(item?.timestamp_iso || item?.timestamp);
    if (timestamp && timestamp.toDateString() === todayKey) {
      promptsTodayFromLogs += 1;
    }

    const score = getRiskScore(item);
    if (score > 85) {
      riskBucketCounts.Critical += 1;
    } else if (score > 60) {
      riskBucketCounts.High += 1;
    } else if (score > 30) {
      riskBucketCounts.Medium += 1;
    } else {
      riskBucketCounts.Low += 1;
    }

    if (timestamp && timestamp >= weeklyCutoff) {
      const weekday = WEEKDAY_LABELS[(timestamp.getDay() + 6) % 7];
      const riskyEvent = decision !== "Passed" || score > 30;
      if (riskyEvent) {
        weeklyRiskCounts[weekday] += 1;
      }
    }
  });

  const blocked = Number(stats.blocked ?? blockedFromLogs);
  const piiRedacted = Number(stats.pii_redacted ?? redactedFromLogs);
  const safePassed = Number(stats.safe_passed ?? passedFromLogs);
  const totalInteractions = Number(stats.recent_count ?? (blocked + piiRedacted + safePassed));

  const attackRate = Number(
    stats.attack_rate
      ?? (totalInteractions > 0 ? ((blocked / totalInteractions) * 100).toFixed(1) : 0),
  );
  const cleanRate = Number(
    stats.clean_rate
      ?? (totalInteractions > 0 ? ((safePassed / totalInteractions) * 100).toFixed(1) : 0),
  );

  const weeklyCounts = WEEKDAY_LABELS.map((label) => ({
    label,
    count: weeklyRiskCounts[label],
  }));
  const maxWeeklyCount = Math.max(0, ...weeklyCounts.map((item) => item.count));

  const activitySeries = weeklyCounts.map((item) => ({
    ...item,
    value: maxWeeklyCount > 0 ? Math.max(10, Math.round((item.count / maxWeeklyCount) * 100)) : 8,
  }));

  const decisionMix = toPercentShares([
    { label: "Passed", color: "var(--success)", count: safePassed },
    { label: "Redacted", color: "var(--warning)", count: piiRedacted },
    { label: "Blocked", color: "var(--danger)", count: blocked },
  ]);

  const riskBuckets = toPercentShares([
    { label: "Low", color: "var(--success)", count: riskBucketCounts.Low },
    { label: "Medium", color: "var(--gold)", count: riskBucketCounts.Medium },
    { label: "High", color: "var(--warning)", count: riskBucketCounts.High },
    { label: "Critical", color: "var(--danger)", count: riskBucketCounts.Critical },
  ]);

  return {
    stats: {
      promptsToday: Number(stats.prompts_today ?? promptsTodayFromLogs),
      blocked,
      piiRedacted,
      safePassed,
      attackRate,
      cleanRate,
    },
    totalInteractions,
    activitySeries,
    decisionMix,
    decisionGradient: buildDecisionGradient(decisionMix),
    riskBuckets,
    totalMixCount: blocked + piiRedacted + safePassed,
    source: String(stats.source || source || "unknown"),
  };
}

export default function DashboardHome() {
  const { logout, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [source, setSource] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [userProfile, setUserProfile] = useState({});
  const latestRequestRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard(showSpinner) {
      const requestId = ++latestRequestRef.current;

      if (showSpinner) {
        setLoading(true);
      }
      setError("");

      try {
        const [statsResponse, logsResponse] = await Promise.all([
          getStats(250),
          getLogs({ limit: 200, offset: 0 }),
        ]);

        if (!isMounted || requestId !== latestRequestRef.current) {
          return;
        }

        const rows = Array.isArray(logsResponse?.items) ? logsResponse.items : [];
        const sortedRows = [...rows].sort((a, b) => getTimestampMs(b) - getTimestampMs(a));

        setStats(statsResponse || {});
        setLogs(sortedRows);
        setSource(String(statsResponse?.source || logsResponse?.source || "unknown"));
        setLastUpdated(new Date());
      } catch (requestError) {
        if (!isMounted || requestId !== latestRequestRef.current) {
          return;
        }

        setError(requestError?.message || "Unable to load dashboard metrics.");
        if (showSpinner) {
          setStats(null);
          setLogs([]);
          setSource("unknown");
        }
      } finally {
        if (isMounted && requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    }

    loadDashboard(true);
    const intervalId = window.setInterval(() => {
      loadDashboard(false);
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.uid]);

  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile() {
      if (!user?.uid) {
        setUserProfile({});
        return;
      }

      const db = getFirestoreDb();
      if (!db) {
        setUserProfile({});
        return;
      }

      try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        if (!isMounted) {
          return;
        }
        setUserProfile(profileSnapshot.exists() ? profileSnapshot.data() || {} : {});
      } catch {
        if (isMounted) {
          setUserProfile({});
        }
      }
    }

    loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const dashboard = useMemo(() => {
    return buildDashboardData(stats, logs, source);
  }, [stats, logs, source]);

  const userInfo = useMemo(() => {
    return {
      name: userProfile?.display_name || user?.displayName || "Not set",
      email: userProfile?.email || user?.email || "Not set",
      company: userProfile?.company || "Not set",
      role: userProfile?.role || "Not set",
      plan: userProfile?.plan || "Not set",
    };
  }, [userProfile, user?.displayName, user?.email]);

  const syncText = lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Syncing...";

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
          <div>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.4rem",
                color: "var(--brown-dark)",
              }}
            >
              Overview
            </h2>
            <div style={{ fontSize: "0.78rem", color: "var(--brown-light)" }}>
              Source: {dashboard.source} · {syncText}
            </div>
            {error ? (
              <div style={{ fontSize: "0.78rem", color: "var(--danger)" }}>{error}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link to="/" className="btn btn-outline btn-sm">
              Back to landing
            </Link>
            <button type="button" onClick={logout} className="btn btn-outline btn-sm">
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
            value={loading ? "--" : dashboard.stats.promptsToday}
            sub={`${dashboard.totalInteractions} total interactions`}
          />
          <StatCard
            label="BLOCKED"
            value={loading ? "--" : dashboard.stats.blocked}
            sub={`${formatRate(dashboard.stats.attackRate)}% attack rate`}
            color="var(--danger)"
          />
          <StatCard
            label="PII REDACTED"
            value={loading ? "--" : dashboard.stats.piiRedacted}
            sub="from model responses"
            color="var(--gold)"
          />
          <StatCard
            label="SAFE PASSED"
            value={loading ? "--" : dashboard.stats.safePassed}
            sub={`${formatRate(dashboard.stats.cleanRate)}% clean rate`}
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
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="label-style">THREAT ACTIVITY</h3>
            <div className="mini-chart">
              {dashboard.activitySeries.map((item) => (
                <div key={item.label} className="mini-chart__col">
                  <div
                    className="mini-chart__bar"
                    title={`${item.label}: ${item.count} risk events`}
                    style={{
                      height: `${item.value}%`,
                      opacity: item.count > 0 ? 1 : 0.35,
                    }}
                  ></div>
                  <span className="mini-chart__label">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="chart-subtext">Weekly risk events across this account's protected apps.</p>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 className="label-style">DECISION MIX</h3>
            <div className="donut" style={{ background: dashboard.decisionGradient }}>
              <div className="donut-hole">{dashboard.totalMixCount > 0 ? "100%" : "0%"}</div>
            </div>
            <div className="legend">
              {dashboard.decisionMix.map((item) => (
                <div key={item.label} className="legend-row">
                  <span className="legend-dot" style={{ background: item.color }}></span>
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
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="label-style">RISK DISTRIBUTION</h3>
            <div className="risk-bars">
              {dashboard.riskBuckets.map((bucket) => (
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
              Calculated from the latest {dashboard.totalInteractions} interactions.
            </p>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 className="label-style">USER INFO</h3>
            <div className="user-line">
              <span className="user-label">Name</span>
              <span className="user-value">{userInfo.name}</span>
            </div>
            <div className="user-line">
              <span className="user-label">Email</span>
              <span className="user-value">{userInfo.email}</span>
            </div>
            <div className="user-line">
              <span className="user-label">Company</span>
              <span className="user-value">{userInfo.company}</span>
            </div>
            <div className="user-line">
              <span className="user-label">Role</span>
              <span className="user-value">{userInfo.role}</span>
            </div>
            <div className="user-line">
              <span className="user-label">Plan</span>
              <span className="user-value">{userInfo.plan}</span>
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
          min-height: 8px;
          transition: height 0.25s ease;
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
