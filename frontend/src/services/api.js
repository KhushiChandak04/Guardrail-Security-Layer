const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("underdog-token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, { ...options, headers });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function secureChat({ prompt, sessionId }) {
  return fetchWithAuth("/api/secure-chat", {
    method: "POST",
    body: JSON.stringify({ prompt, session_id: sessionId }),
  });
}

export async function getLogs({ decision, level, search, limit, offset } = {}) {
  const params = new URLSearchParams({
    ...(decision && { decision }),
    ...(level && { level }),
    ...(search && { search }),
    ...(limit && { limit }),
    ...(offset && { offset }),
  });
  return fetchWithAuth(`/api/logs?${params.toString()}`);
}

export async function getStats() {
  return fetchWithAuth("/api/stats");
}
