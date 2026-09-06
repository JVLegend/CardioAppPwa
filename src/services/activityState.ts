import { useEffect, useSyncExternalStore } from 'react'

type ActivityListener = () => void

const blockingActivities = new Set<string>()
const listeners = new Set<ActivityListener>()
let beforeUnloadGuardAttached = false

function guardBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

function updateBeforeUnloadGuard() {
  if (typeof window === 'undefined') return
  const shouldGuard = blockingActivities.size > 0
  if (shouldGuard && !beforeUnloadGuardAttached) {
    window.addEventListener('beforeunload', guardBeforeUnload)
    beforeUnloadGuardAttached = true
  } else if (!shouldGuard && beforeUnloadGuardAttached) {
    window.removeEventListener('beforeunload', guardBeforeUnload)
    beforeUnloadGuardAttached = false
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export function setBlockingActivity(key: string, active: boolean) {
  let changed = false
  if (active) {
    if (!blockingActivities.has(key)) {
      blockingActivities.add(key)
      changed = true
    }
  } else {
    changed = blockingActivities.delete(key)
  }
  if (changed) {
    updateBeforeUnloadGuard()
    emit()
  }
}

export function hasBlockingActivity() {
  return blockingActivities.size > 0
}

export function subscribeBlockingActivity(listener: ActivityListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Registers an operation that must finish before a PWA reload is offered. */
export function useBlockingActivity(key: string, active: boolean) {
  useEffect(() => {
    setBlockingActivity(key, active)
    return () => setBlockingActivity(key, false)
  }, [active, key])
}

export function useHasBlockingActivity() {
  return useSyncExternalStore(subscribeBlockingActivity, hasBlockingActivity, () => false)
}
