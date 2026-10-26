import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPerformanceHistory } from './performanceHistoryService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true, status = 200) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

describe('performanceHistoryService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('uses only the documented history query parameters in a stable order', async () => {
    const payload = { results: [], next_cursor: 'opaque-next' }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getPerformanceHistory({ areaId: 7, businessDate: '2026-10-25', fromMonth: '2026-09', toMonth: '2026-10', cursor: 'opaque cursor', limit: 25 })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/history/?area_id=7&business_date=2026-10-25&from_month=2026-09&to_month=2026-10&cursor=opaque+cursor&limit=25', { method: 'GET' })
  })

  it('normalizes malformed history failures to neutral Spanish', async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn().mockRejectedValue(new SyntaxError('bad json')) })

    await expect(getPerformanceHistory({ areaId: 7, fromMonth: '2026-10', toMonth: '2026-10' })).rejects.toMatchObject({
      message: 'No fue posible cargar el historial de rendimiento mensual.',
      status: 500,
    })
  })
})
