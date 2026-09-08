import { fireEvent, render, screen } from '@testing-library/react'
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

function renderDashboard(detalleRendimiento) {
  apiRequest.mockResolvedValue(response({
    count: 1,
    results: [{
      id_usuario: 12,
      nombre_usuario: 'GS Ana',
      sucursal: 'Centro',
      rendimiento_hoy: '85.00',
      detalle_rendimiento: detalleRendimiento,
    }],
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
}

describe('DashboardPage: acceso al detalle de rendimiento', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
  })

  it('abre la pantalla de rendimiento con el id_usuario de la tarjeta', async () => {
    renderDashboard({
      disponible: true,
      id_usuario: 12,
      modo: 'solo_lectura',
      puede_registrar_tareas: false,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Ver rendimiento de GS Ana' }))

    expect(await screen.findByText('Destino: /rendimiento?id_usuario=12')).toBeInTheDocument()
  })

  it('no convierte la tarjeta en acción cuando el detalle no está disponible', async () => {
    renderDashboard({ disponible: false, id_usuario: 12 })

    await screen.findByText('GS Ana')
    expect(screen.queryByRole('button', { name: 'Ver rendimiento de GS Ana' })).not.toBeInTheDocument()
  })
})
