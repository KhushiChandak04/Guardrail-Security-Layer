import DashboardShell from "../components/DashboardShell"
import RiskChart from "../components/RiskChart"
import { useInteractionFeed } from "../hooks/useInteractionFeed"

export default function AnalyticsPage() {
  const { riskDistribution } = useInteractionFeed()

  return (
    <DashboardShell
      title="Risk Analytics"
      subtitle="Distribution of incident severities from ingress and egress checks."
    >
      <RiskChart data={riskDistribution} />
    </DashboardShell>
  )
}
