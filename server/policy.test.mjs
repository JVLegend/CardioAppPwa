import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canCreateRole,
  canAccessPatientScope,
  canResetPassword,
  canTransitionAlert,
  canWriteEntity,
  sanitizeProfilePatch,
} from './policy.mjs'

const patientId = '00000000-0000-4000-8000-000000000001'
const otherPatientId = '00000000-0000-4000-8000-000000000002'
const operatorId = '00000000-0000-4000-8000-000000000003'

test('escopo de leitura separa paciente, médico responsável e operadora', () => {
  assert.equal(canAccessPatientScope('patient', patientId, patientId), true)
  assert.equal(canAccessPatientScope('patient', patientId, otherPatientId), false)
  assert.equal(canAccessPatientScope('operator', operatorId, patientId, operatorId), true)
  assert.equal(canAccessPatientScope('operator', operatorId, patientId, '00000000-0000-4000-8000-000000000004'), false)
  assert.equal(canAccessPatientScope('controller', 'controller-id', patientId), true)
})

test('paciente só escreve dados próprios permitidos pelo tipo de entidade', () => {
  assert.equal(canWriteEntity('patient', 'measurement', 'create'), true)
  assert.equal(canWriteEntity('patient', 'glucoseMeasurement', 'delete'), true)
  assert.equal(canWriteEntity('patient', 'alert', 'update'), false)
  assert.equal(canWriteEntity('patient', 'chatMessage', 'delete'), false)
})

test('médico pode atender alerta, mas não criar alertas arbitrários', () => {
  assert.equal(canWriteEntity('operator', 'alert', 'update'), true)
  assert.equal(canWriteEntity('operator', 'alert', 'create'), false)
  assert.equal(canWriteEntity('operator', 'medication', 'update'), true)
})

test('alerta resolvido não pode voltar para pendente', () => {
  assert.equal(canTransitionAlert('pending', 'acknowledged'), true)
  assert.equal(canTransitionAlert('acknowledged', 'resolved'), true)
  assert.equal(canTransitionAlert('resolved', 'pending'), false)
  assert.equal(canTransitionAlert('resolved', 'acknowledged'), false)
})

test('operadora não altera medições clínicas', () => {
  assert.equal(canWriteEntity('controller', 'measurement', 'update'), false)
  assert.equal(canWriteEntity('controller', 'glucoseMeasurement', 'delete'), false)
  assert.equal(canWriteEntity('controller', 'alert', 'update'), true)
})

test('criação de papéis impede elevação para gestora', () => {
  assert.equal(canCreateRole('operator', 'patient'), true)
  assert.equal(canCreateRole('operator', 'operator'), false)
  assert.equal(canCreateRole('controller', 'operator'), true)
  assert.equal(canCreateRole('controller', 'controller'), false)
})

test('redefinição de senha respeita os papéis e a carteira médica', () => {
  const assignedPatient = { id: patientId, role: 'patient', operator_id: operatorId }
  const otherPatient = { id: otherPatientId, role: 'patient', operator_id: 'outro-medico' }
  const operator = { id: operatorId, role: 'operator', operator_id: null }
  assert.equal(canResetPassword('patient', patientId, operator), false)
  assert.equal(canResetPassword('operator', operatorId, assignedPatient), true)
  assert.equal(canResetPassword('operator', operatorId, otherPatient), false)
  assert.equal(canResetPassword('operator', operatorId, operator), false)
  assert.equal(canResetPassword('controller', 'admin-id', operator), true)
  assert.equal(canResetPassword('controller', 'admin-id', assignedPatient), true)
  assert.equal(canResetPassword('controller', operatorId, operator), false)
})

test('campos do perfil são filtrados pelo papel do ator', () => {
  const input = {
    name: 'Paciente', phone: '11999999999', state: 'SP', birthDate: '1980-01-01',
    comorbidities: ['HAS'], planStatus: 'inadimplente', inTreatmentPlan: true,
    operatorId: '00000000-0000-4000-8000-000000000000', role: 'controller',
  }
  assert.deepEqual(sanitizeProfilePatch('patient', input), {
    name: 'Paciente', phone: '11999999999', state: 'SP', birthDate: '1980-01-01',
  })
  assert.equal(sanitizeProfilePatch('operator', input).planStatus, undefined)
  assert.equal(sanitizeProfilePatch('controller', input).planStatus, 'inadimplente')
  assert.equal(sanitizeProfilePatch('controller', input).role, undefined)
})
