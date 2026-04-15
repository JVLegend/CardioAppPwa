import { useState, type FormEvent } from 'react'
import { usePatientData } from '../hooks/usePatientData'
import styles from './MedicationsView.module.css'

const frequencyOptions = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  'A cada 8h',
  'A cada 12h',
  'Conforme necessario',
]

export default function MedicationsView() {
  const { medications, addMedication, removeMedication, toggleMedication } = usePatientData()
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
    const schedule = scheduleInput.split(',').map((s) => s.trim()).filter(Boolean)
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
          Adicionar
        </button>
      </div>

      {showAdd && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Novo remedio</h2>
          <form onSubmit={handleAdd}>
            <div className={styles.inputGroup}>
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Nome</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Losartana" required />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Dose</label>
                <input className={styles.input} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="50mg" required />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Frequencia</label>
                <select className={styles.select} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Horarios</label>
                <input className={styles.input} value={scheduleInput} onChange={(e) => setScheduleInput(e.target.value)} placeholder="08:00, 20:00" />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button type="submit" className={styles.saveBtn}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {activeMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ativos</h2>
          <div className={styles.medList}>
            {activeMeds.map((med, i) => (
              <div key={med.id} className={styles.medItem} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className={styles.medDot} style={{ background: 'var(--cardio-green)' }} />
                <div className={styles.medInfo}>
                  <div className={styles.medName}>{med.name}</div>
                  <div className={styles.medDetail}>
                    {med.dose} — {med.frequency}
                    {med.schedule && med.schedule.length > 0 && ` · ${med.schedule.join(', ')}`}
                  </div>
                </div>
                <div className={styles.medActions}>
                  <button className={styles.iconBtn} onClick={() => toggleMedication(med)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  </button>
                  <button className={styles.iconBtn} onClick={() => removeMedication(med.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inactiveMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Inativos</h2>
          <div className={styles.medList}>
            {inactiveMeds.map((med) => (
              <div key={med.id} className={`${styles.medItem} ${styles.inactive}`}>
                <div className={styles.medDot} style={{ background: 'var(--text-muted)' }} />
                <div className={styles.medInfo}>
                  <div className={styles.medName}>{med.name}</div>
                  <div className={styles.medDetail}>{med.dose} — {med.frequency}</div>
                </div>
                <button className={styles.iconBtn} onClick={() => toggleMedication(med)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-green)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {medications.length === 0 && !showAdd && (
        <div className={styles.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M10.5 1.5H8C4.7 1.5 2 4.2 2 7.5v0c0 3.3 2.7 6 6 6h2.5"/>
            <path d="M13.5 22.5H16c3.3 0 6-2.7 6-6v0c0-3.3-2.7-6-6-6h-2.5"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <p className={styles.emptyTitle}>Sem remedios</p>
          <p className={styles.emptyDesc}>Adicione seus remedios para acompanhar</p>
        </div>
      )}
    </div>
  )
}
