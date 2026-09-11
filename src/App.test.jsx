import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminMaestroRoute, AlmuerzosRoute, CalendarioAreaRoute, CapabilityRoute, DepositosPendientesRoute, GerentesOperacionesRoute, MisTareasRoute, PlantillasAreaRoute, RendimientoRoute } from './App'

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

  it('redirects a Systems account even when an obsolete profile grants the capability', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true, can_access_my_tasks: true } })
    renderMisTareasRoute()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
  })
})

describe('Sistemas-only routes', () => {
  beforeEach(() => useAuth.mockReset())

  it('allows an active Systems account to manage operations managers', () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true } })
    render(
      <MemoryRouter initialEntries={['/gerentes-operaciones']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><p>Gestión GO</p></GerentesOperacionesRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Gestión GO')).toBeInTheDocument()
  })

  it('blocks lunch for a Systems account that was previously a GA', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true } })
    render(
      <MemoryRouter initialEntries={['/almuerzos']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/almuerzos" element={<AlmuerzosRoute><p>Almuerzo autorizado</p></AlmuerzosRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Almuerzo autorizado')).not.toBeInTheDocument()
  })
})

describe('CapabilityRoute', () => {
  beforeEach(() => useAuth.mockReset())

  const managedModules = [
    ['Sucursales', 'canManageBranches', 'manage_branches'],
    ['Usuarios', 'canManageUsers', 'manage_users'],
    ['Plantillas', 'canManageTemplates', 'manage_templates'],
    ['Situaciones especiales', 'canManageSpecialSituations', 'manage_special_situations'],
    ['Dashboard', 'canAccessOperationalDashboard', 'access_operational_dashboard'],
    ['Reportes', 'canAccessPerformanceReports', 'access_performance_reports'],
  ]

  function renderCapabilityRoute(capability) {
    render(
      <MemoryRouter initialEntries={['/modulo']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/modulo" element={<CapabilityRoute capability={capability}><p>Módulo autorizado</p></CapabilityRoute>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it.each(managedModules)('allows %s when its capability is granted', (_, capability, profileCapability) => {
    useAuth.mockReturnValue({ perfil: { capabilities: { [profileCapability]: true } } })
    renderCapabilityRoute(capability)

    expect(screen.getByText('Módulo autorizado')).toBeInTheDocument()
  })

  it.each(managedModules)('denies %s by default when its capability is absent', async (_, capability) => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: false } })
    renderCapabilityRoute(capability)

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Módulo autorizado')).not.toBeInTheDocument()
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
    ['Sistemas+Admin Maestro con scope global', { type: 'sistemas', capabilities: { has_global_scope: true } }],
  ])('permite consultar rendimiento al %s', (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil })
    render(
      <MemoryRouter initialEntries={['/rendimiento?id_usuario=27']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/rendimiento" element={<RendimientoRoute><p>Detalle permitido</p></RendimientoRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Detalle permitido')).toBeInTheDocument()
  })

  it('rechaza perfiles sin acceso al rendimiento', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas' } })
    render(
      <MemoryRouter initialEntries={['/rendimiento?id_usuario=27']}>
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

describe('AdminMaestroRoute', () => {
  beforeEach(() => useAuth.mockReset())

  it('permite la analítica al administrador maestro', () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    render(<MemoryRouter><AdminMaestroRoute><p>Analítica de guardias</p></AdminMaestroRoute></MemoryRouter>)
    expect(screen.getByText('Analítica de guardias')).toBeInTheDocument()
  })

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['GS', { type: 'gerente_sucursal' }],
  ])('redirige al %s', async (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil })
    render(
      <MemoryRouter initialEntries={['/analitica/revisiones-guardia']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/analitica/revisiones-guardia" element={<AdminMaestroRoute><p>Analítica de guardias</p></AdminMaestroRoute>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Analítica de guardias')).not.toBeInTheDocument()
  })
})

describe('PlantillasAreaRoute', () => {
  beforeEach(() => useAuth.mockReset())

  function renderPlantillasAreaRoute() {
    render(
      <MemoryRouter initialEntries={['/plantillas-area']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/plantillas-area" element={<PlantillasAreaRoute><p>Plantillas de área autorizadas</p></PlantillasAreaRoute>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it.each([
    ['una cuenta activa de Sistemas', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true }],
    ['un administrador maestro', { es_admin_maestro: true }],
  ])('permite el acceso a %s', (_, perfil) => {
    useAuth.mockReturnValue({ perfil })
    renderPlantillasAreaRoute()

    expect(screen.getByText('Plantillas de área autorizadas')).toBeInTheDocument()
  })

  it('redirige a un perfil no autorizado', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    renderPlantillasAreaRoute()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Plantillas de área autorizadas')).not.toBeInTheDocument()
  })
})
