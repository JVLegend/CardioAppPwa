import { useState, useRef, useEffect, type FormEvent } from 'react'
import { classifyBP, classificationConfig } from '../config/theme'
import styles from './ManualEntryView.module.css'

interface Props {
  onSave: (systolic: number, diastolic: number, heartRate?: number) => void | Promise<void>
  onCancel: () => void
  initialSystolic?: number | null
  initialDiastolic?: number | null
  initialHeartRate?: number | null
  fromPhoto?: boolean
}

export default function ManualEntryView({
  onSave,
  onCancel,
  initialSystolic,
  initialDiastolic,
  initialHeartRate,
  fromPhoto,
}: Props) {
  const [systolic, setSystolic] = useState(initialSystolic ? String(initialSystolic) : '')
  const [diastolic, setDiastolic] = useState(initialDiastolic ? String(initialDiastolic) : '')
  const [heartRate, setHeartRate] = useState(initialHeartRate ? String(initialHeartRate) : '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const sysRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!fromPhoto) sysRef.current?.focus()
  }, [fromPhoto])

  const sys = parseInt(systolic) || 0
  const dia = parseInt(diastolic) || 0
  const hr = heartRate === '' ? undefined : Number(heartRate)
  const isValid = Number.isInteger(sys) && sys >= 40 && sys <= 300
    && Number.isInteger(dia) && dia >= 20 && dia <= 200
    && (hr === undefined || (Number.isInteger(hr) && hr >= 20 && hr <= 250))

  const classification = isValid ? classifyBP(sys, dia) : null
  const classConfig = classification ? classificationConfig[classification] : null

  const saveReading = async () => {
    if (savingRef.current) return
    if (!isValid) {
      setSaveError('Confira a pressão e informe uma frequência entre 20 e 250 bpm, se preenchida.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      await onSave(sys, dia, hr)
    } catch (error) {
      console.error('[pressure] falha ao registrar medição', error)
      setSaveError(error instanceof Error ? error.message : 'Não foi possível registrar a medição. Tente novamente.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void saveReading()
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onCancel}>
          Cancelar
        </button>
        <h1 className={styles.title}>{fromPhoto ? 'Confirmar leitura' : 'Nova Medição'}</h1>
        <div style={{ width: 70 }} />
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {fromPhoto && (
          <div
            style={{
              background: 'var(--cardio-yellow-bg, #FBF5E5)',
              border: '1px solid var(--cardio-yellow, #C5A050)',
              color: '#7a5a00',
              padding: '12px 14px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.4,
              margin: '0 16px 12px',
            }}
          >
            📷 Valores lidos pela IA da foto do aparelho. <b>Confira</b> os números antes de registrar.
          </div>
        )}
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
          {classification === 'crisis' && (
            <div role="alert" style={{
              margin: '16px 16px 0', padding: '14px 16px', borderRadius: 12,
              background: '#FEE2E2', color: '#7F1D1D', fontSize: 14,
              lineHeight: 1.5, textAlign: 'left',
            }}>
              <strong>Leitura muito elevada.</strong> Registre o valor. Se estiver sem sintomas e em segurança,
              permaneça sentado e repita a medição após 5 minutos. Com dor no peito, falta de ar,
              alteração visual, confusão ou perda de força, procure urgência ou ligue 192.
            </div>
          )}
        </div>

        <div className={styles.inputGroup}>
          <div className={styles.inputRow}>
            <label className={styles.label}>Sistólica</label>
            <input
              ref={sysRef}
              aria-label="Pressão sistólica"
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
              aria-label="Pressão diastólica"
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
            <label className={styles.label}>Frequência cardíaca</label>
            <input
              className={styles.input}
              aria-label="Frequência cardíaca"
              type="number"
              inputMode="numeric"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="72"
              min={20}
              max={250}
            />
            <span className={styles.unit}>bpm</span>
          </div>
        </div>

        {saveError && <div role="alert" style={{ margin: '0 16px 12px', color: 'var(--cardio-red)', fontSize: 14 }}>{saveError}</div>}

        <button className={styles.saveBtn} type="button" disabled={saving} onClick={() => void saveReading()}>
          {saving ? 'Salvando...' : fromPhoto ? 'Confirmar e registrar' : 'Registrar medição'}
        </button>
      </form>
    </div>
  )
}
