import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/globals.css";

const RUNTIME_CACHE_VERSION = "2026-04-18-fresh-start";
const RUNTIME_CACHE_KEY = "underdog_runtime_cache_version";
const TRANSIENT_CACHE_KEYS = [
  "underdog-audit-logs",
  "underdog_guardrail_session_id",
];

function bootstrapRuntimeState() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const currentVersion = window.localStorage.getItem(RUNTIME_CACHE_KEY);
    if (currentVersion === RUNTIME_CACHE_VERSION) {
      return;
    }

    TRANSIENT_CACHE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
    });
    window.localStorage.setItem(RUNTIME_CACHE_KEY, RUNTIME_CACHE_VERSION);
  } catch {
    // Ignore storage failures and continue rendering.
  }

  if ("caches" in window) {
    window.caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName))))
      .catch(() => {
        // Ignore Cache API failures and continue rendering.
      });
  }
}

bootstrapRuntimeState();

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />,
);
