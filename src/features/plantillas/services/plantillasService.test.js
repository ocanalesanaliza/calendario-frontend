import { beforeEach, describe, expect, it, vi } from 'vitest'
import { duplicarPlantilla } from './plantillasService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('duplicarPlantilla', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('sends a POST request without a body to the duplicate endpoint', async () => {
    const data = { id_plantilla: 12 }
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(data) })

    await expect(duplicarPlantilla(10)).resolves.toEqual(data)

    expect(apiRequest).toHaveBeenCalledWith('/api/plantillas/10/duplicar/', { method: 'POST' })
  })

  it('propagates the exact backend error text on a non-ok response', async () => {
    const detail = 'La plantilla no tiene tareas activas y no se puede duplicar.'
    apiRequest.mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ detail }) })

    const error = await duplicarPlantilla(10).catch((error) => error)

    expect(error.message).toBe(detail)
  })
})
