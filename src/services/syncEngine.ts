import type { SyncOperation } from '../models/types'
import {
  countFailedSyncOperations,
  countPendingSyncOperations,
  db,
  deleteSyncOperation,
  fetchPendingSyncOperations,
  incrementSyncAttempts,
  saveSyncOperation,
} from './database'
import * as repo from './railwayRepository'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  failed: number
  lastSyncedAt: string | null
  message: string | null
}

const SYNC_CURSOR_KEY = 'kpscardio:last-sync'
let isOnline = navigator.onLine
let isSyncing = false
let isPulling = false
let state: SyncState = {
  status: isOnline ? 'idle' : 'offline',
  pending: 0,
  failed: 0,
  lastSyncedAt: localStorage.getItem(SYNC_CURSOR_KEY),
  message: null,
}
const listeners = new Set<(next: SyncState) => void>()

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

async function refreshQueueCounts() {
  const [pending, failed] = await Promise.all([
    countPendingSyncOperations(),
    countFailedSyncOperations(),
  ])
  emit({ pending, failed })
}

window.addEventListener('online', () => {
  isOnline = true
  emit({ status: 'syncing', message: null })
  void processPendingOperations().then(() => pullFromServer())
})
window.addEventListener('offline', () => {
  isOnline = false
  emit({ status: 'offline', message: 'Sem conexão; alterações ficam pendentes neste aparelho.' })
})

void refreshQueueCounts()

export function getIsOnline() { return isOnline }
export function getSyncState() { return state }
export function onSyncStateChange(listener: (next: SyncState) => void) {
  listeners.add(listener)
  listener(state)
  return () => { listeners.delete(listener) }
}

type LocalWrite = () => Promise<unknown>

/**
 * Persiste primeiro no Railway quando há rede e mantém o Dexie como cache/fila
 * offline. Erros de validação ou permissão não são escondidos na fila.
 */
export async function persistEntity(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload: unknown,
  writeLocal: LocalWrite
): Promise<'remote' | 'queued'> {
  let savedRemotely = false
  let remoteError: unknown

  if (isOnline) {
    try {
      if (entityType === 'patient' && payload) {
        await repo.updateProfileRemote(payload as Parameters<typeof repo.updateProfileRemote>[0])
      } else if (operation === 'delete') {
        await repo.deleteEntityRemote(entityType, entityId)
      } else {
        await repo.upsertEntityRemote(entityType, entityId, payload)
      }
      savedRemotely = true
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error
        ? Number(error.status)
        : 0
      if (status > 0 && status < 500 && status !== 408 && status !== 429) throw error
      remoteError = error
      console.warn(`[sync] ${entityType} não chegou ao Railway; usando fila local`, error)
    }
  }

  try {
    await writeLocal()
    if (!savedRemotely) await enqueue(entityType, entityId, operation, payload)
  } catch (localError) {
    if (!savedRemotely) throw remoteError || localError
    console.warn(`[sync] ${entityType} salvo no Railway, mas o cache local falhou`, localError)
  }

  return savedRemotely ? 'remote' : 'queued'
}

export async function enqueue(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload?: unknown
) {
  const op: SyncOperation = {
    id: crypto.randomUUID(), entityType, entityId, operation,
    payload: payload ? JSON.stringify(payload) : undefined,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  await saveSyncOperation(op)
  await refreshQueueCounts()
  if (isOnline) void processPendingOperations()
  else emit({ status: 'offline' })
}

export async function processPendingOperations() {
  if (isSyncing || !isOnline) return
  isSyncing = true
  let completedAny = false
  emit({ status: 'syncing', message: null })
  try {
    const ops = await fetchPendingSyncOperations()
    for (const op of ops) {
      try {
        const payload = op.payload ? JSON.parse(op.payload) : undefined
        if (op.entityType === 'patient' && payload) {
          await repo.updateProfileRemote(payload)
        } else if (op.operation === 'delete') {
          await repo.deleteEntityRemote(op.entityType, op.entityId)
        } else {
          await repo.upsertEntityRemote(op.entityType, op.entityId, payload)
        }
        completedAny = true
        await deleteSyncOperation(op.id)
      } catch (error) {
        console.warn('[sync] operação pendente', op.entityType, error)
        await incrementSyncAttempts(op.id)
      }
    }
    await refreshQueueCounts()
    emit({
      status: state.failed > 0 ? 'error' : 'idle',
      message: state.failed > 0 ? `${state.failed} alteração(ões) precisam de atenção.` : null,
    })
  } catch (error) {
    console.warn('[sync] não foi possível processar a fila', error)
    emit({ status: 'error', message: 'Não foi possível enviar as alterações ao Railway.' })
  } finally {
    isSyncing = false
  }
  if (completedAny) await pullFromServer()
}

/** Atualiza o cache offline somente com mudanças posteriores ao último cursor. */
export async function pullFromServer() {
  if (isPulling || !isOnline) return
  isPulling = true
  emit({ status: 'syncing', message: null })
  const previousCursor = localStorage.getItem(SYNC_CURSOR_KEY)
  try {
    const data = await repo.fetchBootstrap(previousCursor)
    const isFullSync = !previousCursor
    await db.transaction('rw', [
      db.patients, db.measurements, db.glucoseMeasurements, db.medications,
      db.alerts, db.devices, db.chatMessages,
    ], async () => {
      if (isFullSync) {
        await Promise.all([
          db.patients.clear(), db.measurements.clear(), db.glucoseMeasurements.clear(),
          db.medications.clear(), db.alerts.clear(), db.devices.clear(), db.chatMessages.clear(),
        ])
      }

      for (const item of data.deleted || []) {
        const table = syncTable(item.entityType)
        if (table) await table.delete(item.entityId)
      }

      await Promise.all([
        db.patients.bulkPut([data.profile, ...data.patients]),
        db.measurements.bulkPut(data.measurements),
        db.glucoseMeasurements.bulkPut(data.glucoseMeasurements),
        db.medications.bulkPut(data.medications),
        db.alerts.bulkPut(data.alerts),
        db.devices.bulkPut(data.devices),
        db.chatMessages.bulkPut(data.chatMessages),
      ])
    })
    localStorage.setItem(SYNC_CURSOR_KEY, data.syncCursor)
    emit({ status: 'idle', lastSyncedAt: data.syncCursor, message: null })
  } catch (error) {
    console.warn('[sync] leitura do Railway indisponível; mantendo cache offline', error)
    emit({ status: 'error', message: 'Não foi possível atualizar os dados do Railway.' })
  } finally {
    isPulling = false
  }
}

function syncTable(entityType: string) {
  switch (entityType) {
    case 'measurement': return db.measurements
    case 'glucoseMeasurement': return db.glucoseMeasurements
    case 'medication': return db.medications
    case 'alert': return db.alerts
    case 'device': return db.devices
    case 'chatMessage': return db.chatMessages
    default: return null
  }
}
