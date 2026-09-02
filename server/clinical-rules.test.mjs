import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMeasurementAlerts } from './clinical-rules.mjs'

const reading = (systolic, diastolic, minutesAgo = 0) => ({
  systolic,
  diastolic,
  measuredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
})

test('pressão muito elevada gera um único alerta urgente sem diagnóstico automático', () => {
  const alerts = evaluateMeasurementAlerts(reading(181, 90), [reading(150, 95, 5), reading(145, 92, 10)])
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].type, 'urgent')
  assert.match(alerts[0].rule, /Pressão muito elevada/)
  assert.doesNotMatch(alerts[0].rule, /crise/i)
})

test('três leituras elevadas consecutivas geram alerta de atenção', () => {
  const alerts = evaluateMeasurementAlerts(reading(145, 88), [reading(142, 91, 5), reading(141, 89, 10)])
  assert.deepEqual(alerts, [{
    type: 'attention',
    rule: '3 leituras consecutivas acima da faixa de acompanhamento',
  }])
})

test('leitura isolada normal não gera alerta', () => {
  assert.deepEqual(evaluateMeasurementAlerts(reading(118, 76), []), [])
})
