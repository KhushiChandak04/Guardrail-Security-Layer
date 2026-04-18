import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 15000
})

export async function sendChatPrompt(prompt) {
  const response = await api.post("/chat", { prompt })
  return response.data
}
