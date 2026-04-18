import React, { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth.jsx";
import { getLogs } from "../services/api";

const AUDIT_STORAGE_KEY = "underdog-audit-logs";

const formatTimestamp = (timestamp, fallback) => {
  if (!timestamp) return fallback || "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return fallback || "";
  return date.toLocaleString();
};

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function extractRiskScore(item) {
  const input = Number(item?.input_risk_score || 0);
  const output = Number(item?.output_risk_score || 0);
  return Math.max(input, output);
}

function decisionLabel(item) {
  const decision = normalizeString(item?.decision);
  if (decision === "blocked" || decision === "block") {
    return "Blocked";
  }
  if (decision === "modified" || decision === "redacted" || Boolean(item?.redacted)) {
    return "Redacted";
  }
  if (decision === "allowed" || decision === "passed" || decision === "allow") {
    return "Passed";
  }
  return "Passed";
}

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

function formatIso(value) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function mapBackendLog(item) {
  const userId = String(item?.user_id || "anonymous");
  const email = String(item?.email || item?.metadata?.user_email || "");
  return {
    id: String(item?.id || item?.request_id || crypto.randomUUID()),
    time: formatRelativeTime(item?.timestamp_iso || item?.timestamp),
    timestamp: String(item?.timestamp_iso || item?.timestamp || ""),
    timestampIso: formatIso(item?.timestamp_iso || item?.timestamp),
    user: userId.slice(0, 1).toUpperCase() || "A",
    userId,
    email,
    prompt: String(item?.input_text || ""),
    outputText: String(item?.output_text || ""),
    risk_score: extractRiskScore(item),
    decision: decisionLabel(item),
    reason: String(item?.reason || "safe"),
    model: String(item?.llm?.model || "unknown"),
    latencyMs: Number(item?.llm?.latency_ms || 0),
    sessionId: String(item?.session_id || "n/a"),
    redactedFields: Array.isArray(item?.output_analysis?.redacted_fields)
      ? item.output_analysis.redacted_fields
      : [],
  };
}

function mapLocalLog(item) {
  const numericScore = Number(
    item?.risk_score ?? item?.output_risk_score ?? item?.input_risk_score ?? 0,
  );
  const redactedFields = Array.isArray(item?.redacted_fields)
    ? item.redacted_fields
    : Array.isArray(item?.redactedFields)
      ? item.redactedFields
      : [];

  return {
    id: String(item?.id || item?.request_id || crypto.randomUUID()),
    time: formatRelativeTime(item?.timestamp_iso || item?.timestamp),
    timestamp: String(item?.timestamp_iso || item?.timestamp || ""),
    timestampIso: formatIso(item?.timestamp_iso || item?.timestamp),
    user: String(item?.user || item?.email || "U").slice(0, 1).toUpperCase(),
    userId: String(item?.user_id || item?.userId || item?.email || "local-user"),
    email: String(item?.email || ""),
    prompt: String(item?.prompt || item?.input_text || ""),
    outputText: String(item?.output_text || item?.outputText || ""),
    risk_score: Number.isFinite(numericScore) ? numericScore : 0,
    decision: decisionLabel({ decision: item?.decision, redacted: redactedFields.length > 0 }),
    reason: String(item?.reason || "local"),
    model: String(item?.model || item?.llm?.model || "unknown"),
    latencyMs: Number(item?.latencyMs || item?.latency_ms || item?.llm?.latency_ms || 0),
    sessionId: String(item?.session_id || item?.sessionId || "n/a"),
    redactedFields,
  };
}

function riskLevelFromScore(value) {
  const score = Number(value || 0);
  if (score > 85) {
    return "critical";
  }
  if (score > 60) {
    return "high";
  }
  if (score > 30) {
    return "medium";
  }
  return "low";
}

function matchesDecision(log, filterDecision) {
  const targetDecision = normalizeString(filterDecision);
  if (!targetDecision || targetDecision === "all") {
    return true;
  }
  return normalizeString(log?.decision) === targetDecision;
}

function matchesLevel(log, filterLevel) {
  const targetLevel = normalizeString(filterLevel);
  if (!targetLevel || targetLevel === "all") {
    return true;
  }
  return riskLevelFromScore(log?.risk_score) === targetLevel;
}

function matchesSearch(log, searchQuery) {
  const query = normalizeString(searchQuery);
  if (!query) {
    return true;
  }
  const candidates = [
    String(log?.prompt || ""),
    String(log?.outputText || ""),
    String(log?.email || ""),
    String(log?.userId || ""),
    String(log?.reason || ""),
  ];
  return candidates.some((candidate) => candidate.toLowerCase().includes(query));
}

function filterLocalLogs(logs, { decision, level, search }) {
  return [...logs]
    .sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    })
    .filter(
      (log) =>
        matchesDecision(log, decision) &&
        matchesLevel(log, level) &&
        matchesSearch(log, search),
    );
}

function toCsv(logs) {
  const headers = [
    "timestamp",
    "decision",
    "risk_score",
    "user_id",
    "email",
    "session_id",
    "model",
    "latency_ms",
    "reason",
    "prompt",
    "output",
  ];

  const lines = logs.map((log) => [
    log.timestampIso,
    log.decision,
    String(log.risk_score),
    log.userId,
    log.email,
    log.sessionId,
    log.model,
    String(log.latencyMs),
    log.reason,
    log.prompt.replace(/\n/g, " "),
    log.outputText.replace(/\n/g, " "),
  ]);

  return [headers, ...lines]
    .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [filterDecision, setFilterDecision] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [backendLogs, setBackendLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDecision, filterLevel, searchQuery, pageSize]);

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      setLoading(true);
      setError("");

      try {
        const response = await getLogs({
          decision: filterDecision,
          level: filterLevel,
          search: searchQuery,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        });

        if (!isMounted) {
          return;
        }

        const rows = Array.isArray(response?.items) ? response.items : [];
        const total = Number(response?.total_filtered ?? response?.count ?? rows.length);

        if (currentPage > 1 && rows.length === 0 && total > 0) {
          setCurrentPage(Math.max(1, Math.ceil(total / pageSize)));
          return;
        }

        setTotalFiltered(total);
        setBackendLogs(rows.map(mapBackendLog));
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setError(requestError?.message || "Unable to load logs from backend.");
        setTotalFiltered(0);
        setBackendLogs([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadLogs();
    return () => {
      isMounted = false;
    };
  }, [filterDecision, filterLevel, searchQuery, currentPage, pageSize]);

  const userEmail = normalizeString(user?.email);
  const localLogsForUser = useMemo(() => {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const mapped = Array.isArray(parsed) ? parsed.map(mapLocalLog) : [];

      if (!userEmail) {
        return mapped;
      }

      return mapped.filter((log) => normalizeString(log.email) === userEmail);
    } catch (storageError) {
      console.error("Failed to parse audit logs", storageError);
      return [];
    }
  }, [userEmail]);

  const filteredLocalLogs = useMemo(
    () =>
      filterLocalLogs(localLogsForUser, {
        decision: filterDecision,
        level: filterLevel,
        search: searchQuery,
      }),
    [localLogsForUser, filterDecision, filterLevel, searchQuery],
  );

  const usingLocalFallback = !loading && backendLogs.length === 0 && filteredLocalLogs.length > 0;
  const showRemoteError = Boolean(error) && !usingLocalFallback;

  const visibleLogs = useMemo(() => {
    if (usingLocalFallback) {
      const start = (currentPage - 1) * pageSize;
      return filteredLocalLogs.slice(start, start + pageSize);
    }
    return backendLogs;
  }, [usingLocalFallback, filteredLocalLogs, backendLogs, currentPage, pageSize]);

  const totalRecords = usingLocalFallback ? filteredLocalLogs.length : totalFiltered;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const rangeStart = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalRecords, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const exportCsv = () => {
    if (visibleLogs.length === 0) {
      return;
    }
    const csv = toCsv(visibleLogs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page" style={{ flexDirection: "row" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          marginLeft: "210px",
        }}
      >
        <header
          style={{
            padding: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.4rem",
            }}
          >
            Audit Logs
          </h2>
          <button
            className="btn btn-outline"
            style={{ fontSize: "0.8rem" }}
            onClick={exportCsv}
            disabled={visibleLogs.length === 0}
          >
            Export CSV
          </button>
        </header>

        <div
          className="card"
          style={{
            margin: "0 1.25rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <select
            value={filterDecision}
            onChange={(event) => setFilterDecision(event.target.value)}
            className="filter-select"
          >
            <option value="all">All decisions</option>
            <option value="blocked">Blocked</option>
            <option value="redacted">Redacted</option>
            <option value="passed">Passed</option>
          </select>
          <select
            value={filterLevel}
            onChange={(event) => setFilterLevel(event.target.value)}
            className="filter-select"
          >
            <option value="all">All levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={{ flex: 1 }}
            className="filter-select"
          />
          <select
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="filter-select"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "hidden",
            padding: "1.25rem",
            paddingTop: 0,
            marginTop: "1rem",
          }}
        >
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              borderRadius: "10px",
              border: "1px solid var(--border)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <tr>
                  <th className="table-header">Timestamp</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Prompt</th>
                  <th className="table-header">Risk</th>
                  <th className="table-header">Decision</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "14px", color: "var(--brown-light)" }}>
                      Loading logs...
                    </td>
                  </tr>
                ) : null}
                {!loading && showRemoteError ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "14px", color: "var(--danger)" }}>
                      {error}
                    </td>
                  </tr>
                ) : null}
                {!loading && !showRemoteError && visibleLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "14px", color: "var(--brown-light)" }}>
                      No activity yet for this account.
                    </td>
                  </tr>
                ) : null}
                {!loading && !showRemoteError
                  ? visibleLogs.map((log) => <LogEntry key={log.id} log={log} onView={handleViewLog} />)
                  : null}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            padding: "0 1.25rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "var(--brown-light)", fontSize: "0.8rem" }}>
            {loading
              ? "Loading page..."
              : usingLocalFallback
                ? `Showing local logs ${rangeStart}-${rangeEnd} of ${totalRecords}`
                : `Showing ${rangeStart}-${rangeEnd} of ${totalRecords}`}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(1)}
            >
              First
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <span
              style={{
                color: "var(--brown-mid)",
                fontSize: "0.8rem",
                minWidth: "84px",
                textAlign: "center",
              }}
            >
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
            <button
              className="btn btn-outline"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </button>
          </div>
        </div>
      </main>

      <LogDrawer log={selectedLog} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style>{`
        .filter-select {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 6px 10px;
          background: var(--surface);
          color: var(--brown-dark);
          font-family: Inter;
          font-size: 0.85rem;
        }
        .table-header {
          padding: 10px 14px;
          text-align: left;
          font-size: 0.72rem;
          color: var(--brown-light);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
      `}</style>
    </div>
  );
}

const LogEntry = ({ log, onView }) => {
  const score = Number(log.risk_score || 0);
  const normalizedScore = Math.max(0, Math.min(100, score));
  const riskColor =
    score > 85
      ? "var(--danger)"
      : score > 60
        ? "var(--warning)"
        : score > 30
          ? "var(--gold)"
          : "var(--success)";

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td
        style={{
          padding: "10px 14px",
          fontSize: "0.78rem",
          color: "var(--brown-light)",
          whiteSpace: "nowrap",
        }}
      >
        {formatTimestamp(log.timestampIso || log.timestamp, log.time)}
      </td>
      <td
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "var(--gold)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: "0.8rem",
            fontWeight: "bold",
          }}
        >
          {log.user}
        </div>
        <span
          style={{
            fontSize: "0.82rem",
            color: "var(--brown-mid)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "180px",
          }}
        >
          {log.email || log.userId}
        </span>
      </td>
      <td
        style={{
          padding: "10px 14px",
          maxWidth: "240px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: "monospace",
          fontSize: "0.78rem",
          color: "var(--brown-mid)",
        }}
      >
        {log.prompt}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ color: riskColor, fontWeight: "bold" }}>{score}</div>
        <div
          style={{
            width: "40px",
            height: "4px",
            background: "var(--border)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${normalizedScore}%`,
              height: "100%",
              background: riskColor,
            }}
          ></div>
        </div>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <span className={`badge badge-${log.decision.toLowerCase()}`}>{log.decision}</span>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <button
          onClick={() => onView(log)}
          className="btn btn-outline"
          style={{ fontSize: "0.78rem", padding: "4px 10px" }}
        >
          View -&gt;
        </button>
      </td>
    </tr>
  );
};

const LogDrawer = ({ log, open, onClose }) => {
  if (!log) {
    return null;
  }

  return (
    <div
      className="log-drawer"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: "380px",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        zIndex: 100,
        overflowY: "auto",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <button
        onClick={onClose}
        className="log-drawer__close"
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          fontSize: "1.2rem",
          cursor: "pointer",
          color: "var(--brown-light)",
          background: "none",
          border: "none",
        }}
      >
        x
      </button>
      <h3 className="drawer-title" style={{ fontFamily: "'Playfair Display', serif" }}>
        Log Details
      </h3>

      <DrawerSection title="ORIGINAL PROMPT" content={log.prompt || "n/a"} />
      <DrawerSection title="MODEL OUTPUT" content={log.outputText || "n/a"} />

      <div>
        <h4 className="label-style">DECISION</h4>
        <div
          className={`badge badge-${log.decision.toLowerCase()}`}
          style={{ width: "100%", justifyContent: "center", height: "30px" }}
        >
          {log.decision}
        </div>
      </div>

      <div>
        <h4 className="label-style">METADATA</h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            fontSize: "0.8rem",
            gap: "4px",
          }}
        >
          <span className="meta-label">Timestamp</span>
          <span>{log.timestampIso || log.timestamp || new Date().toISOString()}</span>
          <span className="meta-label">Session ID</span>
          <span>{log.sessionId}</span>
          <span className="meta-label">User ID</span>
          <span>{log.userId}</span>
          <span className="meta-label">Model</span>
          <span>{log.model}</span>
          <span className="meta-label">Latency</span>
          <span>{log.latencyMs}ms</span>
          <span className="meta-label">Reason</span>
          <span>{log.reason}</span>
          <span className="meta-label">Redacted fields</span>
          <span>{log.redactedFields.join(", ") || "none"}</span>
        </div>
      </div>
      <style>{`
        .label-style { font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brown-light); margin-bottom: 0.5rem; }
        .drawer-title { color: var(--brown-dark); }
        .meta-label { color: var(--brown-light); }
        .drawer-box { background: var(--cream); border: 1px solid var(--border); color: var(--brown-dark); }
        body.theme-dark .log-drawer { color: var(--text-main); }
        body.theme-dark .log-drawer .drawer-title { color: var(--text-main); }
        body.theme-dark .log-drawer .label-style,
        body.theme-dark .log-drawer .meta-label { color: var(--text-soft); }
        body.theme-dark .log-drawer .drawer-box { color: #3b2a1e; }
        body.theme-dark .log-drawer__close { color: var(--text-main); }
      `}</style>
    </div>
  );
};

const DrawerSection = ({ title, content }) => (
  <div>
    <h4 className="label-style">{title}</h4>
    <div
      className="drawer-box"
      style={{
        borderRadius: "8px",
        padding: "0.75rem",
        fontSize: "0.82rem",
        lineHeight: 1.6,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </div>
  </div>
);
