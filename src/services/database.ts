import Dexie, { type Table } from 'dexie'
import type {
  Measurement,
  GlucoseMeasurement,
  Medication,
  BPAlert,
  BPDevice,
  Patient,
  SyncOperation,
  ChatMessage,
} from '../models/types'

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

class KPSCardioDatabase extends Dexie {
  measurements!: Table<Measurement, string>
  glucoseMeasurements!: Table<GlucoseMeasurement, string>
  medications!: Table<Medication, string>
  alerts!: Table<BPAlert, string>
  devices!: Table<BPDevice, string>
  patients!: Table<Patient, string>
  syncOperations!: Table<SyncOperation, string>
  chatMessages!: Table<ChatMessage, string>

  constructor() {
    super('KPSCardioDB')
    this.version(1).stores({
      measurements: 'id, patientId, measuredAt, source',
      medications: 'id, patientId, active',
      alerts: 'id, patientId, status, type, createdAt',
      devices: 'id, patientId',
      patients: 'id, userId, operatorId',
      syncOperations: 'id, entityType, createdAt, attempts',
    })
    this.version(2).stores({
      measurements: 'id, patientId, measuredAt, source',
      medications: 'id, patientId, active',
      alerts: 'id, patientId, status, type, createdAt',
      devices: 'id, patientId',
      patients: 'id, userId, operatorId',
      syncOperations: 'id, entityType, createdAt, attempts',
      chatMessages: 'id, operatorId, patientId, sentAt, read',
    })
    this.version(3).stores({
      measurements: 'id, patientId, measuredAt, source',
      glucoseMeasurements: 'id, patientId, measuredAt, context, source',
      medications: 'id, patientId, active',
      alerts: 'id, patientId, status, type, createdAt',
      devices: 'id, patientId',
      patients: 'id, userId, operatorId',
      syncOperations: 'id, entityType, createdAt, attempts',
      chatMessages: 'id, operatorId, patientId, sentAt, read',
    })
    this.version(4).stores({
      measurements: 'id, [patientId+measuredAt], patientId, measuredAt, source',
      glucoseMeasurements: 'id, [patientId+measuredAt], patientId, measuredAt, context, source',
      medications: 'id, patientId, active',
      alerts: 'id, [patientId+status], patientId, status, type, createdAt',
      devices: 'id, patientId',
      patients: 'id, userId, operatorId',
      syncOperations: 'id, [ownerId+entityType], ownerId, entityType, entityId, createdAt, attempts, nextAttemptAt',
      chatMessages: 'id, [operatorId+patientId], operatorId, patientId, sentAt, read',
    }).upgrade(async (tx) => {
      const legacyOwner = typeof localStorage !== 'undefined'
        ? localStorage.getItem('kpscardio:cache-owner') || 'legacy'
        : 'legacy'
      await tx.table('syncOperations').toCollection().modify((operation) => {
        if (!operation.ownerId) operation.ownerId = legacyOwner
      })
    })
  }
}

export const db = new KPSCardioDatabase()

// ---- Measurement helpers ----
export async function saveMeasurement(m: Measurement) {
  await db.measurements.put(m)
}

export async function fetchAllMeasurements(patientId: string): Promise<Measurement[]> {
  const rows = await db.measurements
    .where('patientId')
    .equals(patientId)
    .sortBy('measuredAt')
  return rows.reverse()
}

export async function fetchTodayMeasurements(patientId: string): Promise<Measurement[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return db.measurements
    .where('[patientId+measuredAt]')
    .between([patientId, startOfDay.toISOString()], [patientId, '\uffff'])
    .reverse()
    .toArray()
}

export async function fetchMeasurementsByDays(
  patientId: string,
  days: number
): Promise<Measurement[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return db.measurements
    .where('[patientId+measuredAt]')
    .between([patientId, since.toISOString()], [patientId, '\uffff'])
    .reverse()
    .toArray()
}

export async function fetchRecentMeasurements(
  patientId: string,
  limit: number
): Promise<Measurement[]> {
  return db.measurements
    .where('[patientId+measuredAt]')
    .between([patientId, ''], [patientId, '\uffff'])
    .reverse()
    .limit(Math.max(0, limit))
    .toArray()
}

export async function fetchStreak(patientId: string): Promise<number> {
  const all = await fetchAllMeasurements(patientId)
  if (all.length === 0) return 0

  const measuredDays = new Set(
    all.map((measurement) => localDateKey(new Date(measurement.measuredAt)))
  )

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const day = new Date(today)
    day.setDate(day.getDate() - i)
    const dayStr = localDateKey(day)
    const hasReading = measuredDays.has(dayStr)
    if (hasReading) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ---- Operator stats helpers ----
export async function fetchLatestMeasurementForPatient(
  patientId: string
): Promise<Measurement | undefined> {
  const all = await fetchAllMeasurements(patientId)
  return all[0]
}

export async function fetchOperatorPatientStats(patientIds: string[]): Promise<{
  latestMeasurements: Map<string, Measurement>
  measuredToday: Set<string>
  activeMedicationCount: Map<string, number>
  measuredLast3Days: Set<string>
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(today.getDate() - 3)

  const latestMeasurements = new Map<string, Measurement>()
  const measuredToday = new Set<string>()
  const measuredLast3Days = new Set<string>()
  const activeMedicationCount = new Map<string, number>()

  if (patientIds.length === 0) return { latestMeasurements, measuredToday, activeMedicationCount, measuredLast3Days }

  // Uma leitura de cada tabela é muito mais barata que duas consultas por
  // paciente, sobretudo no painel da operadora com uma carteira grande.
  const [measurements, medications] = await Promise.all([
    db.measurements.where('patientId').anyOf(patientIds).toArray(),
    db.medications.where('patientId').anyOf(patientIds).toArray(),
  ])
  for (const measurement of measurements) {
    const previous = latestMeasurements.get(measurement.patientId)
    if (!previous || Date.parse(measurement.measuredAt) > Date.parse(previous.measuredAt)) {
      latestMeasurements.set(measurement.patientId, measurement)
    }
  }
  for (const [pid, latest] of latestMeasurements) {
    const measuredAt = new Date(latest.measuredAt)
    if (measuredAt >= today) measuredToday.add(pid)
    if (measuredAt >= threeDaysAgo) measuredLast3Days.add(pid)
  }
  const patientIdSet = new Set(patientIds)
  const activeByPatient = new Map<string, number>()
  for (const medication of medications) {
    if (!medication.active || !patientIdSet.has(medication.patientId)) continue
    if (medication.endDate && medication.endDate < localDateKey(today)) continue
    activeByPatient.set(medication.patientId, (activeByPatient.get(medication.patientId) || 0) + 1)
  }
  for (const pid of patientIds) {
    activeMedicationCount.set(pid, activeByPatient.get(pid) || 0)
  }

  return { latestMeasurements, measuredToday, activeMedicationCount, measuredLast3Days }
}

// ---- Glucose helpers ----
export async function saveGlucoseMeasurement(g: GlucoseMeasurement) {
  await db.glucoseMeasurements.put(g)
}

export async function fetchAllGlucose(patientId: string): Promise<GlucoseMeasurement[]> {
  const rows = await db.glucoseMeasurements
    .where('patientId')
    .equals(patientId)
    .sortBy('measuredAt')
  return rows.reverse()
}

export async function fetchLatestGlucoseForPatients(
  patientIds: string[]
): Promise<Map<string, GlucoseMeasurement>> {
  const latest = new Map<string, GlucoseMeasurement>()
  if (patientIds.length === 0) return latest
  const rows = await db.glucoseMeasurements.where('patientId').anyOf(patientIds).toArray()
  for (const row of rows) {
    const previous = latest.get(row.patientId)
    if (!previous || Date.parse(row.measuredAt) > Date.parse(previous.measuredAt)) {
      latest.set(row.patientId, row)
    }
  }
  return latest
}

export async function fetchTodayGlucose(patientId: string): Promise<GlucoseMeasurement[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return db.glucoseMeasurements
    .where('[patientId+measuredAt]')
    .between([patientId, startOfDay.toISOString()], [patientId, '\uffff'])
    .reverse()
    .toArray()
}

export async function deleteGlucoseMeasurement(id: string) {
  await db.glucoseMeasurements.delete(id)
}

// ---- Medication helpers ----
export async function saveMedication(m: Medication) {
  await db.medications.put(m)
}

export async function fetchMedications(patientId: string): Promise<Medication[]> {
  return db.medications.where('patientId').equals(patientId).toArray()
}

export async function deleteMedication(id: string) {
  await db.medications.delete(id)
}

// ---- Alert helpers ----
export async function saveAlert(a: BPAlert) {
  await db.alerts.put(a)
}

export async function fetchActiveAlerts(patientId: string): Promise<BPAlert[]> {
  return db.alerts
    .where('[patientId+status]')
    .equals([patientId, 'pending'])
    .toArray()
}

export async function fetchActiveAlertsForPatients(
  patientIds: string[]
): Promise<Map<string, BPAlert[]>> {
  const grouped = new Map<string, BPAlert[]>()
  if (patientIds.length === 0) return grouped
  const rows = await db.alerts.where('patientId').anyOf(patientIds).toArray()
  for (const row of rows) {
    if (row.status !== 'pending') continue
    const list = grouped.get(row.patientId) || []
    list.push(row)
    grouped.set(row.patientId, list)
  }
  return grouped
}

export async function acknowledgeAlert(id: string) {
  await db.alerts.update(id, {
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
  })
}

export async function resolveAlert(id: string, resolvedBy?: string) {
  await db.alerts.update(id, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  })
}

// ---- Device helpers ----
export async function saveDevice(d: BPDevice) {
  await db.devices.put(d)
}

export async function fetchDevices(patientId: string): Promise<BPDevice[]> {
  return db.devices.where('patientId').equals(patientId).toArray()
}

export async function updateDeviceLastConnected(deviceId: string) {
  await db.devices.update(deviceId, {
    lastConnectedAt: new Date().toISOString(),
  })
}

// ---- Patient helpers ----
export async function savePatient(p: Patient) {
  await db.patients.put(p)
}

export async function fetchPatient(id: string): Promise<Patient | undefined> {
  return db.patients.get(id)
}

export async function fetchPatientByUserId(userId: string): Promise<Patient | undefined> {
  return db.patients.where('userId').equals(userId).first()
}

export async function fetchPatientsByOperator(operatorId: string): Promise<Patient[]> {
  return db.patients.where('operatorId').equals(operatorId).toArray()
}

// ---- Chat helpers ----
export async function saveChatMessage(msg: ChatMessage) {
  await db.chatMessages.put(msg)
}

export async function fetchChatMessages(
  operatorId: string,
  patientId: string
): Promise<ChatMessage[]> {
  return db.chatMessages
    .where({ operatorId, patientId })
    .sortBy('sentAt')
}

export async function markMessagesRead(operatorId: string, patientId: string, readerRole: 'operator' | 'patient') {
  const msgs = await db.chatMessages
    .where({ operatorId, patientId })
    .toArray()
  const toMark = msgs.filter((m) => m.fromRole !== readerRole && !m.read)
  await Promise.all(toMark.map((m) => db.chatMessages.update(m.id, { read: true })))
}

export async function fetchUnreadCountForPatient(
  operatorId: string,
  patientId: string,
  readerRole: 'operator' | 'patient'
): Promise<number> {
  const msgs = await db.chatMessages.where({ operatorId, patientId }).toArray()
  return msgs.filter((m) => m.fromRole !== readerRole && !m.read).length
}

// ---- Sync queue helpers ----
export class SyncQueueFullError extends Error {
  constructor() {
    super('A fila offline está cheia. Conecte-se à internet e tente novamente antes de registrar outra alteração.')
    this.name = 'SyncQueueFullError'
  }
}

const MAX_SYNC_QUEUE_SIZE = 500

/**
 * Guarda uma operação por entidade e conta. Atualizações sucessivas da mesma
 * medição substituem a operação anterior; exclusões eliminam operações
 * anteriores da entidade. Assim, um aparelho offline não cresce a fila sem
 * limite ao editar o mesmo registro.
 */
export async function saveSyncOperation(op: SyncOperation) {
  if (!op.ownerId) throw new Error('Não foi possível identificar a conta da alteração offline.')
  const existing = await db.syncOperations
    .where('ownerId')
    .equals(op.ownerId)
    .filter((item) => item.entityType === op.entityType && item.entityId === op.entityId)
    .toArray()
  const isNewEntity = existing.length === 0
  const ownerCount = await db.syncOperations.where('ownerId').equals(op.ownerId).count()
  if (isNewEntity && ownerCount >= MAX_SYNC_QUEUE_SIZE) throw new SyncQueueFullError()

  if (existing.length > 0) {
    await db.syncOperations.bulkDelete(existing.map((item) => item.id))
  }
  await db.syncOperations.put(op)
}

export async function fetchPendingSyncOperations(ownerId?: string | null): Promise<SyncOperation[]> {
  if (!ownerId) return []
  const now = Date.now()
  return db.syncOperations
    .where('ownerId')
    .equals(ownerId)
    .filter((operation) => operation.attempts < 20 && (!operation.nextAttemptAt || Date.parse(operation.nextAttemptAt) <= now))
    .sortBy('createdAt')
}

export async function fetchSyncOperations(ownerId?: string | null): Promise<SyncOperation[]> {
  if (!ownerId) return []
  return db.syncOperations.where('ownerId').equals(ownerId).sortBy('createdAt')
}

export async function countPendingSyncOperations(ownerId?: string | null): Promise<number> {
  if (!ownerId) return 0
  return db.syncOperations
    .where('ownerId')
    .equals(ownerId)
    // Inclui operações em backoff: a tela precisa deixar claro que ainda há
    // dados aguardando envio, mesmo quando a próxima tentativa está agendada.
    .filter((operation) => operation.attempts < 20)
    .count()
}

export async function countFailedSyncOperations(ownerId?: string | null): Promise<number> {
  if (!ownerId) return 0
  return db.syncOperations
    .where('ownerId')
    .equals(ownerId)
    .filter((operation) => operation.attempts >= 20)
    .count()
}

export async function deleteSyncOperation(id: string) {
  await db.syncOperations.delete(id)
}

export async function incrementSyncAttempts(id: string) {
  const op = await db.syncOperations.get(id)
  if (op) {
    const attempts = op.attempts + 1
    const delayMs = Math.min(60 * 60_000, 2 ** Math.min(attempts, 10) * 1_000)
    await db.syncOperations.update(id, {
      attempts,
      lastAttemptAt: new Date().toISOString(),
      nextAttemptAt: attempts >= 20 ? undefined : new Date(Date.now() + delayMs).toISOString(),
      lastError: 'Não foi possível enviar ao Railway; nova tentativa será feita automaticamente.',
    })
  }
}

export async function markSyncOperationFailed(id: string, errorMessage?: string) {
  await db.syncOperations.update(id, {
    attempts: 20,
    lastAttemptAt: new Date().toISOString(),
    nextAttemptAt: undefined,
    lastError: errorMessage || 'A alteração não pôde ser enviada ao Railway.',
  })
}

export async function resetFailedSyncOperations(ownerId?: string | null) {
  if (!ownerId) return
  const failed = await db.syncOperations
    .where('ownerId')
    .equals(ownerId)
    .filter((operation) => operation.attempts >= 20)
    .toArray()
  await Promise.all(failed.map((operation) => db.syncOperations.update(operation.id, {
    attempts: 0,
    nextAttemptAt: undefined,
    lastError: undefined,
  })))
}

// ---- Account deletion (LGPD art. 18 / App Review 5.1.1(v)) ----
/**
 * Apaga TODOS os dados clínicos locais do usuário. Chamado em
 * "Excluir minha conta". Limpa também localStorage de auth.
 */
export async function wipeAccountData() {
  await Promise.all([
    db.measurements.clear(),
    db.glucoseMeasurements.clear(),
    db.medications.clear(),
    db.alerts.clear(),
    db.devices.clear(),
    db.patients.clear(),
    db.chatMessages.clear(),
    db.syncOperations.clear(),
  ])
  localStorage.removeItem('kpscardio_disclaimer_accepted')
  localStorage.removeItem('kpscardio:last-sync')
  localStorage.removeItem('kpscardio:cache-owner')
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('kpscardio:last-sync:') || key?.startsWith('kpscardio:draft:')) localStorage.removeItem(key)
  }
}

/** Evita vazamento de dados entre contas no mesmo navegador sem apagar o aceite legal. */
export async function clearClinicalCache(options: { ownerId?: string | null } = {}) {
  await Promise.all([
    db.measurements.clear(),
    db.glucoseMeasurements.clear(),
    db.medications.clear(),
    db.alerts.clear(),
    db.devices.clear(),
    db.patients.clear(),
    db.chatMessages.clear(),
  ])
  localStorage.removeItem('kpscardio:last-sync')
  if (options.ownerId) {
    localStorage.removeItem(`kpscardio:last-sync:${options.ownerId}`)
  } else {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('kpscardio:last-sync:')) localStorage.removeItem(key)
    }
  }
}
