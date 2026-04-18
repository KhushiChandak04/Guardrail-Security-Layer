import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../hooks/useAuth.jsx";
import { getLogs, getStats } from "../../services/api";

function formatRelativeTime(value) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function extractRiskScore(item) {
  const input = Number(item?.input_risk_score || 0);
  const output = Number(item?.output_risk_score || 0);
  return Math.max(input, output);
}

function decisionBadge(item) {
  const decision = String(item?.decision || "").toLowerCase();
  if (decision === "blocked") {
    return "BLOCKED";
  }
  if (decision === "modified" || Boolean(item?.redacted)) {
    return "REDACTED";
  }
  return "PASSED";
}

function normalizeMetricMap(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, count]) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      return accumulator;
    }

    accumulator[normalizedKey] = Number(count || 0);
    return accumulator;
  }, {});
}

function deriveStatsFromLogs(logs) {
  const today = new Date().toDateString();
  const attackCounts = {};
  const piiCounts = {};
  const sessionIds = new Set();
  const latencies = [];

  let promptsToday = 0;
  let blocked = 0;
  let redacted = 0;
  let passed = 0;

  logs.forEach((item) => {
    const decision = String(item?.decision || "").toLowerCase();
    if (decision === "blocked") {
      blocked += 1;
    } else if (decision === "modified" || Boolean(item?.redacted)) {
      redacted += 1;
    } else {
      passed += 1;
    }

    const timestamp = item?.timestamp_iso || item?.timestamp;
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime()) && parsed.toDateString() === today) {
      promptsToday += 1;
    }

    const sessionId = String(item?.session_id || "").trim();
    if (sessionId) {
      sessionIds.add(sessionId);
    }

    const latency = item?.llm?.latency_ms;
    if (typeof latency === "number") {
      latencies.push(latency);
    }

    const inputFlags = Array.isArray(item?.input_flags) ? item.input_flags : [];
    inputFlags.forEach((flag) => {
      const key = String(flag || "").trim().toLowerCase();
      if (key) {
        attackCounts[key] = (attackCounts[key] || 0) + 1;
      }
    });

    const redactedFields = Array.isArray(item?.output_analysis?.redacted_fields)
      ? item.output_analysis.redacted_fields
      : [];
    redactedFields.forEach((field) => {
      const key = String(field || "").trim();
      if (key) {
        piiCounts[key] = (piiCounts[key] || 0) + 1;
      }
    });
  });

  const total = logs.length;
  const cleanRate = total ? Number(((passed / total) * 100).toFixed(1)) : 0;
  const attackRate = total ? Number(((blocked / total) * 100).toFixed(1)) : 0;
  const avgLatency = latencies.length
    ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(1))
    : 0;

  return {
    promptsToday,
    blocked,
    piiRedacted: redacted,
    safePassed: passed,
    cleanRate,
    avgLatency,
    activeSessions: sessionIds.size,
    attackRate,
    attackCounts,
    piiCounts,
    totalLogs: total,
  };
}

export default function DashboardHome() {
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsMeta, setLogsMeta] = useState({ count: 0, totalFiltered: 0, source: "unknown" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [statsResponse, logsResponse] = await Promise.all([
          getStats(250),
          getLogs({ limit: 120, offset: 0 }),
        ]);

        if (!isMounted) {
          return;
        }

        const rows = Array.isArray(logsResponse?.items) ? logsResponse.items : [];
        setStats(statsResponse || {});
        setLogs(rows);
        setLogsMeta({
          count: Number(logsResponse?.count ?? rows.length),
          totalFiltered: Number(logsResponse?.total_filtered ?? rows.length),
          source: String(logsResponse?.source || "unknown"),
        });
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setError(requestError?.message || "Unable to load dashboard metrics.");
        setLogsMeta({ count: 0, totalFiltered: 0, source: "unknown" });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedStats = useMemo(() => {
    const derived = deriveStatsFromLogs(logs);
    const source = stats || {};
    const attackCounts = normalizeMetricMap(source.attack_counts);
    const piiCounts = normalizeMetricMap(source.pii_redaction_counts);

    return {
      promptsToday: Number(source.prompts_today ?? derived.promptsToday),
      blocked: Number(source.blocked ?? derived.blocked),
      piiRedacted: Number(source.pii_redacted ?? derived.piiRedacted),
      safePassed: Number(source.safe_passed ?? derived.safePassed),
      cleanRate: Number(source.clean_rate ?? derived.cleanRate),
      avgLatency: Number(source.avg_latency_ms ?? derived.avgLatency),
      activeSessions: Number(source.active_sessions ?? derived.activeSessions),
      attackRate: Number(source.attack_rate ?? derived.attackRate),
      attackCounts: Object.keys(attackCounts).length > 0 ? attackCounts : derived.attackCounts,
      piiCounts: Object.keys(piiCounts).length > 0 ? piiCounts : derived.piiCounts,
      totalLogs: Number(source.recent_count ?? logsMeta.totalFiltered ?? derived.totalLogs),
    };
  }, [stats, logs, logsMeta.totalFiltered]);

  const liveFeed = useMemo(
    () => logs.slice(0, 6).map((item, index) => ({
      id: String(item?.id || item?.request_id || index),
      decision: decisionBadge(item),
      score: extractRiskScore(item),
      time: formatRelativeTime(item?.timestamp_iso || item?.timestamp),
      prompt: String(item?.input_text || ""),
      output: String(item?.output_text || (item?.input_blocked ? "Blocked before model output" : "No model output")),
      reason: String(item?.reason || "safe"),
      model: String(item?.llm?.model || "unknown"),
      color:
        decisionBadge(item) === "BLOCKED"
          ? "var(--danger)"
          : decisionBadge(item) === "REDACTED"
            ? "var(--warning)"
            : "var(--success)",
    })),
    [logs],
  );

  const attackTypes = useMemo(() => {
    const entries = Object.entries(normalizedStats.attackCounts);
    const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);

    if (!entries.length || total === 0) {
      return [];
    }

    return entries
      .map(([label, value], index) => ({
        label: label.replace(/_/g, " "),
        value: Math.round((Number(value || 0) / total) * 100),
        color: ["var(--danger)", "var(--gold)", "#A78BFA", "var(--warning)", "var(--success)"][index % 5],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [normalizedStats.attackCounts]);

  const piiStats = useMemo(() => {
    return Object.entries(normalizedStats.piiCounts)
      .map(([label, value]) => ({
        label,
        value: Number(value || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [normalizedStats.piiCounts]);

  return (
    <div className="page" style={{ flexDirection: "row" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          padding: "1.25rem",
          marginLeft: "210px",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
          height: "100%",
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
              Live � Monitoring
            </div>
          </div>
        </div>

        {error ? (
          <div className="card" style={{ color: "var(--danger)", padding: "0.75rem" }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.875rem",
          }}
        >
          <StatCard
            label="PROMPTS TODAY"
            value={String(normalizedStats.promptsToday)}
            sub="total interactions"
          />
          <StatCard
            label="BLOCKED"
            value={String(normalizedStats.blocked)}
            sub={`${normalizedStats.attackRate}% attack rate`}
            color="var(--danger)"
          />
          <StatCard
            label="PII REDACTED"
            value={String(normalizedStats.piiRedacted)}
            sub="from model responses"
            color="var(--gold)"
          />
          <StatCard
            label="SAFE PASSED"
            value={String(normalizedStats.safePassed)}
            sub={`${normalizedStats.cleanRate}% clean rate`}
            color="var(--success)"
          />
        </div>

        <div
          className="card"
          style={{
            padding: "0.75rem",
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          <Metric label="Avg latency" value={`${normalizedStats.avgLatency}ms`} />
          <Metric label="Active sessions" value={String(normalizedStats.activeSessions)} />
          <Metric label="Attack rate" value={`${normalizedStats.attackRate}%`} />
          <Metric
            label="Records scanned"
            value={String(normalizedStats.totalLogs)}
            sub={`${logsMeta.count} loaded � ${logsMeta.source}`}
          />
        </div>

        <div
          className="pii-banner"
          style={{
            background: "#FEF3C7",
            border: "1px solid var(--gold)",
            borderRadius: "10px",
            padding: "0.875rem 1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="pii-title">Indian PII Detection</span>
            <span className="badge badge-gold pii-badge">Live from backend logs</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            {piiStats.length === 0 ? (
              <div className="card pii-card" style={{ padding: "8px 10px", textAlign: "center", gridColumn: "1 / -1" }}>
                <div className="pii-card__label">No PII fields detected yet</div>
                <div className="pii-card__sub">This section updates automatically from model output redactions</div>
              </div>
            ) : (
              piiStats.map((item) => (
                <div
                  key={item.label}
                  className="card pii-card"
                  style={{ padding: "8px 10px", textAlign: "center" }}
                >
                  <div className="pii-card__label">{item.label}</div>
                  <div className="pii-card__value">{item.value}</div>
                  <div className="pii-card__sub">{item.value > 0 ? "redacted" : "none"}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.875rem",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="label-style">ATTACK TYPES</h3>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-around",
              }}
            >
              {attackTypes.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--brown-light)" }}>
                  No attack labels detected in current logs.
                </p>
              ) : (
                attackTypes.map((attack) => (
                  <div
                    key={attack.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--brown-mid)" }}>{attack.label}</span>
                    <div
                      style={{
                        flex: 2,
                        height: "5px",
                        background: "var(--border)",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${attack.value}%`,
                          background: attack.color,
                          borderRadius: "3px",
                        }}
                      ></div>
                    </div>
                    <span
                      style={{
                        minWidth: "30px",
                        textAlign: "right",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: attack.color,
                      }}
                    >
                      {attack.value}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3 className="label-style">LIVE FEED (INPUT TO OUTPUT)</h3>
            {loading ? (
              <p style={{ color: "var(--brown-light)", fontSize: "0.82rem" }}>Loading live logs...</p>
            ) : null}
            {!loading && liveFeed.length === 0 ? (
              <p style={{ color: "var(--brown-light)", fontSize: "0.82rem" }}>
                No interaction records yet. Start a secure chat to populate feed.
              </p>
            ) : null}
            {liveFeed.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "var(--cream)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span className={`badge badge-${item.decision.toLowerCase()}`}>{item.decision}</span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: item.color,
                    }}
                  >
                    {item.score}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--brown-light)" }}>{item.time}</span>
                </div>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "var(--brown-mid)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: "4px",
                  }}
                >
                  Input: {item.prompt}
                </p>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "var(--brown-light)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: "2px",
                  }}
                >
                  Output: {item.output}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "4px",
                    fontSize: "0.68rem",
                    color: "var(--brown-light)",
                  }}
                >
                  <span>{item.model}</span>
                  <span>{item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, color = "var(--gold)" }) {
  return (
    <div className="card" style={{ padding: "0.9rem" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--brown-light)", letterSpacing: "0.08em" }}>{label}</div>
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
      <div style={{ fontSize: "0.78rem", color: "var(--brown-mid)" }}>{sub}</div>
    </div>
  );
}

function Metric({ label, value, sub = "" }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--brown-light)", letterSpacing: "0.08em" }}>{label}</div>
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1.15rem",
          color: "var(--brown-dark)",
          marginTop: "2px",
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: "0.66rem", color: "var(--brown-light)", marginTop: "2px" }}>{sub}</div> : null}
    </div>
  );
}
