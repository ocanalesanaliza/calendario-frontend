import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTareas } from './tareasService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('tareasService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('requests the catalog filtered by scope when provided', async () => {
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ results: [] }) })

    await expect(getTareas('sucursal')).resolves.toEqual([])

    expect(apiRequest).toHaveBeenCalledWith('/api/tareas/?ambito=sucursal')
  })

  it('preserves the unfiltered endpoint for existing consumers', async () => {
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ results: [] }) })

    await getTareas()

    expect(apiRequest).toHaveBeenCalledWith('/api/tareas/')
  })
})
