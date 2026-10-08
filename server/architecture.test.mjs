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

test('sincronização e lembretes são isolados pela conta autenticada', async () => {
  const [sync, auth, reminders] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'services', 'syncEngine.ts'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'contexts', 'AuthContext.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'services', 'reminderService.ts'), 'utf8'),
  ])

  assert.match(sync, /ownerId/)
  assert.match(sync, /function cursorKey\(ownerId: string\)/)
  assert.match(sync, /localStorage\.getItem\(cursorKey\(ownerId\)\)/)
  assert.match(auth, /setSyncOwner\(profile\.id\)/)
  assert.match(reminders, /ownerStorageKey\(STORAGE_KEY\)/)
  assert.match(reminders, /if \(!activeOwnerId\) return/)
})

test('chat usa o papel da sessão e persiste leitura no servidor', async () => {
  const [chat, server] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'views', 'ChatView.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'server', 'index.mjs'), 'utf8'),
  ])

  assert.match(chat, /currentUserRole === 'operator'/)
  assert.match(chat, /markChatReadRemote\(patientId\)/)
  assert.match(server, /app\.post\('\/api\/chat\/read'/)
  assert.match(server, /from_role<>\$3/)
  assert.match(server, /authorizedPatientIds: ids/)
})

test('limites de rede, cache e IA ficam no servidor', async () => {
  const [client, server, app, gemini] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'services', 'apiClient.ts'), 'utf8'),
    readFile(join(process.cwd(), 'server', 'index.mjs'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'AppErrorBoundary.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'server', 'gemini-request.mjs'), 'utf8'),
  ])

  assert.match(client, /DEFAULT_TIMEOUT_MS = 15_000/)
  assert.match(client, /Cache-Control': 'no-store'/)
  assert.match(server, /X-Request-ID/)
  assert.match(server, /requestGemini\(\{ model: geminiModel, purpose, contents/)
  assert.match(gemini, /const generationConfig = isOcr/)
  assert.match(app, /O KPS Cardio precisa ser atualizado/)
})

test('modais clínicos e administrativos mantêm foco acessível', async () => {
  const [hook, patientList, patientManagement, disclaimer, settings] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'hooks', 'useModalAccessibility.ts'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'views', 'PatientListView.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'views', 'PatientManagementSection.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'views', 'DisclaimerView.tsx'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'views', 'SettingsView.tsx'), 'utf8'),
  ])

  assert.match(hook, /event.key === 'Escape'/)
  assert.match(hook, /event.key !== 'Tab'/)
  assert.match(hook, /previousFocusRef\.current\?\.isConnected/)
  for (const view of [patientList, patientManagement, disclaimer, settings]) {
    assert.match(view, /role="dialog"|role="alertdialog"/)
    assert.match(view, /aria-modal="true"/)
  }
})

test('a atualização da PWA não interrompe operações ativas', async () => {
  const [activity, prompt, forms] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'services', 'activityState.ts'), 'utf8'),
    readFile(join(process.cwd(), 'src', 'views', 'PwaUpdatePrompt.tsx'), 'utf8'),
    Promise.all([
      readFile(join(process.cwd(), 'src', 'views', 'ManualEntryView.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src', 'views', 'GlucoseView.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src', 'views', 'MedicationsView.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'src', 'views', 'LoginView.tsx'), 'utf8'),
    ]),
  ])

  assert.match(activity, /useBlockingActivity/)
  assert.match(activity, /useHasBlockingActivity/)
  assert.match(activity, /beforeunload/)
  assert.match(prompt, /hasBlockingActivity/)
  assert.match(prompt, /Aguardando operação/)
  for (const form of forms) assert.match(form, /useBlockingActivity/)
})
