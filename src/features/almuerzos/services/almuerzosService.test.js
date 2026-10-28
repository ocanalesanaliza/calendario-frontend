import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activarAlmuerzo, cerrarAlmuerzo, getDashboardAlmuerzos, getMiAlmuerzo } from './almuerzosService'

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

  it('uses the dashboard endpoint with date and status filters without a user id', async () => {
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ count: 0, results: [] }) })

    await getDashboardAlmuerzos({ fecha: '2026-09-07', estado: 'en_almuerzo' })

    expect(apiRequest).toHaveBeenCalledWith('/api/almuerzos/dashboard/?fecha=2026-09-07&estado=en_almuerzo')
    expect(apiRequest.mock.calls[0][0]).not.toContain('id_usuario')
  })

  it('keeps the HTTP status available to the dashboard presentation', async () => {
    apiRequest.mockResolvedValue({ ok: false, status: 403, json: vi.fn().mockResolvedValue({ detail: 'Forbidden' }) })

    await expect(getDashboardAlmuerzos()).rejects.toMatchObject({ status: 403 })
  })
})
