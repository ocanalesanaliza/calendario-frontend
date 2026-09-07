import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MisTareasRoute } from './App'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('./features/auth/context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth,
}))

function renderMisTareasRoute() {
  render(
    <MemoryRouter initialEntries={['/mis-tareas']}>
      <Routes>
        <Route path="/" element={<p>Inicio</p>} />
        <Route path="/mis-tareas" element={<MisTareasRoute><p>Mis tareas autorizadas</p></MisTareasRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MisTareasRoute', () => {
  beforeEach(() => useAuth.mockReset())

  it('redirects a Systems account without the capability', async () => {
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true, can_access_my_tasks: false } })
    renderMisTareasRoute()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Mis tareas autorizadas')).not.toBeInTheDocument()
  })

  it.each([
    ['a branch manager', { type: 'gerente_sucursal', can_access_my_tasks: true }],
    ['a non-Systems master admin', { es_admin_maestro: true, es_cuenta_sistemas: false, can_access_my_tasks: true }],
  ])('allows %s when the capability is granted', (_, perfil) => {
    useAuth.mockReturnValue({ perfil })
    renderMisTareasRoute()

    expect(screen.getByText('Mis tareas autorizadas')).toBeInTheDocument()
  })
})
