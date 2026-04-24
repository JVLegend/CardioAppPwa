export type UserRole = 'patient' | 'operator' | 'controller'
export type MeasurementSource = 'ble' | 'manual'
export type AlertType = 'urgent' | 'attention' | 'adherence'
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved'

export type PlanStatus = 'adimplente' | 'inadimplente' | 'pendente'

export interface Patient {
  id: string
  operatorId: string
  userId?: string
  name: string
  birthDate?: string
  phone?: string
  createdAt?: string
  role: UserRole
  comorbidities?: string[]
  planStatus?: PlanStatus
  inTreatmentPlan?: boolean
}

export interface Measurement {
  id: string
  patientId: string
  deviceId?: string
  systolic: number
  diastolic: number
  heartRate?: number
  meanArterialPressure?: number
  source: MeasurementSource
  measuredAt: string
  syncedAt?: string
}

export interface Medication {
  id: string
  patientId: string
  name: string
  dose: string
  frequency: string
  schedule?: string[]
  active: boolean
  startDate?: string
  endDate?: string
  notes?: string
}

export interface BPAlert {
  id: string
  patientId: string
  measurementId?: string
  type: AlertType
  rule: string
  status: AlertStatus
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface BPDevice {
  id: string
  patientId: string
  model: string
  serialNumber?: string
  lastConnectedAt?: string
}

export interface SyncOperation {
  id: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload?: string
  createdAt: string
  attempts: number
}

export interface ChatMessage {
  id: string
  operatorId: string
  patientId: string
  fromRole: 'operator' | 'patient'
  content: string
  sentAt: string
  read: boolean
}
