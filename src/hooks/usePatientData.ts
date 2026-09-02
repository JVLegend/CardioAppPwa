import { useState, useEffect, useCallback } from 'react'
import type { Measurement, BPAlert, Medication, MeasurementSource, GlucoseMeasurement } from '../models/types'
import { useAuth } from '../contexts/AuthContext'
import * as db from '../services/database'
import { evaluateAlerts, sendBrowserNotification } from '../services/alertService'
import { persistEntity, pullFromServer } from '../services/syncEngine'

export function usePatientData() {
  const { currentPatient } = useAuth()
  const [allMeasurements, setAllMeasurements] = useState<Measurement[]>([])
  const [todayMeasurements, setTodayMeasurements] = useState<Measurement[]>([])
  const [allGlucoseMeasurements, setAllGlucoseMeasurements] = useState<GlucoseMeasurement[]>([])
  const [streak, setStreak] = useState(0)
  const [activeAlerts, setActiveAlerts] = useState<BPAlert[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const patientId = currentPatient?.id

  const loadData = useCallback(async () => {
    if (!patientId) return
    setIsLoading(true)
    try {
      await pullFromServer()
      const [all, today, glucose, s, alerts, meds] = await Promise.all([
        db.fetchAllMeasurements(patientId),
        db.fetchTodayMeasurements(patientId),
        db.fetchAllGlucose(patientId),
        db.fetchStreak(patientId),
        db.fetchActiveAlerts(patientId),
        db.fetchMedications(patientId),
      ])
      setAllMeasurements(all)
      setTodayMeasurements(today)
      setAllGlucoseMeasurements(glucose)
      setStreak(s)
      setActiveAlerts(alerts)
      setMedications(meds)
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addMeasurement = async (
    systolic: number,
    diastolic: number,
    heartRate?: number,
    source: MeasurementSource = 'manual'
  ) => {
    if (!patientId) throw new Error('Não foi possível identificar o paciente.')

    const m: Measurement = {
      id: crypto.randomUUID(),
      patientId,
      systolic,
      diastolic,
      heartRate,
      meanArterialPressure: Math.round((systolic + 2 * diastolic) / 3),
      source,
      measuredAt: new Date().toISOString(),
    }

    const persistence = await persistEntity(
      'measurement', m.id, 'create', m,
      () => db.saveMeasurement(m)
    )

    setAllMeasurements((prev) => [m, ...prev.filter((item) => item.id !== m.id)])
    setTodayMeasurements((prev) => [m, ...prev.filter((item) => item.id !== m.id)])

    // Check alerts
    const recent = (await db.fetchRecentMeasurements(patientId, 4)).filter((item) => item.id !== m.id)
    const alertResults = evaluateAlerts(m, recent)
    for (const result of alertResults) {
      sendBrowserNotification(
        result.type === 'urgent' ? '⚠️ Alerta Urgente' : '⚡ Atenção',
        result.rule
      )
    }

    if (persistence === 'remote') await pullFromServer()
    await loadData()
  }

  const addMedication = async (
    name: string,
    dose: string,
    frequency: string,
    schedule?: string[],
    startDate?: string,
    endDate?: string,
    notes?: string
  ) => {
    if (!patientId) throw new Error('Não foi possível identificar o paciente.')
    const med: Medication = {
      id: crypto.randomUUID(),
      patientId,
      name,
      dose,
      frequency,
      schedule,
      active: true,
      startDate,
      endDate,
      notes,
    }
    await persistEntity('medication', med.id, 'create', med, () => db.saveMedication(med))
    setMedications((prev) => [...prev, med])
  }

  const removeMedication = async (id: string) => {
    await persistEntity('medication', id, 'delete', undefined, () => db.deleteMedication(id))
    setMedications((prev) => prev.filter((m) => m.id !== id))
  }

  const toggleMedication = async (med: Medication) => {
    const updated = { ...med, active: !med.active }
    await persistEntity('medication', med.id, 'update', updated, () => db.saveMedication(updated))
    setMedications((prev) => prev.map((m) => (m.id === med.id ? updated : m)))
  }

  return {
    allMeasurements,
    allGlucoseMeasurements,
    todayMeasurements,
    streak,
    activeAlerts,
    medications,
    isLoading,
    addMeasurement,
    addMedication,
    removeMedication,
    toggleMedication,
    reload: loadData,
  }
}
