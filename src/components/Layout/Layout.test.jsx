import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from './Layout'

const { useAuth, getTrabajosCampo, getCoberturas, getSolicitudesVacacion } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getTrabajosCampo: vi.fn(),
  getCoberturas: vi.fn(),
  getSolicitudesVacacion: vi.fn(),
}))

const capabilityModuleLabels = ['Sucursales', 'Usuarios', 'Plantillas', 'Situaciones especiales', 'Dashboard', 'Reportes']

vi.mock('../../features/auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../features/trabajosCampo/services/trabajosCampoService', () => ({ getTrabajosCampo }))
vi.mock('../../features/coberturas/services/coberturasService', () => ({ getCoberturas }))
vi.mock('../../features/vacacionesProgramadas/services/vacacionesProgramadasService', () => ({ getSolicitudesVacacion }))

describe('Layout Mis tareas navigation', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() },
    })
    useAuth.mockReset()
    getTrabajosCampo.mockReset()
    getCoberturas.mockReset()
    getSolicitudesVacacion.mockReset()
    getTrabajosCampo.mockResolvedValue({ results: [] })
    getCoberturas.mockResolvedValue({ results: [] })
    getSolicitudesVacacion.mockResolvedValue({ results: [] })
  })

  it('shows only the Systems management menu for an active Systems account that was previously a GA', () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true, can_access_my_tasks: true }, logout: vi.fn() })

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByTitle('Mis tareas')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Depósitos pendientes')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Calendario del área')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Mi almuerzo')).not.toBeInTheDocument()
    expect(screen.getByTitle('Áreas')).toBeInTheDocument()
    expect(screen.getByTitle('Gerentes de área')).toBeInTheDocument()
    expect(screen.getByTitle('Gerentes de operaciones')).toBeInTheDocument()
  })

  it('shows the six capability-controlled modules to a Systems master admin with granted capabilities', () => {
    useAuth.mockReturnValue({
      perfil: {
        type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true,
        capabilities: {
          has_global_scope: true,
          manage_branches: true,
          manage_users: true,
          manage_templates: true,
          manage_special_situations: true,
          access_operational_dashboard: true,
          access_performance_reports: true,
        },
      },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route>
        </Routes>
      </MemoryRouter>,
    )

    capabilityModuleLabels.forEach((label) => {
      expect(screen.getByTitle(label)).toBeInTheDocument()
    })
  })

  it('hides the six capability-controlled modules from a Systems profile without master admin or capabilities', () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: false }, logout: vi.fn() })

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route>
        </Routes>
      </MemoryRouter>,
    )

    capabilityModuleLabels.forEach((label) => {
      expect(screen.queryByTitle(label)).not.toBeInTheDocument()
    })
  })

  it('shows Depósitos pendientes only for an area manager', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' }, logout: vi.fn() })

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTitle('Depósitos pendientes')).toBeInTheDocument()
    expect(screen.getByTitle('Calendario del área')).toBeInTheDocument()
    expect(screen.getByTitle('Mi almuerzo')).toBeInTheDocument()
  })

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['GS', { type: 'gerente_sucursal', can_access_my_tasks: true }],
  ])('oculta Revisiones de guardia para %s', (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.queryByTitle('Revisiones de guardia')).not.toBeInTheDocument()
  })

  it('muestra Revisiones de guardia únicamente al administrador maestro', () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.getByTitle('Revisiones de guardia')).toHaveAttribute('href', '/analitica/revisiones-guardia')
  })
})
