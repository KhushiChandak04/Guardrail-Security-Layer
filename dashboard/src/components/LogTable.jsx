const sample = [
  { id: "inc-1", user: "user_alpha", blocked: true, risk: "high" },
  { id: "inc-2", user: "user_beta", blocked: false, risk: "medium" }
]

export default function LogTable() {
  return (
    <section className="table-card">
      <h2>Recent Incidents</h2>
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
          {sample.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.user}</td>
              <td>
                <span className={item.blocked ? "badge badge-blocked" : "badge badge-allowed"}>
                  {item.blocked ? "Yes" : "No"}
                </span>
              </td>
              <td>
                <span className="risk-chip">{item.risk}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
