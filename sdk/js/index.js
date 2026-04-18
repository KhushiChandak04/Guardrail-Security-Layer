function generateSessionId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `sdk-js-${Date.now()}`
}

export async function processPrompt({ baseUrl = "http://localhost:8000", prompt, sessionId, metadata = {} }) {
  const resolvedSessionId = sessionId || generateSessionId()
  const payload = {
    prompt,
    session_id: resolvedSessionId,
    metadata: {
      source: "sdk_js",
      client_timestamp: new Date().toISOString(),
      sdk: "js",
      prompt_length: String(prompt.length),
      ...metadata,
    }
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return response.json()
}
