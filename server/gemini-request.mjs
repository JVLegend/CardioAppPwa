// Sampling is ignored by 3.5 Flash-Lite and 3.6 Flash, and rejected by
// future generations. Preserve it for older explicit model overrides (e.g. 2.5).
// https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6
function omitsSampling(model) {
  if (model === 'gemini-flash-latest' || model === 'gemini-flash-lite-latest') return true
  if (/^gemini-3\.5-flash-lite(?:-|$)/.test(model)) return true
  const version = /^gemini-(\d+)(?:\.(\d+))?(?:-|$)/.exec(model)
  // Unknown/rolling names are not evidence of legacy sampling support.
  // Do not rewrite the selected model or retry against a different one.
  if (!version) return true
  return Number(version[1]) > 3 || (Number(version[1]) === 3 && Number(version[2]) >= 6)
}

export function buildGeminiPayload(model, purpose, contents) {
  const isOcr = ['bp_ocr', 'glucose_ocr', 'medication_ocr'].includes(purpose)
  const generationConfig = isOcr
    ? { maxOutputTokens: 256, response_mime_type: 'application/json' }
    : { maxOutputTokens: 640 }
  if (!omitsSampling(model)) generationConfig.temperature = isOcr ? 0 : 0.2
  return { contents, generationConfig }
}

export function requestGemini({ model, purpose, contents, apiKey }, fetchImpl = fetch) {
  return fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiPayload(model, purpose, contents)),
    signal: AbortSignal.timeout(30_000),
  })
}
