import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as db from '../services/database'
import { persistEntity } from '../services/syncEngine'
import { readGlucoseFromImage, MissingGeminiKeyError } from '../services/glucoseOcr'
import type { GlucoseMeasurement, MealContext, MeasurementSource } from '../models/types'
import AppPageHeader from './AppPageHeader'
import {
  classifyGlucose,
  MAX_GLUCOSE_MG_DL,
  MIN_GLUCOSE_MG_DL,
  MMOL_TO_MG_DL,
  type GlucoseUnit,
} from '../config/glucose'
import styles from './GlucoseView.module.css'

const contextOptions: { id: MealContext; label: string }[] = [
  { id: 'jejum', label: 'Jejum' },
  { id: 'pre_refeicao', label: 'Pré-refeição' },
  { id: 'pos_refeicao', label: 'Pós-refeição' },
  { id: 'aleatorio', label: 'Aleatório' },
]

export default function GlucoseView() {
  const { currentPatient } = useAuth()
  const [history, setHistory] = useState<GlucoseMeasurement[]>([])
  const [showEntry, setShowEntry] = useState(false)
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<GlucoseUnit>('mg/dL')
  const [context, setContext] = useState<MealContext>('jejum')
  const [source, setSource] = useState<MeasurementSource>('manual')
  const [fromPhoto, setFromPhoto] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<GlucoseMeasurement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const savingRef = useRef(false)

  const loadHistory = async () => {
    if (!currentPatient) return
    const all = await db.fetchAllGlucose(currentPatient.id)
    setHistory(all)
  }

  useEffect(() => { loadHistory() }, [currentPatient?.id])

  useEffect(() => {
    if (showEntry && !fromPhoto) {
      setTimeout(() => valueRef.current?.focus(), 50)
    }
  }, [showEntry, fromPhoto])

  useEffect(() => {
    if (!pendingDelete) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    deleteCancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) setPendingDelete(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [pendingDelete, deleting])

  const enteredValue = Number(value) || 0
  const num = unit === 'mmol/L' ? Math.round(enteredValue * MMOL_TO_MG_DL) : enteredValue
  const isValid = Number.isFinite(enteredValue)
    && enteredValue > 0
    && (unit === 'mmol/L' || Number.isInteger(enteredValue))
    && num >= MIN_GLUCOSE_MG_DL
    && num <= MAX_GLUCOSE_MG_DL

  const classification = isValid ? classifyGlucose(num, context) : null

  const resetForm = () => {
    setValue(''); setUnit('mg/dL'); setContext('jejum'); setSource('manual')
    setFromPhoto(false); setOcrError(''); setSaveError('')
  }

  const saveReading = async () => {
    if (savingRef.current) return
    if (!isValid) {
      setSaveError(unit === 'mmol/L'
        ? 'Informe um valor entre 0,6 e 44,4 mmol/L.'
        : 'Informe um valor inteiro entre 10 e 800 mg/dL.')
      return
    }
    if (!currentPatient) {
      setSaveError('Não foi possível identificar o paciente. Atualize a página e tente novamente.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setSaveError('')
    const reading: GlucoseMeasurement = {
      id: crypto.randomUUID(),
      patientId: currentPatient.id,
      value: num,
      context,
      source,
      measuredAt: new Date().toISOString(),
    }

    try {
      await persistEntity(
        'glucoseMeasurement', reading.id, 'create', reading,
        () => db.saveGlucoseMeasurement(reading)
      )

      setHistory((current) => [reading, ...current.filter((item) => item.id !== reading.id)])
      resetForm()
      setShowEntry(false)
    } catch (error) {
      console.error('[glucose] falha ao registrar medição', error)
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

  const handlePhotoCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOcrLoading(true)
    setOcrError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      const reading = await readGlucoseFromImage(base64, mimeType)
      if (reading.value === null) {
        setOcrError('A IA não conseguiu ler o número. Tente outra foto ou registre manualmente.')
      } else {
        const useOriginalMmol = reading.originalUnit === 'mmol/L' && reading.originalValue !== null
        setValue(String(useOriginalMmol ? reading.originalValue : reading.value))
        setUnit(useOriginalMmol ? 'mmol/L' : 'mg/dL')
        setSource('photo')
        setFromPhoto(true)
        setShowEntry(true)
      }
    } catch (err) {
      console.error(err)
      if (err instanceof MissingGeminiKeyError) {
        setOcrError('Leitura por foto não está configurada no servidor.')
      } else {
        setOcrError('Erro ao ler a foto. Tente novamente.')
      }
    } finally {
      setOcrLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await persistEntity('glucoseMeasurement', pendingDelete.id, 'delete', undefined, () => db.deleteGlucoseMeasurement(pendingDelete.id))
      await loadHistory()
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível apagar a medição.')
    } finally {
      setDeleting(false)
    }
  }

  const todayCount = history.filter((g) => {
    const d = new Date(g.measuredAt)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return d >= today
  }).length

  if (showEntry) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => { resetForm(); setShowEntry(false) }}>
            Cancelar
          </button>
          <h1 className={styles.title} style={{ fontSize: 17 }}>
            {fromPhoto ? 'Confirmar leitura' : 'Nova medição'}
          </h1>
          <div style={{ width: 70 }} />
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          {fromPhoto && (
            <div className={styles.notice}>
              📷 Valor lido pela IA da foto. <b>Confira</b> o número antes de registrar.
            </div>
          )}

          <div className={styles.preview}>
            <span
              className={styles.previewValue}
              style={{ color: classification?.color || 'var(--text-muted)' }}
            >
              {enteredValue || '---'}
            </span>
            <span className={styles.previewUnit}>{unit}</span>
            {unit === 'mmol/L' && isValid && (
              <span className={styles.convertedValue}>Equivale a {num} mg/dL</span>
            )}
            {classification && (
              <div className={styles.previewClass}>
                <span className={styles.previewDot} style={{ background: classification.color }} />
                <span style={{ color: classification.color }}>{classification.label}</span>
              </div>
            )}
          </div>

          {isValid && num < 54 && (
            <div className={styles.criticalNotice} role="alert">
              <strong>Glicemia muito baixa.</strong> Confira a unidade e repita a medição. Se o valor for confirmado ou houver sintomas, siga seu plano de hipoglicemia e procure ajuda médica imediatamente.
            </div>
          )}

          <div className={styles.inputGroup}>
            <div className={styles.inputRow}>
              <label className={styles.label}>Glicemia</label>
              <input
                ref={valueRef}
                aria-label="Glicemia"
                className={styles.input}
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="100"
                min={unit === 'mmol/L' ? 0.6 : MIN_GLUCOSE_MG_DL}
                max={unit === 'mmol/L' ? 44.4 : MAX_GLUCOSE_MG_DL}
                step={unit === 'mmol/L' ? 0.1 : 1}
                required
              />
              <select
                className={styles.unitSelect}
                aria-label="Unidade da glicemia"
                value={unit}
                onChange={(e) => setUnit(e.target.value as GlucoseUnit)}
              >
                <option value="mg/dL">mg/dL</option>
                <option value="mmol/L">mmol/L</option>
              </select>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.contextRow}>
              {contextOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.contextBtn} ${context === opt.id ? styles.activeCtx : ''}`}
                  onClick={() => setContext(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {saveError && <div className={styles.error} role="alert">{saveError}</div>}

          <button
            className={styles.saveBtn}
            type="button"
            disabled={saving}
            onClick={() => void saveReading()}
          >
            {saving ? 'Salvando...' : fromPhoto ? 'Confirmar e Registrar' : 'Registrar'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <AppPageHeader
        title="Glicose"
        subtitle={todayCount > 0
          ? `${todayCount} ${todayCount === 1 ? 'medição' : 'medições'} hoje`
          : 'Nenhuma medição hoje'}
      />

      <div className={styles.actions}>
        <button
          className={styles.primaryAction}
          onClick={() => { resetForm(); setShowEntry(true) }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Inserir manualmente
        </button>

        <button
          className={`${styles.primaryAction} ${styles.photoAction}`}
          onClick={() => cameraRef.current?.click()}
          disabled={ocrLoading}
        >
          {ocrLoading ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Lendo glicosímetro...
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Tirar foto do glicosímetro
            </>
          )}
        </button>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handlePhotoCapture}
        />

        {ocrError && <div className={styles.error}>{ocrError}</div>}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico</h2>
        {history.length === 0 ? (
          <div className={styles.empty}>Nenhuma medição registrada ainda</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((g) => {
              const c = classifyGlucose(g.value, g.context)
              const ctxLabel = contextOptions.find((o) => o.id === g.context)?.label ?? '—'
              const date = new Date(g.measuredAt)
              const isToday = date.toDateString() === new Date().toDateString()
              const timeStr = isToday
                ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              return (
                <button
                  type="button"
                  key={g.id}
                  className={styles.historyItem}
                  onClick={() => { setDeleteError(''); setPendingDelete(g) }}
                  aria-label={`Glicemia ${g.value} mg/dL. Abrir opções`}
                >
                  <span className={styles.historyDot} style={{ background: c.color }} />
                  <div className={styles.historyContent}>
                    <div className={styles.historyValue}>
                      {g.value}<span className={styles.historyUnitInline}>mg/dL</span>
                    </div>
                    <div className={styles.historyMeta}>
                      <span style={{ color: c.color }}>{c.label}</span>
                      {' · '}{ctxLabel}
                      {g.source === 'photo' && ' · 📷'}
                    </div>
                  </div>
                  <span className={styles.historyTime}>{timeStr}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {pendingDelete && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setPendingDelete(null)
          }}
        >
          <div
            className={styles.deleteModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-glucose-title"
            aria-describedby="delete-glucose-description"
          >
            <div className={styles.deleteIcon} aria-hidden="true">🗑</div>
            <h2 id="delete-glucose-title" className={styles.deleteTitle}>Apagar esta medição?</h2>
            <p id="delete-glucose-description" className={styles.deleteDescription}>
              A glicemia de <strong>{pendingDelete.value} mg/dL</strong>, registrada em{' '}
              {new Date(pendingDelete.measuredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}, será removida do seu histórico.
            </p>
            {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}
            <div className={styles.deleteActions}>
              <button
                ref={deleteCancelRef}
                type="button"
                className={styles.cancelDeleteBtn}
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? 'Apagando...' : 'Apagar medição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
