const CONFIG = {
  apiUrls: [
    "http://127.0.0.1:8000/api/chat",
    "http://localhost:8000/api/chat",
  ],
}

const promptInput = document.getElementById("promptInput")
const validateBtn = document.getElementById("validateBtn")
const injectBtn = document.getElementById("injectBtn")
const statusBadge = document.getElementById("statusBadge")
const resultHint = document.getElementById("resultHint")
const safeDetail = document.getElementById("safeDetail")
const flaggedDetail = document.getElementById("flaggedDetail")
const blockedDetail = document.getElementById("blockedDetail")
const sanitizedText = document.getElementById("sanitizedText")
const blockedReason = document.getElementById("blockedReason")

const STATUS_CLASSES = [
  "status-idle",
  "status-safe",
  "status-flagged",
  "status-blocked",
]

let sanitizedPrompt = ""

const requestGuardrailDecision = async (prompt) => {
  const payload = {
    prompt,
    metadata: {
      source: "chrome_extension_popup",
      prompt_length: String(prompt.length),
      client_timestamp: new Date().toISOString(),
    },
  }

  let lastError = null

  for (const apiUrl of CONFIG.apiUrls) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = "Validation request failed."
        try {
          const errorPayload = await response.json()
          if (errorPayload?.detail) {
            message = String(errorPayload.detail)
          }
        } catch {
          // Ignore parse failures and use default message.
        }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error("Unable to reach backend API.")
}

const setHidden = (element, hidden) => {
  if (!element) return
  element.classList.toggle("hidden", hidden)
}

const setStatusBadge = (text, className) => {
  if (!statusBadge) return
  statusBadge.textContent = text
  STATUS_CLASSES.forEach((statusClass) => {
    statusBadge.classList.remove(statusClass)
  })
  statusBadge.classList.add(className)
}

const resetDetails = () => {
  setHidden(safeDetail, true)
  setHidden(flaggedDetail, true)
  setHidden(blockedDetail, true)
  setHidden(resultHint, false)
}

const setLoading = (isLoading) => {
  if (validateBtn) validateBtn.disabled = isLoading
  if (isLoading && resultHint) {
    resultHint.textContent = "Checking..."
    setHidden(resultHint, false)
  }
  if (isLoading) {
    setStatusBadge("CHECKING", "status-idle")
  }
}

const showSafe = () => {
  sanitizedPrompt = promptInput.value
  setStatusBadge("SAFE", "status-safe")
  setHidden(resultHint, true)
  setHidden(safeDetail, false)
  setHidden(flaggedDetail, true)
  setHidden(blockedDetail, true)
  setHidden(injectBtn, false)
}

const showFlagged = (detailsText) => {
  sanitizedPrompt = promptInput.value
  if (sanitizedText) sanitizedText.textContent = detailsText || sanitizedPrompt
  setStatusBadge("FLAGGED", "status-flagged")
  setHidden(resultHint, true)
  setHidden(safeDetail, true)
  setHidden(flaggedDetail, false)
  setHidden(blockedDetail, true)
  setHidden(injectBtn, false)
}

const showBlocked = (reason) => {
  sanitizedPrompt = ""
  if (blockedReason) {
    blockedReason.textContent = reason || "Prompt blocked by policy."
  }
  setStatusBadge("BLOCKED", "status-blocked")
  setHidden(resultHint, true)
  setHidden(safeDetail, true)
  setHidden(flaggedDetail, true)
  setHidden(blockedDetail, false)
  setHidden(injectBtn, true)
}

const showError = (message) => {
  sanitizedPrompt = ""
  if (resultHint) resultHint.textContent = message
  setStatusBadge("ERROR", "status-blocked")
  resetDetails()
  setHidden(injectBtn, true)
}

const validatePrompt = async () => {
  const prompt = promptInput ? promptInput.value.trim() : ""
  resetDetails()
  setHidden(injectBtn, true)

  if (!prompt) {
    showError("Please enter a prompt to validate.")
    return
  }

  try {
    setLoading(true)
    const data = await requestGuardrailDecision(prompt)
    const isBlocked = Boolean(data?.blocked)
    const redactions = Array.isArray(data?.redactions) ? data.redactions : []
    const ingressRisk = String(data?.ingress_risk || "low").toLowerCase()
    const outputRisk = String(data?.output_risk || "low").toLowerCase()
    const elevatedRisk = ingressRisk !== "low" || outputRisk !== "low"

    if (isBlocked) {
      showBlocked(data?.message || "Prompt blocked by policy.")
      return
    }

    if (redactions.length > 0 || elevatedRisk) {
      const detailLines = [
        `Ingress risk: ${ingressRisk.toUpperCase()}`,
        `Output risk: ${outputRisk.toUpperCase()}`,
      ]

      if (redactions.length > 0) {
        detailLines.push(`Redactions: ${redactions.join(", ")}`)
      }

      detailLines.push("Prompt ready for injection:")
      detailLines.push(prompt)

      showFlagged(detailLines.join("\n"))
      return
    }

    if (data && typeof data === "object") {
      showSafe()
    } else {
      showError("Unexpected response from the validator.")
    }
  } catch (error) {
    showError("Unable to reach the validator service.")
  } finally {
    setLoading(false)
  }
}

const injectPrompt = async () => {
  if (!sanitizedPrompt) {
    showError("Run validation before injecting.")
    return
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeTab = tabs[0]

  if (!activeTab || !activeTab.id) {
    showError("No active tab found for injection.")
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (text) => {
        window.dispatchEvent(
          new CustomEvent("guardrail_inject", {
            detail: { text },
          })
        )
      },
      args: [sanitizedPrompt],
    })
  } catch (error) {
    showError("Injection failed. Check extension permissions.")
  }
}

if (validateBtn) {
  validateBtn.addEventListener("click", validatePrompt)
}

if (injectBtn) {
  injectBtn.addEventListener("click", injectPrompt)
}
