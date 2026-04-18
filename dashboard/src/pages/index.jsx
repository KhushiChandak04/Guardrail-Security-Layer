import DashboardShell from "../components/DashboardShell"
import StatCards from "../components/StatCards"

export default function IndexPage() {
  return (
    <DashboardShell
      title="Guardrail Admin Dashboard"
      subtitle="Realtime view of blocked prompts, redaction events, and risk trends."
    >
      <StatCards />
    </DashboardShell>
  )
}
