import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignAreaToManager, getEligibleAreaManagers, getEligibleAreas, reassignAreaToManager } from './areaManagerAssignmentService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

describe('areaManagerAssignmentService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('uses the eligible endpoints and posts an area assignment', async () => {
    apiRequest.mockResolvedValue(response({ results: [] }))

    await getEligibleAreaManagers(4)
    await getEligibleAreas(8)
    await assignAreaToManager(8, 4)
    await reassignAreaToManager(8, 4)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/areas/4/eligible-area-managers/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/ga/8/eligible-areas/')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga/8/areas/', {
      method: 'POST', body: JSON.stringify({ area_id: 4 }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/ga/8/areas/4/', { method: 'PUT' })
  })
})
