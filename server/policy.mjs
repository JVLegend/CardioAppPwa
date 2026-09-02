export const USER_ROLES = Object.freeze(['patient', 'operator', 'controller'])
export const ENTITY_TYPES = Object.freeze([
  'measurement',
  'glucoseMeasurement',
  'medication',
  'alert',
  'device',
  'chatMessage',
])

const ENTITY_WRITE_POLICY = Object.freeze({
  patient: Object.freeze({
    measurement: new Set(['create', 'update', 'delete']),
    glucoseMeasurement: new Set(['create', 'update', 'delete']),
    medication: new Set(['create', 'update', 'delete']),
    device: new Set(['create', 'update', 'delete']),
    chatMessage: new Set(['create', 'update']),
  }),
  operator: Object.freeze({
    measurement: new Set(['create', 'update', 'delete']),
    glucoseMeasurement: new Set(['create', 'update', 'delete']),
    medication: new Set(['create', 'update', 'delete']),
    alert: new Set(['update']),
    device: new Set(['create', 'update', 'delete']),
    chatMessage: new Set(['create', 'update']),
  }),
  controller: Object.freeze({
    alert: new Set(['update']),
    chatMessage: new Set(['create', 'update']),
  }),
})

const PROFILE_FIELDS = Object.freeze({
  patient: new Set(['name', 'phone', 'birthDate', 'state']),
  operator: new Set(['name', 'phone', 'birthDate', 'state', 'comorbidities', 'inTreatmentPlan']),
  controller: new Set(['name', 'phone', 'birthDate', 'state', 'comorbidities', 'planStatus', 'inTreatmentPlan', 'operatorId']),
})

export function isUserRole(value) {
  return USER_ROLES.includes(value)
}

export function canCreateRole(actorRole, targetRole) {
  if (actorRole === 'operator') return targetRole === 'patient'
  if (actorRole === 'controller') return targetRole === 'patient' || targetRole === 'operator'
  return false
}

export function canResetPassword(actorRole, actorId, target) {
  if (!target || actorId === target.id) return false
  if (actorRole === 'controller') return true
  return actorRole === 'operator'
    && target.role === 'patient'
    && target.operator_id === actorId
}

export function canWriteEntity(actorRole, entityType, operation) {
  return ENTITY_WRITE_POLICY[actorRole]?.[entityType]?.has(operation) === true
}

export function canAccessPatientScope(actorRole, actorId, patientId, assignedOperatorId = null) {
  if (actorRole === 'controller') return true
  if (actorRole === 'patient') return actorId === patientId
  if (actorRole === 'operator') return actorId === assignedOperatorId
  return false
}

export function canTransitionAlert(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true
  if (fromStatus === 'pending') return toStatus === 'acknowledged' || toStatus === 'resolved'
  if (fromStatus === 'acknowledged') return toStatus === 'resolved'
  return false
}

export function sanitizeProfilePatch(actorRole, body = {}) {
  const allowed = PROFILE_FIELDS[actorRole] || new Set()
  return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.has(key)))
}

export function changedProfileFields(actorRole, body = {}) {
  return Object.keys(sanitizeProfilePatch(actorRole, body)).sort()
}

export function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function isValidState(value) {
  return value == null || value === '' || /^[A-Z]{2}$/.test(String(value))
}

export function isValidIsoDate(value) {
  return value == null || value === '' || !Number.isNaN(Date.parse(String(value)))
}
