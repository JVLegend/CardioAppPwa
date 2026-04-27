import styles from './DisclaimerView.module.css'

interface Props {
  variant: 'onboarding' | 'modal'
  onAccept?: () => void
  onClose?: () => void
}

export default function DisclaimerView({ variant, onAccept, onClose }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div className={styles.icon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="var(--cardio-red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />
            </svg>
          </div>
          <h1 className={styles.title}>
            {variant === 'onboarding' ? 'Bem-vindo ao CardioApp' : 'Aviso médico'}
          </h1>
          {variant === 'onboarding' && (
            <p className={styles.subtitle}>Antes de começar, leia este aviso.</p>
          )}
        </header>

        <div className={styles.body}>
          <p>
            O CardioApp é uma ferramenta de <strong>monitoramento e registro</strong>{' '}
            de medições de pressão arterial. Ele <strong>não substitui</strong>{' '}
            consulta, diagnóstico ou tratamento médico.
          </p>
          <p>
            As classificações exibidas (Normal, Pré-hipertensão, Hipertensão I, II e
            Crise Hipertensiva) seguem a <strong>Diretriz Brasileira de Hipertensão
            Arterial (SBC, 2025)</strong> e têm caráter <strong>informativo</strong>.
          </p>
          <div className={styles.warn}>
            <strong>⚠️ Em PA ≥ 180/110 mmHg</strong> ou sintomas como dor no peito,
            falta de ar, dor de cabeça intensa, alterações visuais ou perda de força —{' '}
            <strong>procure atendimento de urgência</strong> ou ligue{' '}
            <strong>192 (SAMU)</strong>.
          </div>
          <p className={styles.footnote}>
            Os alertas automáticos são limites configuráveis e não são diagnósticos.
            Sempre converse com seu médico antes de alterar medicações.
          </p>
          <p className={styles.footnote}>
            Ao continuar você aceita nossos{' '}
            <a href="/terms.html" target="_blank" rel="noreferrer">Termos de Uso</a>{' '}e a{' '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.
          </p>
        </div>

        <footer className={styles.footer}>
          {variant === 'onboarding' ? (
            <button className={styles.primaryBtn} onClick={onAccept}>
              Li e concordo
            </button>
          ) : (
            <button className={styles.primaryBtn} onClick={onClose}>
              Fechar
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
