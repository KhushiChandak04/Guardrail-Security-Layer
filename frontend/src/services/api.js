import axios from "axios"

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "")

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000
})

export async function sendChatPrompt({ prompt, idToken, sessionId, metadata = {} }) {
  const payload = {
    prompt,
    session_id: sessionId,
    metadata,
  }

  if (idToken) {
    payload.id_token = idToken
  }

  const response = await api.post("/chat", payload)
  return response.data
}

export async function syncAuthUserProfile({ idToken, displayName = "" }) {
  const payload = {
    id_token: idToken,
    display_name: displayName,
  }

  const response = await api.post("/auth/sync-user", payload)
  return response.data
}
