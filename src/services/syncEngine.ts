import type { SyncOperation } from '../models/types'
import {
  saveSyncOperation,
  fetchPendingSyncOperations,
  deleteSyncOperation,
  incrementSyncAttempts,
} from './database'
import * as repo from './supabaseRepository'
import * as db from './database'

let isOnline = navigator.onLine
let isSyncing = false

window.addEventListener('online', () => {
  isOnline = true
  processPendingOperations()
})
window.addEventListener('offline', () => {
  isOnline = false
})

export function getIsOnline() {
  return isOnline
}

export async function enqueue(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload?: unknown
) {
  const op: SyncOperation = {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    operation,
    payload: payload ? JSON.stringify(payload) : undefined,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  await saveSyncOperation(op)
  if (isOnline) {
    processPendingOperations()
  }
}

export async function processPendingOperations() {
  if (isSyncing || !isOnline) return
  isSyncing = true

  try {
    const ops = await fetchPendingSyncOperations()
    for (const op of ops) {
      try {
        await executeOperation(op)
        await deleteSyncOperation(op.id)
      } catch {
        await incrementSyncAttempts(op.id)
      }
    }
  } finally {
    isSyncing = false
  }
}

async function executeOperation(op: SyncOperation) {
  const payload = op.payload ? JSON.parse(op.payload) : null

  switch (op.entityType) {
    case 'measurement':
      if (op.operation === 'create') await repo.insertMeasurementRemote(payload)
      break
    case 'medication':
      if (op.operation === 'create' || op.operation === 'update')
        await repo.upsertMedicationRemote(payload)
      if (op.operation === 'delete')
        await repo.deleteMedicationRemote(op.entityId)
      break
    case 'alert':
      if (op.operation === 'create') await repo.insertAlertRemote(payload)
      if (op.operation === 'update')
        await repo.updateAlertStatusRemote(
          op.entityId,
          payload?.status,
          payload?.resolvedBy
        )
      break
    case 'device':
      if (op.operation === 'create' || op.operation === 'update')
        await repo.upsertDeviceRemote(payload)
      break
    case 'patient':
      if (op.operation === 'create' || op.operation === 'update')
        await repo.upsertPatientRemote(payload)
      break
  }
}

export async function pullFromServer(patientId: string) {
  if (!isOnline) return
  try {
    const [measurements, medications, alerts, devices] = await Promise.all([
      repo.fetchMeasurementsRemote(patientId),
      repo.fetchMedicationsRemote(patientId),
      repo.fetchActiveAlertsRemote(patientId),
      repo.fetchDevicesRemote(patientId),
    ])

    await Promise.all([
      ...measurements.map((m) => db.saveMeasurement(m)),
      ...medications.map((m) => db.saveMedication(m)),
      ...alerts.map((a) => db.saveAlert(a)),
      ...devices.map((d) => db.saveDevice(d)),
    ])
  } catch {
    // Silently fail — offline-first
  }
}
