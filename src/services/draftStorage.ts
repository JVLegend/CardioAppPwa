import { getSyncOwner } from './syncEngine'

/**
 * Rascunhos curtos de formulários ficam somente no aparelho e pertencem à
 * conta autenticada. Não guardamos fotos nem respostas completas da IA aqui.
 */
const PREFIX = 'kpscardio:draft'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_BYTES = 200_000

function storageKey(scope: string) {
  const ownerId = getSyncOwner()
  return ownerId ? `${PREFIX}:${ownerId}:${scope}` : null
}

export function readDraft<T>(scope: string): T | null {
  const key = storageKey(scope)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; value?: T }
    if (!parsed || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.value ?? null
  } catch {
    return null
  }
}

export function writeDraft(scope: string, value: unknown) {
  const key = storageKey(scope)
  if (!key) return
  try {
    const encoded = JSON.stringify({ savedAt: Date.now(), value })
    if (encoded.length > MAX_BYTES) return
    localStorage.setItem(key, encoded)
  } catch {
    // Rascunho é uma conveniência: falha de quota nunca deve bloquear o app.
  }
}

export function clearDraft(scope?: string) {
  if (!scope) return
  const key = storageKey(scope)
  if (key) localStorage.removeItem(key)
}
