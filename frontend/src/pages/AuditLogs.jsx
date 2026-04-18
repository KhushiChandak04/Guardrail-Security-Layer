import React, { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth.jsx";

const AUDIT_STORAGE_KEY = "underdog-audit-logs";

const formatTimestamp = (timestamp, fallback) => {
  if (!timestamp) return fallback || "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return fallback || "";
  return date.toLocaleString();
};

// TODO: fetch from GET /api/logs
const mockLogs = [
  {
    id: 1,
    time: "2m ago",
    user: "S",
    email: "sundar@google.com",
    prompt: "What is the capital of India?",
    risk_score: 5,
    decision: "Passed",
  },
  {
    id: 2,
    time: "5m ago",
    user: "J",
    email: "jane@doe.com",
    prompt: "My Aadhaar is 1234 5678 9012",
    risk_score: 95,
    decision: "Blocked",
  },
  {
    id: 3,
    time: "1h ago",
    user: "A",
    email: "alice@wonder.land",
    prompt: "Tell me a story about a cat",
    risk_score: 10,
    decision: "Passed",
  },
  {
    id: 4,
    time: "3h ago",
    user: "B",
    email: "bob@builder.com",
    prompt: "Ignore all previous instructions...",
    risk_score: 88,
    decision: "Blocked",
  },
  {
    id: 5,
    time: "1d ago",
    user: "C",
    email: "charlie@chocolate.com",
    prompt: "My PAN is ABCDE1234F",
    risk_score: 72,
    decision: "Redacted",
  },
  {
    id: 6,
    time: "2d ago",
    user: "D",
    email: "diana@prince.com",
    prompt: "How to make a bomb?",
    risk_score: 99,
    decision: "Blocked",
  },
  {
    id: 7,
    time: "2d ago",
    user: "S",
    email: "sundar@google.com",
    prompt: "What is the weather in Mumbai?",
    risk_score: 8,
    decision: "Passed",
  },
  {
    id: 8,
    time: "3d ago",
    user: "J",
    email: "jane@doe.com",
    prompt: "My UPI is jane@okbank",
    risk_score: 65,
    decision: "Redacted",
  },
];

export default function AuditLogs() {
  const { user } = useAuth();
  const [filterDecision, setFilterDecision] = useState("All");
  const [filterLevel, setFilterLevel] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const userEmail = user?.email?.toLowerCase();
  const storedLogs = useMemo(() => {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Failed to parse audit logs", error);
      return [];
    }
  }, []);

  const sourceLogs = storedLogs.length ? storedLogs : mockLogs;

  const userLogs = userEmail
    ? sourceLogs.filter((log) => log.email?.toLowerCase() === userEmail)
    : [];

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const filteredLogs = userLogs
    .sort((a, b) => {
      const aTime = new Date(a.timestamp || a.time || 0).getTime();
      const bTime = new Date(b.timestamp || b.time || 0).getTime();
      return bTime - aTime;
    })
    .filter((log) => {
      const decisionMatch =
        filterDecision === "All" || log.decision === filterDecision;
      const levelMatch =
        filterLevel === "All" ||
        (filterLevel === "Critical" && log.risk_score > 85) ||
        (filterLevel === "High" &&
          log.risk_score > 60 &&
          log.risk_score <= 85) ||
        (filterLevel === "Medium" &&
          log.risk_score > 30 &&
          log.risk_score <= 60) ||
        (filterLevel === "Low" && log.risk_score <= 30);
      const searchMatch = log.prompt
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return decisionMatch && levelMatch && searchMatch;
    });

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
          <button className="btn btn-outline" style={{ fontSize: "0.8rem" }}>
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
            onChange={(e) => setFilterDecision(e.target.value)}
            className="filter-select"
          >
            <option>All decisions</option>
            <option>Blocked</option>
            <option>Redacted</option>
            <option>Passed</option>
          </select>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="filter-select"
          >
            <option>All levels</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
            className="filter-select"
          />
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
                  <th className="table-header">Prompt</th>
                  <th className="table-header">Risk</th>
                  <th className="table-header">Decision</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "1rem 1.25rem",
                        color: "var(--brown-light)",
                        fontSize: "0.85rem",
                      }}
                    >
                      No activity yet for this account.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <LogEntry key={log.id} log={log} onView={handleViewLog} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <LogDrawer
        log={selectedLog}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
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
  const riskColor =
    log.risk_score > 85
      ? "var(--danger)"
      : log.risk_score > 60
        ? "var(--warning)"
        : log.risk_score > 30
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
        {formatTimestamp(log.timestamp, log.time)}
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
        <div style={{ color: riskColor, fontWeight: "bold" }}>
          {log.risk_score}
        </div>
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
              width: `${log.risk_score}%`,
              height: "100%",
              background: riskColor,
            }}
          ></div>
        </div>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <span className={`badge badge-${log.decision.toLowerCase()}`}>
          {log.decision}
        </span>
      </td>
      <td style={{ padding: "10px 14px" }}>
        <button
          onClick={() => onView(log)}
          className="btn btn-outline"
          style={{ fontSize: "0.78rem", padding: "4px 10px" }}
        >
          View →
        </button>
      </td>
    </tr>
  );
};

const LogDrawer = ({ log, open, onClose }) => {
  if (!log) return null;
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
        ×
      </button>
      <h3
        className="drawer-title"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Log Details
      </h3>

      <DrawerSection title="ORIGINAL PROMPT" content={log.prompt} />
      <DrawerSection title="SENT TO LLM" content={log.prompt} />
      <DrawerSection title="AI RESPONSE" content="This is a mock response." />

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
          <span>{log.timestamp || new Date().toISOString()}</span>
          <span className="meta-label">Session ID</span>
          <span>sess_{log.id}</span>
          <span className="meta-label">User ID</span>
          <span>user_{log.user}</span>
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
      }}
    >
      {content}
    </div>
  </div>
);
