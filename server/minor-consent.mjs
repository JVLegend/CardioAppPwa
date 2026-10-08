export const GUARDIAN_CONSENT_VERSION = '2026-10-08'

export const GUARDIAN_CONSENT_METHODS = new Set([
  'authenticated_digital',
  'in_person',
  'recorded_call',
  'signed_document',
])

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export function ageOnDate(birthDate, referenceDate = new Date()) {
  const birth = parseDateOnly(birthDate)
  if (!birth || Number.isNaN(referenceDate.getTime())) return null
  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday = referenceDate.getUTCMonth() < birth.getUTCMonth()
    || (referenceDate.getUTCMonth() === birth.getUTCMonth() && referenceDate.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export function isMinor(birthDate, referenceDate = new Date()) {
  const age = ageOnDate(birthDate, referenceDate)
  return age != null && age >= 0 && age < 18
}

export function validateGuardianConsent(value, referenceDate = new Date()) {
  if (!value || typeof value !== 'object') return 'A autorização do responsável legal é obrigatória para pacientes menores de 18 anos'
  if (String(value.guardianName || '').trim().length < 3 || String(value.guardianName || '').trim().length > 160) return 'Informe o nome completo do responsável legal'
  if (String(value.relationship || '').trim().length < 2 || String(value.relationship || '').trim().length > 80) return 'Informe o vínculo do responsável com o paciente'
  if (String(value.contact || '').trim().length < 5 || String(value.contact || '').trim().length > 160) return 'Informe um telefone ou e-mail válido do responsável legal'
  if (!GUARDIAN_CONSENT_METHODS.has(value.method)) return 'Selecione como a autorização do responsável foi verificada'
  if (String(value.evidenceReference || '').trim().length < 3 || String(value.evidenceReference || '').trim().length > 200) {
    return 'Informe o protocolo ou a referência da evidência de autorização'
  }
  const consentedAt = parseDateOnly(value.consentedAt)
  if (!consentedAt || consentedAt.getTime() > referenceDate.getTime()) return 'Informe uma data válida para a autorização do responsável'
  if (value.confirmed !== true) return 'Confirme que a identidade, o vínculo e a autorização do responsável foram verificados'
  return null
}

export function normalizeGuardianConsent(value) {
  return {
    guardianName: String(value.guardianName).trim(),
    relationship: String(value.relationship).trim(),
    contact: String(value.contact).trim(),
    method: value.method,
    evidenceReference: String(value.evidenceReference).trim(),
    consentedAt: `${value.consentedAt}T12:00:00.000Z`,
  }
}
