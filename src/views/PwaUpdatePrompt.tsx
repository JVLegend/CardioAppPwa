import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

export default function PwaUpdatePrompt() {
  useEffect(() => {
    let updateInterval: number | undefined

    registerSW({
      immediate: true,
      onRegisteredSW: (_scriptUrl, registration) => {
        if (!registration) return
        void registration.update()
        updateInterval = window.setInterval(() => void registration.update(), 5 * 60_000)
      },
      onRegisterError: (error: unknown) => console.error('[pwa] falha ao registrar atualização', error),
    })

    return () => {
      if (updateInterval !== undefined) window.clearInterval(updateInterval)
    }
  }, [])

  return null
}
