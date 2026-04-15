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
          ← Voltar
        </button>
        <h1 className={styles.title}>Registro Manual</h1>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Sistolica (mmHg)</label>
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
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Diastolica (mmHg)</label>
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
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Frequencia Cardiaca (bpm) - opcional</label>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="72"
          />
        </div>

        {/* Preview */}
        {classConfig && (
          <div
            className={styles.preview}
            style={{ borderColor: classConfig.color }}
          >
            <div className={styles.previewValues}>
              <span style={{ color: classConfig.color, fontSize: 32, fontWeight: 700 }}>
                {sys}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>/</span>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{dia}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}>mmHg</span>
            </div>
            <div className={styles.previewClass}>
              {classConfig.emoji} {classConfig.label}
            </div>
          </div>
        )}

        <button
          className={styles.saveBtn}
          type="submit"
          disabled={!isValid}
        >
          Registrar Medicao
        </button>
      </form>
    </div>
  )
}
