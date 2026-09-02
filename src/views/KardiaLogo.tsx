import { useId } from 'react'
import styles from './KardiaLogo.module.css'

interface Props {
  size?: number
  variant?: 'full' | 'mark'
}

/**
 * Marca do KPS Cardio: coração + pulso em um símbolo proprietário.
 * O SVG fica no código para funcionar também offline e em telas pequenas.
 */
export default function KardiaLogo({ size = 32, variant = 'full' }: Props) {
  const h = size
  const markOnly = variant === 'mark'
  const width = markOnly ? size : Math.round(size * (330 / 88))
  const gradientId = `kpscardio-gradient-${useId().replace(/:/g, '')}`

  return (
    <div className={styles.wrapper} style={{ height: h, width }}>
      <svg
        viewBox={markOnly ? '0 0 88 88' : '0 0 330 88'}
        width={width}
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="KPS Cardio"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="8" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--kps-gold-bright)" />
            <stop offset="1" stopColor="var(--kps-gold)" />
          </linearGradient>
        </defs>

        {/* Símbolo: bloco arredondado com coração e linha de pulso */}
        <rect x="4" y="4" width="80" height="80" rx="15" fill={`url(#${gradientId})`} />
        <path
          d="M44 72C38 65 18 53 18 35c0-10 7-17 16-17 5 0 8 2 10 6 2-4 5-6 10-6 9 0 16 7 16 17 0 18-20 30-26 37Z"
          fill="var(--kps-navy)"
        />
        <path
          d="M21 44h11l5-11 8 22 8-17 5 6h10"
          fill="none"
          stroke="var(--kps-gold-light)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {!markOnly && (
          <>
            {/* Wordmark */}
            <text
              x="104"
              y="55"
              fontSize="38"
              fontWeight="800"
              fontFamily="Sora, sans-serif"
              fill="var(--kps-navy)"
              letterSpacing="-1.2"
            >
              KPS
            </text>
            <text
              x="204"
              y="55"
              fontSize="27"
              fontWeight="600"
              fontFamily="Sora, sans-serif"
              fill="var(--kps-gold-bright)"
              letterSpacing="-0.8"
            >
              Cardio
            </text>
            <circle cx="314" cy="49" r="4" fill="var(--kps-gold-bright)" />
          </>
        )}
      </svg>
    </div>
  )
}
