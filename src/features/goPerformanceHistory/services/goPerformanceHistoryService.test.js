import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGOAllAreasPerformanceHistory, getGOAuthorizedAreas, getGOAreaPerformanceHistory, getGOOccurrenceDetail, getGOOccurrences, getGOResponsibilityGaps } from './goPerformanceHistoryService'

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

  it('requests all-Area history only with the accepted parameters and preserves an opaque cursor', async () => {
    const payload = { scope: { mode: 'all_areas' }, results: [], next_cursor: 'opaque+/all-cursor' }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOAllAreasPerformanceHistory({ businessDate: '2026-10-27', fromMonth: '2026-09', toMonth: '2026-10', cursor: 'opaque+/all-cursor', limit: 25, areaId: 7, responsibilityId: 19, snapshotId: 'ignored' })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/history/all-areas/?business_date=2026-10-27&from_month=2026-09&to_month=2026-10&cursor=opaque%2B%2Fall-cursor&limit=25', { method: 'GET' })
  })

  it('normalizes malformed failures to neutral Spanish while retaining authorization status', async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 403, json: vi.fn().mockRejectedValue(new SyntaxError('bad json')) })

    await expect(getGOAreaPerformanceHistory({ areaId: 7, fromMonth: '2026-10', toMonth: '2026-10' })).rejects.toMatchObject({
      message: 'No fue posible cargar el historial de rendimiento de áreas.',
      status: 403,
    })
  })

  it('requests occurrence evidence only with the selected Area, responsibility, and single history period', async () => {
    const payload = { scope: {}, results: [] }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOOccurrences({ areaId: 7, responsibilityId: 19, fromMonth: '2026-10', toMonth: '2026-10' })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/occurrences/?area_id=7&responsibility_id=19&from_month=2026-10&to_month=2026-10', { method: 'GET' })
  })

  it('uses only a list-issued occurrence identifier for the detail endpoint shape', async () => {
    const payload = {
      occurrence: {
        id: 123,
        area_id: 7,
        responsibility_id: 1,
        origin_date_local: '2026-10-20',
        attribution_month: '2026-10',
        frozen_weight: '2.50',
        task_snapshot: { id: 55, title: 'Occurrence detail task' },
      },
      latest_revision: { id: 1, status: 'pendiente', effective_at: '2026-10-20T18:00:00Z', reason: null },
      revision_history: [],
    }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOOccurrenceDetail('opaque-listed-occurrence')).resolves.toEqual({
      task: { title: 'Occurrence detail task' },
      origin_date_local: '2026-10-20',
      attribution_month: '2026-10',
      frozen_weight: '2.50',
      latest_revision: payload.latest_revision,
      revision_history: [],
    })
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/occurrences/opaque-listed-occurrence/', { method: 'GET' })
  })

  it('keeps legitimate missing or null detail fields safe without inventing values', async () => {
    apiRequest.mockResolvedValueOnce(response({ occurrence: { task_snapshot: { title: null }, origin_date_local: null }, latest_revision: null, revision_history: null }))

    await expect(getGOOccurrenceDetail('opaque-listed-occurrence')).resolves.toEqual({
      task: { title: null },
      origin_date_local: null,
      attribution_month: undefined,
      frozen_weight: undefined,
      latest_revision: null,
      revision_history: [],
    })
  })

  it('requests responsibility gaps with documented Area/range parameters and preserves an opaque cursor', async () => {
    const payload = { results: [], next_cursor: 'opaque+/gap' }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getGOResponsibilityGaps({ areaId: 7, businessDate: '2026-10-31', fromDate: '2026-09-01', toDate: '2026-10-31', cursor: 'opaque+/gap', limit: 25 })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/areas/7/responsibility-gaps/?business_date=2026-10-31&from_date=2026-09-01&to_date=2026-10-31&cursor=opaque%2B%2Fgap&limit=25', { method: 'GET' })
  })
})
