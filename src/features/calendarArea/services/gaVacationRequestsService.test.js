import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  actOnGAVacationRequest,
  createGAVacationRequest,
  getGAVacationRequest,
  getGAVacationRequests,
} from './gaVacationRequestsService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(data) })

describe('gaVacationRequestsService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('keeps reads free of idempotency headers and sends injected command keys for retries', async () => {
    const body = { segments: [{ date: '2026-09-10', slot: 'full_day' }, { date: '2026-09-11', slot: 'morning' }, { date: '2026-09-12', slot: 'afternoon' }], reason: 'Vacaciones' }
    await getGAVacationRequests()
    await getGAVacationRequest(9)
    await createGAVacationRequest(body, 'retry-key')
    await createGAVacationRequest(body, 'retry-key')
    await actOnGAVacationRequest(9, 'approve', { reason: '' }, 'action-key')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/ga-vacation-requests/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/ga-vacation-requests/9/')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga-vacation-requests/', {
      method: 'POST', headers: { 'Idempotency-Key': 'retry-key' }, body: JSON.stringify(body),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/ga-vacation-requests/', {
      method: 'POST', headers: { 'Idempotency-Key': 'retry-key' }, body: JSON.stringify(body),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/ga-vacation-requests/9/approve/', {
      method: 'POST', headers: { 'Idempotency-Key': 'action-key' }, body: JSON.stringify({ reason: '' }),
    })
  })

  it('preserves API status and detail for a 409 conflict', async () => {
    apiRequest.mockResolvedValueOnce(response({ detail: 'vacation_overlap' }, 409))

    await expect(createGAVacationRequest({ segments: [{ date: '2026-09-10', slot: 'full_day' }] }, 'conflict-key')).rejects.toMatchObject({
      status: 409, detail: 'vacation_overlap', message: 'vacation_overlap',
    })
  })
})
