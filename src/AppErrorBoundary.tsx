import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Evita tela branca quando um chunk da PWA fica incompatível após atualização. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] falha não recuperada', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <section role="alert" style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>❤️</div>
          <h1 style={{ margin: '0 0 8px' }}>O KPS Cardio precisa ser atualizado</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Recarregue a aplicação para continuar. Dados confirmados já estão no servidor; alterações pendentes permanecem na fila local desta conta.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: '12px 20px', borderRadius: 12, border: 0, background: 'var(--cardio-red)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Recarregar KPS Cardio
          </button>
        </section>
      </main>
    )
  }
}
