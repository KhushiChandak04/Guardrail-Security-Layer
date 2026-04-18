import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const fallbackData = [
  { label: "Blocked", value: 0 },
  { label: "Redacted", value: 0 },
  { label: "High", value: 0 },
  { label: "Medium", value: 0 }
]

export default function RiskChart({ data }) {
  const chartData = data && data.length ? data : fallbackData

  return (
    <section className="chart-card">
      <h2>Risk Distribution</h2>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fill: "#4f4f46" }} axisLine={{ stroke: "#d6d3d1" }} />
            <YAxis tick={{ fill: "#4f4f46" }} axisLine={{ stroke: "#d6d3d1" }} />
            <Tooltip cursor={{ fill: "rgba(186, 230, 253, 0.35)" }} />
            <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
