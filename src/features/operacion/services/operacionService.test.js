import { describe, expect, it, vi } from 'vitest'
import { getMisTareas } from './operacionService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('operacionService', () => {
  it('preserves a 403 status from Mis tareas requests', async () => {
    apiRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ detail: 'Forbidden' }),
    })

    await expect(getMisTareas()).rejects.toMatchObject({ status: 403, message: 'Forbidden' })
  })
})
