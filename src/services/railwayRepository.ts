import type { BPAlert, BPDevice, ChatMessage, GlucoseMeasurement, Measurement, Medication, Patient } from '../models/types'
import { apiRequest } from './apiClient'

export interface BootstrapPayload {
  profile: Patient
  syncCursor: string
  patients: Patient[]
  measurements: Measurement[]
  glucoseMeasurements: GlucoseMeasurement[]
  medications: Medication[]
  alerts: BPAlert[]
  devices: BPDevice[]
  chatMessages: ChatMessage[]
  deleted: Array<{ entityType: string; entityId: string }>
}

export const fetchMe = () => apiRequest<Patient>('/api/me')
export const fetchBootstrap = (since?: string | null) => apiRequest<BootstrapPayload>(
  `/api/bootstrap${since ? `?since=${encodeURIComponent(since)}` : ''}`
)

export function upsertEntityRemote(type: string, id: string, payload: unknown) {
  return apiRequest(`/api/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(payload),
  })
}

export function deleteEntityRemote(type: string, id: string) {
  return apiRequest(`/api/entities/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function updateProfileRemote(patient: Patient) {
  return apiRequest<Patient>(`/api/profiles/${encodeURIComponent(patient.id)}`, {
    method: 'PATCH', body: JSON.stringify(patient),
  })
}

export interface CreateRemoteProfileInput {
  name: string
  email: string
  password: string
  role: Patient['role']
  phone?: string
  birthDate?: string
  state?: string
  comorbidities?: string[]
  planStatus?: Patient['planStatus']
  inTreatmentPlan?: boolean
  operatorId?: string
}

export function createProfileRemote(input: CreateRemoteProfileInput) {
  return apiRequest<Patient>('/api/profiles', { method: 'POST', body: JSON.stringify(input) })
}

export interface ManagedProfile extends Patient {
  credentialConfigured: boolean
  mustChangePassword: boolean
  lastLoginAt?: string
}

export function fetchManagedProfiles() {
  return apiRequest<ManagedProfile[]>('/api/profiles')
}

export function resetProfilePassword(profileId: string, password: string) {
  return apiRequest<{ ok: true; mustChangePassword: true }>(`/api/profiles/${encodeURIComponent(profileId)}/password`, {
    method: 'POST', body: JSON.stringify({ password }),
  })
}

export function generateWithGemini(body: unknown) {
  return apiRequest<Record<string, unknown>>('/api/ai/generate', { method: 'POST', body: JSON.stringify(body) })
}

export function deleteRemoteAccount() {
  return apiRequest<void>('/api/account', { method: 'DELETE' })
}
