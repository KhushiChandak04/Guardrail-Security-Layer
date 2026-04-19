import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { probeExtensionConnection } from "../services/extensionBridge";
import underdogLogo from "../assets/underdog-logo.png";

const EXTENSION_CHECK_TIMEOUT_MS = 3000;

export default function ExtensionRequired() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState({
    connected: false,
    reason: "not_checked",
  });

  const targetPath = useMemo(() => {
    const fromState = location.state?.from;
    if (typeof fromState === "string" && fromState.startsWith("/")) {
      return fromState;
    }
    return "/dashboard";
  }, [location.state]);

  const checkConnection = useCallback(async () => {
    setChecking(true);

    try {
      const result = await probeExtensionConnection({ timeoutMs: EXTENSION_CHECK_TIMEOUT_MS });
      setStatus({
        connected: Boolean(result?.connected),
        reason: String(result?.reason || "ok"),
      });
      return Boolean(result?.connected);
    } catch {
      setStatus({
        connected: false,
        reason: "check_failed",
      });
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    checkConnection();
  }, [isAuthenticated, isLoading, navigate, checkConnection]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || status.connected || checking) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      checkConnection();
    }, 2200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checking, checkConnection, isAuthenticated, isLoading, status.connected]);

  const handleContinue = async () => {
    const connected = await checkConnection();
    if (!connected) {
      return;
    }
    navigate(targetPath, { replace: true });
  };

  const statusText = status.connected
    ? "Connected"
    : checking
      ? "Checking..."
      : "Not connected";

  if (isLoading) {
    return <div className="page" style={{ padding: "2rem" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className="page"
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1.5rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "min(720px, 96vw)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img
            src={underdogLogo}
            alt="Underdog logo"
            className="brand-logo brand-logo--sm"
          />
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "'Playfair Display', serif",
                color: "var(--brown-dark)",
              }}
            >
              Extension Required
            </h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.86rem", color: "var(--brown-mid)" }}>
              Connect the Guardrail extension to continue.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "0.8rem 0.9rem",
            background: status.connected ? "var(--success-bg)" : "var(--warning-bg)",
            color: status.connected ? "var(--success-text)" : "var(--warning-text)",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.6rem",
            flexWrap: "wrap",
          }}
        >
          <span>Extension status: {statusText}</span>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={checkConnection}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check extension connection"}
          </button>
          <button
            type="button"
            className="btn btn-cta"
            onClick={handleContinue}
            disabled={checking}
          >
            Continue to secured workspace
          </button>
          <button type="button" className="btn btn-outline" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
