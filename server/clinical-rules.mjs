export function evaluateMeasurementAlerts(measurement, recentMeasurements = [], thresholds = {}) {
  const config = {
    systolicHigh: thresholds.systolicHigh ?? 180,
    diastolicHigh: thresholds.diastolicHigh ?? 110,
    systolicLow: thresholds.systolicLow ?? 90,
    diastolicLow: thresholds.diastolicLow ?? 60,
  }
  const reading = `${measurement.systolic}/${measurement.diastolic} mmHg`

  if (measurement.systolic >= config.systolicHigh || measurement.diastolic >= config.diastolicHigh) {
    return [{ type: 'urgent', rule: `Pressão muito elevada: ${reading}` }]
  }
  if (measurement.systolic < config.systolicLow || measurement.diastolic < config.diastolicLow) {
    return [{ type: 'urgent', rule: `Pressão muito baixa: ${reading}` }]
  }

  const latest = [measurement, ...recentMeasurements]
    .sort((a, b) => Date.parse(b.measuredAt || 0) - Date.parse(a.measuredAt || 0))
    .slice(0, 3)
  if (latest.length === 3 && latest.every((item) => item.systolic >= 140 || item.diastolic >= 90)) {
    return [{ type: 'attention', rule: '3 leituras consecutivas acima da faixa de acompanhamento' }]
  }
  return []
}
