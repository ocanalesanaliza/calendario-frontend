import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlmuerzosRoute } from '../../App'
import Layout from './Layout'

const { useAuth, getTrabajosCampo, getCoberturas, getSolicitudesVacacion } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getTrabajosCampo: vi.fn(),
  getCoberturas: vi.fn(),
  getSolicitudesVacacion: vi.fn(),
}))

const capabilityModuleLabels = ['Sucursales', 'Usuarios', 'Plantillas', 'Situaciones especiales', 'Status', 'Reportes']

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

    expect(screen.queryByRole('link', { name: 'Mis tareas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Depósitos pendientes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario del área' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mi almuerzo' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Áreas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gerentes de área' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gerentes de operaciones' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Organización' })).toHaveAttribute('href', '/organizacion')
    expect(screen.getByRole('link', { name: 'Admin Masters' })).toHaveAttribute('href', '/admin-master-asignaciones')
  })

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['GO', { type: 'gerente_operaciones', activo: true, habilitado: true }],
    ['GS', { type: 'gerente_sucursal' }],
    ['Administrador Maestro', { es_admin_maestro: true, activo: true, habilitado: true }],
    ['disabled Systems account', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: false }],
    ['inactive Systems account', { type: 'sistemas', es_cuenta_sistemas: true, activo: false, habilitado: true }],
  ])('hides Admin Masters from %s', (_name, perfil) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.queryByRole('link', { name: 'Admin Masters' })).not.toBeInTheDocument()
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
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    })
  })

  it('hides Mi almuerzo for an Admin Master while keeping Calendario del área hidden and the lunch route available', () => {
    localStorage.getItem.mockReturnValue('0')
    useAuth.mockReturnValue({
      perfil: {
        type: 'admin_master',
        capabilities: { manage_branches: true },
      },
      logout: vi.fn(),
    })

    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.getByText('Admin Master')).toBeInTheDocument()
    expect(screen.queryByText('Mi almuerzo')).not.toBeInTheDocument()
    expect(screen.queryByText('Calendario del área')).not.toBeInTheDocument()
    expect(screen.getByText('Sucursales').closest('a')).toHaveAttribute('href', '/sucursales')
    ;['Admin Masters', 'Áreas', 'Usuarios', 'Plantillas', 'Rendimiento', 'Status', 'Reportes', 'Revisiones de guardia', 'Configuración'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    })

    render(
      <MemoryRouter initialEntries={['/almuerzos']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/almuerzos" element={<AlmuerzosRoute><p>Almuerzo autorizado</p></AlmuerzosRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Almuerzo autorizado')).toBeInTheDocument()
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
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: 'Organización' })).not.toBeInTheDocument()
  })

  it('hides the restricted navigation entries for an area manager', () => {
    useAuth.mockReturnValue({
      perfil: {
        type: 'gerente_area',
        can_access_my_tasks: true,
        capabilities: { manage_branches: true },
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

    expect(screen.queryByRole('link', { name: 'Mis tareas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Depósitos pendientes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Conteo de inventario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tareas' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Calendario del área' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi almuerzo' })).toBeInTheDocument()
  })

  it('keeps the navigation entries available to a non-area-manager profile with the same capabilities', () => {
    useAuth.mockReturnValue({
      perfil: {
        type: 'gerente_sucursal',
        can_access_my_tasks: true,
        capabilities: { manage_branches: true },
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

    expect(screen.getByRole('link', { name: 'Mis tareas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitudes pendientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conteo de inventario' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tareas' })).toBeInTheDocument()
  })

  it.each([
    ['Systems', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true }],
    ['Admin Master', { type: 'admin_master' }],
  ])('uses the pending-request capability to show Solicitudes pendientes to %s', (_role, perfil) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.getByTitle('Solicitudes pendientes')).toHaveAttribute('href', '/solicitudes-pendientes')
  })

  it.each([
    ['GA', { type: 'gerente_area' }, true],
    ['GO', { type: 'gerente_operaciones', activo: true, habilitado: true }, true],
    ['active Systems', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true }, true],
    ['plain Admin Master', { type: 'admin_master' }, true],
    ['global Admin Master', { es_admin_maestro: true }, true],
    ['GS', { type: 'gerente_sucursal' }, false],
    ['disabled Systems', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: false }, false],
  ])('uses the area-absence capability to show navigation to %s', (_role, perfil, visible) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    if (visible) expect(screen.getByTitle('Vacaciones y situaciones del área')).toHaveAttribute('href', '/ausencias-area')
    else expect(screen.queryByTitle('Vacaciones y situaciones del área')).not.toBeInTheDocument()
  })

  it('hides Mis tareas and Solicitudes pendientes for an operations manager while preserving Áreas', () => {
    useAuth.mockReturnValue({
      perfil: {
        type: 'gerente_operaciones',
        activo: true,
        habilitado: true,
        can_access_my_tasks: true,
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

    expect(screen.queryByRole('link', { name: 'Mis tareas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Solicitudes pendientes' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Áreas' })).toBeInTheDocument()
  })

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['GS', { type: 'gerente_sucursal', can_access_my_tasks: true }],
  ])('oculta Revisiones de guardia para %s', (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Revisiones de guardia' })).not.toBeInTheDocument()
  })

  it('muestra Revisiones de guardia únicamente al administrador maestro', () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Revisiones de guardia' })).toHaveAttribute('href', '/analitica/revisiones-guardia')
  })

  it('inicia siempre con el menú contraído, aunque antes se haya dejado expandido', () => {
    globalThis.localStorage.getItem.mockReturnValue('0')
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', nombre: 'Gerente' }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('menu-lateral')).toHaveClass('sidebar-collapsed')
    expect(screen.getByTitle('Calendario del área')).toHaveAttribute('href', '/calendario-area')
  })

  it('expande y vuelve a contraer el menú lateral desde el botón de menú de la barra superior', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', nombre: 'Gerente' }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    const boton = screen.getByRole('button', { name: 'Expandir menú' })
    expect(boton.closest('header')).toHaveClass('topbar')
    fireEvent.click(boton)

    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Calendario del área')).toHaveClass('nav-item-label')
    expect(document.getElementById('menu-lateral')).not.toHaveClass('sidebar-collapsed')

    fireEvent.click(screen.getByRole('button', { name: 'Contraer menú' }))
    expect(document.getElementById('menu-lateral')).toHaveClass('sidebar-collapsed')
    expect(document.querySelector('.sidebar-toggle')).toBeNull()
  })

  it('no muestra Calendario Tuvet en el menú y ofrece Cambiar de empresa a Sistemas', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true, nombre: 'Sistemas' }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.queryByRole('link', { name: 'Calendario Tuvet' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Menú de Sistemas' }))
    expect(screen.getByRole('menuitem', { name: 'Cambiar de empresa' })).toBeInTheDocument()
  })

  it('no ofrece Cambiar de empresa a perfiles que no son de Sistemas', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', nombre: 'Gerente' }, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Menú de Gerente' }))
    expect(screen.queryByRole('menuitem', { name: 'Cambiar de empresa' })).not.toBeInTheDocument()
  })

  it.each([
    ['GO', { type: 'gerente_operaciones', activo: true, habilitado: true }],
    ['Administrador Maestro', { es_admin_maestro: true, activo: true, habilitado: true }],
  ])('hides Organización from a non-Systems %s', (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil, logout: vi.fn() })
    render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)

    expect(screen.queryByRole('link', { name: 'Organización' })).not.toBeInTheDocument()
  })
})
