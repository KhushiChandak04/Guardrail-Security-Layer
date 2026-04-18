import { useState } from "react"

import { sendChatPrompt } from "../services/api"

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastRisk, setLastRisk] = useState("low")

  const sendPrompt = async (prompt) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: prompt }])
    setLoading(true)

    try {
      const result = await sendChatPrompt(prompt)
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: result.message }])
      setLastRisk(result.blocked ? result.ingress_risk : result.output_risk)
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: "Unable to reach backend right now." }
      ])
      setLastRisk("high")
    } finally {
      setLoading(false)
    }
  }

  return {
    messages,
    sendPrompt,
    loading,
    lastRisk
  }
}
