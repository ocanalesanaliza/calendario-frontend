import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGOAuthorizedAreas, getGOAreaPerformanceHistory } from './goPerformanceHistoryService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true, status = 200) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

describe('goPerformanceHistoryService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('requests the range-authorized Area selector with only the accepted query parameters', async () => {
    const payload = { scope: {}, results: [] }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOAuthorizedAreas({ businessDate: '2026-10-27', fromMonth: '2026-09', toMonth: '2026-10' })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/areas/?business_date=2026-10-27&from_month=2026-09&to_month=2026-10', { method: 'GET' })
    expect(apiRequest.mock.calls[0][0]).not.toContain('/api/calendar/areas/')
  })

  it('requests history with the exact GO query shape and preserves an opaque cursor', async () => {
    const payload = { scope: {}, results: [], next_cursor: 'opaque-next' }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOAreaPerformanceHistory({ areaId: 7, businessDate: '2026-10-27', fromMonth: '2026-09', toMonth: '2026-10', cursor: 'opaque+/cursor', limit: 25 })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/history/?area_id=7&business_date=2026-10-27&from_month=2026-09&to_month=2026-10&cursor=opaque%2B%2Fcursor&limit=25', { method: 'GET' })
  })

  it('normalizes malformed failures to neutral Spanish while retaining authorization status', async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 403, json: vi.fn().mockRejectedValue(new SyntaxError('bad json')) })

    await expect(getGOAreaPerformanceHistory({ areaId: 7, fromMonth: '2026-10', toMonth: '2026-10' })).rejects.toMatchObject({
      message: 'No fue posible cargar el historial de rendimiento de áreas.',
      status: 403,
    })
  })
})
