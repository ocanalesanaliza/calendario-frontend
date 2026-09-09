import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const { apiRequest, getAccessToken } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  getAccessToken: vi.fn(),
}))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../../services/tokenStorage', () => ({
  clearTokens: vi.fn(),
  getAccessToken,
  setTokens: vi.fn(),
}))

function ProfileProbe() {
  const { perfil, perfilLoading } = useAuth()
  return <><p>{perfil?.type ?? 'sin perfil'}</p><p>{String(perfilLoading)}</p></>
}

describe('AuthContext', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem: vi.fn() },
    })
    getAccessToken.mockReset().mockReturnValue('access-token')
    apiRequest.mockReset().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ perfil: { type: 'gerente_area', can_access_my_tasks: true } }),
    })
  })

  it('hydrates a flat profile from the wrapped /api/auth/me/ HTTP response', async () => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('gerente_area')).toBeInTheDocument())
    expect(screen.getByText('false')).toBeInTheDocument()
    expect(getAccessToken).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/me/')
  })

  it('replaces an obsolete area-manager token profile with the current Systems profile', async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true } }),
    })

    render(<AuthProvider><ProfileProbe /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('sistemas')).toBeInTheDocument())
  })
})
