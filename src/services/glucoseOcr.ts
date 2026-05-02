// OCR de tela de glicosímetro (Accu-Chek, OneTouch, FreeStyle, etc.) via Gemini.
// Lê o valor da glicemia em mg/dL.

export class MissingGeminiKeyError extends Error {
  constructor() { super('MISSING_GEMINI_KEY') }
}

export interface GlucoseReading {
  /** mg/dL — null se ilegível */
  value: number | null
  /** Algumas máquinas mostram a unidade no display */
  unit: 'mg/dL' | 'mmol/L' | null
}

export async function readGlucoseFromImage(base64: string, mimeType: string): Promise<GlucoseReading> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new MissingGeminiKeyError()

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              {
                text: [
                  'Esta é uma foto da TELA de um glicosímetro digital (Accu-Chek, OneTouch, FreeStyle, Contour, etc.).',
                  'Leia EXATAMENTE o número grande mostrado no display LCD, que representa a glicemia.',
                  'Se o display indicar "mmol/L", reporte unit="mmol/L"; se indicar "mg/dL" ou nada, reporte unit="mg/dL".',
                  'Se a leitura não estiver visível ou estiver ilegível, retorne value=null.',
                  'NÃO invente, NÃO chute.',
                  'Responda SOMENTE em JSON válido neste formato exato:',
                  '{"value": <number|null>, "unit": "mg/dL" | "mmol/L" | null}',
                  'Sem markdown, sem ```json, sem texto fora do JSON.',
                ].join('\n'),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: 'application/json',
        },
      }),
    }
  )

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    console.error('[Gemini Glucose OCR] HTTP', resp.status, errBody)
    throw new Error(`Gemini ${resp.status}`)
  }
  const data = await resp.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  console.debug('[Gemini Glucose OCR] raw response:', text)
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = match ? JSON.parse(match[0]) : {}
  }

  const rawValue = parsed.value
  const rawUnit = parsed.unit
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : null
  }

  let value = num(rawValue)
  let unit: 'mg/dL' | 'mmol/L' | null =
    rawUnit === 'mmol/L' ? 'mmol/L' : rawUnit === 'mg/dL' ? 'mg/dL' : null

  // Normaliza para mg/dL se vier em mmol/L (1 mmol/L = 18 mg/dL)
  if (value !== null && unit === 'mmol/L') {
    value = Math.round(value * 18)
    unit = 'mg/dL'
  }

  return { value, unit }
}
