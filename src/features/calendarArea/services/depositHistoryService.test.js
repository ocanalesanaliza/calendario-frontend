import { describe, expect, it, vi } from 'vitest'
import { getDepositHistory, getDepositHistoryBranch, getDepositHistoryClosure } from './depositHistoryService'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) }
}

describe('depositHistoryService', () => {
  it('requests the GA summary and branch detail using backend opaque identifiers', async () => {
    apiRequest.mockResolvedValueOnce(jsonResponse({ branches: [] }))
    apiRequest.mockResolvedValueOnce(jsonResponse({ closures: [] }))
    apiRequest.mockResolvedValueOnce(jsonResponse({ id: 'opaque-closure' }))

    await getDepositHistory({ from: '2026-11-01', to: '2026-11-30' })
    await getDepositHistoryBranch('opaque-branch-token', { from: '2026-11-01', to: '2026-11-30' })
    await getDepositHistoryClosure('opaque-closure-token')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/depositos/ga/historial/?from=2026-11-01&to=2026-11-30', { method: 'GET' })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/depositos/ga/historial/sucursales/opaque-branch-token/?from=2026-11-01&to=2026-11-30', { method: 'GET' })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/depositos/ga/historial/cierres/opaque-closure-token/', { method: 'GET' })
  })

  it('preserves a 404 as an absence/access-safe error', async () => {
    apiRequest.mockResolvedValue(jsonResponse({ detail: 'not found' }, false, 404))

    await expect(getDepositHistory({ from: '2026-11-01', to: '2026-11-30' })).rejects.toMatchObject({ status: 404 })
  })
})
