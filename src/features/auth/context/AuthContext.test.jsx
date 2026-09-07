import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const { decodeToken, getAccessToken } = vi.hoisted(() => ({
  decodeToken: vi.fn(),
  getAccessToken: vi.fn(),
}))

vi.mock('../services/authService', () => ({ decodeToken }))
vi.mock('../../../services/tokenStorage', () => ({
  clearTokens: vi.fn(),
  getAccessToken,
  setTokens: vi.fn(),
}))

function ProfileProbe() {
  const { perfil, revokeMyTasksAccess } = useAuth()
  return <><p>{String(perfil.can_access_my_tasks)}</p><button onClick={revokeMyTasksAccess}>Revocar</button></>
}

describe('AuthContext', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem: vi.fn() },
    })
    getAccessToken.mockReset().mockReturnValue('access-token')
    decodeToken.mockReset().mockReturnValue({ perfil: { can_access_my_tasks: true } })
  })

  it('removes Mis tareas access from the in-memory profile without changing the token', () => {
    render(<AuthProvider><ProfileProbe /></AuthProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }))

    expect(screen.getByText('false')).toBeInTheDocument()
    expect(getAccessToken).toHaveBeenCalledTimes(1)
    expect(decodeToken).toHaveBeenCalledTimes(1)
  })
})
