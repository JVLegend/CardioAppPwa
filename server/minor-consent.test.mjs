import test from 'node:test'
import assert from 'node:assert/strict'
import { ageOnDate, isMinor, normalizeGuardianConsent, validateGuardianConsent } from './minor-consent.mjs'

const today = new Date('2026-10-08T18:00:00.000Z')
const validConsent = {
  guardianName: 'Maria da Silva',
  relationship: 'Mãe',
  contact: 'maria@example.com',
  method: 'authenticated_digital',
  evidenceReference: 'ACEITE-2026-001',
  consentedAt: '2026-10-08',
  confirmed: true,
}

test('calcula 18 anos somente a partir do aniversário', () => {
  assert.equal(ageOnDate('2008-10-08', today), 18)
  assert.equal(ageOnDate('2008-10-09', today), 17)
  assert.equal(isMinor('2008-10-08', today), false)
  assert.equal(isMinor('2008-10-09', today), true)
  assert.equal(ageOnDate('2026-10-09', today), -1)
})

test('exige prova completa de autorização para menor', () => {
  assert.match(validateGuardianConsent(null, today), /obrigatória/)
  assert.match(validateGuardianConsent({ ...validConsent, confirmed: false }, today), /Confirme/)
  assert.match(validateGuardianConsent({ ...validConsent, method: 'mensagem' }, today), /Selecione/)
  assert.match(validateGuardianConsent({ ...validConsent, consentedAt: '2026-10-09' }, today), /data válida/)
  assert.equal(validateGuardianConsent(validConsent, today), null)
})

test('normaliza campos sem armazenar a confirmação transitória', () => {
  assert.deepEqual(normalizeGuardianConsent({ ...validConsent, guardianName: '  Maria da Silva  ' }), {
    guardianName: 'Maria da Silva',
    relationship: 'Mãe',
    contact: 'maria@example.com',
    method: 'authenticated_digital',
    evidenceReference: 'ACEITE-2026-001',
    consentedAt: '2026-10-08T12:00:00.000Z',
  })
})
