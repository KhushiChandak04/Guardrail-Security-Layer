import { useState } from "react"

export default function InputBox({ onSubmit, loading }) {
  const [value, setValue] = useState("")
  const charCount = value.trim().length

  const submit = async (event) => {
    event.preventDefault()
    if (!value.trim() || loading) {
      return
    }

    await onSubmit(value)
    setValue("")
  }

  return (
    <form className="input-row" onSubmit={submit}>
      <label htmlFor="prompt-box" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt-box"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask anything... guardrails will inspect both input and output"
        maxLength={2400}
      />
      <div className="input-actions">
        <p className="input-meta">{charCount} characters</p>
        <button type="submit" disabled={loading}>
          {loading ? "Checking..." : "Send Prompt"}
        </button>
      </div>
    </form>
  )
}
