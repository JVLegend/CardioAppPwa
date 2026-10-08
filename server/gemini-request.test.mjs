import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGeminiPayload, requestGemini } from './gemini-request.mjs'

const contents = [{ role: 'user', parts: [{ text: 'Exemplo sintético' }] }]
for (const model of ['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite-preview', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-4-flash', 'gemini-flash-latest', 'gemini-next-flash']) {
  test(`${model}: omits deprecated sampling for OCR and summary`, () => {
    for (const purpose of ['bp_ocr', 'glucose_ocr', 'medication_ocr', 'daily_insight']) {
      const payload = buildGeminiPayload(model, purpose, contents)
      assert.deepEqual(payload.generationConfig, purpose.endsWith('_ocr')
        ? { maxOutputTokens: 256, response_mime_type: 'application/json' }
        : { maxOutputTokens: 640 })
      assert.equal(payload.contents, contents)
    }
  })
}
for (const model of ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.5-flash']) {
  test(`${model}: preserves existing sampling for explicit legacy override`, () => {
    assert.equal(buildGeminiPayload(model, 'bp_ocr', contents).generationConfig.temperature, 0)
    assert.equal(buildGeminiPayload(model, 'daily_insight', contents).generationConfig.temperature, 0.2)
  })
}
test('mock provider receives the configured model and unchanged contents; response passes through', async () => {
  for (const purpose of ['bp_ocr', 'glucose_ocr', 'medication_ocr', 'daily_insight']) {
    const providerData = { candidates: [{ content: { parts: [{ text: purpose.endsWith('_ocr') ? '{"synthetic":true}' : 'Resumo sintético' }] } }] }
    const response = await requestGemini({ model: 'gemini-3.5-flash-lite', purpose, contents, apiKey: 'test-placeholder' }, async (url, options) => {
      assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent/)
      assert.equal(options.method, 'POST')
      assert.ok(options.signal instanceof AbortSignal)
      assert.deepEqual(JSON.parse(options.body), buildGeminiPayload('gemini-3.5-flash-lite', purpose, contents))
      return Response.json(providerData)
    })
    assert.deepEqual(await response.json(), providerData)
  }
})
test('provider errors and timeout propagate to the existing route handling', async () => {
  const args = { model: 'gemini-2.5-flash', purpose: 'daily_insight', contents, apiKey: 'test-placeholder' }
  const response = await requestGemini(args, async () => Response.json({ error: { message: 'synthetic' } }, { status: 400 }))
  assert.equal(response.status, 400)
  await assert.rejects(requestGemini(args, async () => { throw new DOMException('synthetic', 'TimeoutError') }), { name: 'TimeoutError' })
})

// Exercise the actual Express handler without starting a database or network
// server. Only its collaborators are replaced; transport uses the real builder.
const server = readFileSync(new URL('./index.mjs', import.meta.url), 'utf8')
const routeStart = server.indexOf("app.post('/api/ai/generate', aiRateLimit, ")
const routeEnd = server.indexOf('\n})\n\nfunction validateAiContents', routeStart)
assert.ok(routeStart >= 0 && routeEnd > routeStart)
const handlerSource = server.slice(routeStart, routeEnd + 2).slice(server.slice(routeStart).indexOf('async (req'))
const createHandler = new Function('requestGemini', 'process', 'geminiModel', 'validateAiContents', 'writeAudit', `return (${handlerSource})`)

function routeHarness(provider, model = 'gemini-3.5-flash-lite') {
  const calls = [], audits = [], errors = []
  const handler = createHandler(args => requestGemini(args, async (url, options) => {
    calls.push({ url, payload: JSON.parse(options.body) })
    return provider()
  }), { env: { GEMINI_API_KEY: 'test-placeholder' } }, model, () => null, async (_req, audit) => audits.push(audit))
  return { calls, audits, errors, async run(purpose, content = contents) {
    const result = { status: 200, data: undefined }
    const res = { status(code) { result.status = code; return this }, json(data) { result.data = data; return this } }
    await handler({ profile: { role: 'operator' }, body: { purpose, contents: content } }, res, error => errors.push(error))
    return result
  } }
}
test('actual OCR/summary handler preserves successful, empty and invalid-JSON provider response contracts', async () => {
  const imageContents = [{ role: 'user', parts: [{ text: 'Imagem sintética' }, { inlineData: { mimeType: 'image/png', data: 'c3ludGhldGlj' } }] }]
  for (const model of ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-next-flash']) {
    for (const purpose of ['bp_ocr', 'glucose_ocr', 'medication_ocr', 'daily_insight']) {
      for (const data of [{}, { candidates: [{ content: { parts: [{ text: 'synthetic non-JSON' }] } }] }, { candidates: [{ content: { parts: [{ text: '{"synthetic":true}' }] } }] }]) {
        const h = routeHarness(() => Response.json(data), model)
        assert.deepEqual(await h.run(purpose, imageContents), { status: 200, data })
        assert.deepEqual(h.calls[0].payload, buildGeminiPayload(model, purpose, imageContents))
        assert.equal(h.calls[0].payload.contents[0].parts[1].inlineData.data, 'c3ludGhldGlj')
        assert.equal(h.audits[0].entityId, purpose)
        assert.equal(h.errors.length, 0)
      }
    }
  }
})
test('actual handler retains upstream 502 and timeout 504 for OCR/summary', async () => {
  for (const purpose of ['bp_ocr', 'daily_insight']) {
    const h = routeHarness(() => Response.json({ error: 'synthetic' }, { status: 400 }))
    const error = await h.run(purpose)
    assert.equal(error.status, 502)
    assert.equal(error.data.code, 'AI_PROVIDER_ERROR')
    const t = routeHarness(() => { throw new DOMException('synthetic', 'TimeoutError') })
    const timeout = await t.run(purpose)
    assert.equal(timeout.status, 504)
    assert.equal(timeout.data.code, 'AI_TIMEOUT')
  }
})
