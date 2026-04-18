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
