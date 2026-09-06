import type { SyncOperation } from '../models/types'
import {
  countFailedSyncOperations,
  countPendingSyncOperations,
  db,
  deleteSyncOperation,
  fetchPendingSyncOperations,
  incrementSyncAttempts,
  markSyncOperationFailed,
  resetFailedSyncOperations,
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
const SYNC_OVERLAP_MS = 5_000
const MAX_ERROR_LENGTH = 240

let isOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let activeOwnerId: string | null = null
let ownerGeneration = 0
let syncPromise: Promise<void> | null = null
let pullPromise: Promise<void> | null = null
let state: SyncState = {
  status: isOnline ? 'idle' : 'offline',
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  message: null,
}
const listeners = new Set<(next: SyncState) => void>()

class StaleSyncSessionError extends Error {
  constructor() {
    super('A sessão mudou enquanto a sincronização estava em andamento.')
    this.name = 'StaleSyncSessionError'
  }
}

function cursorKey(ownerId: string) {
  return `${SYNC_CURSOR_KEY}:${ownerId}`
}

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

async function refreshQueueCounts() {
  const ownerId = activeOwnerId
  const generation = ownerGeneration
  const [pending, failed] = await Promise.all([
    countPendingSyncOperations(ownerId),
    countFailedSyncOperations(ownerId),
  ])
  if (ownerId !== activeOwnerId || generation !== ownerGeneration) return
  emit({ pending, failed })
}

export function setSyncOwner(ownerId: string | null) {
  // Também muda quando a conta volta a ser a mesma: respostas de uma sessão
  // antiga não podem gravar no cache depois de logout/login rápido.
  ownerGeneration += 1
  activeOwnerId = ownerId
  const lastSyncedAt = ownerId && typeof localStorage !== 'undefined'
    ? localStorage.getItem(cursorKey(ownerId))
    : null
  emit({ status: isOnline ? 'idle' : 'offline', lastSyncedAt, pending: 0, failed: 0, message: null })
  void refreshQueueCounts()
}

export function getSyncOwner() {
  return activeOwnerId
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true
    emit({ status: 'syncing', message: null })
    void processPendingOperations().then(() => pullFromServer())
  })
  window.addEventListener('offline', () => {
    isOnline = false
    emit({ status: 'offline', message: 'Sem conexão; alterações ficam pendentes neste aparelho.' })
  })
}

void refreshQueueCounts()

export function getIsOnline() { return isOnline }
export function getSyncState() { return state }
export function onSyncStateChange(listener: (next: SyncState) => void) {
  listeners.add(listener)
  listener(state)
  return () => { listeners.delete(listener) }
}

type LocalWrite = () => Promise<unknown>

function makeOperation(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload?: unknown
): SyncOperation {
  if (!activeOwnerId) throw new Error('Sessão não identificada para guardar a alteração.')
  return {
    id: crypto.randomUUID(),
    ownerId: activeOwnerId,
    entityType,
    entityId,
    operation,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
}

const transactionTables = [
  db.measurements,
  db.glucoseMeasurements,
  db.medications,
  db.alerts,
  db.devices,
  db.patients,
  db.chatMessages,
  db.syncOperations,
]

/**
 * Persiste primeiro no Railway quando há rede. Quando a rede falha, a entidade
 * e a operação de sincronização entram na mesma transação local, evitando uma
 * medição salva sem uma operação correspondente na fila.
 */
export async function persistEntity(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload: unknown,
  writeLocal: LocalWrite
): Promise<'remote' | 'queued'> {
  const ownerIdAtStart = activeOwnerId
  const generationAtStart = ownerGeneration
  const queuedOperation = makeOperation(entityType, entityId, operation, payload)
  let savedRemotely = false

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
      // Permissão, validação e autenticação não são problemas transitórios:
      // não escondemos esses erros dentro de uma fila offline.
      if (status > 0 && status < 500 && status !== 408 && status !== 409 && status !== 429) throw error
      console.warn(`[sync] ${entityType} não chegou ao Railway; usando fila local`, error)
    }
  }

  try {
    await db.transaction('rw', transactionTables, async () => {
      // Se a sessão trocou enquanto a rede respondia, não repopule o cache da
      // conta anterior. Uma falha remota ainda fica na fila da conta correta,
      // para ser retomada quando ela voltar a entrar.
      const ownerChanged = activeOwnerId !== ownerIdAtStart || ownerGeneration !== generationAtStart
      if (ownerChanged) {
        if (!savedRemotely) await saveSyncOperation(queuedOperation)
        return
      }
      await writeLocal()
      if (!savedRemotely) await saveSyncOperation(queuedOperation)
    })
  } catch (localError) {
    // Se o Railway confirmou e apenas o cache local falhou, o dado remoto é a
    // fonte de verdade; ainda assim a tela recebe o erro para poder recarregar.
    console.warn(`[sync] ${entityType} salvo no Railway, mas o cache local falhou`, localError)
    throw localError
  }

  if (activeOwnerId !== ownerIdAtStart || ownerGeneration !== generationAtStart) {
    await refreshQueueCounts()
    return savedRemotely ? 'remote' : 'queued'
  }

  await refreshQueueCounts()
  if (!savedRemotely) {
    emit({ status: isOnline ? 'syncing' : 'offline', message: 'Alteração guardada neste aparelho e aguardando sincronização.' })
    if (isOnline) void processPendingOperations()
  }
  return savedRemotely ? 'remote' : 'queued'
}

export async function enqueue(
  entityType: string,
  entityId: string,
  operation: SyncOperation['operation'],
  payload?: unknown
) {
  await db.transaction('rw', transactionTables, async () => {
    await saveSyncOperation(makeOperation(entityType, entityId, operation, payload))
  })
  await refreshQueueCounts()
  if (isOnline) void processPendingOperations()
  else emit({ status: 'offline' })
}

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Falha temporária ao sincronizar.'
  return message.slice(0, MAX_ERROR_LENGTH)
}

export async function processPendingOperations(): Promise<void> {
  if (syncPromise) return syncPromise
  if (!isOnline || !activeOwnerId) return
  const ownerId = activeOwnerId
  const generation = ownerGeneration
  syncPromise = (async () => {
    let completedAny = false
    emit({ status: 'syncing', message: null })
    try {
      const ops = await fetchPendingSyncOperations(ownerId)
      for (const op of ops) {
        if (activeOwnerId !== ownerId || ownerGeneration !== generation || !isOnline) break
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
          const status = typeof error === 'object' && error && 'status' in error
            ? Number(error.status)
            : 0
          if (status >= 400 && status < 500 && ![408, 409, 429].includes(status)) {
            await markSyncOperationFailed(op.id, readableError(error))
          } else {
            await incrementSyncAttempts(op.id)
          }
          console.warn('[sync] operação pendente', op.entityType, error)
        }
      }
      if (activeOwnerId !== ownerId || ownerGeneration !== generation) return
      await refreshQueueCounts()
      emit({
        status: state.failed > 0 ? 'error' : 'idle',
        message: state.failed > 0
          ? `${state.failed} alteração(ões) precisam de atenção.`
          : state.pending > 0
            ? `${state.pending} alteração(ões) aguardando conexão.`
            : null,
      })
    } catch (error) {
      console.warn('[sync] não foi possível processar a fila', error)
      emit({ status: 'error', message: 'Não foi possível enviar as alterações ao Railway.' })
    } finally {
      syncPromise = null
    }
    if (completedAny && activeOwnerId === ownerId && ownerGeneration === generation) await pullFromServer()
  })()
  return syncPromise
}

export async function retryFailedSyncOperations() {
  await resetFailedSyncOperations(activeOwnerId)
  await refreshQueueCounts()
  await processPendingOperations()
}

function syncTable(entityType: string) {
  switch (entityType) {
    case 'patient': return db.patients
    case 'measurement': return db.measurements
    case 'glucoseMeasurement': return db.glucoseMeasurements
    case 'medication': return db.medications
    case 'alert': return db.alerts
    case 'device': return db.devices
    case 'chatMessage': return db.chatMessages
    default: return null
  }
}

async function reapplyLocalOperations(operations: SyncOperation[]) {
  for (const operation of operations) {
    const table = syncTable(operation.entityType)
    if (!table) continue
    if (operation.operation === 'delete') {
      await table.delete(operation.entityId)
      continue
    }
    if (!operation.payload) continue
    try {
      await table.put(JSON.parse(operation.payload))
    } catch (error) {
      console.warn('[sync] operação local inválida foi mantida na fila', operation.entityType, error)
    }
  }
}

async function deleteLocalRowsForPatients(patientIds: string[]) {
  if (patientIds.length === 0) return
  const remove = async (table: any) => {
    const rows = await table.where('patientId').anyOf(patientIds).toArray()
    await table.bulkDelete(rows.map((row: { id: string }) => row.id))
  }
  await Promise.all([
    remove(db.measurements),
    remove(db.glucoseMeasurements),
    remove(db.medications),
    remove(db.alerts),
    remove(db.devices),
    remove(db.chatMessages),
  ])
  await db.patients.bulkDelete(patientIds)
}

function operationBelongsToPatient(operation: SyncOperation, patientIds: Set<string>) {
  if (operation.entityType === 'patient') return patientIds.has(operation.entityId)
  if (!operation.payload) return false
  try {
    const payload = JSON.parse(operation.payload) as { patientId?: string }
    return Boolean(payload.patientId && patientIds.has(payload.patientId))
  } catch {
    return false
  }
}

/**
 * Atualiza o cache somente com mudanças posteriores ao cursor. A janela de
 * sobreposição cobre commits que terminaram durante a leitura; bulkPut é
 * idempotente e a operação local pendente é reaplicada depois do remoto.
 */
export async function pullFromServer(): Promise<void> {
  if (pullPromise) return pullPromise
  if (!isOnline || !activeOwnerId) return
  const ownerId = activeOwnerId
  const generation = ownerGeneration
  pullPromise = (async () => {
    emit({ status: 'syncing', message: null })
    try {
      const previousCursor = typeof localStorage !== 'undefined'
        ? localStorage.getItem(cursorKey(ownerId))
        : null
      const isFullSync = !previousCursor
      const queryCursor = previousCursor
        ? new Date(Math.max(0, Date.parse(previousCursor) - SYNC_OVERLAP_MS)).toISOString()
        : null
      const data = await repo.fetchBootstrap(queryCursor)
      if (activeOwnerId !== ownerId || ownerGeneration !== generation) return
      await db.transaction('rw', [
        db.patients, db.measurements, db.glucoseMeasurements, db.medications,
        db.alerts, db.devices, db.chatMessages, db.syncOperations,
      ], async () => {
        if (activeOwnerId !== ownerId || ownerGeneration !== generation) throw new StaleSyncSessionError()
        // Leia a fila dentro da mesma transação que aplica o bootstrap. Uma
        // alteração offline criada enquanto a rede respondia não pode ficar
        // fora do snapshot e ser sobrescrita por uma versão remota antiga.
        const pendingLocalOperations = await db.syncOperations
          .where('ownerId')
          .equals(ownerId)
          .sortBy('createdAt')
        let operationsToReapply = pendingLocalOperations
        // O servidor devolve a carteira completa mesmo em um pull incremental.
        // Isso permite remover prontuários que deixaram de pertencer ao médico
        // sem aguardar um tombstone (inclusive após exclusão de uma conta).
        if (Array.isArray(data.authorizedPatientIds)) {
          const authorized = new Set(data.authorizedPatientIds)
          const cachedPatients = await db.patients.toArray()
          const revokedIds = cachedPatients
            .filter((patient) => patient.role === 'patient' && !authorized.has(patient.id))
            .map((patient) => patient.id)
          if (revokedIds.length > 0) {
            const revoked = new Set(revokedIds)
            const revokedOperations = pendingLocalOperations.filter((operation) => operationBelongsToPatient(operation, revoked))
            if (revokedOperations.length > 0) {
              // Retém a operação para auditoria/revisão local, mas marca como
              // falha definitiva: ela nunca deve ser enviada sem que o acesso
              // seja restabelecido explicitamente.
              await Promise.all(revokedOperations.map((operation) => db.syncOperations.update(operation.id, {
                attempts: 20,
                nextAttemptAt: undefined,
                lastAttemptAt: new Date().toISOString(),
                lastError: 'Acesso ao paciente foi revogado; a alteração não será enviada.',
              })))
            }
            operationsToReapply = pendingLocalOperations.filter((operation) => !operationBelongsToPatient(operation, revoked))
            await deleteLocalRowsForPatients(revokedIds)
          }
        }
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
        await reapplyLocalOperations(operationsToReapply)
        if (activeOwnerId !== ownerId || ownerGeneration !== generation) throw new StaleSyncSessionError()
      })
      if (activeOwnerId !== ownerId || ownerGeneration !== generation) return
      if (typeof localStorage !== 'undefined') localStorage.setItem(cursorKey(ownerId), data.syncCursor)
      emit({ status: 'idle', lastSyncedAt: data.syncCursor, message: null })
    } catch (error) {
      if (error instanceof StaleSyncSessionError) return
      console.warn('[sync] leitura do Railway indisponível; mantendo cache offline', error)
      emit({ status: 'error', message: 'Não foi possível atualizar os dados do Railway.' })
    } finally {
      pullPromise = null
    }
  })()
  return pullPromise
}
