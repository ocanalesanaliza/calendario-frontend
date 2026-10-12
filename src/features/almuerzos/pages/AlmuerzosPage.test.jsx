import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlmuerzosPage from './AlmuerzosPage'

const { getMiAlmuerzo, activarAlmuerzo, cerrarAlmuerzo, getDashboardAlmuerzos } = vi.hoisted(() => ({
  getMiAlmuerzo: vi.fn(), activarAlmuerzo: vi.fn(), cerrarAlmuerzo: vi.fn(), getDashboardAlmuerzos: vi.fn(),
}))
let perfil = { type: 'gerente_sucursal' }

vi.mock('../services/almuerzosService', () => ({ getMiAlmuerzo, activarAlmuerzo, cerrarAlmuerzo, getDashboardAlmuerzos }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth: () => ({ perfil }) }))

const lunch = { fecha: '2026-09-07', estado: 'no_iniciado', puede_activar: true }

describe('AlmuerzosPage', () => {
  beforeEach(() => {
    perfil = { type: 'gerente_sucursal' }
    getMiAlmuerzo.mockReset().mockResolvedValue(lunch)
    activarAlmuerzo.mockReset().mockResolvedValue({})
    cerrarAlmuerzo.mockReset().mockResolvedValue({})
    getDashboardAlmuerzos.mockReset().mockResolvedValue({ results: [] })
  })

  it('shows only the personal lunch section for a branch manager', async () => {
    render(<AlmuerzosPage />)

    expect(await screen.findByRole('heading', { name: 'Mi almuerzo' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Equipo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard almuerzos' })).not.toBeInTheDocument()
    expect(getDashboardAlmuerzos).not.toHaveBeenCalled()
  })

  it('shows personal lunch by default and defers the dashboard for an area manager', async () => {
    perfil = { type: 'gerente_area' }
    getDashboardAlmuerzos.mockResolvedValue({ results: [{ id_almuerzo: 1, usuario: { nombre: 'Ana' }, sucursal_actual: { nombre: 'Centro' }, estado: 'finalizado', fecha: '2026-09-07', duracion_minutos: 30 }] })

    render(<AlmuerzosPage />)

    expect(await screen.findByRole('heading', { name: 'Mi almuerzo' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mi almuerzo' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Equipo' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.queryByRole('heading', { name: 'Dashboard almuerzos' })).not.toBeInTheDocument()
    expect(getDashboardAlmuerzos).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: 'Equipo' }))

    expect(await screen.findByText('Centro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /almuerzo de Ana/i })).not.toBeInTheDocument()
    expect(getDashboardAlmuerzos).toHaveBeenCalledTimes(1)
  })

  it('refreshes the area dashboard after a personal action', async () => {
    perfil = { type: 'gerente_area' }

    render(<AlmuerzosPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar almuerzo' }))

    await waitFor(() => expect(activarAlmuerzo).toHaveBeenCalledWith())
    await waitFor(() => expect(getMiAlmuerzo).toHaveBeenCalledTimes(2))
    expect(getDashboardAlmuerzos).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: 'Equipo' }))

    await waitFor(() => expect(getDashboardAlmuerzos).toHaveBeenCalledTimes(1))
  })

  it('keeps team dashboard filters and errors within the Equipo tab', async () => {
    perfil = { type: 'gerente_area' }
    getDashboardAlmuerzos.mockRejectedValue(new Error('No se pudo cargar el equipo.'))

    render(<AlmuerzosPage />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Equipo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el equipo.')

    getDashboardAlmuerzos.mockResolvedValue({ results: [] })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en_almuerzo' } })

    await waitFor(() => expect(getDashboardAlmuerzos).toHaveBeenLastCalledWith({ estado: 'en_almuerzo' }))
  })

  it('displays personal API errors instead of treating them as empty state', async () => {
    getMiAlmuerzo.mockRejectedValue(new Error('No se pudo cargar el almuerzo.'))

    render(<AlmuerzosPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el almuerzo.')
  })
})
