// OCR de tela de aparelho de pressão (Omron e similares) via Gemini.
// Lê SYS / DIA / PULSE da foto e devolve números. Os campos podem vir
// vazios (null) se o modelo não conseguir ler com confiança.

export class MissingGeminiKeyError extends Error {
  constructor() { super('MISSING_GEMINI_KEY') }
}

export interface BpReading {
  systolic: number | null
  diastolic: number | null
  heartRate: number | null
}

export async function readBpFromImage(base64: string, mimeType: string): Promise<BpReading> {
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
                  'Esta é uma foto da TELA de um aparelho digital de pressão arterial (ex.: Omron).',
                  'Leia EXATAMENTE os números mostrados no display LCD:',
                  '• systolic — número grande ao lado de "SYS" / "SIS" (mmHg)',
                  '• diastolic — número médio ao lado de "DIA" (mmHg)',
                  '• heartRate — número ao lado de "PULSE" / "PUL" / coração (/min)',
                  'Use APENAS os dígitos visíveis no LCD. Se algum campo não estiver visível ou não for legível, retorne null.',
                  'NÃO invente, NÃO chute, NÃO some, NÃO arredonde.',
                  'Responda SOMENTE em JSON válido neste formato exato:',
                  '{"systolic": <number|null>, "diastolic": <number|null>, "heartRate": <number|null>}',
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
    console.error('[Gemini BP OCR] HTTP', resp.status, errBody)
    throw new Error(`Gemini ${resp.status}`)
  }
  const data = await resp.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  console.debug('[Gemini BP OCR] raw response:', text)
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = match ? JSON.parse(match[0]) : {}
  }

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    return Number.isFinite(n) ? n : null
  }

  return {
    systolic: num(parsed.systolic),
    diastolic: num(parsed.diastolic),
    heartRate: num(parsed.heartRate),
  }
}
