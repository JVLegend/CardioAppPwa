import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGlucoseAlerts, evaluateMeasurementAlerts } from './clinical-rules.mjs'

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

test('glicemia abaixo de 54 mg/dL gera alerta urgente', () => {
  assert.deepEqual(evaluateGlucoseAlerts({ value: 14 }), [
    { type: 'urgent', rule: 'Glicemia muito baixa: 14 mg/dL' },
  ])
})

test('glicemia entre 54 e 69 mg/dL gera alerta de atenção', () => {
  assert.deepEqual(evaluateGlucoseAlerts({ value: 65 }), [
    { type: 'attention', rule: 'Glicemia baixa: 65 mg/dL' },
  ])
})

test('glicemia a partir de 70 mg/dL não gera alerta de hipoglicemia', () => {
  assert.deepEqual(evaluateGlucoseAlerts({ value: 70 }), [])
})
