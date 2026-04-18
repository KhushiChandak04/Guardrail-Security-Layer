import { useChatContext } from "../context/ChatContext"
import InputBox from "./InputBox"
import MessageBubble from "./MessageBubble"
import RiskIndicator from "./RiskIndicator"

export default function ChatWindow() {
  const { messages, sendPrompt, loading, lastRisk } = useChatContext()

  return (
    <section className="panel">
      <div className="chat-list" aria-live="polite">
        {messages.length === 0 ? (
          <article className="empty-state">
            <h2>Start a guarded conversation</h2>
            <p>
              Try a normal question first, then a risky prompt to see the policy engine
              block it.
            </p>
          </article>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <RiskIndicator risk={lastRisk} />
      <InputBox onSubmit={sendPrompt} loading={loading} />
    </section>
  )
}
