import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../hooks/useAuth.jsx";
import { getLogs, getStats } from "../../services/api";
import { getFirestoreDb } from "../../services/firebase";

const DASHBOARD_POLL_INTERVAL_MS = 15000;
const LOGS_PAGE_SIZE = 200;

function resolveLogTargetForWindow(windowDays) {
  const days = Math.max(1, Number(windowDays) || 7);
  if (days >= 30) {
    return 600;
  }
  if (days >= 14) {
    return 400;
  }
  return LOGS_PAGE_SIZE;
}

function dedupeLogs(rows) {
  const unique = [];
  const seen = new Set();

  rows.forEach((item) => {
    const id = String(item?.id || "").trim();
    const fallbackKey = [
      String(item?.timestamp_iso || item?.timestamp || ""),
      String(item?.session_id || ""),
      String(item?.request_id || ""),
      String(item?.input_text || "").slice(0, 120),
    ].join("|");
    const key = id || fallbackKey;

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(item);
  });

  return unique;
}

function toLocalDayKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldRenderActivityLabel(index, totalDays) {
  if (totalDays <= 7) {
    return true;
  }
  if (totalDays <= 14) {
    return index % 2 === 0 || index === totalDays - 1;
  }
  if (totalDays <= 30) {
    return index % 5 === 0 || index === totalDays - 1;
  }
  return index % 7 === 0 || index === totalDays - 1;
}

function formatActivityTick(dateValue, totalDays) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (totalDays <= 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatActivityDisplayDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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

function buildDashboardData(statsPayload, logItems, source, activityWindowDays = 7) {
  const stats = statsPayload && typeof statsPayload === "object" ? statsPayload : {};
  const logs = Array.isArray(logItems) ? logItems : [];

  const today = new Date();
  const todayKey = today.toDateString();
  const normalizedActivityDays = Math.max(1, Number(activityWindowDays) || 7);
  const activityCutoff = new Date(today);
  activityCutoff.setHours(0, 0, 0, 0);
  activityCutoff.setDate(activityCutoff.getDate() - (normalizedActivityDays - 1));

  const activityTimeline = [];
  const activityBuckets = {};

  for (let dayIndex = 0; dayIndex < normalizedActivityDays; dayIndex += 1) {
    const bucketDate = new Date(activityCutoff);
    bucketDate.setDate(activityCutoff.getDate() + dayIndex);

    const dayKey = toLocalDayKey(bucketDate);
    if (!dayKey) {
      continue;
    }

    activityTimeline.push({
      dayKey,
      date: bucketDate,
      index: dayIndex,
    });

    activityBuckets[dayKey] = {
      count: 0,
      blocked: 0,
      redacted: 0,
      riskyPassed: 0,
    };
  }

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

    if (timestamp && timestamp >= activityCutoff) {
      const dayKey = toLocalDayKey(timestamp);
      const dayBucket = activityBuckets[dayKey];
      const riskyEvent = decision !== "Passed" || score > 30;
      if (dayBucket && riskyEvent) {
        dayBucket.count += 1;
        if (decision === "Blocked") {
          dayBucket.blocked += 1;
        } else if (decision === "Redacted") {
          dayBucket.redacted += 1;
        } else {
          dayBucket.riskyPassed += 1;
        }
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

  const activitySeriesBase = activityTimeline.map((entry) => {
    const bucket = activityBuckets[entry.dayKey] || {
      count: 0,
      blocked: 0,
      redacted: 0,
      riskyPassed: 0,
    };

    return {
      key: entry.dayKey,
      index: entry.index,
      label: formatActivityTick(entry.date, normalizedActivityDays),
      showLabel: shouldRenderActivityLabel(entry.index, normalizedActivityDays),
      displayDate: formatActivityDisplayDate(entry.date),
      count: bucket.count,
      blocked: bucket.blocked,
      redacted: bucket.redacted,
      riskyPassed: bucket.riskyPassed,
    };
  });

  const maxActivityCount = Math.max(0, ...activitySeriesBase.map((item) => item.count));

  const activitySeries = activitySeriesBase.map((item) => ({
    ...item,
    value:
      maxActivityCount > 0 && item.count > 0
        ? Math.max(12, Math.round((item.count / maxActivityCount) * 100))
        : 0,
  }));

  const activityTotal = activitySeries.reduce((sum, item) => sum + item.count, 0);

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
    activityTotal,
    activityWindowDays: normalizedActivityDays,
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
  const [activityWindowDays, setActivityWindowDays] = useState(7);
  const [activeThreatDay, setActiveThreatDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [userProfile, setUserProfile] = useState({});
  const latestRequestRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchLogsForWindow(targetCount) {
      const collectedRows = [];
      let logsSource = "unknown";

      for (let offset = 0; offset < targetCount; offset += LOGS_PAGE_SIZE) {
        const response = await getLogs({
          limit: LOGS_PAGE_SIZE,
          offset,
        });

        logsSource = String(response?.source || logsSource || "unknown");
        const pageRows = Array.isArray(response?.items) ? response.items : [];

        if (!pageRows.length) {
          break;
        }

        collectedRows.push(...pageRows);

        if (pageRows.length < LOGS_PAGE_SIZE) {
          break;
        }
      }

      return {
        rows: dedupeLogs(collectedRows),
        source: logsSource,
      };
    }

    async function loadDashboard(showSpinner) {
      const requestId = ++latestRequestRef.current;

      if (showSpinner) {
        setLoading(true);
      }
      setError("");

      try {
        const targetCount = resolveLogTargetForWindow(activityWindowDays);
        const [statsResponse, logsResponse] = await Promise.all([
          getStats(250),
          fetchLogsForWindow(targetCount),
        ]);

        if (!isMounted || requestId !== latestRequestRef.current) {
          return;
        }

        const rows = Array.isArray(logsResponse?.rows) ? logsResponse.rows : [];
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
  }, [user?.uid, activityWindowDays]);

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
    return buildDashboardData(stats, logs, source, activityWindowDays);
  }, [stats, logs, source, activityWindowDays]);

  useEffect(() => {
    setActiveThreatDay("");
  }, [activityWindowDays]);

  useEffect(() => {
    if (!dashboard.activitySeries.length) {
      if (activeThreatDay) {
        setActiveThreatDay("");
      }
      return;
    }

    const stillExists = dashboard.activitySeries.some((item) => item.key === activeThreatDay);
    if (stillExists) {
      return;
    }

    const sortedByActivity = [...dashboard.activitySeries].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.index - a.index;
    });

    setActiveThreatDay(sortedByActivity[0]?.key || "");
  }, [dashboard.activitySeries, activeThreatDay]);

  const selectedThreatDay = useMemo(() => {
    if (!dashboard.activitySeries.length) {
      return null;
    }

    const selected = dashboard.activitySeries.find((item) => item.key === activeThreatDay);
    return selected || dashboard.activitySeries[0];
  }, [dashboard.activitySeries, activeThreatDay]);

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
            <div className="threat-header-row">
              <h3 className="label-style" style={{ marginBottom: 0 }}>THREAT ACTIVITY</h3>
              <div className="threat-window-tabs" role="tablist" aria-label="Threat activity range">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`threat-window-tab ${activityWindowDays === days ? "is-active" : ""}`}
                    aria-pressed={activityWindowDays === days}
                    onClick={() => {
                      if (activityWindowDays === days) {
                        return;
                      }
                      setLoading(true);
                      setActivityWindowDays(days);
                    }}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
            <div
              className="mini-chart"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, dashboard.activitySeries.length)}, minmax(0, 1fr))`,
              }}
            >
              {dashboard.activitySeries.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`mini-chart__col mini-chart__col--interactive ${activeThreatDay === item.key ? "is-active" : ""}`}
                  title={`${item.displayDate}: ${item.count} risk events`}
                  onClick={() => setActiveThreatDay(item.key)}
                  aria-label={`${item.displayDate}: ${item.count} risk events`}
                  aria-pressed={activeThreatDay === item.key}
                >
                  <div
                    className="mini-chart__bar"
                    style={{
                      height: `${item.value}%`,
                      opacity: item.count > 0 ? 1 : 0.18,
                    }}
                  ></div>
                  <span className="mini-chart__label">{item.showLabel ? item.label : ""}</span>
                  <span className="mini-chart__count">{item.count}</span>
                </button>
              ))}
            </div>
            {selectedThreatDay ? (
              <div className="threat-insight" role="status" aria-live="polite">
                <strong>{selectedThreatDay.displayDate}:</strong> {selectedThreatDay.count} risk events
                <span>
                  Blocked {selectedThreatDay.blocked} · Redacted {selectedThreatDay.redacted} · High-risk passed {selectedThreatDay.riskyPassed}
                </span>
              </div>
            ) : null}
            <p className="chart-subtext">
              {dashboard.activityTotal > 0
                ? `${dashboard.activityTotal} risk events in the last ${dashboard.activityWindowDays} days across this account's protected apps.`
                : `No risk events detected in the last ${dashboard.activityWindowDays} days across this account's protected apps.`}
            </p>
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
          gap: 0.5rem;
          align-items: end;
          height: 160px;
          margin-top: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.2rem;
        }
        .threat-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }
        .threat-window-tabs {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(93, 64, 55, 0.07);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 0.15rem;
          position: relative;
          z-index: 2;
        }
        .threat-window-tab {
          border: none;
          background: transparent;
          color: var(--brown-mid);
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          border-radius: 999px;
          padding: 0.25rem 0.55rem;
          cursor: pointer;
          pointer-events: auto;
        }
        .threat-window-tab.is-active {
          background: var(--gold-bg);
          color: var(--brown-dark);
        }
        .threat-window-tab:focus-visible {
          outline: 2px solid rgba(217, 164, 65, 0.8);
          outline-offset: 1px;
        }
        .mini-chart__col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          gap: 0.35rem;
        }
        .mini-chart__col--interactive {
          border: none;
          background: transparent;
          padding: 0.2rem;
          border-radius: 10px;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.2s ease;
        }
        .mini-chart__col--interactive:hover {
          background: rgba(93, 64, 55, 0.08);
        }
        .mini-chart__col--interactive.is-active {
          background: rgba(217, 164, 65, 0.15);
          box-shadow: inset 0 0 0 1px rgba(217, 164, 65, 0.45);
        }
        .mini-chart__bar {
          width: 100%;
          background: linear-gradient(180deg, rgba(217, 164, 65, 0.9), rgba(217, 164, 65, 0.35));
          border-radius: 10px;
          min-width: 8px;
          min-height: 0;
          transition: height 0.25s ease;
        }
        .mini-chart__label {
          font-size: 0.7rem;
          color: var(--brown-light);
          min-height: 0.75rem;
          line-height: 1;
        }
        .mini-chart__count {
          font-size: 0.68rem;
          color: var(--brown-mid);
          line-height: 1;
          min-height: 0.68rem;
        }
        .threat-insight {
          margin-top: 0.75rem;
          background: rgba(217, 164, 65, 0.12);
          border: 1px solid rgba(217, 164, 65, 0.35);
          border-radius: 10px;
          padding: 0.45rem 0.6rem;
          font-size: 0.78rem;
          color: var(--brown-mid);
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
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
