import styles from './LeveSaudeLogo.module.css'

interface Props {
  size?: number
}

/**
 * Logo recriado da LeveSaúde: "Leve" + "saúde" em ameixa com arco coral
 * sobre o texto. Inspirado no símbolo da marca; SVG puro pra não depender
 * de asset binário e poder colorir via CSS vars.
 */
export default function LeveSaudeLogo({ size = 32 }: Props) {
  const h = size
  return (
    <div className={styles.wrapper} style={{ height: h }}>
      <svg
        viewBox="0 0 200 70"
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Leve Saúde"
      >
        {/* Arco coral sobre o "Leve" */}
        <path
          d="M 12 28 Q 55 -2 100 28"
          fill="none"
          stroke="var(--leve-coral)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Texto "Leve" — ameixa, sans-serif bold */}
        <text
          x="0"
          y="58"
          fontSize="46"
          fontWeight="700"
          fontFamily="Sora, sans-serif"
          fill="var(--leve-plum)"
          letterSpacing="-1"
        >
          Leve
        </text>
        {/* "saúde" menor */}
        <text
          x="103"
          y="58"
          fontSize="22"
          fontWeight="500"
          fontFamily="Sora, sans-serif"
          fill="var(--leve-plum)"
        >
          saúde
        </text>
      </svg>
    </div>
  )
}
