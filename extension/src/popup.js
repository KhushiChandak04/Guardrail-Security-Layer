const CONFIG = {
  apiUrl: "http://localhost:8000/api/v1/validate", // replace with deployed URL later
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

const showFlagged = (sanitized) => {
  sanitizedPrompt = sanitized || promptInput.value
  if (sanitizedText) sanitizedText.textContent = sanitizedPrompt
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
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      showError("Validation request failed. Please try again.")
      return
    }

    const data = await response.json()

    if (data.status === "safe") {
      showSafe()
    } else if (data.status === "flagged") {
      showFlagged(data.sanitized_prompt)
    } else if (data.status === "blocked") {
      showBlocked(data.reason)
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
