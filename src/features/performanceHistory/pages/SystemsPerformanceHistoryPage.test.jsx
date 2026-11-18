import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SystemsPerformanceHistoryPage from './SystemsPerformanceHistoryPage'

const service = vi.hoisted(() => ({ getPerformanceHistory: vi.fn(), getAreas: vi.fn() }))
const evaluations = vi.hoisted(() => ({ getGAMonthlyEvaluations: vi.fn(), getGAMonthlyEvaluationHistory: vi.fn(), createGAMonthlyEvaluation: vi.fn(), correctGAMonthlyEvaluation: vi.fn() }))
vi.mock('../services/performanceHistoryService', () => ({ getPerformanceHistory: service.getPerformanceHistory }))
vi.mock('../../areas/services/areasService', () => ({ getAreas: service.getAreas }))
vi.mock('../../gaMonthlyEvaluations/services/gaMonthlyEvaluationsService', () => evaluations)

const areas = [{ id_area: 7, codigo: 'NORTE', nombre: 'Área Norte', activo: true }, { id_area: 8, codigo: 'SUR', nombre: 'Área Sur', activo: false }]
const result = (kind = 'definitive', state = 'closed') => ({
  area: { codigo: 'NORTE', nombre: 'Área Norte' }, responsibility: { nombre: 'Responsable' }, period: '2026-10',
  performance: { kind, state, version: 4, expected_weight: '20', credited_weight: '15', percentage: kind === 'provisional' ? null : '75', as_of: '2026-10-25T10:30:00Z', snapshot_id: 'never-render-this' },
})

function renderPage(props = {}) { return render(<MemoryRouter><SystemsPerformanceHistoryPage {...props} /></MemoryRouter>) }

describe('SystemsPerformanceHistoryPage', () => {
  beforeEach(() => {
    service.getAreas.mockReset(); service.getPerformanceHistory.mockReset()
    Object.values(evaluations).forEach((mock) => mock.mockReset())
    service.getAreas.mockResolvedValue(areas)
    service.getPerformanceHistory.mockResolvedValue({ results: [result()], next_cursor: null })
    evaluations.getGAMonthlyEvaluations.mockResolvedValue({ evaluations: [{ id: 81, score: '87.50', comment: 'Seguimiento', issuer_go: { name: 'GO Ana' } }] })
    evaluations.getGAMonthlyEvaluationHistory.mockResolvedValue({ history: [{ id: 80, version: 1, score: '80.00', comment: '', reason: '' }, { id: 81, version: 2, score: '87.50', comment: 'Seguimiento', reason: 'Revisión operativa' }] })
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

  it('shows nested historical managers safely in the correction selector and preserves legacy responsibility labels', async () => {
    service.getPerformanceHistory.mockResolvedValue({
      results: [
        { ...result(), responsibility: { id: 1, starts_on: '2026-10-01', ends_on: null, manager: { display_name: 'Nombre del GA' } } },
        { ...result(), responsibility: { id: 2, starts_on: '2026-10-01', ends_on: null, manager: null } },
        { ...result(), responsibility: 'Responsable histórico' },
      ],
      next_cursor: null,
    })

    renderPage({ selectionMode: true, onSelectTarget: vi.fn() })

    expect(await screen.findByText('Nombre del GA')).toBeInTheDocument()
    expect(screen.getByText('Gerente histórico no disponible')).toBeInTheDocument()
    expect(screen.getByText('Responsable histórico')).toBeInTheDocument()
  })

  it('loads the complete versioned evaluation history for the selected Systems row without evaluation mutation controls', async () => {
    service.getPerformanceHistory.mockResolvedValue({ results: [{ ...result(), responsibility: { id: 1, manager: { id: 27, display_name: 'Nombre del GA' } } }], next_cursor: null })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial de evaluación' }))
    expect(await screen.findByRole('dialog', { name: /Historial de evaluación mensual/i })).toBeInTheDocument()
    expect(evaluations.getGAMonthlyEvaluations).toHaveBeenCalledWith({ gaId: 27, month: '2026-10' })
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial completo' }))
    expect(await screen.findByText('Versión 2')).toBeInTheDocument()
    expect(screen.getByText('Revisión operativa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /emitir|corregir evaluación|guardar evaluación/i })).not.toBeInTheDocument()
    expect(evaluations.createGAMonthlyEvaluation).not.toHaveBeenCalled()
    expect(evaluations.correctGAMonthlyEvaluation).not.toHaveBeenCalled()
  })

  it('keeps evaluation history states isolated for an empty or denied API response', async () => {
    service.getPerformanceHistory.mockResolvedValue({ results: [{ ...result(), responsibility: { id: 1, manager: { id: 27, display_name: 'Nombre del GA' } } }], next_cursor: null })
    evaluations.getGAMonthlyEvaluations.mockResolvedValueOnce({ evaluations: [] }).mockRejectedValueOnce(Object.assign(new Error('denied'), { status: 403 }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial de evaluación' }))
    expect(await screen.findByText('No hay evaluación mensual vigente.')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1))
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial de evaluación' }))
    expect(await screen.findByText(/El servidor mantiene la autorización/)).toBeInTheDocument()
    expect(screen.getByText('Nombre del GA')).toBeInTheDocument()
  })
})
