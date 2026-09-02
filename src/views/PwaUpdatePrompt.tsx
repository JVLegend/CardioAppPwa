import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export default function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    const updateServiceWorker = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisterError: (error: unknown) => console.error('[pwa] falha ao registrar atualização', error),
    })
    setUpdate(() => () => updateServiceWorker(true))
  }, [])

  if (!needRefresh) return null

  return (
    <div role="status" style={{
      position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 2000,
      maxWidth: 460, margin: '0 auto', padding: 16, borderRadius: 16,
      background: 'var(--bg-secondary)', color: 'var(--text-primary)',
      border: '1px solid var(--border)', boxShadow: '0 12px 36px rgba(0,0,0,.18)',
    }}>
      <strong>Atualização disponível</strong>
      <p style={{ margin: '6px 0 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Salve o que estiver preenchendo e atualize para usar a versão mais recente.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setNeedRefresh(false)} style={{ padding: '9px 12px' }}>Depois</button>
        <button onClick={() => void update?.()} style={{
          padding: '9px 14px', borderRadius: 999, background: 'var(--casal-red)',
          color: 'white', fontWeight: 700,
        }}>Atualizar agora</button>
      </div>
    </div>
  )
}
