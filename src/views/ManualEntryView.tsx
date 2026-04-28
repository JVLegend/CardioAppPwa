import { useState, useRef, useEffect, type FormEvent } from 'react'
import { classifyBP, classificationConfig } from '../config/theme'
import styles from './ManualEntryView.module.css'

interface Props {
  onSave: (systolic: number, diastolic: number, heartRate?: number) => void
  onCancel: () => void
}

export default function ManualEntryView({ onSave, onCancel }: Props) {
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const sysRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    sysRef.current?.focus()
  }, [])

  const sys = parseInt(systolic) || 0
  const dia = parseInt(diastolic) || 0
  const isValid = sys >= 40 && sys <= 300 && dia >= 20 && dia <= 200

  const classification = isValid ? classifyBP(sys, dia) : null
  const classConfig = classification ? classificationConfig[classification] : null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    const hr = heartRate ? parseInt(heartRate) : undefined
    onSave(sys, dia, hr)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onCancel}>
          Cancelar
        </button>
        <h1 className={styles.title}>Nova Medição</h1>
        <div style={{ width: 70 }} />
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Preview */}
        <div className={styles.preview}>
          <div className={styles.previewValues}>
            <span
              className={styles.previewSys}
              style={{ color: classConfig?.color || 'var(--text-muted)' }}
            >
              {sys || '---'}
            </span>
            <span className={styles.previewSlash}>/</span>
            <span className={styles.previewDia}>{dia || '--'}</span>
          </div>
          {classConfig && (
            <div className={styles.previewClass}>
              <span className={styles.previewDot} style={{ background: classConfig.color }} />
              <span style={{ color: classConfig.color }}>{classConfig.label}</span>
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputRow}>
            <label className={styles.label}>Sistólica</label>
            <input
              ref={sysRef}
              className={styles.input}
              type="number"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
              placeholder="120"
              min={40}
              max={300}
              required
            />
            <span className={styles.unit}>mmHg</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.inputRow}>
            <label className={styles.label}>Diastólica</label>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
              placeholder="80"
              min={20}
              max={200}
              required
            />
            <span className={styles.unit}>mmHg</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.inputRow}>
            <label className={styles.label}>Frequencia cardíaca</label>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="72"
            />
            <span className={styles.unit}>bpm</span>
          </div>
        </div>

        <button className={styles.saveBtn} type="submit" disabled={!isValid}>
          Registrar
        </button>
      </form>
    </div>
  )
}
