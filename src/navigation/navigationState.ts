export type AppTab = 'home' | 'history' | 'glucose' | 'medications' | 'chat' | 'settings'

export const APP_TABS: AppTab[] = ['home', 'history', 'glucose', 'medications', 'chat', 'settings']

export function isAppTab(value: string | null): value is AppTab {
  return value != null && APP_TABS.includes(value as AppTab)
}

export function readTabFromLocation(fallback: AppTab = 'home'): AppTab {
  if (typeof window === 'undefined') return fallback
  const value = new URLSearchParams(window.location.search).get('tab')
  return isAppTab(value) ? value : fallback
}

export function readPatientFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('patient')
}

export function writeNavigationState({
  tab,
  patientId,
  mode = 'replace',
}: {
  tab?: AppTab
  patientId?: string | null
  mode?: 'push' | 'replace'
}) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (tab) url.searchParams.set('tab', tab)
  if (patientId) url.searchParams.set('patient', patientId)
  else if (patientId === null) url.searchParams.delete('patient')
  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return
  const historyState = { ...(window.history.state || {}), kpsCardio: { tab, patientId } }
  if (mode === 'push') window.history.pushState(historyState, '', next)
  else window.history.replaceState(historyState, '', next)
}
