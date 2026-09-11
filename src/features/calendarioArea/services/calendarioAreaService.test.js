import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeAreaOccurrence,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  rescheduleAreaOccurrence,
} from './calendarioAreaService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('calendarioAreaService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('uses the WU8 monthly, completion, reschedule, and performance clients', async () => {
    const payload = { month: '2026-09', timezone: 'America/Tegucigalpa', occurrences: [] }
    apiRequest.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(payload) })

    await expect(getMonthlyAreaOccurrences('2026-09')).resolves.toEqual(payload)
    await getMonthlyAreaPerformance('2026-09')
    await completeAreaOccurrence(14)
    await rescheduleAreaOccurrence(14, { target_date: '2026-09-15' })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/my-area/monthly-occurrences/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/my-area/monthly-performance/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/my-area/occurrences/14/complete/', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/my-area/occurrences/14/reschedule/', {
      method: 'POST', body: JSON.stringify({ target_date: '2026-09-15' }),
    })
  })

  it.each([400, 403, 409])('preserves status, detail, and fields for a %i calendar API error', async (status) => {
    const fields = { detail: 'Fecha no disponible.', target_date: ['No hay cobertura.'] }
    apiRequest.mockResolvedValue({ ok: false, status, json: vi.fn().mockResolvedValue(fields) })

    await expect(rescheduleAreaOccurrence(14, { target_date: '2026-09-15' })).rejects.toMatchObject({
      message: 'Fecha no disponible.',
      status,
      detail: 'Fecha no disponible.',
      fields,
    })
  })
})
