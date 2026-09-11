import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignAreaTemplate,
  cancelAreaTemplateAssignment,
  getAssignableAreaTemplates,
  getAreaTemplateAssignment,
} from './areaTemplateAssignmentsService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

describe('areaTemplateAssignmentsService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses the singular state and scoped assignment endpoints', async () => {
    await getAreaTemplateAssignment(8)
    await assignAreaTemplate(8, { template_id: 3, version: 2, fecha_inicio: '2026-10-01' }, 'assign-key')
    await cancelAreaTemplateAssignment(8, 12, 'cancel-key')
    await getAssignableAreaTemplates(8)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/areas/8/template-assignment/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/areas/8/template-assignments/', {
      method: 'POST', headers: { 'Idempotency-Key': 'assign-key' }, body: JSON.stringify({ template_id: 3, version: 2, fecha_inicio: '2026-10-01' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/areas/8/template-assignments/12/cancel/', {
      method: 'POST', headers: { 'Idempotency-Key': 'cancel-key' }, body: JSON.stringify({ confirm: true }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/areas/8/assignable-templates/')
  })
})
