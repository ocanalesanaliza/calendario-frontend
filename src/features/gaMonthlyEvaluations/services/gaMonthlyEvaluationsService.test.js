import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../services/apiClient'
import { correctGAMonthlyEvaluation, createGAMonthlyEvaluation, getGAMonthlyEvaluationHistory, getGAMonthlyEvaluations } from './gaMonthlyEvaluationsService'

vi.mock('../../../services/apiClient', () => ({ apiRequest: vi.fn() }))

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

describe('gaMonthlyEvaluationsService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('uses the dedicated evaluation endpoints and keeps command keys in JSON bodies', async () => {
    apiRequest.mockResolvedValueOnce(response({ evaluations: [] }))
      .mockResolvedValueOnce(response({ evaluation: { id: 8 } }, 201))
      .mockResolvedValueOnce(response({ evaluation: { id: 9 } }, 201))
      .mockResolvedValueOnce(response({ history: [] }))

    await getGAMonthlyEvaluations({ gaId: 7, month: '2026-02' })
    await createGAMonthlyEvaluation({ ga_id: 7, month: '2026-02', score: '87.50', comment: '', idempotency_key: 'create-key' })
    await correctGAMonthlyEvaluation(8, { score: '90', comment: 'Updated', reason: 'Follow-up', idempotency_key: 'correct-key' })
    await getGAMonthlyEvaluationHistory(9)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/ga-monthly-evaluations/?ga_id=7&month=2026-02', { method: 'GET' })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/ga-monthly-evaluations/', expect.objectContaining({ method: 'POST', body: JSON.stringify({ ga_id: 7, month: '2026-02', score: '87.50', comment: '', idempotency_key: 'create-key' }) }))
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga-monthly-evaluations/8/correct/', expect.objectContaining({ method: 'POST', body: JSON.stringify({ score: '90', comment: 'Updated', reason: 'Follow-up', idempotency_key: 'correct-key' }) }))
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/ga-monthly-evaluations/9/history/', { method: 'GET' })
  })

  it('preserves 422, 403, and 409 responses for the form to handle distinctly', async () => {
    apiRequest.mockResolvedValueOnce(response({ fields: { score: ['invalid'] } }, 422))

    await expect(createGAMonthlyEvaluation({})).rejects.toMatchObject({ status: 422, payload: { fields: { score: ['invalid'] } } })
  })
})
