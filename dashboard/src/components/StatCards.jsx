export default function StatCards() {
  const stats = [
    { label: "Total Incidents", value: 42 },
    { label: "Blocked", value: 13 },
    { label: "PII Redactions", value: 19 },
    { label: "High Risk", value: 8 }
  ]

  return (
    <section className="cards">
      {stats.map((item) => (
        <article className="card" key={item.label}>
          <h3>{item.label}</h3>
          <p className="stat-value">{item.value}</p>
        </article>
      ))}
    </section>
  )
}
