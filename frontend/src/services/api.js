import { getFirebaseAuth } from "./firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

async function resolveCurrentIdToken() {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    return "";
  }

  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return "";
  }
}

function buildErrorMessage(payload, status) {
  if (payload && typeof payload === "object") {
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
  }
  return `Request failed with status ${status}`;
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(buildErrorMessage(payload, response.status));
  }

  return payload;
}

export async function sendChatPrompt({ prompt, idToken, sessionId, metadata = {} }) {
  const resolvedIdToken = idToken || await resolveCurrentIdToken();
  const payload = {
    prompt,
    session_id: sessionId,
    metadata,
  };

  if (resolvedIdToken) {
    payload.id_token = resolvedIdToken;
  }

  return request("/chat", {
    method: "POST",
    body: payload,
  });
}

export async function secureChat({ prompt, sessionId, metadata = {} }) {
  return sendChatPrompt({
    prompt,
    sessionId,
    metadata,
  });
}

export async function getLogs({ decision, level, search, limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (decision && decision !== "all") {
    params.set("decision", decision);
  }
  if (level && level !== "all") {
    params.set("level", level);
  }
  if (search) {
    params.set("search", search);
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return request(`/logs?${params.toString()}`);
}

export async function getStats(limit = 250) {
  return request(`/stats?limit=${encodeURIComponent(String(limit))}`);
}

export async function getPolicies() {
  return request("/policies");
}

export async function updatePolicies(payload) {
  return request("/policies", {
    method: "PUT",
    body: payload,
  });
}

export async function getGuardrailDiagnostics() {
  return request("/diagnostics/guardrails");
}
