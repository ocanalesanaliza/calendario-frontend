import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SystemsPerformanceHistoryPage from './SystemsPerformanceHistoryPage'

const service = vi.hoisted(() => ({ getPerformanceHistory: vi.fn(), getAreas: vi.fn() }))
vi.mock('../services/performanceHistoryService', () => ({ getPerformanceHistory: service.getPerformanceHistory }))
vi.mock('../../areas/services/areasService', () => ({ getAreas: service.getAreas }))

const areas = [{ id_area: 7, codigo: 'NORTE', nombre: 'Área Norte', activo: true }, { id_area: 8, codigo: 'SUR', nombre: 'Área Sur', activo: false }]
const result = (kind = 'definitive', state = 'closed') => ({
  area: { codigo: 'NORTE', nombre: 'Área Norte' }, responsibility: { nombre: 'Responsable' }, period: '2026-10',
  performance: { kind, state, version: 4, expected_weight: '20', credited_weight: '15', percentage: kind === 'provisional' ? null : '75', as_of: '2026-10-25T10:30:00Z', snapshot_id: 'never-render-this' },
})

function renderPage() { return render(<MemoryRouter><SystemsPerformanceHistoryPage /></MemoryRouter>) }

describe('SystemsPerformanceHistoryPage', () => {
  beforeEach(() => {
    service.getAreas.mockReset(); service.getPerformanceHistory.mockReset()
    service.getAreas.mockResolvedValue(areas)
    service.getPerformanceHistory.mockResolvedValue({ results: [result()], next_cursor: null })
  })

  it('shows inactive areas, searches a matching one-month range, and never exposes snapshot ids', async () => {
    renderPage()
    await screen.findByText('Responsable')
    expect(screen.getByRole('option', { name: /Área Sur.*Inactiva/ })).toBeInTheDocument()
    expect(service.getPerformanceHistory).toHaveBeenCalledWith(expect.objectContaining({ areaId: '7', fromMonth: expect.any(String), toMonth: expect.any(String), limit: 25 }))
    const call = service.getPerformanceHistory.mock.calls[0][0]
    expect(call.fromMonth).toBe(call.toMonth)
    expect(screen.queryByText('never-render-this')).not.toBeInTheDocument()
    expect(window.location.search).not.toContain('snapshot')
    expect(screen.getByText('Versión 4')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('rejects ranges of 24 months or more before requesting history', async () => {
    renderPage()
    await screen.findByText('Responsable')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2024-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))
    expect(await screen.findByText(/El rango debe ser menor de 24 meses/)).toBeInTheDocument()
    expect(service.getPerformanceHistory).toHaveBeenCalledTimes(1)
  })

  it('keeps opaque cursors unchanged and distinguishes provisional N/A from definitive data', async () => {
    service.getPerformanceHistory.mockResolvedValueOnce({ results: [result('provisional', 'not_applicable')], next_cursor: 'opaque+/cursor' }).mockResolvedValueOnce({ results: [result('definitive', 'not_applicable')], next_cursor: null })
    renderPage()
    expect(await screen.findByText('Provisional')).toBeInTheDocument()
    expect(screen.getAllByText('No aplica').length).toBeGreaterThan(0)
    expect(screen.queryByText('Versión 4')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(service.getPerformanceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'opaque+/cursor' })))
    expect(screen.getAllByText('No aplica').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Versión 4')).toBeInTheDocument()
  })

  it('offers loading, empty, error retry, keyboard focus and a contextual correction control', async () => {
    let resolveAreas
    service.getAreas.mockImplementationOnce(() => new Promise((resolve) => { resolveAreas = resolve }))
    renderPage()
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    resolveAreas(areas)
    await screen.findByText('Responsable')
    expect(screen.getByRole('button', { name: 'Consultar historial' })).toBeVisible()
    expect(document.querySelector('.systems-performance-history')).toHaveClass('tema-analiza')
    expect(document.querySelector('.systems-performance-history')).toHaveAttribute('data-responsive-breakpoints', '375 768 1024 1440')
    expect(screen.getByRole('button', { name: 'Corregir rendimiento' })).toBeVisible()
  })

  it('retries loading Areas after an initial Areas failure', async () => {
    service.getAreas
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(areas)

    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(service.getAreas).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('option', { name: /Área Sur.*Inactiva/ })).toBeInTheDocument()
    await waitFor(() => expect(service.getPerformanceHistory).toHaveBeenCalledWith(expect.objectContaining({ areaId: '7' })))
  })
})
