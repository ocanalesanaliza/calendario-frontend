import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activarAlmuerzo, cerrarAlmuerzo, getMiAlmuerzo } from './almuerzosService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('almuerzosService', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('uses personal endpoints without an id_usuario payload', async () => {
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ almuerzo: { estado: 'no_iniciado' } }) })

    await getMiAlmuerzo()
    await activarAlmuerzo()
    await cerrarAlmuerzo()

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/almuerzos/hoy/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/almuerzos/activar/', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/almuerzos/cerrar/', { method: 'POST' })
  })

  it('preserves API detail messages', async () => {
    apiRequest.mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ detail: 'No puede cerrar el almuerzo.' }) })

    await expect(cerrarAlmuerzo()).rejects.toThrow('No puede cerrar el almuerzo.')
  })
})
