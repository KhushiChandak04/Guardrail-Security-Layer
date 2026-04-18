import React, { useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth.jsx";
import { sendChatPrompt } from "../services/api";
import { getFirebaseAuth } from "../services/firebase";

const AUDIT_STORAGE_KEY = "underdog-audit-logs";
const SESSION_STORAGE_KEY = "underdog_guardrail_session_id";

const loadAuditLogs = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to read audit logs", error);
    return [];
  }
};

const saveAuditLog = (entry) => {
  if (typeof window === "undefined") {
    return;
  }

  const logs = loadAuditLogs();
  const next = [entry, ...logs].slice(0, 200);
  window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
};

function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextSessionId = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

function riskLevelToScore(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return 85;
  }
  if (normalized === "medium") {
    return 60;
  }
  if (normalized === "low") {
    return 20;
  }
  return 0;
}

function buildRiskSnapshot(result, sessionId) {
  const blocked = Boolean(result?.blocked);
  const redactions = Array.isArray(result?.redactions) ? result.redactions : [];
  const decision = blocked ? "BLOCKED" : redactions.length > 0 ? "REDACTED" : "PASSED";
  const riskLevel = blocked ? result?.ingress_risk : result?.output_risk;

  return {
    decision,
    risk_score: riskLevelToScore(riskLevel),
    risk_level: String(riskLevel || "low"),
    reasons: blocked
      ? [String(result?.message || "Request blocked by guardrails")]
      : redactions.length > 0
        ? redactions.map((field) => `Redacted ${field}`)
        : ["No policy violations detected"],
    detected_issues: blocked
      ? [{ type: "Policy", detail: String(result?.ingress_risk || "high"), confidence: 1 }]
      : redactions.map((field) => ({
          type: "PII",
          detail: String(field),
          confidence: 1,
        })),
    sanitized_prompt: blocked ? "Blocked before model call" : "Forwarded to model",
    llm_response: String(result?.message || ""),
    output_clean: !blocked && redactions.length === 0,
    pii_in_output: redactions,
    request_id: String(result?.request_id || ""),
    session_id: sessionId,
    timestamp: String(result?.timestamp || new Date().toISOString()),
    ingress_risk: String(result?.ingress_risk || "low"),
    output_risk: String(result?.output_risk || "low"),
  };
}

function persistAuditLog({ user, prompt, result, sessionId }) {
  const blocked = Boolean(result?.blocked);
  const redactions = Array.isArray(result?.redactions) ? result.redactions : [];

  const decisionLabel = blocked ? "Blocked" : redactions.length > 0 ? "Redacted" : "Passed";
  const displayName = String(user?.displayName || user?.email || "U");

  saveAuditLog({
    id: String(result?.request_id || crypto.randomUUID()),
    request_id: String(result?.request_id || ""),
    timestamp: String(result?.timestamp || new Date().toISOString()),
    user: displayName.slice(0, 1).toUpperCase(),
    user_id: String(user?.uid || "anonymous"),
    email: String(user?.email || ""),
    prompt,
    input_text: prompt,
    output_text: String(result?.message || ""),
    risk_score: blocked
      ? riskLevelToScore(result?.ingress_risk)
      : riskLevelToScore(result?.output_risk),
    input_risk_score: riskLevelToScore(result?.ingress_risk),
    output_risk_score: riskLevelToScore(result?.output_risk),
    decision: decisionLabel,
    reason: blocked ? "blocked" : redactions.length > 0 ? "redacted" : "safe",
    redacted_fields: redactions,
    redacted: redactions.length > 0,
    session_id: sessionId,
    model: String(result?.llm?.model || "unknown"),
  });
}

export default function SecureChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentRisk, setCurrentRisk] = useState(null);
  const [error, setError] = useState("");

  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const handleSend = async () => {
    const prompt = inputText.trim();
    if (!prompt || isLoading) {
      return;
    }

    setError("");
    setCurrentRisk(null);
    setInputText("");
    setIsLoading(true);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const auth = getFirebaseAuth();
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : "";

      const result = await sendChatPrompt({
        prompt,
        idToken,
        sessionId,
        metadata: {
          source: "secure_chat_page",
          client_timestamp: new Date().toISOString(),
          prompt_length: String(prompt.length),
          user_email: String(user?.email || ""),
        },
      });

      const blocked = Boolean(result?.blocked);
      const redactions = Array.isArray(result?.redactions) ? result.redactions : [];

      if (blocked || redactions.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "guard",
            decision: blocked ? "BLOCKED" : "REDACTED",
            detectedIssues: blocked
              ? [{ type: "Policy", detail: String(result?.ingress_risk || "high") }]
              : redactions.map((field) => ({ type: "PII", detail: String(field) })),
          },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: String(result?.message || "Request blocked by guardrail policy."),
          outputClean: !blocked && redactions.length === 0,
        },
      ]);

      setCurrentRisk(buildRiskSnapshot(result, sessionId));
      persistAuditLog({ user, prompt, result, sessionId });
    } catch (requestError) {
      const message = requestError?.message || "Unable to reach backend right now.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          outputClean: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page" style={{ flexDirection: "row" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          height: "100vh",
          marginLeft: "210px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          <header
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1rem",
              }}
            >
              Secure Chat
            </h2>
            <div className="badge badge-passed">
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--success)",
                  marginRight: "6px",
                }}
              ></span>
              Guardrail active
            </div>
          </header>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            <div
              style={{
                alignSelf: "center",
                background: "var(--overlay)",
                fontSize: "0.75rem",
                color: "var(--brown-light)",
                padding: "4px 12px",
                borderRadius: "20px",
              }}
            >
              Session ID: {sessionId}
            </div>
            {messages.length === 0 ? (
              <div
                style={{
                  alignSelf: "center",
                  color: "var(--brown-light)",
                  fontSize: "0.82rem",
                  marginTop: "2rem",
                }}
              >
                Start a conversation. Every prompt and response is logged in backend storage.
              </div>
            ) : null}
            {messages.map((msg) => {
              if (msg.role === "user") {
                return <UserBubble key={msg.id} content={msg.content} />;
              }
              if (msg.role === "guard") {
                return (
                  <GuardBubble
                    key={msg.id}
                    decision={msg.decision}
                    detectedIssues={msg.detectedIssues}
                  />
                );
              }
              return (
                <AssistantBubble
                  key={msg.id}
                  content={msg.content}
                  outputClean={Boolean(msg.outputClean)}
                />
              );
            })}
            {isLoading ? <div style={{ alignSelf: "flex-start" }}>...</div> : null}
            {error ? (
              <div style={{ color: "var(--danger)", fontSize: "0.78rem" }}>{error}</div>
            ) : null}
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: "0.875rem",
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message..."
              style={{
                flex: 1,
                height: "44px",
                resize: "none",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--surface)",
                color: "var(--brown-dark)",
                fontFamily: "Inter",
                fontSize: "0.875rem",
                padding: "10px 14px",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="btn btn-gold"
              style={{ height: "44px", minWidth: "72px" }}
            >
              Send
            </button>
          </div>
        </div>
        <Inspector risk={currentRisk} />
      </main>
    </div>
  );
}

const UserBubble = ({ content }) => (
  <div
    style={{
      alignSelf: "flex-end",
      maxWidth: "75%",
      background: "var(--gold)",
      color: "#fff",
      borderRadius: "12px 12px 2px 12px",
      padding: "0.625rem 0.875rem",
      fontSize: "0.875rem",
    }}
  >
    {content}
  </div>
);

const GuardBubble = ({ decision, detectedIssues }) => (
  <div
    style={{
      alignSelf: "center",
      maxWidth: "90%",
      background: "var(--warning-bg)",
      border: "1px solid var(--warning)",
      borderRadius: "10px",
      padding: "0.625rem 0.875rem",
      fontSize: "0.78rem",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--warning-text)",
        fontWeight: 600,
      }}
    >
      Guardrail decision: {decision}
    </div>
    <div style={{ marginTop: "4px" }}>
      Detected: {detectedIssues.map((issue) => issue.detail || issue.type).join(", ") || "none"}
    </div>
  </div>
);

const AssistantBubble = ({ content, outputClean }) => (
  <div style={{ alignSelf: "flex-start", maxWidth: "75%" }}>
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--success)",
        borderRadius: "12px 12px 12px 2px",
        padding: "0.625rem 0.875rem",
        fontSize: "0.875rem",
        lineHeight: 1.6,
      }}
    >
      {content}
    </div>
    <div
      style={{
        fontSize: "0.7rem",
        color: outputClean ? "var(--success-text)" : "var(--warning-text)",
        marginTop: "4px",
      }}
    >
      {outputClean ? "Output scanned · Clean" : "Output scanned · Review required"}
    </div>
  </div>
);

const Inspector = ({ risk }) => {
  if (!risk) {
    return (
      <div
        style={{
          borderLeft: "1px solid var(--border)",
          padding: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--brown-light)", fontSize: "0.85rem" }}>
          Send a message to see guardrail analysis from live backend response.
        </p>
      </div>
    );
  }

  const riskColor =
    risk.risk_score > 70
      ? "var(--danger)"
      : risk.risk_score > 40
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div
      style={{
        borderLeft: "1px solid var(--border)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        overflowY: "auto",
      }}
    >
      <h3 className="label-style">Guardrail Inspector</h3>
      <div style={{ textAlign: "center" }}>
        <svg width="120" height="120" viewBox="0 0 36 36" style={{ margin: "0 auto" }}>
          <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={riskColor}
            strokeWidth="3"
            strokeDasharray={`${(risk.risk_score / 100) * 100.5} 100.5`}
            transform="rotate(-90 18 18)"
          />
          <text x="18" y="20.5" textAnchor="middle" fontSize="8" fill={riskColor} fontWeight="700">
            {risk.risk_score}
          </text>
        </svg>
        <div style={{ marginTop: "0.5rem" }}>
          <span className={`badge badge-${risk.decision.toLowerCase()}`}>{risk.decision}</span>
        </div>
      </div>

      <div>
        <h4 className="label-style">Risk</h4>
        <div className="card" style={{ padding: "0.75rem" }}>
          <div>Ingress: {risk.ingress_risk}</div>
          <div>Output: {risk.output_risk}</div>
          <div>Session: {risk.session_id}</div>
          <div>Request: {risk.request_id || "n/a"}</div>
        </div>
      </div>

      <div>
        <h4 className="label-style">Detected Issues</h4>
        <div className="card" style={{ padding: "0.75rem", fontFamily: "monospace" }}>
          {risk.detected_issues.length > 0
            ? risk.detected_issues.map((issue) => `${issue.type}: ${issue.detail}`).join("\n")
            : "No explicit issue labels returned"}
        </div>
      </div>

      <div>
        <h4 className="label-style">Redactions</h4>
        <div className="card" style={{ padding: "0.75rem", fontFamily: "monospace" }}>
          {risk.pii_in_output.length > 0 ? risk.pii_in_output.join(", ") : "None"}
        </div>
      </div>

      <div>
        <h4 className="label-style">Model Output</h4>
        <div className="card" style={{ padding: "0.75rem", lineHeight: 1.6 }}>
          {risk.llm_response || "No output"}
        </div>
      </div>
    </div>
  );
};
