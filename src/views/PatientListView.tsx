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
          <button
            className={styles.backBtn}
            onClick={() => setSelectedPatient(null)}
          >
            ← Pacientes
          </button>
          <span className={styles.patientName}>{selectedPatient.name}</span>
        </div>
        <MainTabView />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Pacientes</h1>
        <button className={styles.logoutBtn} onClick={logout}>
          Sair
        </button>
      </div>

      {/* Search */}
      <input
        className={styles.searchInput}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar paciente..."
      />

      {/* Add */}
      <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
        + Adicionar Paciente
      </button>

      {showAdd && (
        <div className={styles.formCard}>
          <form onSubmit={handleAddPatient} className={styles.form}>
            <input
              className={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do paciente"
              required
            />
            <input
              className={styles.input}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Telefone (opcional)"
            />
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowAdd(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.saveBtn}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patient List */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>Nenhum paciente encontrado</div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              className={styles.patientItem}
              onClick={() => handleSelectPatient(p)}
            >
              <div className={styles.avatar}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.patientInfo}>
                <div className={styles.patientItemName}>{p.name}</div>
                {p.phone && (
                  <div className={styles.patientPhone}>{p.phone}</div>
                )}
              </div>
              <span className={styles.chevron}>›</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
