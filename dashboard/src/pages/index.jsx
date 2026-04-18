import DashboardShell from "../components/DashboardShell"
import StatCards from "../components/StatCards"
import { useInteractionFeed } from "../hooks/useInteractionFeed"

export default function IndexPage() {
  const { stats } = useInteractionFeed()

  return (
    <DashboardShell
      title="Guardrail Admin Dashboard"
      subtitle="Realtime view of blocked prompts, redaction events, and risk trends."
    >
      <StatCards stats={stats} />
    </DashboardShell>
  )
}
