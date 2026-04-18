import DashboardShell from "../components/DashboardShell"
import LogTable from "../components/LogTable"

export default function LogsPage() {
  return (
    <DashboardShell
      title="Incident Logs"
      subtitle="Recent incidents captured by policy checks and logging pipeline."
    >
      <LogTable />
    </DashboardShell>
  )
}
