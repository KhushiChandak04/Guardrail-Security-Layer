const CONFIG = {
  apiUrls: [
    "http://127.0.0.1:8000/api/chat",
    "http://localhost:8000/api/chat",
  ],
  webAppTabPatterns: [
    "http://127.0.0.1:5173/*",
    "http://localhost:5173/*",
    "http://127.0.0.1:3000/*",
    "http://localhost:3000/*",
  ],
  authCacheStorageKey: "guardrail_auth_context",
  extensionSessionStorageKey: "guardrail_extension_session_id",
  authCacheMaxAgeMs: 50 * 60 * 1000,
  requestTimeoutMs: 30000,
}

const promptInput = document.getElementById("promptInput")
const validateBtn = document.getElementById("validateBtn")
const injectBtn = document.getElementById("injectBtn")
const statusBadge = document.getElementById("statusBadge")
const resultHint = document.getElementById("resultHint")
const safeDetail = document.getElementById("safeDetail")
const flaggedDetail = document.getElementById("flaggedDetail")
const blockedDetail = document.getElementById("blockedDetail")
const safeText = document.getElementById("safeText")
const sanitizedText = document.getElementById("sanitizedText")
const blockedReason = document.getElementById("blockedReason")

const STATUS_CLASSES = [
  "status-idle",
  "status-safe",
  "status-flagged",
  "status-blocked",
]

let sanitizedPrompt = ""
let cachedAuthContext = null

const storageGet = async (keys) => {
  const data = await chrome.storage.local.get(keys)
  return data || {}
}

const storageSet = async (data) => {
  await chrome.storage.local.set(data)
}

const withRequestTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}

const getOrCreateExtensionSessionId = async () => {
  const storage = await storageGet(CONFIG.extensionSessionStorageKey)
  const existing = String(storage?.[CONFIG.extensionSessionStorageKey] || "").trim()
  if (existing) {
    return existing
  }

  const generated =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `ext-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`

  await storageSet({ [CONFIG.extensionSessionStorageKey]: generated })
  return generated
}

const setHidden = (element, hidden) => {
  if (!element) {
    return
  }
  element.classList.toggle("hidden", hidden)
}

const setStatusBadge = (text, className) => {
  if (!statusBadge) {
    return
  }

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

  if (safeText) {
    safeText.textContent = "No issues detected."
  }
  if (sanitizedText) {
    sanitizedText.textContent = ""
  }
  if (blockedReason) {
    blockedReason.textContent = ""
  }
}

const setLoading = (isLoading) => {
  if (validateBtn) {
    validateBtn.disabled = isLoading
  }

  if (isLoading && resultHint) {
    resultHint.textContent = "Checking with live guardrail models..."
    setHidden(resultHint, false)
  }

  if (isLoading) {
    setStatusBadge("CHECKING", "status-idle")
  }
}

const normalizeAuthContext = (rawContext) => {
  const idToken = String(rawContext?.idToken || "").trim()
  if (!idToken) {
    return null
  }

  return {
    idToken,
    uid: String(rawContext?.uid || "").trim(),
    email: String(rawContext?.email || "").trim(),
    source: String(rawContext?.source || "unknown"),
    origin: String(rawContext?.origin || ""),
    capturedAt: String(rawContext?.capturedAt || new Date().toISOString()),
  }
}

const extractAuthContextFromTab = async (tabId) => {
  if (!tabId) {
    return null
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "GUARDRAIL_GET_AUTH_CONTEXT",
    })

    if (!response?.ok) {
      return null
    }

    return normalizeAuthContext(response.context)
  } catch {
    return null
  }
}

const getCandidateWebsiteTabs = async () => {
  let tabs = []

  try {
    tabs = await chrome.tabs.query({ url: CONFIG.webAppTabPatterns })
  } catch {
    tabs = []
  }

  if (!Array.isArray(tabs) || !tabs.length) {
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true })
      return Array.isArray(activeTabs) ? activeTabs : []
    } catch {
      return []
    }
  }

  return [...tabs].sort((a, b) => {
    if (a.active === b.active) {
      return 0
    }
    return a.active ? -1 : 1
  })
}

const resolveAuthContext = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cachedAuthContext?.idToken) {
    if (Date.now() - Number(cachedAuthContext.cachedAt || 0) <= CONFIG.authCacheMaxAgeMs) {
      return cachedAuthContext
    }
  }

  if (!forceRefresh) {
    const storage = await storageGet(CONFIG.authCacheStorageKey)
    const storedContext = storage?.[CONFIG.authCacheStorageKey]
    if (storedContext?.idToken) {
      const cacheAge = Date.now() - Number(storedContext.cachedAt || 0)
      if (cacheAge <= CONFIG.authCacheMaxAgeMs) {
        cachedAuthContext = storedContext
        return storedContext
      }
    }
  }

  const candidateTabs = await getCandidateWebsiteTabs()

  for (const tab of candidateTabs) {
    let context = await extractAuthContextFromTab(tab?.id)
    if (!context?.idToken) {
      continue
    }

    const mergedContext = {
      ...context,
      origin: context.origin || (() => {
        try {
          return tab?.url ? new URL(tab.url).origin : ""
        } catch {
          return ""
        }
      })(),
      cachedAt: Date.now(),
    }

    cachedAuthContext = mergedContext
    await storageSet({ [CONFIG.authCacheStorageKey]: mergedContext })
    return mergedContext
  }

  cachedAuthContext = null
  await storageSet({ [CONFIG.authCacheStorageKey]: null })
  return null
}

const buildMetadata = ({ prompt, authContext }) => {
  const metadata = {
    source: "chrome_extension_popup",
    prompt_length: String(prompt.length),
    client_timestamp: new Date().toISOString(),
    extension_version: chrome.runtime.getManifest().version,
    auth_linked: String(Boolean(authContext?.idToken)),
  }

  if (authContext?.uid) {
    metadata.user_uid = authContext.uid
  }

  if (authContext?.email) {
    metadata.user_email = authContext.email
  }

  if (authContext?.origin) {
    metadata.linked_origin = authContext.origin
  }

  return metadata
}

const requestGuardrailDecision = async (prompt) => {
  const authContext = await resolveAuthContext({ forceRefresh: true })
  const sessionId = await getOrCreateExtensionSessionId()

  const payload = {
    prompt,
    session_id: sessionId,
    metadata: buildMetadata({ prompt, authContext }),
    rephrase: false,
  }

  if (authContext?.idToken) {
    payload.id_token = authContext.idToken
  }

  let lastError = null

  for (const apiUrl of CONFIG.apiUrls) {
    try {
      const response = await withRequestTimeout(
        apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            ...(authContext?.uid ? { "X-Guardrail-User-Id": authContext.uid } : {}),
          },
          body: JSON.stringify(payload),
        },
        CONFIG.requestTimeoutMs
      )

      const raw = await response.text()
      let parsed = null

      try {
        parsed = raw ? JSON.parse(raw) : null
      } catch {
        parsed = null
      }

      if (!response.ok) {
        const detail =
          String(parsed?.detail || parsed?.message || "").trim() ||
          `Validation request failed with status ${response.status}.`
        throw new Error(detail)
      }

      return {
        data: parsed,
        authContext,
        apiUrl,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error("Unable to reach backend API.")
}

const showSafe = ({ data }) => {
  sanitizedPrompt = promptInput ? promptInput.value : ""
  setStatusBadge("SAFE", "status-safe")
  setHidden(resultHint, true)
  setHidden(safeDetail, false)
  setHidden(flaggedDetail, true)
  setHidden(blockedDetail, true)
  setHidden(injectBtn, false)

  const ingressRisk = String(data?.ingress_risk || "low").toUpperCase()
  const outputRisk = String(data?.output_risk || "low").toUpperCase()

  if (safeText) {
    safeText.textContent = [
      "Backend verdict: Prompt passed active guardrails.",
      `Ingress risk: ${ingressRisk}`,
      `Output risk: ${outputRisk}`,
    ].join("\n")
  }

}

const showFlagged = ({ data }) => {
  sanitizedPrompt = promptInput ? promptInput.value : ""

  const redactions = Array.isArray(data?.redactions) ? data.redactions : []
  const ingressRisk = String(data?.ingress_risk || "low").toUpperCase()
  const outputRisk = String(data?.output_risk || "low").toUpperCase()
  const detailLines = [
    "Guardrails modified or flagged this request.",
    `Ingress risk: ${ingressRisk}`,
    `Output risk: ${outputRisk}`,
  ]

  if (redactions.length) {
    detailLines.push(`Redactions: ${redactions.join(", ")}`)
  }

  detailLines.push("Prompt is still available for injection.")

  if (sanitizedText) {
    sanitizedText.textContent = detailLines.join("\n")
  }

  setStatusBadge("FLAGGED", "status-flagged")
  setHidden(resultHint, true)
  setHidden(safeDetail, true)
  setHidden(flaggedDetail, false)
  setHidden(blockedDetail, true)
  setHidden(injectBtn, false)

}

const showBlocked = ({ data }) => {
  sanitizedPrompt = ""

  if (blockedReason) {
    blockedReason.textContent = String(
      data?.message || "Prompt blocked by live backend guardrails."
    )
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
  if (resultHint) {
    resultHint.textContent = message
  }
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
    const { data } = await requestGuardrailDecision(prompt)
    const blocked = Boolean(data?.blocked)
    const redactions = Array.isArray(data?.redactions) ? data.redactions : []

    if (blocked) {
      showBlocked({ data })
      return
    }

    if (redactions.length > 0) {
      showFlagged({ data })
      return
    }

    showSafe({ data })
  } catch (error) {
    showError(String(error?.message || "Unable to reach live backend validator."))
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
  } catch {
    showError("Injection failed. Check extension permissions.")
  }
}

if (validateBtn) {
  validateBtn.addEventListener("click", validatePrompt)
}

if (injectBtn) {
  injectBtn.addEventListener("click", injectPrompt)
}

resetDetails()
setStatusBadge("NOT CHECKED", "status-idle")
