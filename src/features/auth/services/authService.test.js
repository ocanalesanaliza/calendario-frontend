import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentProfile, normalizeCurrentProfile } from './authService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('getCurrentProfile', () => {
  beforeEach(() => apiRequest.mockReset())

  it('unwraps the HTTP profile envelope before returning it to AuthContext', async () => {
    const profile = { id: 7, nombre: 'Ana', type: 'gerente_area', can_access_my_tasks: true }
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ perfil: profile }) })

    await expect(getCurrentProfile()).resolves.toEqual(profile)
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/me/')
  })

  it('accepts the temporary flat response contract', () => {
    const profile = { id: 7, nombre: 'Ana', type: 'gerente_area' }

    expect(normalizeCurrentProfile(profile)).toBe(profile)
  })
})
