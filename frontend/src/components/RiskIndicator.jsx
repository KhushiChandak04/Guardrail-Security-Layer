export default function RiskIndicator({ risk }) {
  const level = (risk || "unknown").toLowerCase()
  return (
    <div className="risk" data-level={level}>
      <span className="risk-title">Latest risk</span>
      <strong>{level.toUpperCase()}</strong>
    </div>
  )
}
