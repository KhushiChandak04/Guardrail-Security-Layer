export default function MessageBubble({ message }) {
  const className = message.role === "user" ? "bubble bubble-user" : "bubble bubble-assistant"
  const label = message.role === "user" ? "You" : "Assistant"

  return (
    <article className={className}>
      <p className="bubble-label">{label}</p>
      <p className="bubble-text">{message.text}</p>
    </article>
  )
}
