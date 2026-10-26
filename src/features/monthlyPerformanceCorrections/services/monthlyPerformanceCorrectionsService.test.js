import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMonthlyPerformanceCorrection, getMonthlyPerformanceCorrectionAudit, validateMonthlyPerformanceCorrection } from './monthlyPerformanceCorrectionsService'

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest: api.apiRequest }))

describe('monthlyPerformanceCorrectionsService', () => {
  const payload = { target_snapshot_id: 123, classification: 'recalculo_por_defecto', reason: 'Evidencia preservada', idempotency_key: '11111111-1111-4111-8111-111111111111' }
  beforeEach(() => api.apiRequest.mockReset())

  it('validates only with the documented endpoint and JSON body UUID', async () => {
    api.apiRequest.mockResolvedValue({ ok: true, json: async () => ({ valid: true }) })
    await expect(validateMonthlyPerformanceCorrection(payload)).resolves.toEqual({ valid: true })
    expect(api.apiRequest).toHaveBeenCalledWith('/api/calendar/area-performance/corrections/validate/', expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }))
    expect(api.apiRequest.mock.calls[0][1].headers).not.toHaveProperty('Idempotency-Key')
  })

  it('writes and reads the read-only audit chain through the documented endpoints', async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: true, json: async () => ({ receipt: { replayed: true } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    await expect(createMonthlyPerformanceCorrection(payload)).resolves.toEqual({ receipt: { replayed: true } })
    await expect(getMonthlyPerformanceCorrectionAudit(123)).resolves.toEqual({ results: [] })
    expect(api.apiRequest.mock.calls[0][0]).toBe('/api/calendar/area-performance/corrections/')
    expect(api.apiRequest.mock.calls[1][0]).toBe('/api/calendar/area-performance/snapshots/123/corrections/')
  })
})
