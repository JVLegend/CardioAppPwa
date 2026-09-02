import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  readCookie,
  sessionCookie,
  validatePassword,
  verifyPassword,
} from './auth.mjs'

test('senha é validada, derivada e verificada sem guardar texto puro', async () => {
  assert.match(validatePassword('curta1') || '', /12/)
  assert.match(validatePassword('somenteletraslongas') || '', /letras e números/)
  assert.equal(validatePassword('SenhaTemporaria2026'), null)
  const encoded = await hashPassword('SenhaTemporaria2026')
  assert.doesNotMatch(encoded, /SenhaTemporaria2026/)
  assert.equal(await verifyPassword('SenhaTemporaria2026', encoded), true)
  assert.equal(await verifyPassword('SenhaIncorreta2026', encoded), false)
})

test('tokens de sessão são aleatórios e persistidos somente por hash', () => {
  const first = createSessionToken()
  const second = createSessionToken()
  assert.notEqual(first, second)
  assert.equal(hashSessionToken(first).length, 64)
  assert.notEqual(hashSessionToken(first), first)
})

test('cookie de sessão é HttpOnly, Secure e SameSite estrito', () => {
  const cookie = sessionCookie('token-seguro', 3600, true)
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`))
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Strict/)
  assert.equal(readCookie(`outro=1; ${SESSION_COOKIE}=token-seguro`, SESSION_COOKIE), 'token-seguro')
  assert.match(clearSessionCookie(true), /Max-Age=0/)
})
