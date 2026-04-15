import { useState, useEffect, useCallback } from 'react'
import type { Measurement, BPAlert, Medication } from '../models/types'
import { useAuth } from '../contexts/AuthContext'
import * as db from '../services/database'
import { evaluateAlerts, createAlert, sendBrowserNotification } from '../services/alertService'
import { enqueue } from '../services/syncEngine'

export function usePatientData() {
  const { currentPatient } = useAuth()
  const [allMeasurements, setAllMeasurements] = useState<Measurement[]>([])
  const [todayMeasurements, setTodayMeasurements] = useState<Measurement[]>([])
  const [streak, setStreak] = useState(0)
  const [activeAlerts, setActiveAlerts] = useState<BPAlert[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const patientId = currentPatient?.id

  const loadData = useCallback(async () => {
    if (!patientId) return
    setIsLoading(true)
    try {
      const [all, today, s, alerts, meds] = await Promise.all([
        db.fetchAllMeasurements(patientId),
        db.fetchTodayMeasurements(patientId),
        db.fetchStreak(patientId),
        db.fetchActiveAlerts(patientId),
        db.fetchMedications(patientId),
      ])
      setAllMeasurements(all)
      setTodayMeasurements(today)
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
    source: 'manual' | 'ble' = 'manual'
  ) => {
    if (!patientId) return

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

    // Update UI immediately
    setAllMeasurements((prev) => [m, ...prev])
    setTodayMeasurements((prev) => [m, ...prev])

    // Persist locally
    await db.saveMeasurement(m)

    // Check alerts
    const recent = await db.fetchRecentMeasurements(patientId, 3)
    const alertResults = evaluateAlerts(m, recent)
    for (const result of alertResults) {
      const alert = createAlert(patientId, m.id, result)
      await db.saveAlert(alert)
      setActiveAlerts((prev) => [alert, ...prev])
      sendBrowserNotification(
        alert.type === 'urgent' ? '⚠️ Alerta Urgente' : '⚡ Atenção',
        alert.rule
      )
      enqueue('alert', alert.id, 'create', alert)
    }

    // Update streak
    const newStreak = await db.fetchStreak(patientId)
    setStreak(newStreak)

    // Sync
    enqueue('measurement', m.id, 'create', m)
  }

  const addMedication = async (
    name: string,
    dose: string,
    frequency: string,
    schedule?: string[]
  ) => {
    if (!patientId) return
    const med: Medication = {
      id: crypto.randomUUID(),
      patientId,
      name,
      dose,
      frequency,
      schedule,
      active: true,
    }
    await db.saveMedication(med)
    setMedications((prev) => [...prev, med])
    enqueue('medication', med.id, 'create', med)
  }

  const removeMedication = async (id: string) => {
    await db.deleteMedication(id)
    setMedications((prev) => prev.filter((m) => m.id !== id))
    enqueue('medication', id, 'delete')
  }

  const toggleMedication = async (med: Medication) => {
    const updated = { ...med, active: !med.active }
    await db.saveMedication(updated)
    setMedications((prev) => prev.map((m) => (m.id === med.id ? updated : m)))
    enqueue('medication', med.id, 'update', updated)
  }

  return {
    allMeasurements,
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
