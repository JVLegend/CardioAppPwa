import type { Measurement, BPAlert, AlertType } from '../models/types'
import { AppEnvironment } from '../config/environment'

interface AlertResult {
  type: AlertType
  rule: string
}

export function evaluateAlerts(
  measurement: Measurement,
  recentMeasurements: Measurement[]
): AlertResult[] {
  const results: AlertResult[] = []
  const { systolic, diastolic } = measurement

  // Urgent: Hypertensive crisis
  if (
    systolic >= AppEnvironment.defaultSystolicHigh ||
    diastolic >= AppEnvironment.defaultDiastolicHigh
  ) {
    results.push({
      type: 'urgent',
      rule: `Crise hipertensiva: ${systolic}/${diastolic} mmHg`,
    })
  }

  // Urgent: Hypotension
  if (
    systolic < AppEnvironment.defaultSystolicLow ||
    diastolic < AppEnvironment.defaultDiastolicLow
  ) {
    results.push({
      type: 'urgent',
      rule: `Hipotensão: ${systolic}/${diastolic} mmHg`,
    })
  }

  // Attention: 3 consecutive out-of-range readings
  const threshold = AppEnvironment.consecutiveOutOfRangeThreshold
  const recent = [measurement, ...recentMeasurements].slice(0, threshold)
  if (recent.length >= threshold) {
    const allOutOfRange = recent.every(
      (m) => m.systolic > 140 || m.diastolic > 90
    )
    if (allOutOfRange) {
      results.push({
        type: 'attention',
        rule: `${threshold} leituras consecutivas acima do normal`,
      })
    }
  }

  return results
}

export function createAlert(
  patientId: string,
  measurementId: string,
  result: AlertResult
): BPAlert {
  return {
    id: crypto.randomUUID(),
    patientId,
    measurementId,
    type: result.type,
    rule: result.rule,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

export async function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/pwa-192x192.png' })
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}
