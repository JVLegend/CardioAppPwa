import Dexie, { type Table } from 'dexie'
import type {
  Measurement,
  Medication,
  BPAlert,
  BPDevice,
  Patient,
  SyncOperation,
} from '../models/types'

class CardioDatabase extends Dexie {
  measurements!: Table<Measurement, string>
  medications!: Table<Medication, string>
  alerts!: Table<BPAlert, string>
  devices!: Table<BPDevice, string>
  patients!: Table<Patient, string>
  syncOperations!: Table<SyncOperation, string>

  constructor() {
    super('CardioAppDB')
    this.version(1).stores({
      measurements: 'id, patientId, measuredAt, source',
      medications: 'id, patientId, active',
      alerts: 'id, patientId, status, type, createdAt',
      devices: 'id, patientId',
      patients: 'id, userId, operatorId',
      syncOperations: 'id, entityType, createdAt, attempts',
    })
  }
}

export const db = new CardioDatabase()

// ---- Measurement helpers ----
export async function saveMeasurement(m: Measurement) {
  await db.measurements.put(m)
}

export async function fetchAllMeasurements(patientId: string): Promise<Measurement[]> {
  return db.measurements
    .where('patientId')
    .equals(patientId)
    .reverse()
    .sortBy('measuredAt')
}

export async function fetchTodayMeasurements(patientId: string): Promise<Measurement[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const all = await fetchAllMeasurements(patientId)
  return all.filter((m) => new Date(m.measuredAt) >= startOfDay)
}

export async function fetchMeasurementsByDays(
  patientId: string,
  days: number
): Promise<Measurement[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const all = await fetchAllMeasurements(patientId)
  return all.filter((m) => new Date(m.measuredAt) >= since)
}

export async function fetchRecentMeasurements(
  patientId: string,
  limit: number
): Promise<Measurement[]> {
  const all = await fetchAllMeasurements(patientId)
  return all.slice(0, limit)
}

export async function fetchStreak(patientId: string): Promise<number> {
  const all = await fetchAllMeasurements(patientId)
  if (all.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const day = new Date(today)
    day.setDate(day.getDate() - i)
    const dayStr = day.toISOString().split('T')[0]
    const hasReading = all.some(
      (m) => new Date(m.measuredAt).toISOString().split('T')[0] === dayStr
    )
    if (hasReading) {
      streak++
    } else {
      break
    }
  }
  return streak
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
    .where({ patientId, status: 'pending' })
    .toArray()
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

// ---- Sync queue helpers ----
export async function saveSyncOperation(op: SyncOperation) {
  const count = await db.syncOperations.count()
  if (count >= 500) return
  await db.syncOperations.put(op)
}

export async function fetchPendingSyncOperations(): Promise<SyncOperation[]> {
  return db.syncOperations.where('attempts').below(3).toArray()
}

export async function deleteSyncOperation(id: string) {
  await db.syncOperations.delete(id)
}

export async function incrementSyncAttempts(id: string) {
  const op = await db.syncOperations.get(id)
  if (op) {
    await db.syncOperations.update(id, { attempts: op.attempts + 1 })
  }
}
