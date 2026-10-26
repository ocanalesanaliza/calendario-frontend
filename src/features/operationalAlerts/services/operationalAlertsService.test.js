import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOperationalAlerts, getOperationalAlertsCount } from './operationalAlertsService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true, status = 200) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

describe('operationalAlertsService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('gets the server-ordered list with scope, cursor, and limit', async () => {
    const payload = { results: [{ id: 'new' }, { id: 'old' }], next_cursor: 'next' }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getOperationalAlerts({ scope: 'history', cursor: 'before', limit: 25 })).resolves.toBe(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/operational-alerts/?scope=history&cursor=before&limit=25', { method: 'GET' })
  })

  it('uses GET for the active count endpoint', async () => {
    apiRequest.mockResolvedValueOnce(response({ count: 3 }))

    await expect(getOperationalAlertsCount()).resolves.toEqual({ count: 3 })
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/operational-alerts/count/', { method: 'GET' })
  })

  it('does not re-sort rows returned by the server', async () => {
    const payload = { results: [{ id: 'latest' }, { id: 'earliest' }] }
    apiRequest.mockResolvedValueOnce(response(payload))

    await expect(getOperationalAlerts()).resolves.toBe(payload)
  })

  it('normalizes a non-JSON API failure to the approved Spanish message', async () => {
    apiRequest.mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')) })

    await expect(getOperationalAlerts()).rejects.toMatchObject({
      message: 'No fue posible cargar las alertas operativas.',
      status: 500,
    })
  })

  it('does not expose malformed API error payloads to the UI', async () => {
    apiRequest.mockResolvedValueOnce(response({ detail: { unexpected: 'Raw API error' } }, false, 502))

    await expect(getOperationalAlerts()).rejects.toMatchObject({
      message: 'No fue posible cargar las alertas operativas.',
      status: 502,
    })
  })
})
