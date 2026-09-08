import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMonthlyAreaOccurrences } from './calendarioAreaService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('calendarioAreaService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('requests monthly occurrences with the selected month', async () => {
    const payload = { month: '2026-09', timezone: 'America/Tegucigalpa', occurrences: [] }
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(payload) })

    await expect(getMonthlyAreaOccurrences('2026-09')).resolves.toEqual(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/calendar/my-area/monthly-occurrences/?month=2026-09')
  })

  it('preserves the API error detail', async () => {
    apiRequest.mockResolvedValue({ ok: false, json: vi.fn().mockResolvedValue({ detail: 'Mes inválido.' }) })

    await expect(getMonthlyAreaOccurrences('invalid')).rejects.toThrow('Mes inválido.')
  })
})
