function resolveRisk(item) {
  const inputScore = Number(item?.input_risk_score ?? item?.input_analysis?.risk_score ?? 0)
  const outputScore = Number(item?.output_risk_score ?? item?.output_analysis?.risk_score ?? 0)
  const score = Math.max(inputScore, outputScore)

  if (score >= 70) {
    return "high"
  }
  if (score >= 55) {
    return "medium"
  }
  return "low"
}

function resolveDecision(item) {
  if (typeof item?.decision === "string") {
    return item.decision
  }
  return item?.decision?.status || item?.decision_details?.status || "allowed"
}

export default function LogTable({ items, loading, error }) {
  const rows = items || []

  return (
    <section className="table-card">
      <h2>Recent Incidents</h2>
      {loading ? <p className="table-state">Loading interaction stream...</p> : null}
      {error ? <p className="table-state table-state-error">{error}</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Incident</th>
            <th>User</th>
            <th>Blocked</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="table-empty">
                No interactions yet. Start sending prompts to generate audit logs.
              </td>
            </tr>
          ) : null}
          {rows.map((item) => {
            const risk = resolveRisk(item)
            const blocked = resolveDecision(item) === "blocked"

            return (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.user_id || "anonymous"}</td>
                <td>
                  <span className={blocked ? "badge badge-blocked" : "badge badge-allowed"}>
                    {blocked ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  <span className={`risk-chip risk-chip-${risk}`}>{risk}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
