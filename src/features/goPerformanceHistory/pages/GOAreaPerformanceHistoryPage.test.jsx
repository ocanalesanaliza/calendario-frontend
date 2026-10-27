import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GOAreaPerformanceHistoryPage from './GOAreaPerformanceHistoryPage'

const service = vi.hoisted(() => ({ getGOAuthorizedAreas: vi.fn(), getGOAreaPerformanceHistory: vi.fn() }))
vi.mock('../services/goPerformanceHistoryService', () => service)

const areas = [
  { id: 7, codigo: 'NORTE', nombre: 'Área Norte', activo: true },
  { id: 8, codigo: 'SUR', nombre: 'Área Sur', activo: false },
]

const row = ({ kind = 'definitive', state = 'closed', percentage = '75', version = 4, responsibility = { id: 1, ga_profile_id: 2, starts_on: '2026-01-15', ends_on: null } } = {}) => ({
  area: { id: 7, codigo: 'NORTE', nombre: 'Área Norte' },
  responsibility,
  period: '2026-10',
  performance: { kind, state, version, expected_weight: state === 'not_applicable' ? '0' : '20', credited_weight: state === 'not_applicable' ? '0' : '15', percentage: state === 'not_applicable' ? null : percentage, as_of: '2026-10-27T10:30:00Z', snapshot_id: 'never-render-this' },
})

describe('GOAreaPerformanceHistoryPage', () => {
  beforeEach(() => {
    service.getGOAuthorizedAreas.mockReset()
    service.getGOAreaPerformanceHistory.mockReset()
    service.getGOAuthorizedAreas.mockResolvedValue({ scope: {}, results: areas })
    service.getGOAreaPerformanceHistory.mockResolvedValue({ scope: {}, results: [row()], next_cursor: null })
  })

  it('uses the range-authorized selector, identifies an inactive Area, and renders segmented read-only history', async () => {
    render(<GOAreaPerformanceHistoryPage />)

    await screen.findByText('Desde 2026-01-15 · Vigente')
    expect(service.getGOAuthorizedAreas).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: expect.any(String), toMonth: expect.any(String) }))
    expect(screen.getByRole('option', { name: /Área Sur.*Inactiva/ })).toBeInTheDocument()
    expect(screen.getByText('Definitivo')).toBeInTheDocument()
    expect(screen.getByText('Versión 4')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('never-render-this')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /corregir|aprobar|confirmar|reconocer/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/alerta|recibo|auditoría/i)).not.toBeInTheDocument()
  })

  it('renders backend responsibility date ranges without rendering the raw object', async () => {
    const backendResponsibility = { id: 1, ga_profile_id: 2, starts_on: '2026-01-15', ends_on: null }
    service.getGOAreaPerformanceHistory.mockResolvedValueOnce({
      scope: {},
      results: [row({ responsibility: backendResponsibility })],
      next_cursor: null,
    })

    expect(() => render(<GOAreaPerformanceHistoryPage />)).not.toThrow()

    expect(await screen.findByText('Desde 2026-01-15 · Vigente')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    expect(screen.getAllByText('NORTE · Área Norte')).toHaveLength(2)
    expect(screen.getByText('octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Definitivo')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('falls back safely when a backend responsibility has no date fields', async () => {
    service.getGOAreaPerformanceHistory.mockResolvedValueOnce({
      scope: {},
      results: [row({ responsibility: { id: 1, ga_profile_id: 2 } })],
      next_cursor: null,
    })

    expect(() => render(<GOAreaPerformanceHistoryPage />)).not.toThrow()

    expect(await screen.findByText('Responsabilidad sin fechas disponibles')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })

  it('validates an invalid month range before requesting either the selector or history again', async () => {
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Desde 2026-01-15 · Vigente')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2024-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))

    expect(await screen.findByText(/El rango debe ser menor de 24 meses/)).toBeInTheDocument()
    expect(service.getGOAuthorizedAreas).toHaveBeenCalledTimes(1)
    expect(service.getGOAreaPerformanceHistory).toHaveBeenCalledTimes(1)
  })

  it('preserves opaque cursors and distinguishes provisional data from definitive N/A rows', async () => {
    service.getGOAreaPerformanceHistory
      .mockResolvedValueOnce({ scope: {}, results: [row({ kind: 'provisional', state: 'not_applicable', version: null })], next_cursor: 'opaque+/cursor' })
      .mockResolvedValueOnce({ scope: {}, results: [row({ kind: 'definitive', state: 'not_applicable', version: 4 })], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)

    expect(await screen.findByText('Provisional')).toBeInTheDocument()
    expect(screen.getAllByText('No aplica').length).toBeGreaterThan(0)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(service.getGOAreaPerformanceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'opaque+/cursor' })))
    expect(screen.getByText('Versión 4')).toBeInTheDocument()
  })

  it('provides loading, empty, neutral authorization error, keyboard focus and responsive reduced-motion structure', async () => {
    let resolveAreas
    service.getGOAuthorizedAreas.mockImplementationOnce(() => new Promise((resolve) => { resolveAreas = resolve }))
    render(<GOAreaPerformanceHistoryPage />)

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    await waitFor(() => expect(resolveAreas).toEqual(expect.any(Function)))
    resolveAreas({ scope: {}, results: areas })
    await screen.findByText('Desde 2026-01-15 · Vigente')
    expect(document.querySelector('.go-area-performance-history')).toHaveClass('tema-analiza')
    expect(document.querySelector('.go-area-performance-history')).toHaveAttribute('data-responsive-breakpoints', '375 768 1024 1440')
    expect(screen.getByLabelText('Resultados del historial de rendimiento de áreas')).toHaveAttribute('tabindex', '0')

    service.getGOAreaPerformanceHistory.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }))
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))
    expect(await screen.findByText(/El servidor mantiene la autorización/)).toBeInTheDocument()
  })
})
