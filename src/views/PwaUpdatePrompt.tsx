import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useHasBlockingActivity } from '../services/activityState'
import styles from './PwaUpdatePrompt.module.css'

type ApplyUpdate = (reloadPage?: boolean) => Promise<void>

export default function PwaUpdatePrompt() {
  const hasBlockingActivity = useHasBlockingActivity()
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [applyUpdate, setApplyUpdate] = useState<ApplyUpdate | null>(null)

  useEffect(() => {
    let updateInterval: number | undefined

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        setUpdateError('')
        setNeedRefresh(true)
      },
      onRegisteredSW: (_scriptUrl, registration) => {
        if (!registration) return
        void registration.update()
        updateInterval = window.setInterval(() => void registration.update(), 5 * 60_000)
      },
      onRegisterError: (error: unknown) => console.error('[pwa] falha ao registrar atualização', error),
    })
    setApplyUpdate(() => updateSW)

    return () => {
      if (updateInterval !== undefined) window.clearInterval(updateInterval)
    }
  }, [])

  if (!needRefresh) return null

  const installUpdate = async () => {
    if (!applyUpdate || updating) return
    if (hasBlockingActivity) {
      setUpdateError('Conclua a operação em andamento antes de atualizar. Seus rascunhos continuam preservados.')
      return
    }
    setUpdating(true)
    setUpdateError('')
    try {
      await applyUpdate(true)
    } catch (error) {
      console.error('[pwa] falha ao aplicar atualização', error)
      setUpdateError('Não foi possível atualizar agora. Tente novamente em instantes.')
      setUpdating(false)
    }
  }

  return (
    <aside
      className={styles.notice}
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
    >
      <div className={styles.icon} aria-hidden="true">↻</div>
      <div className={styles.content}>
        <strong id="pwa-update-title" className={styles.title}>Nova versão disponível</strong>
        <p id="pwa-update-description" className={styles.description}>
          {hasBlockingActivity
            ? 'Uma atualização está pronta, mas uma operação está em andamento. Conclua-a para atualizar com segurança.'
            : 'Uma atualização do KPS Cardio está pronta para instalar. Rascunhos de formulários e mensagens ficam preservados neste aparelho.'}
        </p>
        {updateError && <p className={styles.error} role="alert">{updateError}</p>}
        <div className={styles.actions}>
          <button className={styles.primaryButton} type="button" disabled={updating || hasBlockingActivity} onClick={() => void installUpdate()}>
            {updating ? 'Atualizando...' : hasBlockingActivity ? 'Aguardando operação' : 'Atualizar agora'}
          </button>
          <button className={styles.secondaryButton} type="button" disabled={updating} onClick={() => setNeedRefresh(false)}>
            Depois
          </button>
        </div>
      </div>
    </aside>
  )
}
