import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGASpecialSituation,
  deactivateGASpecialSituation,
  getCatalog,
  getGASpecialSituation,
  getGASpecialSituations,
} from './gaSpecialSituationsService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

describe('gaSpecialSituationsService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses the Calendar catalog query and idempotency keys only for commands', async () => {
    const body = { gerente_area_id: 8, date: '2026-09-10', type: 'capacitacion', reason: 'Curso', slot: 'afternoon' }
    await getGASpecialSituations()
    await getCatalog('2026-09-10')
    await getCatalog()
    await getGASpecialSituation(6)
    await createGASpecialSituation(body, 'create-key')
    await deactivateGASpecialSituation(6, 'deactivate-key')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/ga-special-situations/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/ga-special-situations/catalog/?date=2026-09-10')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga-special-situations/catalog/')
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/ga-special-situations/6/')
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/ga-special-situations/', {
      method: 'POST', headers: { 'Idempotency-Key': 'create-key' }, body: JSON.stringify(body),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/ga-special-situations/6/deactivate/', {
      method: 'POST', headers: { 'Idempotency-Key': 'deactivate-key' },
    })
  })
})
