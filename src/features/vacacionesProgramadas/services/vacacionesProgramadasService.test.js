import { describe, expect, it, vi } from 'vitest'
import { getSolicitudesVacacion } from './vacacionesProgramadasService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('vacacionesProgramadasService', () => {
  it('preserves request failure status for consistent pending-request handling', async () => {
    apiRequest.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ detail: 'Not found' }),
    })

    await expect(getSolicitudesVacacion()).rejects.toMatchObject({ status: 404, message: 'Not found' })
  })
})
