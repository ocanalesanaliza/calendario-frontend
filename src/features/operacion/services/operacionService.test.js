import { describe, expect, it, vi } from 'vitest'
import { getMisTareas, registrarTarea } from './operacionService'

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

  it('flattens nested API errors while preserving the structured response fields', async () => {
    const data = { detail: { errors: [{ message: 'Inventory branch tasks must be completed through the structured inventory flow.' }] } }
    apiRequest.mockResolvedValue({ ok: false, status: 400, json: vi.fn().mockResolvedValue(data) })

    await expect(registrarTarea({})).rejects.toMatchObject({
      status: 400,
      message: 'Inventory branch tasks must be completed through the structured inventory flow.',
      fields: data,
    })
  })
})
