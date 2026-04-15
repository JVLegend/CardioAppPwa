import { useState, type FormEvent } from 'react'
import { usePatientData } from '../hooks/usePatientData'
import styles from './MedicationsView.module.css'

const frequencyOptions = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  '4x ao dia',
  'A cada 8h',
  'A cada 12h',
  'Conforme necessario',
]

export default function MedicationsView() {
  const { medications, addMedication, removeMedication, toggleMedication } =
    usePatientData()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState(frequencyOptions[0])
  const [scheduleInput, setScheduleInput] = useState('')

  const activeMeds = medications.filter((m) => m.active)
  const inactiveMeds = medications.filter((m) => !m.active)

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!name || !dose) return
    const schedule = scheduleInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    addMedication(name, dose, frequency, schedule.length > 0 ? schedule : undefined)
    setName('')
    setDose('')
    setFrequency(frequencyOptions[0])
    setScheduleInput('')
    setShowAdd(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Remedios</h1>
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
          + Adicionar
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Novo Remedio</h2>
          <form className={styles.form} onSubmit={handleAdd}>
            <div className={styles.field}>
              <label className={styles.label}>Nome</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Losartana"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Dose</label>
              <input
                className={styles.input}
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="Ex: 50mg"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Frequencia</label>
              <select
                className={styles.input}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                {frequencyOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Horarios (opcional, separar por virgula)</label>
              <input
                className={styles.input}
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                placeholder="08:00, 20:00"
              />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelFormBtn} onClick={() => setShowAdd(false)}>
                Cancelar
              </button>
              <button type="submit" className={styles.saveFormBtn}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active */}
      {activeMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ativos ({activeMeds.length})</h2>
          {activeMeds.map((med) => (
            <div key={med.id} className={styles.medItem}>
              <div className={styles.medInfo}>
                <div className={styles.medName}>💊 {med.name}</div>
                <div className={styles.medDose}>
                  {med.dose} — {med.frequency}
                </div>
                {med.schedule && med.schedule.length > 0 && (
                  <div className={styles.medSchedule}>
                    🕐 {med.schedule.join(', ')}
                  </div>
                )}
              </div>
              <div className={styles.medActions}>
                <button
                  className={styles.medToggle}
                  onClick={() => toggleMedication(med)}
                  title="Desativar"
                >
                  ⏸️
                </button>
                <button
                  className={styles.medDelete}
                  onClick={() => removeMedication(med.id)}
                  title="Remover"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inactive */}
      {inactiveMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Inativos ({inactiveMeds.length})</h2>
          {inactiveMeds.map((med) => (
            <div key={med.id} className={`${styles.medItem} ${styles.medInactive}`}>
              <div className={styles.medInfo}>
                <div className={styles.medName}>💊 {med.name}</div>
                <div className={styles.medDose}>
                  {med.dose} — {med.frequency}
                </div>
              </div>
              <button
                className={styles.medToggle}
                onClick={() => toggleMedication(med)}
                title="Reativar"
              >
                ▶️
              </button>
            </div>
          ))}
        </div>
      )}

      {medications.length === 0 && !showAdd && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💊</div>
          <div>Nenhum remedio cadastrado</div>
          <div className={styles.emptyHint}>
            Toque em "Adicionar" para registrar seus remedios
          </div>
        </div>
      )}
    </div>
  )
}
