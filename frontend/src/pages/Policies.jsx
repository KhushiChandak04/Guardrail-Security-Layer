import React, { useEffect, useMemo, useState } from "react";

import Sidebar from "../components/Sidebar";
import { getPolicies, updatePolicies } from "../services/api";

const DEFAULT_PII = {
  Aadhaar: true,
  PAN: true,
  UPI: true,
  GST: true,
  PHONE_NUMBER: true,
  EMAIL_ADDRESS: true,
};

export default function Policies() {
  const [blockThreshold, setBlockThreshold] = useState(80);
  const [warnThreshold, setWarnThreshold] = useState(50);
  const [redactPII, setRedactPII] = useState(true);
  const [honeypot, setHoneypot] = useState(false);
  const [multiTurn, setMultiTurn] = useState(true);
  const [blockedTopics, setBlockedTopics] = useState([]);
  const [newTopic, setNewTopic] = useState("");
  const [piiDetection, setPiiDetection] = useState(DEFAULT_PII);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPolicy() {
      setLoading(true);
      setError("");
      setStatus("");

      try {
        const response = await getPolicies();
        const policy = response?.policy || {};

        if (!isMounted) {
          return;
        }

        setBlockThreshold(Number(policy.max_risk_score || 80));
        setWarnThreshold(Number(policy.sanitize_risk_score || 50));
        setRedactPII(Boolean(policy.redact_pii));
        setHoneypot(Boolean(policy.honeypot_mode));
        setMultiTurn(Boolean(policy.multi_turn_tracking));
        setBlockedTopics(Array.isArray(policy.blocked_topics) ? policy.blocked_topics : []);
        setPiiDetection({
          ...DEFAULT_PII,
          ...(typeof policy.pii_detection === "object" && policy.pii_detection ? policy.pii_detection : {}),
        });
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setError(requestError?.message || "Unable to load policy from backend.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPolicy();
    return () => {
      isMounted = false;
    };
  }, []);

  const blockCategories = useMemo(() => {
    const categories = ["prompt_injection", "system_extraction", "secret_exposure"];
    if (redactPII) {
      categories.push("pii_detected");
    }
    return categories;
  }, [redactPII]);

  const handleAddTopic = () => {
    const normalized = newTopic.trim();
    if (!normalized || blockedTopics.includes(normalized)) {
      return;
    }

    setBlockedTopics((prev) => [...prev, normalized]);
    setNewTopic("");
  };

  const handleRemoveTopic = (topicToRemove) => {
    setBlockedTopics((prev) => prev.filter((topic) => topic !== topicToRemove));
  };

  const handlePiiChange = (pii) => {
    setPiiDetection((prev) => ({ ...prev, [pii]: !prev[pii] }));
  };

  const handleSave = async () => {
    setError("");
    setStatus("");
    setSaving(true);

    try {
      const response = await updatePolicies({
        max_risk_score: Number(blockThreshold),
        sanitize_risk_score: Number(warnThreshold),
        redact_pii: Boolean(redactPII),
        block_categories: blockCategories,
        blocked_topics: blockedTopics,
        pii_detection: piiDetection,
        honeypot_mode: Boolean(honeypot),
        multi_turn_tracking: Boolean(multiTurn),
      });

      const policy = response?.policy || {};
      setBlockThreshold(Number(policy.max_risk_score || blockThreshold));
      setWarnThreshold(Number(policy.sanitize_risk_score || warnThreshold));
      setStatus("Policy saved to backend database.");
    } catch (requestError) {
      setError(requestError?.message || "Unable to save policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page policies-page" style={{ flexDirection: "row" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem",
          gap: "1rem",
          overflow: "hidden",
          marginLeft: "210px",
        }}
      >
        <header>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.4rem",
            }}
          >
            Policies
          </h2>
          <p style={{ color: "var(--brown-light)", fontSize: "0.85rem" }}>
            Configure guardrail thresholds and rules from live backend policy storage.
          </p>
        </header>

        {loading ? (
          <div className="card" style={{ padding: "0.75rem", color: "var(--brown-light)" }}>
            Loading policy configuration...
          </div>
        ) : null}
        {error ? (
          <div className="card" style={{ padding: "0.75rem", color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="card" style={{ padding: "0.75rem", color: "var(--success)" }}>
            {status}
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            overflow: "hidden",
          }}
        >
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h3 className="label-style">THRESHOLDS</h3>
            <SliderControl
              label="Block above"
              value={blockThreshold}
              onChange={setBlockThreshold}
              color="var(--gold)"
              description="Interactions scoring above this are automatically blocked"
            />
            <SliderControl
              label="Warn above"
              value={warnThreshold}
              onChange={setWarnThreshold}
              color="var(--warning)"
              description="Interactions above this trigger redaction"
            />
            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
            <ToggleControl
              label="Redact PII"
              description="Automatically mask PII before LLM call"
              enabled={redactPII}
              onToggle={() => setRedactPII(!redactPII)}
            />
            <ToggleControl
              label="Honeypot mode"
              description="Feed fake responses to detected attackers"
              enabled={honeypot}
              onToggle={() => setHoneypot(!honeypot)}
            />
            <ToggleControl
              label="Multi-turn tracking"
              description="Accumulate risk across conversation session"
              enabled={multiTurn}
              onToggle={() => setMultiTurn(!multiTurn)}
            />
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h3 className="label-style">RULES</h3>
            <div>
              <h4 className="policy-section-title">Blocked topics</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {blockedTopics.map((topic) => (
                  <div key={topic} className="chip">
                    {topic}
                    <button onClick={() => handleRemoveTopic(topic)} className="chip-close">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", marginTop: "0.75rem" }}>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(event) => setNewTopic(event.target.value)}
                  placeholder="Add topic"
                  className="filter-select"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAddTopic}
                  className="btn btn-outline"
                  style={{ marginLeft: "0.5rem", padding: "6px 10px" }}
                >
                  Add
                </button>
              </div>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
            <div>
              <h4 className="policy-section-title">PII detection profile</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {Object.keys(piiDetection).map((pii) => (
                  <CheckboxControl
                    key={pii}
                    label={pii}
                    checked={piiDetection[pii]}
                    onChange={() => handlePiiChange(pii)}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleSave}
              className="btn btn-cta"
              style={{ width: "100%", marginTop: "auto" }}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save policy"}
            </button>
          </div>
        </div>
      </main>
      <style>{`
        .label-style { font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brown-light); }
        .policy-section-title { color: var(--brown-mid); font-size: 0.8rem; font-weight: 500; margin-bottom: 0.5rem; }
        .chip { background: var(--cream); border: 1px solid var(--border); border-radius: 20px; padding: 4px 10px; font-size: 0.78rem; color: var(--brown-dark); display: flex; align-items: center; gap: 6px; }
        .chip-close { background: none; border: none; color: var(--brown-light); cursor: pointer; font-size: 1rem; padding: 0; }
        .filter-select { border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: var(--surface); color: var(--brown-dark); font-family: Inter; font-size: 0.85rem; }
        .filter-select::placeholder { color: rgba(59, 42, 30, 0.6); }
        body.theme-dark .policies-page .label-style { color: var(--text-main); }
        body.theme-dark .policies-page .policy-section-title { color: var(--text-soft); }
        body.theme-dark .policies-page .chip { background: rgba(241, 199, 108, 0.12); border-color: var(--border); color: var(--text-main); }
        body.theme-dark .policies-page .chip-close { color: var(--text-soft); }
        body.theme-dark .policies-page .filter-select { background: #1c140f; color: var(--text-main); border-color: var(--border); }
        body.theme-dark .policies-page .filter-select::placeholder { color: rgba(244, 233, 216, 0.55); }
      `}</style>
    </div>
  );
}

const SliderControl = ({ label, value, onChange, color, description }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <label style={{ color: "var(--brown-dark)" }}>{label}</label>
      <span style={{ color, fontWeight: "bold" }}>{value}</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ width: "100%", accentColor: "var(--gold)", marginTop: "0.25rem" }}
    />
    <p style={{ fontSize: "0.75rem", color: "var(--brown-light)" }}>{description}</p>
  </div>
);

const ToggleControl = ({ label, description, enabled, onToggle }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div>
      <div style={{ color: "var(--brown-dark)", fontSize: "0.9rem" }}>{label}</div>
      <p style={{ fontSize: "0.75rem", color: "var(--brown-light)" }}>{description}</p>
    </div>
    <button
      onClick={onToggle}
      className="theme-toggle"
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        background: enabled ? "var(--gold)" : "var(--border)",
        position: "relative",
        cursor: "pointer",
        border: "none",
        padding: "2px",
      }}
    >
      <div
        className="theme-toggle__knob"
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "var(--surface)",
          position: "absolute",
          transition: "transform 0.2s",
          transform: enabled ? "translateX(20px)" : "translateX(0)",
        }}
      ></div>
    </button>
  </div>
);

const CheckboxControl = ({ label, checked, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ accentColor: "var(--gold)", width: "16px", height: "16px" }}
    />
    <label style={{ fontSize: "0.85rem", color: "var(--brown-dark)" }}>{label}</label>
  </div>
);
