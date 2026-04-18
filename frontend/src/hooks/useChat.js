import { useState } from "react"

import { sendChatPrompt } from "../services/api"
import { getFirebaseAuth } from "../services/firebase"
import { getRuntimeSessionId } from "../services/runtimeStore"

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastRisk, setLastRisk] = useState("low")

  const sendPrompt = async (prompt) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: prompt }])
    setLoading(true)

    try {
      let idToken
      const auth = getFirebaseAuth()
      if (auth?.currentUser) {
        idToken = await auth.currentUser.getIdToken()
      }

      const sessionId = getRuntimeSessionId()
      const metadata = {
        source: "frontend_ui",
        client_timestamp: new Date().toISOString(),
        prompt_length: String(prompt.length),
      }

      const result = await sendChatPrompt({
        prompt,
        idToken,
        sessionId,
        metadata,
      })
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
