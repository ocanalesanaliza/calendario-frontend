import { describe, expect, it, vi } from 'vitest'
import { getGOEvidence } from './goStructuredEvidenceService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../services/apiClient', () => ({ apiRequest }))

describe('goStructuredEvidenceService', () => {
  it('uses the GO evidence resolver only', async () => {
    apiRequest.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ kind: 'inventory_area' }) })
    await expect(getGOEvidence('opaque/ref')).resolves.toEqual({ kind: 'inventory_area' })
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/performance/evidence/opaque%2Fref/', { method: 'GET' })
  })
})
