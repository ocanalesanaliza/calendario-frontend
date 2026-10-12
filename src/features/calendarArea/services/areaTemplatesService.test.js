import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveAreaTemplate,
  createAreaTemplate,
  createAreaTemplateVersion,
  getAreaTemplate,
  getAreaTemplates,
  getAreaTemplateVersions,
} from './areaTemplatesService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })
const task = { task_id: 4, jornada: 'manana', aplica_ambas_jornadas: false }

describe('areaTemplatesService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses the exact template collection, detail, version, and archive contracts', async () => {
    await getAreaTemplates()
    await createAreaTemplate({ name: 'Apertura', description: '', tasks: [task] }, 'create-key')
    await getAreaTemplate(3)
    await getAreaTemplateVersions(3)
    await createAreaTemplateVersion(3, { tasks: [task] }, 'publish-key')
    await archiveAreaTemplate(3, 'archive-key')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/area-templates/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/area-templates/', { method: 'POST', headers: { 'Idempotency-Key': 'create-key' }, body: JSON.stringify({ name: 'Apertura', description: '', tasks: [task] }) })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/area-templates/3/')
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/area-templates/3/versions/')
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/area-templates/3/versions/', { method: 'POST', headers: { 'Idempotency-Key': 'publish-key' }, body: JSON.stringify({ tasks: [task] }) })
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/area-templates/3/archive/', { method: 'POST', headers: { 'Idempotency-Key': 'archive-key' } })
  })
})
