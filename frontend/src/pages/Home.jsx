import AuthPanel from "../components/AuthPanel"
import ChatWindow from "../components/ChatWindow"

export default function Home() {
  return (
    <main className="layout">
      <section className="hero">
        <p className="hero-kicker">Hackathon Demo</p>
        <h1>Guardrail Security Layer</h1>
        <p>
          Every prompt is screened before the model call, and every response is validated
          before it reaches users.
        </p>
        <div className="hero-chips">
          <span>Ingress Defense</span>
          <span>Egress Validation</span>
          <span>Incident Logging</span>
        </div>
      </section>
      <AuthPanel />
      <ChatWindow />
    </main>
  )
}
