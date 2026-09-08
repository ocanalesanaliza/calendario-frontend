import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarioAreaRoute, DepositosPendientesRoute, MisTareasRoute, RendimientoRoute } from './App'

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

describe('DepositosPendientesRoute', () => {
  function renderDepositosPendientesRoute() {
    render(
      <MemoryRouter initialEntries={['/depositospendientes']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/depositospendientes" element={<DepositosPendientesRoute><p>Depósitos autorizados</p></DepositosPendientesRoute>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(() => useAuth.mockReset())

  it('allows only an area manager', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    renderDepositosPendientesRoute()

    expect(screen.getByText('Depósitos autorizados')).toBeInTheDocument()
  })

  it.each([
    { type: 'gerente_sucursal' },
    { type: 'gerente_operaciones' },
    { es_admin_maestro: true },
  ])('redirects other profiles to home', async (perfil) => {
    useAuth.mockReturnValue({ perfil })
    renderDepositosPendientesRoute()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Depósitos autorizados')).not.toBeInTheDocument()
  })
})

describe('CalendarioAreaRoute', () => {
  function renderCalendarioAreaRoute() {
    render(
      <MemoryRouter initialEntries={['/calendario-area']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/calendario-area" element={<CalendarioAreaRoute><p>Calendario autorizado</p></CalendarioAreaRoute>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(() => useAuth.mockReset())

  it('allows only an area manager', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    renderCalendarioAreaRoute()

    expect(screen.getByText('Calendario autorizado')).toBeInTheDocument()
  })

  it('redirects other profiles to home', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_sucursal' } })
    renderCalendarioAreaRoute()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
     expect(screen.queryByText('Calendario autorizado')).not.toBeInTheDocument()
  })
})
describe('RendimientoRoute', () => {
  beforeEach(() => useAuth.mockReset())

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['GS', { type: 'gerente_sucursal' }],
  ])('permite consultar rendimiento al %s', (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil })
    render(
      <MemoryRouter initialEntries={['/rendimiento?id_usuario=12']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/rendimiento" element={<RendimientoRoute><p>Detalle permitido</p></RendimientoRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Detalle permitido')).toBeInTheDocument()
  })

  it('rechaza perfiles sin acceso al rendimiento', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_operaciones' } })
    render(
      <MemoryRouter initialEntries={['/rendimiento?id_usuario=12']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/rendimiento" element={<RendimientoRoute><p>Detalle permitido</p></RendimientoRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Detalle permitido')).not.toBeInTheDocument()
  })
})
