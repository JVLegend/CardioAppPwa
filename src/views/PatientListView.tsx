import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Patient } from '../models/types'
import * as db from '../services/database'
import { enqueue } from '../services/syncEngine'
import MainTabView from './MainTabView'
import styles from './PatientListView.module.css'

export default function PatientListView() {
  const { currentPatient, selectPatient, logout } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  useEffect(() => {
    if (currentPatient) {
      db.fetchPatientsByOperator(currentPatient.id).then(setPatients)
    }
  }, [currentPatient])

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddPatient = (e: FormEvent) => {
    e.preventDefault()
    if (!newName || !currentPatient) return
    const patient: Patient = {
      id: crypto.randomUUID(),
      operatorId: currentPatient.id,
      name: newName,
      phone: newPhone || undefined,
      role: 'patient',
      createdAt: new Date().toISOString(),
    }
    db.savePatient(patient)
    setPatients((prev) => [...prev, patient])
    enqueue('patient', patient.id, 'create', patient)
    setNewName('')
    setNewPhone('')
    setShowAdd(false)
  }

  const handleSelectPatient = (patient: Patient) => {
    selectPatient(patient)
    setSelectedPatient(patient)
  }

  if (selectedPatient) {
    return (
      <div>
        <div className={styles.patientBar}>
          <button className={styles.backBtn} onClick={() => setSelectedPatient(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Pacientes
          </button>
          <span className={styles.patientName}>{selectedPatient.name}</span>
          <div style={{ width: 80 }} />
        </div>
        <MainTabView />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Pacientes</h1>
        <button className={styles.logoutBtn} onClick={logout}>Sair</button>
      </div>

      <input
        className={styles.searchInput}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar paciente..."
      />

      <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
        Adicionar paciente
      </button>

      {showAdd && (
        <div className={styles.formCard}>
          <form onSubmit={handleAddPatient}>
            <div className={styles.inputGroup}>
              <input className={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do paciente" required />
              <div className={styles.inputDivider} />
              <input className={styles.input} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefone (opcional)" />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button type="submit" className={styles.saveBtn}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>Nenhum paciente encontrado</div>
        ) : (
          filtered.map((p, i) => (
            <button
              key={p.id}
              className={styles.patientItem}
              onClick={() => handleSelectPatient(p)}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className={styles.avatar}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.patientInfo}>
                <div className={styles.patientItemName}>{p.name}</div>
                {p.phone && <div className={styles.patientPhone}>{p.phone}</div>}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
