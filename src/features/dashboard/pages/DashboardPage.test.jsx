import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data) => ({ ok: true, status: 200, json: async () => data })

function Destino() {
  const location = useLocation()
  return <p>Destino: {location.pathname}{location.search}</p>
}

function tarjeta(overrides = {}) {
  return {
    id_usuario: 12,
    nombre_usuario: 'GS Ana',
    sucursal: 'Centro',
    estado: 'activo',
    estado_operativo_label: 'Jornada mañana',
    rendimiento_hoy: '85.00',
    trabajo_campo: { estado: 'aceptado', jornada: 'manana' },
    detalle_rendimiento: {
      disponible: true,
      id_usuario: 12,
      modo: 'solo_lectura',
      puede_registrar_tareas: false,
    },
    ...overrides,
  }
}

function renderDashboard(results = [tarjeta()], meta = { requiere_filtro: false, mensaje: '', resumen_areas: [] }) {
  apiRequest.mockResolvedValue(response({
    count: results.length,
    results,
    meta,
  }))

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/rendimiento" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardPage: acceso al detalle de rendimiento', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
  })

  it('abre la pantalla de rendimiento con el id_usuario de la tarjeta', async () => {
    renderDashboard([tarjeta({ detalle_rendimiento: {
      disponible: true,
      id_usuario: 12,
      modo: 'solo_lectura',
      puede_registrar_tareas: false,
    } })])

    fireEvent.click(await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' }))

    expect(await screen.findByText('Destino: /rendimiento?id_usuario=12')).toBeInTheDocument()
  })

  it('no convierte la tarjeta en acción cuando el detalle no está disponible', async () => {
    renderDashboard([tarjeta({ detalle_rendimiento: { disponible: false, id_usuario: 12 } })])

    await screen.findByText('GS Ana')
    expect(screen.queryByRole('button', { name: 'Ver rendimiento de GS Ana' })).not.toBeInTheDocument()
  })

  it('muestra la inhabilitación dominical sin rendimiento y conserva el acceso al detalle', async () => {
    renderDashboard([tarjeta({
      rendimiento_hoy: '0.00',
      operacion_habilitada: false,
      motivo_no_disponible: 'operacion_dominical_no_habilitada',
    })])

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('Operación dominical no habilitada')).toBeInTheDocument()
    expect(within(card).queryByText('0%')).not.toBeInTheDocument()
    expect(card.querySelector('.score-bar-bg')).not.toBeInTheDocument()

    fireEvent.click(card)
    expect(await screen.findByText('Destino: /rendimiento?id_usuario=12')).toBeInTheDocument()
  })

  it('conserva el contenido operativo y el rendimiento de una tarjeta elegible', async () => {
    renderDashboard()

    const card = await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' })
    expect(within(card).getByText('Activo')).toBeInTheDocument()
    expect(within(card).getByText('Jornada mañana')).toBeInTheDocument()
    expect(within(card).getByText(/Trabajo de campo \(autorizado\) — Mañana/)).toBeInTheDocument()
    expect(within(card).getByText('85%')).toBeInTheDocument()
    expect(card.querySelector('.score-bar-bg')).toBeInTheDocument()
  })

  it('conserva el filtro y el estado vacío', async () => {
    apiRequest.mockResolvedValueOnce(response({
      count: 1,
      results: [tarjeta()],
      meta: { requiere_filtro: false, mensaje: '', resumen_areas: [] },
    })).mockResolvedValueOnce(response({
      count: 0,
      results: [],
      meta: { requiere_filtro: false, mensaje: '', resumen_areas: [] },
    }))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rendimiento" element={<Destino />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('GS Ana')
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, email, sucursal o área...'), { target: { value: 'Ana' } })

    expect(await screen.findByText('Sin resultados para los filtros aplicados.')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenLastCalledWith('/api/dashboard-operativo/usuarios/?buscar=Ana')
  })
})
