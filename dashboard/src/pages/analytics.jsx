import DashboardShell from "../components/DashboardShell"
import RiskChart from "../components/RiskChart"

export default function AnalyticsPage() {
  return (
    <DashboardShell
      title="Risk Analytics"
      subtitle="Distribution of incident severities from ingress and egress checks."
    >
      <RiskChart />
    </DashboardShell>
  )
}
