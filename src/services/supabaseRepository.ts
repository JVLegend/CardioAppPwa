import { supabase } from './supabaseClient'
import type {
  Patient,
  Measurement,
  Medication,
  BPAlert,
  BPDevice,
} from '../models/types'

// ---- Patients ----
export async function fetchPatientRemote(userId: string): Promise<Patient | null> {
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data ? mapPatient(data) : null
}

export async function upsertPatientRemote(p: Patient) {
  await supabase.from('patients').upsert(toPatientRow(p))
}

export async function fetchPatientsRemote(operatorId: string): Promise<Patient[]> {
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('operator_id', operatorId)
  return (data || []).map(mapPatient)
}

// ---- Measurements ----
export async function fetchMeasurementsRemote(
  patientId: string,
  since?: string
): Promise<Measurement[]> {
  let query = supabase
    .from('measurements')
    .select('*')
    .eq('patient_id', patientId)
    .order('measured_at', { ascending: false })
  if (since) query = query.gte('measured_at', since)
  const { data } = await query
  return (data || []).map(mapMeasurement)
}

export async function insertMeasurementRemote(m: Measurement) {
  await supabase.from('measurements').insert(toMeasurementRow(m))
}

// ---- Medications ----
export async function fetchMedicationsRemote(patientId: string): Promise<Medication[]> {
  const { data } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
  return (data || []).map(mapMedication)
}

export async function upsertMedicationRemote(m: Medication) {
  await supabase.from('medications').upsert(toMedicationRow(m))
}

export async function deleteMedicationRemote(id: string) {
  await supabase.from('medications').delete().eq('id', id)
}

// ---- Alerts ----
export async function fetchActiveAlertsRemote(patientId: string): Promise<BPAlert[]> {
  const { data } = await supabase
    .from('alerts')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'pending')
  return (data || []).map(mapAlert)
}

export async function insertAlertRemote(a: BPAlert) {
  await supabase.from('alerts').insert(toAlertRow(a))
}

export async function updateAlertStatusRemote(
  id: string,
  status: string,
  resolvedBy?: string
) {
  const update: Record<string, string> = { status }
  if (status === 'acknowledged') update.acknowledged_at = new Date().toISOString()
  if (status === 'resolved') {
    update.resolved_at = new Date().toISOString()
    if (resolvedBy) update.resolved_by = resolvedBy
  }
  await supabase.from('alerts').update(update).eq('id', id)
}

// ---- Devices ----
export async function fetchDevicesRemote(patientId: string): Promise<BPDevice[]> {
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('patient_id', patientId)
  return (data || []).map(mapDevice)
}

export async function upsertDeviceRemote(d: BPDevice) {
  await supabase.from('devices').upsert(toDeviceRow(d))
}

// ---- Mappers: DB row → Model ----
function mapPatient(r: Record<string, unknown>): Patient {
  return {
    id: r.id as string,
    operatorId: r.operator_id as string,
    userId: r.user_id as string | undefined,
    name: r.name as string,
    birthDate: r.birth_date as string | undefined,
    phone: r.phone as string | undefined,
    createdAt: r.created_at as string | undefined,
    role: (r.role as string) === 'operator' ? 'operator' : 'patient',
  }
}

function mapMeasurement(r: Record<string, unknown>): Measurement {
  return {
    id: r.id as string,
    patientId: r.patient_id as string,
    deviceId: r.device_id as string | undefined,
    systolic: r.systolic as number,
    diastolic: r.diastolic as number,
    heartRate: r.heart_rate as number | undefined,
    meanArterialPressure: r.mean_arterial_pressure as number | undefined,
    source: (r.source as string) === 'ble' ? 'ble' : 'manual',
    measuredAt: r.measured_at as string,
    syncedAt: r.synced_at as string | undefined,
  }
}

function mapMedication(r: Record<string, unknown>): Medication {
  return {
    id: r.id as string,
    patientId: r.patient_id as string,
    name: r.name as string,
    dose: r.dose as string,
    frequency: r.frequency as string,
    schedule: r.schedule as string[] | undefined,
    active: r.active as boolean,
  }
}

function mapAlert(r: Record<string, unknown>): BPAlert {
  return {
    id: r.id as string,
    patientId: r.patient_id as string,
    measurementId: r.measurement_id as string | undefined,
    type: r.type as BPAlert['type'],
    rule: r.rule as string,
    status: r.status as BPAlert['status'],
    createdAt: r.created_at as string,
    acknowledgedAt: r.acknowledged_at as string | undefined,
    resolvedAt: r.resolved_at as string | undefined,
    resolvedBy: r.resolved_by as string | undefined,
  }
}

function mapDevice(r: Record<string, unknown>): BPDevice {
  return {
    id: r.id as string,
    patientId: r.patient_id as string,
    model: r.model as string,
    serialNumber: r.serial_number as string | undefined,
    lastConnectedAt: r.last_connected_at as string | undefined,
  }
}

// ---- Mappers: Model → DB row ----
function toPatientRow(p: Patient) {
  return {
    id: p.id,
    operator_id: p.operatorId,
    user_id: p.userId,
    name: p.name,
    birth_date: p.birthDate,
    phone: p.phone,
    created_at: p.createdAt,
    role: p.role,
  }
}

function toMeasurementRow(m: Measurement) {
  return {
    id: m.id,
    patient_id: m.patientId,
    device_id: m.deviceId,
    systolic: m.systolic,
    diastolic: m.diastolic,
    heart_rate: m.heartRate,
    mean_arterial_pressure: m.meanArterialPressure,
    source: m.source,
    measured_at: m.measuredAt,
    synced_at: m.syncedAt,
  }
}

function toMedicationRow(m: Medication) {
  return {
    id: m.id,
    patient_id: m.patientId,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    schedule: m.schedule,
    active: m.active,
  }
}

function toAlertRow(a: BPAlert) {
  return {
    id: a.id,
    patient_id: a.patientId,
    measurement_id: a.measurementId,
    type: a.type,
    rule: a.rule,
    status: a.status,
    created_at: a.createdAt,
    acknowledged_at: a.acknowledgedAt,
    resolved_at: a.resolvedAt,
    resolved_by: a.resolvedBy,
  }
}

function toDeviceRow(d: BPDevice) {
  return {
    id: d.id,
    patient_id: d.patientId,
    model: d.model,
    serial_number: d.serialNumber,
    last_connected_at: d.lastConnectedAt,
  }
}
