import { getFirebaseAuth } from "./firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function addUniqueCandidate(target, seen, value) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  target.push(normalized);
}

function withCacheBust(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_ts=${Date.now()}`;
}

function buildApiBaseCandidates() {
  const seen = new Set();
  const candidates = [];

  addUniqueCandidate(candidates, seen, API_BASE_URL);

  if (typeof window !== "undefined") {
    addUniqueCandidate(candidates, seen, `${window.location.origin}/api`);

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      addUniqueCandidate(candidates, seen, "http://127.0.0.1:8000/api");
      addUniqueCandidate(candidates, seen, "http://localhost:8000/api");
    }
  }

  addUniqueCandidate(candidates, seen, "http://127.0.0.1:8000/api");
  addUniqueCandidate(candidates, seen, "http://localhost:8000/api");

  return candidates;
}

function buildScanBaseCandidates() {
  const seen = new Set();
  const candidates = [];

  for (const apiBase of buildApiBaseCandidates()) {
    const scanBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
    addUniqueCandidate(candidates, seen, scanBase);
  }

  return candidates;
}

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

async function resolveIdentityHeaders(headers = {}) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  const identityHeaders = {};

  if (user?.uid && !("X-Guardrail-User-Id" in headers)) {
    identityHeaders["X-Guardrail-User-Id"] = user.uid;
  }

  if (!("Authorization" in headers)) {
    const idToken = await resolveCurrentIdToken();
    if (idToken) {
      identityHeaders.Authorization = `Bearer ${idToken}`;
    }
  }

  return identityHeaders;
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
  const apiBases = buildApiBaseCandidates();
  const identityHeaders = await resolveIdentityHeaders(headers);
  let lastNetworkError = null;

  for (const apiBase of apiBases) {
    const url = `${apiBase}${path}`;
    let response;

    try {
      response = await fetch(url, {
        method,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...NO_STORE_HEADERS,
          ...identityHeaders,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (networkError) {
      lastNetworkError = networkError;
      continue;
    }

    let payload = null;
    try {
      const raw = await response.text();
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(buildErrorMessage(payload, response.status));
    }

    return payload;
  }

  if (lastNetworkError) {
    throw new Error(
      "Unable to reach backend API. Start backend server with `npm run dev:backend:stable` or set VITE_API_BASE_URL.",
    );
  }

  throw new Error("Unable to reach backend API.");
}

export async function sendChatPrompt({ prompt, idToken, sessionId, metadata = {}, rephrase = false }) {
  const resolvedIdToken = idToken || await resolveCurrentIdToken();
  const payload = {
    prompt,
    session_id: sessionId,
    metadata,
    rephrase: Boolean(rephrase),
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

  return request(withCacheBust(`/logs?${params.toString()}`));
}

export async function getStats(limit = 250) {
  return request(withCacheBust(`/stats?limit=${encodeURIComponent(String(limit))}`));
}

export async function getPolicies() {
  return request(withCacheBust("/policies"));
}

export async function updatePolicies(payload) {
  return request("/policies", {
    method: "PUT",
    body: payload,
  });
}

export async function getGuardrailDiagnostics() {
  return request(withCacheBust("/diagnostics/guardrails"));
}

export async function scanDocument(file) {
  if (!(file instanceof File)) {
    throw new Error("Invalid file selected for scanning.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const candidates = buildScanBaseCandidates();

  let lastNetworkError = null;

  for (const base of candidates) {
    let response;
    try {
      response = await fetch(`${base}/scan-document`, {
        method: "POST",
        cache: "no-store",
        headers: {
          ...NO_STORE_HEADERS,
        },
        body: formData,
      });
    } catch (networkError) {
      lastNetworkError = networkError;
      continue;
    }

    let payload = null;
    try {
      const raw = await response.text();
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(buildErrorMessage(payload, response.status));
    }

    return payload;
  }

  if (lastNetworkError) {
    throw new Error("Unable to reach backend scan endpoint.");
  }

  throw new Error("Unable to scan document.");
}
