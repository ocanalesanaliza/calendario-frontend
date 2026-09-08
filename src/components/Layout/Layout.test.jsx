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
    getSolicitudesVacacion.mockResolvedValue({ results: [] })
  })

  it('hides Mis tareas for a Systems account without the capability', () => {
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true, can_access_my_tasks: false }, logout: vi.fn() })

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
  })
})
