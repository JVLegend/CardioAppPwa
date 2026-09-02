import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [path] : []
  }))
  return files.flat()
}

test('aplicação não depende do Supabase', async () => {
  const files = await sourceFiles(join(process.cwd(), 'src'))
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n').toLowerCase()

  assert.doesNotMatch(source, /supabase/)
})

test('PostgreSQL contém todas as entidades clínicas e operacionais', async () => {
  const schema = await readFile(join(process.cwd(), 'server', 'schema.sql'), 'utf8')
  for (const table of [
    'profiles', 'measurements', 'glucose_measurements', 'medications', 'alerts',
    'alert_events', 'devices', 'chat_messages', 'sync_tombstones', 'audit_logs',
    'auth_credentials', 'auth_sessions',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'))
  }
})

test('médico e operadora recebem painéis distintos', async () => {
  const app = await readFile(join(process.cwd(), 'src', 'App.tsx'), 'utf8')

  assert.match(app, /currentUserRole === 'operator'[\s\S]*<PatientListView \/>/)
  assert.match(app, /currentUserRole === 'controller'[\s\S]*<ControllerDashboardView \/>/)
  assert.doesNotMatch(app, /currentUserRole === 'operator'\s*\|\|\s*currentUserRole === 'controller'/)
})

test('painel médico não exibe nem edita situação financeira', async () => {
  const panel = await readFile(join(process.cwd(), 'src', 'views', 'PatientListView.tsx'), 'utf8')

  assert.match(panel, /Painel Médico/)
  assert.doesNotMatch(panel, /Plano financeiro|Adimplente|Inadimplente/)
})
