import DashboardShell from "../components/DashboardShell"
import LogTable from "../components/LogTable"
import { useInteractionFeed } from "../hooks/useInteractionFeed"

export default function LogsPage() {
  const { items, loading, error } = useInteractionFeed()

  return (
    <DashboardShell
      title="Incident Logs"
      subtitle="Recent incidents captured by policy checks and logging pipeline."
    >
      <LogTable items={items} loading={loading} error={error} />
    </DashboardShell>
  )
}
