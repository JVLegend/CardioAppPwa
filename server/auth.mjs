import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PASSWORD_ALGORITHM = 'scrypt'
const PASSWORD_COST = 32_768
const PASSWORD_BLOCK_SIZE = 8
const PASSWORD_PARALLELIZATION = 1
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_MAX_MEMORY = 64 * 1024 * 1024

export const SESSION_COOKIE = 'kpscardio_session'
export const MIN_PASSWORD_LENGTH = 12

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return `A senha deve ter entre ${MIN_PASSWORD_LENGTH} e 200 caracteres`
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'A senha deve combinar letras e números'
  }
  return null
}

export async function hashPassword(password) {
  const error = validatePassword(password)
  if (error) throw new Error(error)
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
    maxmem: PASSWORD_MAX_MEMORY,
  })
  return [
    PASSWORD_ALGORITHM,
    PASSWORD_COST,
    PASSWORD_BLOCK_SIZE,
    PASSWORD_PARALLELIZATION,
    salt.toString('base64url'),
    Buffer.from(derived).toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, cost, blockSize, parallelization, saltText, hashText] = String(encoded || '').split('$')
    if (algorithm !== PASSWORD_ALGORITHM) return false
    const expected = Buffer.from(hashText, 'base64url')
    if (expected.length !== PASSWORD_KEY_LENGTH) return false
    const derived = await scrypt(String(password || ''), Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: PASSWORD_MAX_MEMORY,
    })
    return timingSafeEqual(expected, Buffer.from(derived))
  } catch {
    return false
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

export function readCookie(header, name) {
  const cookies = String(header || '').split(';')
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')
    if (separator < 0) continue
    if (cookie.slice(0, separator).trim() === name) return decodeURIComponent(cookie.slice(separator + 1).trim())
  }
  return null
}

export function sessionCookie(token, maxAgeSeconds, secure = true) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export function clearSessionCookie(secure = true) {
  return sessionCookie('', 0, secure)
}
