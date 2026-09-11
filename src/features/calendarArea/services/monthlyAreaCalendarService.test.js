import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeMonthlyAreaPerformance,
  completeAreaOccurrence,
  correctMonthlyAreaPerformance,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  rescheduleAreaOccurrence,
} from './monthlyAreaCalendarService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

describe('monthlyAreaCalendarService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses the monthly occurrence and performance command contracts', async () => {
    const performance = { area_id: 8, month: '2026-09', reason: 'Cierre mensual' }
    await getMonthlyAreaOccurrences('2026-09')
    await getMonthlyAreaPerformance('2026-09')
    await completeAreaOccurrence(14)
    await rescheduleAreaOccurrence(14, { target_date: '2026-09-15', reason: 'Cobertura' })
    await closeMonthlyAreaPerformance(performance)
    await correctMonthlyAreaPerformance(performance)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/my-area/monthly-occurrences/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/my-area/monthly-performance/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/my-area/occurrences/14/complete/', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/my-area/occurrences/14/reschedule/', {
      method: 'POST', body: JSON.stringify({ target_date: '2026-09-15', reason: 'Cobertura' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/area-performance/close/', { method: 'POST', body: JSON.stringify(performance) })
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/area-performance/correct/', { method: 'POST', body: JSON.stringify(performance) })
  })
})
