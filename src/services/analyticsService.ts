import type { Measurement } from '../models/types'
import { classifyBP, type BPClassification } from '../config/theme'

export interface BPAverage {
  systolic: number
  diastolic: number
  heartRate: number | null
  count: number
}

export type Trend = 'improving' | 'stable' | 'worsening'

export interface ClassificationDistribution {
  classification: BPClassification
  count: number
  percentage: number
}

export function average(measurements: Measurement[]): BPAverage | null {
  if (measurements.length === 0) return null
  const count = measurements.length
  const systolic = Math.round(
    measurements.reduce((s, m) => s + m.systolic, 0) / count
  )
  const diastolic = Math.round(
    measurements.reduce((s, m) => s + m.diastolic, 0) / count
  )
  const hrMeasurements = measurements.filter((m) => m.heartRate != null)
  const heartRate =
    hrMeasurements.length > 0
      ? Math.round(
          hrMeasurements.reduce((s, m) => s + m.heartRate!, 0) /
            hrMeasurements.length
        )
      : null
  return { systolic, diastolic, heartRate, count }
}

export function weeklyAverage(measurements: Measurement[]): BPAverage | null {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const filtered = measurements.filter(
    (m) => new Date(m.measuredAt) >= since
  )
  return average(filtered)
}

export function monthlyAverage(measurements: Measurement[]): BPAverage | null {
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const filtered = measurements.filter(
    (m) => new Date(m.measuredAt) >= since
  )
  return average(filtered)
}

export function classificationDistribution(
  measurements: Measurement[]
): ClassificationDistribution[] {
  if (measurements.length === 0) return []
  const counts: Record<BPClassification, number> = {
    normal: 0,
    prehypertension: 0,
    stage1: 0,
    stage2: 0,
    crisis: 0,
  }
  measurements.forEach((m) => {
    counts[classifyBP(m.systolic, m.diastolic)]++
  })
  return (Object.entries(counts) as [BPClassification, number][])
    .filter(([, c]) => c > 0)
    .map(([classification, count]) => ({
      classification,
      count,
      percentage: Math.round((count / measurements.length) * 100),
    }))
}

export function trendAnalysis(measurements: Measurement[]): Trend {
  if (measurements.length < 3) return 'stable'

  // Linear regression on systolic values ordered by time
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
  )
  const n = sorted.length
  const xs = sorted.map((_, i) => i)
  const ys = sorted.map((m) => m.systolic)

  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) * (xs[i] - xMean)
  }

  const slope = den === 0 ? 0 : num / den

  if (slope < -1) return 'improving'
  if (slope > 1) return 'worsening'
  return 'stable'
}

export function morningVsEvening(
  measurements: Measurement[]
): { morning: BPAverage | null; evening: BPAverage | null } {
  const morning = measurements.filter((m) => {
    const h = new Date(m.measuredAt).getHours()
    return h >= 5 && h < 12
  })
  const evening = measurements.filter((m) => {
    const h = new Date(m.measuredAt).getHours()
    return h >= 17 && h < 23
  })
  return { morning: average(morning), evening: average(evening) }
}

/** Manhã (5h-12h) · Tarde (12h-18h) · Noite (18h-5h, cobre madrugada também) */
export function byTimeOfDay(
  measurements: Measurement[]
): { morning: BPAverage | null; afternoon: BPAverage | null; evening: BPAverage | null } {
  const morning: Measurement[] = []
  const afternoon: Measurement[] = []
  const evening: Measurement[] = []
  for (const m of measurements) {
    const h = new Date(m.measuredAt).getHours()
    if (h >= 5 && h < 12) morning.push(m)
    else if (h >= 12 && h < 18) afternoon.push(m)
    else evening.push(m)
  }
  return { morning: average(morning), afternoon: average(afternoon), evening: average(evening) }
}
