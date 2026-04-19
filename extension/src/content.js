const findPromptInput = () => {
  const selectors = ["#prompt-textarea", "[contenteditable=\"true\"]", "textarea"]

  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el) {
      return el
    }
  }

  return null
}

const FIREBASE_AUTH_KEY_PREFIX = "firebase:authUser:"
const EXTENSION_PING_EVENT = "guardrail_extension_ping"
const EXTENSION_PONG_EVENT = "guardrail_extension_pong"
const EXTENSION_MESSAGE_PING = "GUARDRAIL_EXTENSION_PING"
const EXTENSION_MESSAGE_PONG = "GUARDRAIL_EXTENSION_PONG"

const parseAuthRecord = (rawValue, storageName) => {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    const token = String(
      parsed?.stsTokenManager?.accessToken || parsed?.accessToken || ""
    ).trim()
    if (!token) {
      return null
    }

    return {
      idToken: token,
      uid: String(parsed?.uid || "").trim(),
      email: String(parsed?.email || "").trim(),
      source: storageName,
      origin: window.location.origin,
      capturedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

const readFirebaseAuthContext = () => {
  const storageAreas = [
    { name: "sessionStorage", area: window.sessionStorage },
    { name: "localStorage", area: window.localStorage },
  ]

  for (const storageArea of storageAreas) {
    const area = storageArea.area
    if (!area) {
      continue
    }

    for (let i = 0; i < area.length; i += 1) {
      const key = area.key(i)
      if (!key || !key.startsWith(FIREBASE_AUTH_KEY_PREFIX)) {
        continue
      }

      const value = area.getItem(key)
      const authContext = parseAuthRecord(value, storageArea.name)
      if (authContext?.idToken) {
        return authContext
      }
    }
  }

  return null
}

const emitExtensionConnected = (requestId = "") => {
  try {
    window.dispatchEvent(
      new CustomEvent(EXTENSION_PONG_EVENT, {
        detail: {
          requestId,
          connected: true,
          origin: window.location.origin,
          timestamp: new Date().toISOString(),
        },
      })
    )
  } catch {
    // Ignore custom event dispatch issues to keep content script functional.
  }
}

const emitPostMessageConnected = (requestId = "") => {
  try {
    window.postMessage(
      {
        type: EXTENSION_MESSAGE_PONG,
        requestId,
        connected: true,
        origin: window.location.origin,
        timestamp: new Date().toISOString(),
      },
      "*"
    )
  } catch {
    // Ignore postMessage failures to keep content script functional.
  }
}

const setContentEditableText = (element, text) => {
  element.textContent = text
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

const setTextareaValue = (element, text) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )

  if (descriptor && typeof descriptor.set === "function") {
    descriptor.set.call(element, text)
  } else {
    element.value = text
  }

  element.dispatchEvent(new Event("input", { bubbles: true }))
}

const handleInjection = (event) => {
  const injectedText = event?.detail?.text

  if (typeof injectedText !== "string") {
    return
  }

  const input = findPromptInput()

  if (!input) {
    console.log("Guardrail: No prompt input found on this page.")
    return
  }

  input.focus()

  if (input.isContentEditable) {
    setContentEditableText(input, injectedText)
    return
  }

  if (input instanceof HTMLTextAreaElement) {
    setTextareaValue(input, injectedText)
    return
  }

  if (typeof input.value !== "undefined") {
    setTextareaValue(input, injectedText)
    return
  }

  setContentEditableText(input, injectedText)
}

window.addEventListener("guardrail_inject", handleInjection)
window.addEventListener(EXTENSION_PING_EVENT, (event) => {
  const requestId = String(event?.detail?.requestId || "")
  emitExtensionConnected(requestId)
})
window.addEventListener("message", (event) => {
  if (event?.source !== window) {
    return
  }

  const payload = event?.data && typeof event.data === "object" ? event.data : null
  if (!payload || payload.type !== EXTENSION_MESSAGE_PING) {
    return
  }

  const requestId = String(payload?.requestId || "")
  emitPostMessageConnected(requestId)
  emitExtensionConnected(requestId)
})
emitExtensionConnected("")
emitPostMessageConnected("")

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GUARDRAIL_EXTENSION_PING") {
    sendResponse({
      ok: true,
      origin: window.location.origin,
    })
    return true
  }

  if (message?.type !== "GUARDRAIL_GET_AUTH_CONTEXT") {
    return undefined
  }

  try {
    const authContext = readFirebaseAuthContext()
    sendResponse({
      ok: Boolean(authContext?.idToken),
      context: authContext,
    })
  } catch (error) {
    sendResponse({
      ok: false,
      error: String(error?.message || error || "unable_to_read_auth_context"),
    })
  }

  return true
})
