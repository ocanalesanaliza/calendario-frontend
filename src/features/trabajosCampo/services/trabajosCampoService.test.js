import { describe, expect, it, vi } from 'vitest'
import { aceptarTrabajoCampo, getTrabajosCampo, rechazarTrabajoCampo } from './trabajosCampoService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('trabajosCampoService', () => {
  it.each([
    ['loads field work', () => getTrabajosCampo()],
    ['accepts field work', () => aceptarTrabajoCampo(9)],
    ['rejects field work', () => rechazarTrabajoCampo(9)],
  ])('preserves a 403 status when it %s', async (_action, request) => {
    apiRequest.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ detail: 'Forbidden' }),
    })

    await expect(request()).rejects.toMatchObject({ status: 403, message: 'Forbidden' })
  })
})
