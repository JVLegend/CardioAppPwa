// Sampling is ignored by 3.5 Flash-Lite and 3.6 Flash, and rejected by
// future generations. Preserve it for older explicit model overrides (e.g. 2.5).
// https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6
function omitsSampling(model) {
  // Only recognized legacy families demonstrate sampling support. Numeric
  // prefixes alone (e.g. gemini-2.99-future) do not establish capabilities.
  // Rolling aliases and unclassified names use provider defaults.
  // 3.5 Flash still describes sampling as not recommended, rather than ignored:
  // https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5
  const legacy = /^(?:gemini-1\.5-(?:flash|pro)|gemini-2\.0-flash(?:-lite)?|gemini-2\.5-(?:flash(?:-lite)?|pro)|gemini-3-(?:flash|pro)|gemini-3\.1-(?:pro|flash-lite)|gemini-3\.5-flash)(?:-(?:\d{3}|preview(?:-\d{2}-(?:\d{2}|\d{4}))?|exp(?:-\d{4})?))?$/
  return !legacy.test(model)
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
