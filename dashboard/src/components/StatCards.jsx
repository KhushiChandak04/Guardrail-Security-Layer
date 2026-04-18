export default function StatCards({ stats }) {
  const safeStats = stats || {
    total: 0,
    blocked: 0,
    redacted: 0,
    highRisk: 0,
  }

  const cardStats = [
    { label: "Total Incidents", value: safeStats.total },
    { label: "Blocked", value: safeStats.blocked },
    { label: "PII Redactions", value: safeStats.redacted },
    { label: "High Risk", value: safeStats.highRisk }
  ]

  return (
    <section className="cards">
      {cardStats.map((item) => (
        <article className="card" key={item.label}>
          <h3>{item.label}</h3>
          <p className="stat-value">{item.value}</p>
        </article>
      ))}
    </section>
  )
}
