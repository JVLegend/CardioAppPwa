import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canCreateRole,
  canAccessPatientScope,
  canResetPassword,
  canTransitionAlert,
  canWriteEntity,
  changedProfileFields,
  isUserRole,
  isUuid,
  isValidIsoDate,
  isValidState,
  sanitizeProfilePatch,
} from './policy.mjs'
import { evaluateMeasurementAlerts } from './clinical-rules.mjs'
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const port = Number(process.env.PORT || 3000)
const databaseUrl = process.env.DATABASE_URL
const secureCookies = process.env.COOKIE_SECURE !== 'false'
  && (process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT_ID))

const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
      max: 12,
      idleTimeoutMillis: 30_000,
    })
  : null

app.set('trust proxy', 1)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    },
  },
}))
app.use(express.json({ limit: '12mb' }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }))
const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de acesso. Aguarde alguns minutos.' },
})
const aiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações de IA. Aguarde um minuto e tente novamente.' },
})

const dummyPasswordHash = hashPassword('KardiaApp-Dummy-2026')

function requireServices(_req, res, next) {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL não configurada' })
  next()
}

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.headers.origin
  if (!origin) return next()
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim()
  const expected = `${forwardedProto}://${req.get('host')}`
  const allowed = new Set([expected, ...(process.env.ALLOWED_APP_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)])
  if (!allowed.has(origin)) return res.status(403).json({ error: 'Origem da requisição não autorizada' })
  next()
}

async function authenticate(req, res, next) {
  try {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE)
    if (!token) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' })
    const tokenHash = hashSessionToken(token)
    const result = await pool.query(
      `SELECT p.*, c.must_change_password
       FROM auth_sessions s
       JOIN profiles p ON p.id=s.user_id
       JOIN auth_credentials c ON c.user_id=p.id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND c.disabled_at IS NULL`,
      [tokenHash]
    )
    if (!result.rows[0]) {
      res.setHeader('Set-Cookie', clearSessionCookie(secureCookies))
      return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' })
    }
    req.sessionTokenHash = tokenHash
    req.profile = result.rows[0]
    req.mustChangePassword = result.rows[0].must_change_password === true
    await pool.query('UPDATE auth_sessions SET last_seen_at=now() WHERE token_hash=$1', [tokenHash])
    next()
  } catch (error) {
    next(error)
  }
}

function requirePasswordReady(req, res, next) {
  if (req.mustChangePassword) return res.status(403).json({ error: 'Troque a senha provisória para continuar', code: 'PASSWORD_CHANGE_REQUIRED' })
  next()
}

function profileToClient(row) {
  return {
    id: row.id,
    operatorId: row.operator_id || '',
    userId: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    birthDate: row.birth_date,
    phone: row.phone,
    state: row.state,
    comorbidities: row.comorbidities || [],
    planStatus: row.plan_status,
    inTreatmentPlan: row.in_treatment_plan,
    createdAt: row.created_at,
  }
}

async function accessiblePatientIds(profile) {
  if (profile.role === 'patient') return [profile.id]
  if (profile.role === 'operator') {
    const result = await pool.query("SELECT id FROM profiles WHERE role = 'patient' AND operator_id = $1", [profile.id])
    return result.rows.map((r) => r.id)
  }
  const result = await pool.query("SELECT id FROM profiles WHERE role = 'patient'")
  return result.rows.map((r) => r.id)
}

async function canAccessPatient(profile, patientId) {
  if (!isUuid(patientId)) return false
  if (profile.role !== 'operator') {
    return canAccessPatientScope(profile.role, profile.id, patientId)
  }
  const result = await pool.query(
    "SELECT operator_id FROM profiles WHERE id = $1 AND role = 'patient'",
    [patientId]
  )
  return canAccessPatientScope(profile.role, profile.id, patientId, result.rows[0]?.operator_id)
}

async function requirePatientAccess(req, res, patientId) {
  if (await canAccessPatient(req.profile, patientId)) return true
  res.status(403).json({ error: 'Acesso negado a este paciente' })
  return false
}

async function writeAudit(req, {
  action,
  entityType,
  entityId = null,
  patientId = null,
  changedFields = [],
}, client = pool) {
  await client.query(
    `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, patient_id, changed_fields, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      req.profile?.id || null,
      req.profile?.role || null,
      action,
      entityType,
      entityId,
      patientId,
      changedFields,
      req.ip || null,
      String(req.headers['user-agent'] || '').slice(0, 500) || null,
    ]
  )
}

app.use('/api', requireSameOrigin)

app.get('/api/health', async (_req, res) => {
  const status = { ok: false, database: false, auth: false, authProvider: 'postgres' }
  if (pool) {
    try {
      await pool.query('SELECT 1 FROM auth_credentials LIMIT 1')
      status.database = true
      status.auth = true
      status.ok = true
    } catch {
      status.ok = false
    }
  } else {
    status.ok = false
  }
  res.status(status.ok ? 200 : 503).json(status)
})

app.post('/api/auth/login', requireServices, loginRateLimit, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!/^\S+@\S+\.\S+$/.test(email) || !password || password.length > 200) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' })
    }
    const result = await pool.query(
      `SELECT p.*, c.password_hash, c.must_change_password, c.failed_attempts, c.locked_until, c.disabled_at
       FROM profiles p JOIN auth_credentials c ON c.user_id=p.id
       WHERE lower(p.email)=lower($1)`,
      [email]
    )
    const account = result.rows[0]
    const passwordMatches = await verifyPassword(password, account?.password_hash || await dummyPasswordHash)
    if (!account || account.disabled_at || !passwordMatches) {
      if (account && !account.disabled_at) {
        const attempts = Number(account.failed_attempts || 0) + 1
        await pool.query(
          `UPDATE auth_credentials SET failed_attempts=$2,
           locked_until=CASE WHEN $2>=5 THEN now()+interval '15 minutes' ELSE locked_until END,
           updated_at=now() WHERE user_id=$1`,
          [account.id, attempts]
        )
      }
      return res.status(401).json({ error: 'E-mail ou senha incorretos' })
    }
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return res.status(429).json({ error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.' })
    }

    const maxAgeSeconds = account.role === 'patient' ? 30 * 24 * 60 * 60 : 12 * 60 * 60
    const token = createSessionToken()
    const tokenHash = hashSessionToken(token)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE auth_credentials SET failed_attempts=0,locked_until=NULL,last_login_at=now(),updated_at=now()
         WHERE user_id=$1`,
        [account.id]
      )
      await client.query('DELETE FROM auth_sessions WHERE expires_at<=now() OR (user_id=$1 AND created_at<now()-interval \'45 days\')', [account.id])
      await client.query(
        `INSERT INTO auth_sessions (token_hash,user_id,expires_at,ip,user_agent)
         VALUES ($1,$2,now()+($3::text || ' seconds')::interval,$4,$5)`,
        [tokenHash, account.id, maxAgeSeconds, req.ip || null, String(req.headers['user-agent'] || '').slice(0, 500) || null]
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Set-Cookie', sessionCookie(token, maxAgeSeconds, secureCookies))
    res.json({ profile: profileToClient(account), mustChangePassword: account.must_change_password === true })
  } catch (error) { next(error) }
})

app.use('/api', requireServices, authenticate)

app.get('/api/auth/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ profile: profileToClient(req.profile), mustChangePassword: req.mustChangePassword })
})

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [req.sessionTokenHash])
    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies))
    res.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/auth/change-password', async (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword || '')
    const currentPassword = String(req.body?.currentPassword || '')
    const validationError = validatePassword(newPassword)
    if (validationError) return res.status(400).json({ error: validationError })
    const credentials = await pool.query('SELECT password_hash,must_change_password FROM auth_credentials WHERE user_id=$1', [req.profile.id])
    if (!credentials.rows[0]) return res.status(404).json({ error: 'Credencial não encontrada' })
    if (!credentials.rows[0].must_change_password && !await verifyPassword(currentPassword, credentials.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' })
    }
    if (await verifyPassword(newPassword, credentials.rows[0].password_hash)) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' })
    }
    const passwordHash = await hashPassword(newPassword)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE auth_credentials SET password_hash=$2,must_change_password=false,failed_attempts=0,
         locked_until=NULL,password_changed_at=now(),updated_at=now() WHERE user_id=$1`,
        [req.profile.id, passwordHash]
      )
      await client.query('DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2', [req.profile.id, req.sessionTokenHash])
      await writeAudit(req, { action: 'password_change', entityType: 'credential', entityId: req.profile.id }, client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
    req.mustChangePassword = false
    res.json({ profile: profileToClient(req.profile), mustChangePassword: false })
  } catch (error) { next(error) }
})

app.use('/api', requirePasswordReady)

app.get('/api/me', (req, res) => res.json(profileToClient(req.profile)))

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(String(req.query.since)) : null
    if (since && Number.isNaN(since.getTime())) return res.status(400).json({ error: 'Cursor de sincronização inválido' })
    const syncCursor = new Date().toISOString()
    const ids = await accessiblePatientIds(req.profile)
    const profiles = req.profile.role === 'patient'
      ? [req.profile]
      : (await pool.query(
          `SELECT * FROM profiles
           WHERE id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR updated_at > $2)
           ORDER BY name`,
          [ids, since?.toISOString() || null]
        )).rows
    if (ids.length === 0) {
      return res.json({ profile: profileToClient(req.profile), syncCursor, patients: [], measurements: [], glucoseMeasurements: [], medications: [], alerts: [], devices: [], chatMessages: [], deleted: [] })
    }
    const cursor = since?.toISOString() || null
    const [measurements, glucose, medications, alerts, devices, messages, deleted] = await Promise.all([
      pool.query('SELECT * FROM measurements WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR synced_at > $2) ORDER BY measured_at DESC', [ids, cursor]),
      pool.query('SELECT * FROM glucose_measurements WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR synced_at > $2) ORDER BY measured_at DESC', [ids, cursor]),
      pool.query('SELECT * FROM medications WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR updated_at > $2)', [ids, cursor]),
      pool.query('SELECT * FROM alerts WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR updated_at > $2) ORDER BY created_at DESC', [ids, cursor]),
      pool.query('SELECT * FROM devices WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR updated_at > $2)', [ids, cursor]),
      pool.query('SELECT * FROM chat_messages WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR updated_at > $2) ORDER BY sent_at', [ids, cursor]),
      pool.query('SELECT entity_type, entity_id FROM sync_tombstones WHERE patient_id = ANY($1::uuid[]) AND ($2::timestamptz IS NULL OR deleted_at > $2)', [ids, cursor]),
    ])
    res.json({
      profile: profileToClient(req.profile),
      syncCursor,
      patients: profiles.map(profileToClient),
      measurements: measurements.rows.map(mapMeasurement),
      glucoseMeasurements: glucose.rows.map(mapGlucose),
      medications: medications.rows.map(mapMedication),
      alerts: alerts.rows.map(mapAlert),
      devices: devices.rows.map(mapDevice),
      chatMessages: messages.rows.map(mapMessage),
      deleted: deleted.rows.map((row) => ({ entityType: row.entity_type, entityId: row.entity_id })),
    })
  } catch (error) { next(error) }
})

app.get('/api/profiles', async (req, res, next) => {
  try {
    if (!['operator', 'controller'].includes(req.profile.role)) return res.status(403).json({ error: 'Perfil sem permissão para gerenciar acessos' })
    const result = req.profile.role === 'controller'
      ? await pool.query(
          `SELECT p.*, c.must_change_password,c.last_login_at,(c.user_id IS NOT NULL) AS credential_configured
           FROM profiles p LEFT JOIN auth_credentials c ON c.user_id=p.id
           WHERE p.id<>$1 ORDER BY p.created_at DESC`,
          [req.profile.id]
        )
      : await pool.query(
          `SELECT p.*, c.must_change_password,c.last_login_at,(c.user_id IS NOT NULL) AS credential_configured
           FROM profiles p LEFT JOIN auth_credentials c ON c.user_id=p.id
           WHERE p.role='patient' AND p.operator_id=$1 ORDER BY p.created_at DESC`,
          [req.profile.id]
        )
    res.json(result.rows.map((row) => ({
      ...profileToClient(row),
      credentialConfigured: row.credential_configured,
      mustChangePassword: row.must_change_password === true,
      lastLoginAt: row.last_login_at,
    })))
  } catch (error) { next(error) }
})

app.post('/api/profiles', async (req, res, next) => {
  if (!['operator', 'controller'].includes(req.profile.role)) return res.status(403).json({ error: 'Perfil sem permissão para criar usuários' })
  const { email, password, name, role, phone, birthDate, state, comorbidities, planStatus, inTreatmentPlan, operatorId } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedName = String(name || '').trim()
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || !normalizedName || normalizedName.length > 160 || typeof password !== 'string' || !isUserRole(role)) {
    return res.status(400).json({ error: 'Nome, e-mail, senha e papel válidos são obrigatórios' })
  }
  if (!canCreateRole(req.profile.role, role)) return res.status(403).json({ error: 'Este perfil não pode criar o papel solicitado' })
  const passwordError = validatePassword(password)
  if (passwordError) return res.status(400).json({ error: passwordError })
  if (!isValidState(state)) return res.status(400).json({ error: 'UF inválida' })
  if (!isValidIsoDate(birthDate)) return res.status(400).json({ error: 'Data de nascimento inválida' })
  if (phone != null && String(phone).length > 40) return res.status(400).json({ error: 'Telefone inválido' })
  if (comorbidities != null && (!Array.isArray(comorbidities) || comorbidities.length > 50 || comorbidities.some((item) => typeof item !== 'string' || item.length > 120))) {
    return res.status(400).json({ error: 'Lista de comorbidades inválida' })
  }
  const linkedOperator = role === 'patient' ? (req.profile.role === 'operator' ? req.profile.id : operatorId || null) : null
  const safePlanStatus = req.profile.role === 'controller' ? planStatus || null : null
  if (linkedOperator && !isUuid(linkedOperator)) return res.status(400).json({ error: 'Médico responsável inválido' })
  if (linkedOperator) {
    const clinician = await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND role='operator'", [linkedOperator])
    if (!clinician.rowCount) return res.status(400).json({ error: 'Médico responsável não encontrado' })
  }
  let client
  try {
    const passwordHash = await hashPassword(password)
    client = await pool.connect()
    await client.query('BEGIN')
    const result = await client.query(
      `INSERT INTO profiles (id,email,name,role,operator_id,phone,birth_date,state,comorbidities,plan_status,in_treatment_plan)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [normalizedEmail, normalizedName, role, linkedOperator, phone || null, birthDate || null, state || null, comorbidities || [], safePlanStatus, Boolean(inTreatmentPlan)]
    )
    const createdUser = result.rows[0]
    await client.query(
      `INSERT INTO auth_credentials (user_id,password_hash,must_change_password)
       VALUES ($1,$2,true)`,
      [createdUser.id, passwordHash]
    )
    await writeAudit(req, {
      action: 'create', entityType: 'profile', entityId: createdUser.id,
      patientId: role === 'patient' ? createdUser.id : null,
      changedFields: ['email', 'name', 'role', 'operatorId'],
    }, client)
    await client.query('COMMIT')
    res.status(201).json(profileToClient(result.rows[0]))
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

app.post('/api/profiles/:id/password', async (req, res, next) => {
  let client
  try {
    const targetResult = await pool.query('SELECT * FROM profiles WHERE id=$1', [req.params.id])
    const target = targetResult.rows[0]
    if (!target) return res.status(404).json({ error: 'Perfil não encontrado' })
    if (!canResetPassword(req.profile.role, req.profile.id, target)) {
      return res.status(403).json({ error: 'Você não pode redefinir a senha deste perfil' })
    }
    const password = String(req.body?.password || '')
    const passwordError = validatePassword(password)
    if (passwordError) return res.status(400).json({ error: passwordError })
    const passwordHash = await hashPassword(password)
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO auth_credentials (user_id,password_hash,must_change_password,failed_attempts,locked_until,password_changed_at,updated_at)
       VALUES ($1,$2,true,0,NULL,now(),now())
       ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,must_change_password=true,
       failed_attempts=0,locked_until=NULL,password_changed_at=now(),updated_at=now()`,
      [target.id, passwordHash]
    )
    await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [target.id])
    await writeAudit(req, {
      action: 'password_reset', entityType: 'credential', entityId: target.id,
      patientId: target.role === 'patient' ? target.id : null,
      changedFields: ['password'],
    }, client)
    await client.query('COMMIT')
    res.json({ ok: true, mustChangePassword: true })
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

app.patch('/api/profiles/:id', async (req, res, next) => {
  try {
    if (!(await requirePatientAccess(req, res, req.params.id))) return
    if (req.profile.role === 'patient' && req.profile.id !== req.params.id) return res.status(403).json({ error: 'Acesso negado' })
    const current = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id])
    if (!current.rows[0]) return res.status(404).json({ error: 'Perfil não encontrado' })
    const body = sanitizeProfilePatch(req.profile.role, req.body || {})
    const fields = changedProfileFields(req.profile.role, req.body || {})
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo permitido foi informado' })
    if (!isValidState(body.state)) return res.status(400).json({ error: 'UF inválida' })
    if (!isValidIsoDate(body.birthDate)) return res.status(400).json({ error: 'Data de nascimento inválida' })
    if (body.operatorId && !isUuid(body.operatorId)) return res.status(400).json({ error: 'Médico responsável inválido' })
    if (body.operatorId) {
      const clinician = await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND role='operator'", [body.operatorId])
      if (!clinician.rowCount) return res.status(400).json({ error: 'Médico responsável não encontrado' })
    }
    const old = current.rows[0]
    const read = (key, fallback) => Object.hasOwn(body, key) ? body[key] : fallback
    const result = await pool.query(
      `UPDATE profiles SET name=$2, phone=$3, birth_date=$4, state=$5, comorbidities=$6,
       plan_status=$7, in_treatment_plan=$8, operator_id=$9, updated_at=now() WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        String(read('name', old.name) || old.name).trim(),
        read('phone', old.phone) || null,
        read('birthDate', old.birth_date) || null,
        read('state', old.state) || null,
        read('comorbidities', old.comorbidities) || [],
        read('planStatus', old.plan_status) || null,
        Object.hasOwn(body, 'inTreatmentPlan') ? Boolean(body.inTreatmentPlan) : old.in_treatment_plan,
        read('operatorId', old.operator_id) || null,
      ]
    )
    await writeAudit(req, {
      action: 'update', entityType: 'profile', entityId: req.params.id,
      patientId: old.role === 'patient' ? req.params.id : null,
      changedFields: fields,
    })
    res.json(profileToClient(result.rows[0]))
  } catch (error) { next(error) }
})

app.put('/api/entities/:type/:id', async (req, res, next) => {
  let client
  try {
    client = await pool.connect()
    const config = entityConfigs[req.params.type]
    if (!config) return res.status(400).json({ error: 'Tipo de entidade inválido' })
    const payload = { ...(req.body || {}), id: req.params.id }
    const current = await client.query(
      `SELECT patient_id${req.params.type === 'alert' ? ', status' : ''} FROM ${config.table} WHERE id = $1`,
      [req.params.id]
    )
    const operation = current.rowCount ? 'update' : 'create'
    if (!canWriteEntity(req.profile.role, req.params.type, operation)) {
      return res.status(403).json({ error: 'Seu perfil não pode realizar esta operação' })
    }
    const patientId = current.rows[0]?.patient_id || payload.patientId
    if (!(await requirePatientAccess(req, res, patientId))) return
    if (current.rows[0] && payload.patientId && payload.patientId !== current.rows[0].patient_id) {
      return res.status(400).json({ error: 'Não é permitido transferir um registro para outro paciente' })
    }
    payload.patientId = patientId
    const validationError = validateEntityPayload(req.params.type, payload)
    if (validationError) return res.status(400).json({ error: validationError })
    if (req.params.type === 'alert' && current.rows[0] && !canTransitionAlert(current.rows[0].status, payload.status)) {
      return res.status(409).json({ error: 'Transição de status do alerta não permitida' })
    }
    if (req.params.type === 'chatMessage') {
      const expectedRole = req.profile.role === 'patient' ? 'patient' : 'operator'
      payload.fromRole = expectedRole
      const patient = await client.query("SELECT operator_id FROM profiles WHERE id=$1 AND role='patient'", [patientId])
      const assignedOperator = patient.rows[0]?.operator_id
      if (!assignedOperator) return res.status(409).json({ error: 'Paciente sem médico responsável para o chat' })
      if (req.profile.role === 'operator' && assignedOperator !== req.profile.id) return res.status(403).json({ error: 'Paciente não pertence à sua carteira' })
      payload.operatorId = assignedOperator
    }
    await client.query('BEGIN')
    const result = await client.query(config.upsert(payload, req.profile.id))
    await client.query('DELETE FROM sync_tombstones WHERE entity_type=$1 AND entity_id=$2', [req.params.type, req.params.id])
    if (req.params.type === 'measurement') await createMeasurementAlerts(client, payload)
    if (req.params.type === 'alert') {
      await client.query('INSERT INTO alert_events (alert_id, actor_id, event_type) VALUES ($1,$2,$3)', [payload.id, req.profile.id, payload.status || 'updated'])
    }
    await writeAudit(req, {
      action: operation, entityType: req.params.type, entityId: req.params.id,
      patientId, changedFields: Object.keys(req.body || {}).filter((key) => key !== 'id').sort(),
    }, client)
    await client.query('COMMIT')
    res.json(config.map(result.rows[0]))
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

app.delete('/api/entities/:type/:id', async (req, res, next) => {
  let client
  try {
    client = await pool.connect()
    const config = entityConfigs[req.params.type]
    if (!config) return res.status(400).json({ error: 'Tipo de entidade inválido' })
    if (!canWriteEntity(req.profile.role, req.params.type, 'delete')) return res.status(403).json({ error: 'Seu perfil não pode excluir este tipo de registro' })
    const found = await client.query(`SELECT patient_id FROM ${config.table} WHERE id = $1`, [req.params.id])
    if (!found.rows[0]) return res.status(204).end()
    if (!(await requirePatientAccess(req, res, found.rows[0].patient_id))) return
    await client.query('BEGIN')
    await client.query(`DELETE FROM ${config.table} WHERE id = $1`, [req.params.id])
    await client.query(
      `INSERT INTO sync_tombstones (entity_type,entity_id,patient_id,deleted_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT(entity_type,entity_id) DO UPDATE SET patient_id=EXCLUDED.patient_id,deleted_at=now()`,
      [req.params.type, req.params.id, found.rows[0].patient_id]
    )
    await writeAudit(req, {
      action: 'delete', entityType: req.params.type, entityId: req.params.id,
      patientId: found.rows[0].patient_id,
    }, client)
    await client.query('COMMIT')
    res.status(204).end()
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

app.delete('/api/account', async (req, res, next) => {
  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO account_deletions (user_id,email,requested_at,auth_deleted_at,last_error)
       VALUES ($1,$2,now(),now(),NULL)
       ON CONFLICT(user_id) DO UPDATE SET requested_at=now(),auth_deleted_at=now(),last_error=NULL`,
      [req.profile.id, req.profile.email]
    )
    await writeAudit(req, {
      action: 'delete', entityType: 'account', entityId: req.profile.id,
      patientId: req.profile.role === 'patient' ? req.profile.id : null,
    }, client)
    await client.query('DELETE FROM profiles WHERE id = $1', [req.profile.id])
    await client.query('COMMIT')
    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies))
    res.status(204).end()
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client?.release()
  }
})

app.get('/api/audit', async (req, res, next) => {
  try {
    if (req.profile.role !== 'controller') return res.status(403).json({ error: 'Apenas a operadora pode consultar a auditoria' })
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
    const result = await pool.query(
      `SELECT id,actor_id,actor_role,action,entity_type,entity_id,patient_id,changed_fields,created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    )
    await writeAudit(req, { action: 'read', entityType: 'audit_log', changedFields: [] })
    res.json(result.rows)
  } catch (error) { next(error) }
})

app.post('/api/ai/generate', aiRateLimit, async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'IA não configurada no servidor' })
    const { purpose, contents, generationConfig } = req.body || {}
    const purposes = req.profile.role === 'patient'
      ? new Set(['bp_ocr', 'glucose_ocr', 'medication_ocr'])
      : req.profile.role === 'operator'
        ? new Set(['bp_ocr', 'glucose_ocr', 'medication_ocr', 'daily_insight'])
        : new Set(['daily_insight'])
    if (!purposes.has(purpose)) return res.status(403).json({ error: 'Uso de IA não permitido para este perfil' })
    if (!Array.isArray(contents)) return res.status(400).json({ error: 'Conteúdo inválido' })
    if (JSON.stringify(contents).length > 10_000_000) return res.status(413).json({ error: 'Imagem ou conteúdo acima do limite permitido' })
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: AbortSignal.timeout(30_000),
    })
    const data = await response.json()
    await writeAudit(req, { action: 'use', entityType: 'ai', entityId: purpose })
    res.status(response.status).json(data)
  } catch (error) { next(error) }
})

function validateEntityPayload(type, payload) {
  if (!isUuid(payload.patientId)) return 'Paciente inválido'
  if (type !== 'device' && !isUuid(payload.id)) return 'Identificador inválido'
  if (type === 'device' && (typeof payload.id !== 'string' || payload.id.length > 200)) return 'Identificador do aparelho inválido'

  if (type === 'measurement') {
    if (!Number.isInteger(payload.systolic) || payload.systolic < 40 || payload.systolic > 300) return 'Pressão sistólica inválida'
    if (!Number.isInteger(payload.diastolic) || payload.diastolic < 20 || payload.diastolic > 200) return 'Pressão diastólica inválida'
    if (payload.heartRate != null && (!Number.isInteger(payload.heartRate) || payload.heartRate < 20 || payload.heartRate > 250)) return 'Frequência cardíaca inválida'
    if (!['ble', 'manual', 'photo'].includes(payload.source) || !isValidIsoDate(payload.measuredAt)) return 'Origem ou data da medição inválida'
  }
  if (type === 'glucoseMeasurement') {
    if (!Number.isInteger(payload.value) || payload.value < 20 || payload.value > 800) return 'Valor de glicose inválido'
    if (!['jejum', 'pre_refeicao', 'pos_refeicao', 'aleatorio'].includes(payload.context)) return 'Contexto da glicose inválido'
    if (!['ble', 'manual', 'photo'].includes(payload.source) || !isValidIsoDate(payload.measuredAt)) return 'Origem ou data da medição inválida'
  }
  if (type === 'medication') {
    if (!String(payload.name || '').trim() || String(payload.name).length > 200) return 'Nome do medicamento inválido'
    if (!String(payload.dose || '').trim() || String(payload.dose).length > 120) return 'Dose inválida'
    if (!String(payload.frequency || '').trim() || String(payload.frequency).length > 120) return 'Frequência inválida'
  }
  if (type === 'alert' && !['pending', 'acknowledged', 'resolved'].includes(payload.status)) return 'Status do alerta inválido'
  if (type === 'device' && (!String(payload.model || '').trim() || String(payload.model).length > 200)) return 'Modelo do aparelho inválido'
  if (type === 'chatMessage') {
    const content = String(payload.content || '').trim()
    if (!content || content.length > 4000) return 'Mensagem deve ter entre 1 e 4000 caracteres'
    if (!isValidIsoDate(payload.sentAt)) return 'Data da mensagem inválida'
  }
  return null
}

async function createMeasurementAlerts(client, measurement) {
  const systolicHigh = Number(process.env.SYSTOLIC_URGENT_THRESHOLD || 180)
  const diastolicHigh = Number(process.env.DIASTOLIC_URGENT_THRESHOLD || 110)
  const systolicLow = Number(process.env.SYSTOLIC_LOW_THRESHOLD || 90)
  const diastolicLow = Number(process.env.DIASTOLIC_LOW_THRESHOLD || 60)
  const recent = await client.query(
    'SELECT systolic,diastolic,measured_at AS "measuredAt" FROM measurements WHERE patient_id=$1 AND id<>$2 ORDER BY measured_at DESC LIMIT 2',
    [measurement.patientId, measurement.id]
  )
  const alerts = evaluateMeasurementAlerts(measurement, recent.rows, {
    systolicHigh, diastolicHigh, systolicLow, diastolicLow,
  })

  for (const alert of alerts) {
    const inserted = await client.query(
      `INSERT INTO alerts (id,patient_id,measurement_id,type,rule,status,created_at,updated_at)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,'pending',now(),now())
       ON CONFLICT DO NOTHING RETURNING id`,
      [measurement.patientId, measurement.id, alert.type, alert.rule]
    )
    if (inserted.rows[0]) {
      await client.query(
        `INSERT INTO alert_events (alert_id,actor_id,event_type,details)
         VALUES ($1,$2,'created',jsonb_build_object('source','server_rule'))`,
        [inserted.rows[0].id, measurement.patientId]
      )
    }
  }
}

function mapMeasurement(r) { return { id:r.id, patientId:r.patient_id, deviceId:r.device_id, systolic:r.systolic, diastolic:r.diastolic, heartRate:r.heart_rate, meanArterialPressure:r.mean_arterial_pressure, source:r.source, measuredAt:r.measured_at, syncedAt:r.synced_at } }
function mapGlucose(r) { return { id:r.id, patientId:r.patient_id, deviceId:r.device_id, value:r.value, context:r.context, source:r.source, measuredAt:r.measured_at, notes:r.notes, syncedAt:r.synced_at } }
function mapMedication(r) { return { id:r.id, patientId:r.patient_id, name:r.name, dose:r.dose, frequency:r.frequency, schedule:r.schedule, active:r.active, startDate:r.start_date, endDate:r.end_date, notes:r.notes } }
function mapAlert(r) { return { id:r.id, patientId:r.patient_id, measurementId:r.measurement_id, type:r.type, rule:r.rule, status:r.status, createdAt:r.created_at, acknowledgedAt:r.acknowledged_at, resolvedAt:r.resolved_at, resolvedBy:r.resolved_by } }
function mapDevice(r) { return { id:r.id, patientId:r.patient_id, model:r.model, serialNumber:r.serial_number, lastConnectedAt:r.last_connected_at } }
function mapMessage(r) { return { id:r.id, operatorId:r.operator_id, patientId:r.patient_id, fromRole:r.from_role, content:r.content, sentAt:r.sent_at, read:r.read } }

const entityConfigs = {
  measurement: { table:'measurements', map:mapMeasurement, upsert:p=>({ text:`INSERT INTO measurements (id,patient_id,device_id,systolic,diastolic,heart_rate,mean_arterial_pressure,source,measured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET systolic=EXCLUDED.systolic,diastolic=EXCLUDED.diastolic,heart_rate=EXCLUDED.heart_rate,synced_at=now() RETURNING *`, values:[p.id,p.patientId,p.deviceId||null,p.systolic,p.diastolic,p.heartRate||null,p.meanArterialPressure||null,p.source,p.measuredAt] }) },
  glucoseMeasurement: { table:'glucose_measurements', map:mapGlucose, upsert:p=>({ text:`INSERT INTO glucose_measurements (id,patient_id,device_id,value,context,source,measured_at,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,context=EXCLUDED.context,notes=EXCLUDED.notes,synced_at=now() RETURNING *`, values:[p.id,p.patientId,p.deviceId||null,p.value,p.context,p.source,p.measuredAt,p.notes||null] }) },
  medication: { table:'medications', map:mapMedication, upsert:p=>({ text:`INSERT INTO medications (id,patient_id,name,dose,frequency,schedule,active,start_date,end_date,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,dose=EXCLUDED.dose,frequency=EXCLUDED.frequency,schedule=EXCLUDED.schedule,active=EXCLUDED.active,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,notes=EXCLUDED.notes,updated_at=now() RETURNING *`, values:[p.id,p.patientId,p.name,p.dose,p.frequency,JSON.stringify(p.schedule||[]),p.active!==false,p.startDate||null,p.endDate||null,p.notes||null] }) },
  alert: { table:'alerts', map:mapAlert, upsert:(p,actorId)=>({ text:`INSERT INTO alerts (id,patient_id,measurement_id,type,rule,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,acknowledged_at=CASE WHEN EXCLUDED.status='acknowledged' THEN COALESCE(alerts.acknowledged_at,now()) ELSE alerts.acknowledged_at END,acknowledged_by=CASE WHEN EXCLUDED.status='acknowledged' THEN $8 ELSE alerts.acknowledged_by END,resolved_at=CASE WHEN EXCLUDED.status='resolved' THEN COALESCE(alerts.resolved_at,now()) ELSE alerts.resolved_at END,resolved_by=CASE WHEN EXCLUDED.status='resolved' THEN $8 ELSE alerts.resolved_by END,updated_at=now() RETURNING *`, values:[p.id,p.patientId,p.measurementId||null,p.type,p.rule,p.status||'pending',p.createdAt,actorId] }) },
  device: { table:'devices', map:mapDevice, upsert:p=>({ text:`INSERT INTO devices (id,patient_id,model,serial_number,last_connected_at,updated_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT(id) DO UPDATE SET model=EXCLUDED.model,serial_number=EXCLUDED.serial_number,last_connected_at=EXCLUDED.last_connected_at,updated_at=now() RETURNING *`, values:[p.id,p.patientId,p.model,p.serialNumber||null,p.lastConnectedAt||null] }) },
  chatMessage: { table:'chat_messages', map:mapMessage, upsert:p=>({ text:`INSERT INTO chat_messages (id,operator_id,patient_id,from_role,content,sent_at,read,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(id) DO UPDATE SET read=EXCLUDED.read,updated_at=now() RETURNING *`, values:[p.id,p.operatorId,p.patientId,p.fromRole,String(p.content||'').trim(),p.sentAt,p.read===true] }) },
}

app.use(express.static(join(__dirname, '..', 'dist'), { maxAge: '1h' }))
app.get('/*splat', (_req, res) => res.sendFile(join(__dirname, '..', 'dist', 'index.html')))
app.use((error, _req, res, _next) => {
  console.error('[api]', error)
  const known = {
    '22P02': 'Identificador ou valor inválido',
    '23503': 'Registro relacionado não encontrado',
    '23505': 'Registro já existe',
    '23514': 'Valor fora dos limites permitidos',
  }
  const status = Number(error?.status) || (known[error?.code] ? 400 : 500)
  const message = status < 500 ? (known[error?.code] || error?.message || 'Requisição inválida') : 'Erro interno'
  res.status(status).json({ error: message })
})

async function ensureBootstrapAdmin() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!email || !password) {
    const existing = await pool.query(
      `SELECT 1 FROM profiles p JOIN auth_credentials c ON c.user_id=p.id
       WHERE p.role='controller' AND c.disabled_at IS NULL LIMIT 1`
    )
    if (!existing.rowCount) console.warn('[auth] nenhum administrador configurado; defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD')
    return
  }
  const validationError = validatePassword(password)
  if (validationError) throw new Error(`BOOTSTRAP_ADMIN_PASSWORD inválida: ${validationError}`)
  const passwordHash = await hashPassword(password)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const profile = await client.query(
      `INSERT INTO profiles (id,email,name,role)
       VALUES (gen_random_uuid(),$1,$2,'controller')
       ON CONFLICT(email) DO UPDATE SET role='controller',updated_at=now()
       RETURNING id`,
      [email, String(process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador KardiaApp').trim()]
    )
    await client.query(
      `INSERT INTO auth_credentials (user_id,password_hash,must_change_password)
       VALUES ($1,$2,true) ON CONFLICT(user_id) DO NOTHING`,
      [profile.rows[0].id, passwordHash]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function start() {
  if (pool) {
    const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8')
    await pool.query(schema)
    await pool.query('DELETE FROM auth_sessions WHERE expires_at<=now()')
    await ensureBootstrapAdmin()
  }
  app.listen(port, '0.0.0.0', () => console.log(`KardiaApp em :${port}`))
}

start().catch((error) => { console.error(error); process.exit(1) })
