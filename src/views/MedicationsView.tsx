import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { usePatientData } from '../hooks/usePatientData'
import type { Medication } from '../models/types'
import styles from './MedicationsView.module.css'

const frequencyOptions = [
  '1x ao dia',
  '2x ao dia',
  '3x ao dia',
  'A cada 8h',
  'A cada 12h',
  'Conforme necessário',
]

type AddMode = 'manual' | 'ai'

function treatmentDaysLeft(endDate?: string): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
  return diff
}

function TreatmentBar({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  if (!startDate || !endDate) return null
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const progress = Math.min(Math.max((now - start) / (end - start), 0), 1)
  const daysLeft = treatmentDaysLeft(endDate)

  if (daysLeft === null) return null

  const expired = daysLeft < 0
  const urgent = daysLeft >= 0 && daysLeft <= 2

  return (
    <div className={styles.treatmentBar}>
      <div className={styles.treatmentBarTrack}>
        <div
          className={styles.treatmentBarFill}
          style={{
            width: `${progress * 100}%`,
            background: expired ? 'var(--text-muted)' : urgent ? 'var(--cardio-orange)' : 'var(--cardio-green)',
          }}
        />
      </div>
      <span
        className={styles.treatmentDays}
        style={{ color: expired ? 'var(--text-muted)' : urgent ? 'var(--cardio-orange)' : 'var(--cardio-green)' }}
      >
        {expired
          ? 'Tratamento encerrado'
          : daysLeft === 0
          ? 'Último dia'
          : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

async function analyzePrescritionImage(base64: string, mimeType: string): Promise<Partial<{ name: string; dose: string; frequency: string; notes: string }>> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY não configurada')

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              {
                text: 'Esta é uma imagem de uma receita médica ou embalagem de medicamento. Extraia: nome do medicamento, dose/concentração, frequência de uso e observações. Responda SOMENTE em JSON válido com as chaves: name, dose, frequency, notes. Sem texto fora do JSON.',
              },
            ],
          },
        ],
      }),
    }
  )

  if (!resp.ok) throw new Error('Erro ao analisar imagem')
  const data = await resp.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : {}
}

export default function MedicationsView() {
  const { medications, addMedication, removeMedication, toggleMedication } = usePatientData()
  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('manual')
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState(frequencyOptions[0])
  const [scheduleInput, setScheduleInput] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)

  const activeMeds = medications.filter((m) => {
    const daysLeft = treatmentDaysLeft(m.endDate)
    return m.active && (daysLeft === null || daysLeft >= 0)
  })
  const expiredMeds = medications.filter((m) => {
    const daysLeft = treatmentDaysLeft(m.endDate)
    return m.active && daysLeft !== null && daysLeft < 0
  })
  const inactiveMeds = medications.filter((m) => !m.active)

  const resetForm = () => {
    setName(''); setDose(''); setFrequency(frequencyOptions[0])
    setScheduleInput(''); setStartDate(new Date().toISOString().split('T')[0])
    setEndDate(''); setNotes(''); setAiError('')
  }

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!name || !dose) return
    const schedule = scheduleInput.split(',').map((s) => s.trim()).filter(Boolean)
    addMedication(name, dose, frequency, schedule.length > 0 ? schedule : undefined, startDate || undefined, endDate || undefined, notes || undefined)
    resetForm()
    setShowAdd(false)
  }

  const handlePhotoCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true)
    setAiError('')
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string
        const base64 = dataUrl.split(',')[1]
        const mimeType = file.type || 'image/jpeg'
        try {
          const result = await analyzePrescritionImage(base64, mimeType)
          if (result.name) setName(result.name)
          if (result.dose) setDose(result.dose)
          if (result.frequency) {
            const match = frequencyOptions.find((f) => f.toLowerCase().includes(result.frequency!.toLowerCase().split(' ')[0]))
            setFrequency(match ?? frequencyOptions[0])
          }
          if (result.notes) setNotes(result.notes)
        } catch (err) {
          setAiError('Não foi possível analisar a imagem. Preencha manualmente.')
        } finally {
          setAiLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch {
      setAiError('Erro ao ler o arquivo.')
      setAiLoading(false)
    }
    e.target.value = ''
  }

  const openCamera = () => {
    setAddMode('ai')
    setShowAdd(true)
    setTimeout(() => cameraRef.current?.click(), 100)
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Remédios</h1>
          <p className={styles.subtitle}>{activeMeds.length} ativo{activeMeds.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={styles.addActions}>
          <button className={styles.aiBtn} onClick={openCamera} title="Foto da receita">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
            IA
          </button>
          <button className={styles.addBtn} onClick={() => { setAddMode('manual'); setShowAdd(true) }}>
            + Manual
          </button>
        </div>
      </div>

      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoCapture}
      />

      {showAdd && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {addMode === 'ai' ? 'Receita por IA' : 'Novo Remédio'}
            </h2>
            <div className={styles.modeTabs}>
              <button
                className={`${styles.modeTab} ${addMode === 'manual' ? styles.modeTabActive : ''}`}
                onClick={() => setAddMode('manual')}
              >Manual</button>
              <button
                className={`${styles.modeTab} ${addMode === 'ai' ? styles.modeTabActive : ''}`}
                onClick={() => { setAddMode('ai'); cameraRef.current?.click() }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                Foto
              </button>
            </div>
          </div>

          {aiLoading && (
            <div className={styles.aiLoading}>
              <div className={styles.aiSpinner} />
              <p>Analisando receita com IA...</p>
            </div>
          )}

          {aiError && (
            <div className={styles.aiError}>{aiError}</div>
          )}

          {addMode === 'ai' && !aiLoading && !name && !aiError && (
            <button className={styles.retakeBtn} onClick={() => cameraRef.current?.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              Tirar foto da receita
            </button>
          )}

          <form onSubmit={handleAdd}>
            <div className={styles.inputGroup}>
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Nome</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Losartana" required />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Dose</label>
                <input className={styles.input} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex: 50mg" required />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Frequência</label>
                <select className={styles.select} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Horários</label>
                <input className={styles.input} value={scheduleInput} onChange={(e) => setScheduleInput(e.target.value)} placeholder="08:00, 20:00" />
              </div>
            </div>

            <h3 className={styles.subSectionTitle}>Período do Tratamento</h3>
            <div className={styles.inputGroup}>
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Início</label>
                <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Término</label>
                <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="Opcional" />
              </div>
              <div className={styles.inputDivider} />
              <div className={styles.inputRow}>
                <label className={styles.inputLabel}>Obs</label>
                <input className={styles.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => { resetForm(); setShowAdd(false) }}>Cancelar</button>
              <button type="submit" className={styles.saveBtn} disabled={aiLoading}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {activeMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ativos</h2>
          <div className={styles.medList}>
            {activeMeds.map((med, i) => (
              <MedCard key={med.id} med={med} index={i} onToggle={toggleMedication} onRemove={removeMedication} />
            ))}
          </div>
        </div>
      )}

      {expiredMeds.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Tratamento Encerrado</h2>
          <div className={styles.medList}>
            {expiredMeds.map((med, i) => (
              <MedCard key={med.id} med={med} index={i} onToggle={toggleMedication} onRemove={removeMedication} expired />
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-green)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {medications.length === 0 && !showAdd && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10.5 1.5H8C4.7 1.5 2 4.2 2 7.5v0c0 3.3 2.7 6 6 6h2.5" />
              <path d="M13.5 22.5H16c3.3 0 6-2.7 6-6v0c0-3.3-2.7-6-6-6h-2.5" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <p className={styles.emptyTitle}>Sem remédios cadastrados</p>
          <p className={styles.emptyDesc}>Adicione manualmente ou tire foto da receita</p>
        </div>
      )}
    </div>
  )
}

function MedCard({ med, index, onToggle, onRemove, expired }: {
  med: Medication; index: number
  onToggle: (m: Medication) => void; onRemove: (id: string) => void
  expired?: boolean
}) {
  const daysLeft = treatmentDaysLeft(med.endDate)
  const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2

  return (
    <div
      className={`${styles.medItem} ${expired ? styles.expired : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div
        className={styles.medDot}
        style={{ background: expired ? 'var(--text-muted)' : urgent ? 'var(--cardio-orange)' : 'var(--cardio-green)' }}
      />
      <div className={styles.medInfo}>
        <div className={styles.medName}>{med.name}</div>
        <div className={styles.medDetail}>
          {med.dose} — {med.frequency}
          {med.schedule && med.schedule.length > 0 && ` · ${med.schedule.join(', ')}`}
        </div>
        {med.notes && <div className={styles.medNotes}>{med.notes}</div>}
        <TreatmentBar startDate={med.startDate} endDate={med.endDate} />
      </div>
      <div className={styles.medActions}>
        <button className={styles.iconBtn} onClick={() => onToggle(med)} title="Pausar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        </button>
        <button className={styles.iconBtn} onClick={() => onRemove(med.id)} title="Remover">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
        </button>
      </div>
    </div>
  )
}
