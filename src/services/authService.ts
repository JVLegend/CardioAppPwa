import type { Patient } from '../models/types'
import { ApiError } from './apiClient'

const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export interface AuthSessionPayload {
  profile: Patient
  mustChangePassword: boolean
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(body.error || `Falha na autenticação (${response.status})`, response.status, body.code)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function signIn(email: string, password: string) {
  return authRequest<AuthSessionPayload>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })
}

export function getAuthSession() {
  return authRequest<AuthSessionPayload>('/api/auth/session')
}

export function signOut() {
  return authRequest<void>('/api/auth/logout', { method: 'POST' })
}

export function changePassword(newPassword: string, currentPassword?: string) {
  return authRequest<AuthSessionPayload>('/api/auth/change-password', {
    method: 'POST', body: JSON.stringify({ newPassword, currentPassword }),
  })
}
