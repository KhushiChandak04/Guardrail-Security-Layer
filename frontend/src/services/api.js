import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000/api",
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
