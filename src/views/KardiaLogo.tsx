import { useId } from 'react'
import styles from './KardiaLogo.module.css'

interface Props {
  size?: number
  variant?: 'full' | 'mark'
}

/**
 * Marca do Kardia App: coração + pulso em um símbolo proprietário.
 * O SVG fica no código para funcionar também offline e em telas pequenas.
 */
export default function KardiaLogo({ size = 32, variant = 'full' }: Props) {
  const h = size
  const markOnly = variant === 'mark'
  const width = markOnly ? size : Math.round(size * (330 / 88))
  const gradientId = `kardia-gradient-${useId().replace(/:/g, '')}`

  return (
    <div className={styles.wrapper} style={{ height: h, width }}>
      <svg
        viewBox={markOnly ? '0 0 88 88' : '0 0 330 88'}
        width={width}
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Kardia App"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="8" y1="4" x2="84" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--casal-red-deep)" />
            <stop offset="1" stopColor="var(--casal-red-bright)" />
          </linearGradient>
        </defs>

        {/* Símbolo: bloco arredondado com coração e linha de pulso */}
        <rect x="4" y="4" width="80" height="80" rx="27" fill={`url(#${gradientId})`} />
        <path
          d="M44 72C38 65 18 53 18 35c0-10 7-17 16-17 5 0 8 2 10 6 2-4 5-6 10-6 9 0 16 7 16 17 0 18-20 30-26 37Z"
          fill="var(--casal-rose)"
        />
        <path
          d="M21 44h11l5-11 8 22 8-17 5 6h10"
          fill="none"
          stroke="var(--casal-red-deep)"
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
              fill="var(--casal-red-deep)"
              letterSpacing="-1.2"
            >
              Kardia
            </text>
            <text
              x="238"
              y="55"
              fontSize="28"
              fontWeight="600"
              fontFamily="Sora, sans-serif"
              fill="var(--casal-red-bright)"
              letterSpacing="-0.8"
            >
              App
            </text>
            <circle cx="314" cy="49" r="4" fill="var(--casal-red-bright)" />
          </>
        )}
      </svg>
    </div>
  )
}
