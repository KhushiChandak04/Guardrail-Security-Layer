import { useEffect, useMemo, useState } from "react"

import { listenToInteractions } from "../services/interactions"

function extractMaxRiskScore(item) {
  const inputScore = Number(item?.input_risk_score ?? item?.input_analysis?.risk_score ?? 0)
  const outputScore = Number(item?.output_risk_score ?? item?.output_analysis?.risk_score ?? 0)
  return Math.max(inputScore, outputScore)
}

function resolveDecision(item) {
  if (typeof item?.decision === "string") {
    return item.decision
  }
  return item?.decision?.status || item?.decision_details?.status || "allowed"
}

function isRedacted(item) {
  return Boolean(item?.redacted ?? item?.output?.redacted)
}

export function useInteractionFeed() {
  const [items, setItems] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = listenToInteractions({
      limit: 75,
      onData: (nextItems) => {
        setItems(nextItems)
        setError("")
        setLoading(false)
      },
      onError: (nextError) => {
        setError(nextError?.message || "Unable to load interaction feed")
        setLoading(false)
      },
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const stats = useMemo(() => {
    const total = items.length
    const blocked = items.filter((item) => resolveDecision(item) === "blocked").length
    const redacted = items.filter((item) => isRedacted(item)).length
    const highRisk = items.filter((item) => extractMaxRiskScore(item) >= 70).length
    const mediumRisk = items.filter((item) => {
      const score = extractMaxRiskScore(item)
      return score >= 55 && score < 70
    }).length

    return {
      total,
      blocked,
      redacted,
      highRisk,
      mediumRisk,
    }
  }, [items])

  const riskDistribution = useMemo(
    () => [
      { label: "Blocked", value: stats.blocked },
      { label: "Redacted", value: stats.redacted },
      { label: "High", value: stats.highRisk },
      { label: "Medium", value: stats.mediumRisk },
    ],
    [stats]
  )

  return {
    items,
    error,
    loading,
    stats,
    riskDistribution,
  }
}