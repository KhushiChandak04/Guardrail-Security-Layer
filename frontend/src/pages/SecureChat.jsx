import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth.jsx";

const AUDIT_STORAGE_KEY = "underdog-audit-logs";

const loadAuditLogs = () => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to read audit logs", error);
    return [];
  }
};

const saveAuditLog = (entry) => {
  const logs = loadAuditLogs();
  const next = [entry, ...logs].slice(0, 200);
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
};

export default function SecureChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentRisk, setCurrentRisk] = useState(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: inputText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    setCurrentRisk(null);

    // TODO: replace mock with real API call
    // await api.secureChat({ prompt: inputText })
    setTimeout(() => {
      const mockResponse = {
        decision: "REDACT",
        risk_score: 61,
        risk_level: "high",
        reasons: ["Aadhaar number detected", "PII in input"],
        detected_issues: [
          { type: "Indian PII", detail: "Aadhaar number", confidence: 0.98 },
        ],
        sanitized_prompt: "My [AADHAAR_REDACTED], help me with KYC",
        llm_response: "Sure! For KYC you will need valid ID proof...",
        output_clean: true,
        pii_in_output: [],
      };

      setCurrentRisk(mockResponse);

      const decisionLabel =
        mockResponse.decision === "REDACT"
          ? "Redacted"
          : mockResponse.decision === "BLOCK"
            ? "Blocked"
            : "Passed";

      saveAuditLog({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        user: user?.name?.[0] || "U",
        email: user?.email || "unknown@underdog.ai",
        prompt: userMessage.content,
        risk_score: mockResponse.risk_score,
        decision: decisionLabel,
      });

      const guardMessage = {
        id: Date.now() + 1,
        role: "guard",
        decision: mockResponse.decision,
        detectedIssues: mockResponse.detected_issues,
      };

      const assistantMessage = {
        id: Date.now() + 2,
        role: "assistant",
        content: mockResponse.llm_response,
        outputClean: mockResponse.output_clean,
      };

      setMessages((prev) => [...prev, guardMessage, assistantMessage]);
      setIsLoading(false);
    }, 1200);
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
        {/* Left Panel */}
        <div
          style={{ display: "flex", flexDirection: "column", height: "100vh" }}
        >
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
              Underdog is monitoring this conversation
            </div>
            {messages.map((msg) => {
              if (msg.role === "user")
                return <UserBubble key={msg.id} content={msg.content} />;
              if (msg.role === "guard")
                return (
                  <GuardBubble
                    key={msg.id}
                    decision={msg.decision}
                    detectedIssues={msg.detectedIssues}
                  />
                );
              if (msg.role === "assistant")
                return (
                  <AssistantBubble
                    key={msg.id}
                    content={msg.content}
                    outputClean={msg.outputClean}
                  />
                );
              return null;
            })}
            {isLoading && <div style={{ alignSelf: "flex-start" }}>...</div>}
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
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
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
        {/* Right Panel */}
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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Guardrail intercepted
    </div>
    <div style={{ marginTop: "4px" }}>
      Detected: {detectedIssues.map((i) => i.type).join(", ")}
    </div>
    <div style={{ marginTop: "4px" }}>
      Action: <span className="badge badge-redacted">{decision}</span>
    </div>
    {decision === "REDACT" && (
      <div style={{ marginTop: "4px" }}>Sanitised prompt sent to model</div>
    )}
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
      {outputClean ? "Output scanned · Clean" : "Output: PII masked"}
    </div>
  </div>
);

const Inspector = ({ risk }) => {
  const [isPromptVisible, setPromptVisible] = useState(false);

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
          Send a message to see guardrail analysis
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

      {/* Risk Score */}
      <div style={{ textAlign: "center" }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 36 36"
          style={{ margin: "0 auto" }}
        >
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
            strokeDasharray={`${(risk.risk_score / 100) * 100.5} 100.5`}
            transform="rotate(-90 18 18)"
          />
          <text
            x="18"
            y="22"
            textAnchor="middle"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "10px",
              fill: riskColor,
            }}
          >
            {risk.risk_score}
          </text>
        </svg>
        <div
          className={`badge badge-${risk.risk_level}`}
          style={{ marginTop: "0.5rem" }}
        >
          {risk.risk_level}
        </div>
      </div>

      {/* Detected Issues */}
      <div>
        <h3 className="label-style">DETECTED ISSUES</h3>
        {risk.detected_issues.length > 0 ? (
          risk.detected_issues.map((issue, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
              }}
            >
              <span>
                {issue.type}: {issue.detail}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--brown-light)",
                  fontSize: "0.75rem",
                }}
              >
                {issue.confidence * 100}%
              </span>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--success-text)", fontSize: "0.82rem" }}>
            No issues detected
          </p>
        )}
      </div>

      {/* Decision */}
      <div>
        <h3 className="label-style">DECISION</h3>
        <div
          className={`badge badge-${risk.decision.toLowerCase()}`}
          style={{
            width: "100%",
            justifyContent: "center",
            height: "40px",
            fontSize: "0.9rem",
          }}
        >
          {risk.decision}
        </div>
      </div>

      {/* What was sent to LLM */}
      <div>
        <button
          onClick={() => setPromptVisible(!isPromptVisible)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 12px",
            background: "transparent",
            cursor: "pointer",
            color: "var(--brown-dark)",
          }}
        >
          What was sent to LLM
          <span>{isPromptVisible ? "▲" : "▼"}</span>
        </button>
        {isPromptVisible && (
          <div
            style={{
              background: "var(--cream)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem",
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--brown-mid)",
              lineHeight: 1.6,
              marginTop: "0.5rem",
            }}
          >
            {risk.sanitized_prompt}
          </div>
        )}
      </div>

      {/* Output Check */}
      <div>
        <h3 className="label-style">OUTPUT CHECK</h3>
        <div
          style={{
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>PII in response</span>
          <span
            style={{
              color:
                risk.pii_in_output.length === 0
                  ? "var(--success-text)"
                  : "var(--danger-text)",
            }}
          >
            {risk.pii_in_output.length === 0
              ? "None found"
              : `${risk.pii_in_output.length} found`}
          </span>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Secrets detected</span>
          <span style={{ color: "var(--success-text)" }}>None</span>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Toxicity score</span>
          <span style={{ color: "var(--success-text)" }}>0.02 · Clean</span>
        </div>
      </div>
      <style>{`
                .label-style {
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--brown-light);
                    margin-bottom: 0.75rem;
                }
                .badge-high { background: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning); }
                .badge-redact { background: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning); }
                .badge-blocked { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger); }
                .badge-allowed { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success); }
            `}</style>
    </div>
  );
};
