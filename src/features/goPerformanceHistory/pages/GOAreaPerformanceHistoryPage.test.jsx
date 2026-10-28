import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GOAreaPerformanceHistoryPage from './GOAreaPerformanceHistoryPage'

const service = vi.hoisted(() => ({
  getGOAuthorizedAreas: vi.fn(), getGOAllAreasPerformanceHistory: vi.fn(), getGOAreaPerformanceHistory: vi.fn(), getGOOccurrences: vi.fn(), getGOOccurrenceDetail: vi.fn(), getGOResponsibilityGaps: vi.fn(),
}))
vi.mock('../services/goPerformanceHistoryService', () => service)

const areas = [
  { id: 7, codigo: 'NORTE', nombre: 'Área Norte', activo: true },
  { id: 8, codigo: 'SUR', nombre: 'Área Sur', activo: false },
]

const row = ({ kind = 'definitive', state = 'closed', percentage = '75', version = 4, responsibility = { id: 1, starts_on: '2026-01-15', ends_on: null, manager: { display_name: 'Ana Histórica' } } } = {}) => ({
  area: { id: 7, codigo: 'NORTE', nombre: 'Área Norte' },
  responsibility,
  period: '2026-10',
  performance: { kind, state, version, expected_weight: state === 'not_applicable' ? '0' : '20', credited_weight: state === 'not_applicable' ? '0' : '15', percentage: state === 'not_applicable' ? null : percentage, as_of: '2026-10-27T10:30:00Z', snapshot_id: 'never-render-this' },
})

describe('GOAreaPerformanceHistoryPage', () => {
  beforeEach(() => {
    service.getGOAuthorizedAreas.mockReset()
    service.getGOAllAreasPerformanceHistory.mockReset()
    service.getGOAreaPerformanceHistory.mockReset()
    service.getGOOccurrences.mockReset()
    service.getGOOccurrenceDetail.mockReset()
    service.getGOResponsibilityGaps.mockReset()
    service.getGOAuthorizedAreas.mockResolvedValue({ scope: {}, results: areas })
    service.getGOAllAreasPerformanceHistory.mockResolvedValue({ scope: { mode: 'all_areas' }, results: [row()], next_cursor: null })
    service.getGOAreaPerformanceHistory.mockResolvedValue({ scope: {}, results: [row()], next_cursor: null })
    service.getGOOccurrences.mockResolvedValue({ results: [{ id: 'opaque-occurrence-id', task: { title: 'Inventario mensual' }, origin_date_local: '2026-10-04', attribution_month: '2026-10', frozen_weight: '10', latest_status: 'completed' }] })
    service.getGOOccurrenceDetail.mockResolvedValue({ task: { title: 'Inventario mensual' }, origin_date_local: '2026-10-04', attribution_month: '2026-10', frozen_weight: '10', latest_revision: { status: 'completed', created_at: '2026-10-05T12:00:00Z' }, revisions: [{ status: 'pending', created_at: '2026-10-04T08:00:00Z' }] })
    service.getGOResponsibilityGaps.mockResolvedValue({ results: [{ effective_start: '2026-09-12', detected_at: '2026-09-13T08:00:00Z', status: 'open', opening_reason: 'Sin responsabilidad vigente', opening_provenance: 'Asignación histórica' }], next_cursor: null })
  })

  it('selects Todos by default, requests all-Area history, and renders a safe Área column without aggregation', async () => {
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({ scope: { mode: 'all_areas' }, results: [row({ percentage: '75' }), { ...row({ percentage: '20' }), area: { id: 8, codigo: 'SUR', nombre: 'Área Sur' }, responsibility: { id: 2, manager: { display_name: 'Bea Histórica' } } }], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)

    expect(await screen.findByRole('option', { name: 'Todos' })).toHaveProperty('selected', true)
    await screen.findByText('Bea Histórica')
    expect(service.getGOAllAreasPerformanceHistory).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: expect.any(String), toMonth: expect.any(String), limit: 25 }))
    expect(service.getGOAreaPerformanceHistory).not.toHaveBeenCalled()
    expect(screen.getByRole('columnheader', { name: 'Área' })).toBeInTheDocument()
    expect(screen.getAllByText('NORTE · Área Norte')).toHaveLength(2)
    expect(screen.getByText('SUR · Área Sur')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.queryByText('snapshot_id')).not.toBeInTheDocument()
  })

  it('uses the existing single-Area request and hides Área after selecting a specific Area', async () => {
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Ana Histórica')
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))

    await waitFor(() => expect(service.getGOAreaPerformanceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: '7', limit: 25 })))
    expect(screen.queryByRole('columnheader', { name: 'Área' })).not.toBeInTheDocument()
  })

  it('disables Area-specific gaps in Todos mode and restores them for a specific Area', async () => {
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Ana Histórica')
    const gaps = screen.getByRole('button', { name: 'Consultar brechas de responsabilidad del Área' })
    expect(gaps).toBeDisabled()
    expect(screen.getByText('Selecciona un Área específica para consultar brechas de responsabilidad.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '7' } })
    expect(gaps).toBeEnabled()
  })

  it('shows the required neutral all-Area empty state without exposing opaque state', async () => {
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({ scope: { mode: 'all_areas' }, results: [], next_cursor: 'opaque-hidden-cursor' })
    render(<GOAreaPerformanceHistoryPage />)

    expect(await screen.findByText('No hay Áreas autorizadas para el rango seleccionado.')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('opaque-hidden-cursor')
    expect(window.location.search).toBe('')
  })

  it('uses the range-authorized selector, identifies an inactive Area, and renders segmented read-only history', async () => {
    render(<GOAreaPerformanceHistoryPage />)

    await screen.findByText('Ana Histórica')
    expect(service.getGOAuthorizedAreas).toHaveBeenCalledWith(expect.objectContaining({ fromMonth: expect.any(String), toMonth: expect.any(String) }))
    expect(screen.getByRole('option', { name: /Área Sur.*Inactiva/ })).toBeInTheDocument()
    expect(screen.getByText('Definitivo')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('never-render-this')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /corregir|aprobar|confirmar|reconocer/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/alerta|recibo|auditoría/i)).not.toBeInTheDocument()
  })

  it('keeps responsibility data internal when the compact history table omits that column', async () => {
    const backendResponsibility = { id: 1, starts_on: '2026-01-15', ends_on: null, manager: { display_name: 'Ana Histórica' } }
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({
      scope: {},
      results: [row({ responsibility: backendResponsibility })],
      next_cursor: null,
    })

    expect(() => render(<GOAreaPerformanceHistoryPage />)).not.toThrow()

    expect(await screen.findByText('Ana Histórica')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    expect(screen.queryByText('Desde 2026-01-15 · Vigente')).not.toBeInTheDocument()
    expect(screen.getByText('octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Definitivo')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('renders a separate historical manager column and safe legacy-null label without visible IDs or URL state', async () => {
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({
      scope: {}, results: [row(), row({ responsibility: { id: 2, starts_on: '2025-01-01', ends_on: '2025-12-31', manager: null } })], next_cursor: null,
    })
    render(<GOAreaPerformanceHistoryPage />)

    expect(await screen.findByRole('columnheader', { name: 'Gerente de Área' })).toBeInTheDocument()
    expect(screen.getByText('Ana Histórica')).toBeInTheDocument()
    expect(screen.getByText('Gerente histórico no disponible')).toBeInTheDocument()
    expect(screen.queryByText('Desde 2026-01-15 · Vigente')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('ga_profile_id')
    expect(document.body.textContent).not.toContain('opaque-occurrence-id')
    expect(window.location.search).toBe('')
  })

  it('keeps the history table readable and groups the read-only actions in visual keyboard order', async () => {
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({
      scope: {}, results: [row({ kind: 'provisional', state: 'not_applicable' })], next_cursor: null,
    })
    render(<GOAreaPerformanceHistoryPage />)

    await screen.findByText('Ana Histórica')
    const rowElement = document.querySelector('.go-performance-table tbody tr')
    expect(rowElement).toHaveTextContent('Ana Histórica')
    expect(rowElement).toHaveTextContent('NORTE · Área Norte')
    expect(rowElement).not.toHaveTextContent('Desde 2026-01-15 · Vigente')
    expect(screen.getByRole('columnheader', { name: 'Gerente de Área' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Responsabilidad' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Provisional · No aplica')).toBeInTheDocument()
    expect(rowElement.querySelector('.go-performance-updated')).toHaveTextContent('27 oct 2026')

    const actionGroup = screen.getByRole('group', { name: 'Consultas del historial seleccionado' })
    const historyAction = within(actionGroup).getByRole('button', { name: 'Consultar historial' })
    const gapsAction = within(actionGroup).getByRole('button', { name: 'Consultar brechas de responsabilidad del Área' })
    expect(actionGroup).toContainElement(historyAction)
    expect(actionGroup).toContainElement(gapsAction)
    expect(historyAction.compareDocumentPosition(gapsAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver evidencia de ocurrencias' })).toBeInTheDocument()
  })

  it('keeps responsibility, weights, and version hidden from the all-Area history table', async () => {
    render(<GOAreaPerformanceHistoryPage />)

    await screen.findByText('Ana Histórica')
    for (const name of ['Responsabilidad', 'Peso esperado', 'Peso acreditado', 'Versión']) {
      expect(screen.queryByRole('columnheader', { name })).not.toBeInTheDocument()
    }
    const historyRow = document.querySelector('.go-performance-table tbody tr')
    expect(historyRow).toHaveTextContent('NORTE · Área Norte')
    expect(historyRow).not.toHaveTextContent('Versión 4')
  })

  it('loads list-issued occurrence evidence, detail, back navigation, Escape, and focus restoration without mutation controls', async () => {
    render(<GOAreaPerformanceHistoryPage />)
    const trigger = await screen.findByRole('button', { name: 'Ver evidencia de ocurrencias' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(await screen.findByRole('dialog', { name: /Evidencia de ocurrencias/i })).toBeInTheDocument()
    expect(service.getGOOccurrences).toHaveBeenCalledWith({ areaId: 7, responsibilityId: 1, fromMonth: '2026-10', toMonth: '2026-10', limit: 25 })
    expect(screen.queryByText('opaque-occurrence-id')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Inventario mensual/ }))
    expect(await screen.findByText('Historial de revisiones')).toBeInTheDocument()
    expect(service.getGOOccurrenceDetail).toHaveBeenCalledWith('opaque-occurrence-id')
    expect(screen.queryByRole('button', { name: /editar|corregir|aprobar|reconocer|systems|t8/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la lista' }))
    expect(await screen.findByRole('button', { name: /Inventario mensual/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('shows occurrence loading, empty and authorization error states', async () => {
    service.getGOOccurrences.mockResolvedValueOnce({ results: [] }).mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }))
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Ana Histórica')
    fireEvent.click(screen.getByRole('button', { name: 'Ver evidencia de ocurrencias' }))
    expect(await screen.findByText(/No hay ocurrencias autorizadas/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1))
    fireEvent.click(screen.getByRole('button', { name: 'Ver evidencia de ocurrencias' }))
    expect(await screen.findByText(/El servidor mantiene la autorización/)).toBeInTheDocument()
  })

  it('keeps gap evidence separate from performance, converts inclusive months to dates, preserves opaque pagination, and restores focus', async () => {
    service.getGOResponsibilityGaps.mockResolvedValueOnce({ results: [{ effective_start: '2026-09-12', detected_at: '2026-09-13T08:00:00Z', status: 'open', opening_reason: 'Sin responsabilidad vigente', opening_provenance: 'Asignación histórica' }], next_cursor: 'opaque-gap-cursor' }).mockResolvedValueOnce({ results: [], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Ana Histórica')
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))
    await waitFor(() => expect(service.getGOAreaPerformanceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ fromMonth: '2026-09', toMonth: '2026-10' })))
    const trigger = screen.getByRole('button', { name: 'Consultar brechas de responsabilidad del Área' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: /Brechas de responsabilidad del Área/i })
    expect(within(dialog).getByText(/Evidencia operativa independiente del rendimiento/)).toBeInTheDocument()
    expect(service.getGOResponsibilityGaps).toHaveBeenCalledWith({ areaId: '7', fromDate: '2026-09-01', toDate: '2026-10-31', limit: 25 })
    expect(within(dialog).queryByText(/N\/A|0%|deuda|alerta/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /resolver|reconocer|corregir/i })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(service.getGOResponsibilityGaps).toHaveBeenLastCalledWith({ areaId: '7', fromDate: '2026-09-01', toDate: '2026-10-31', cursor: 'opaque-gap-cursor', limit: 25 }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(trigger)
  })

  it('falls back safely when a backend responsibility has no date fields', async () => {
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({
      scope: {},
      results: [row({ responsibility: { id: 1, ga_profile_id: 2 } })],
      next_cursor: null,
    })

    expect(() => render(<GOAreaPerformanceHistoryPage />)).not.toThrow()

    expect(await screen.findByText('Gerente histórico no disponible')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })

  it('validates an invalid month range before requesting either the selector or history again', async () => {
    render(<GOAreaPerformanceHistoryPage />)
    await screen.findByText('Ana Histórica')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2024-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))

    expect(await screen.findByText(/El rango debe ser menor de 24 meses/)).toBeInTheDocument()
    expect(service.getGOAuthorizedAreas).toHaveBeenCalledTimes(1)
    expect(service.getGOAllAreasPerformanceHistory).toHaveBeenCalledTimes(1)
  })

  it('preserves opaque cursors and distinguishes provisional data from definitive N/A rows', async () => {
    service.getGOAllAreasPerformanceHistory
      .mockResolvedValueOnce({ scope: {}, results: [row({ kind: 'provisional', state: 'not_applicable', version: null })], next_cursor: 'opaque+/cursor' })
      .mockResolvedValueOnce({ scope: {}, results: [row({ kind: 'definitive', state: 'not_applicable', version: 4 })], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)

    expect(await screen.findByText('Provisional')).toBeInTheDocument()
    expect(screen.getAllByText('No aplica').length).toBeGreaterThan(0)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    await waitFor(() => expect(service.getGOAllAreasPerformanceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'opaque+/cursor' })))
    expect(screen.queryByRole('columnheader', { name: 'Versión' })).not.toBeInTheDocument()
  })

  it('paginates occurrence evidence with the selected segment, appends unique rows, and keeps opaque values internal', async () => {
    const firstOccurrence = { id: 'opaque-occurrence-one', task: { title: 'Primera ocurrencia' }, origin_date_local: '2026-10-04' }
    const duplicateOccurrence = { id: 'opaque-occurrence-one', task: { title: 'Primera ocurrencia' }, origin_date_local: '2026-10-04' }
    const secondOccurrence = { id: 'opaque-occurrence-two', task: { title: 'Segunda ocurrencia' }, origin_date_local: '2026-10-05' }
    service.getGOOccurrences
      .mockResolvedValueOnce({ results: [firstOccurrence], next_cursor: 'opaque-next-occurrence-cursor' })
      .mockResolvedValueOnce({ results: [duplicateOccurrence, secondOccurrence], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver evidencia de ocurrencias' }))
    expect(await screen.findByRole('button', { name: /Primera ocurrencia/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar más ocurrencias' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('opaque-occurrence-one')
    expect(document.body.textContent).not.toContain('opaque-next-occurrence-cursor')
    expect(window.location.search).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más ocurrencias' }))
    await waitFor(() => expect(service.getGOOccurrences).toHaveBeenLastCalledWith({ areaId: 7, responsibilityId: 1, fromMonth: '2026-10', toMonth: '2026-10', cursor: 'opaque-next-occurrence-cursor', limit: 25 }))
    expect(await screen.findByRole('button', { name: /Segunda ocurrencia/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Primera ocurrencia/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Cargar más ocurrencias' })).not.toBeInTheDocument()
  })

  it('resets occurrence pagination on a different row or close, and preserves page one after a load-more failure', async () => {
    const secondRow = row({ responsibility: { id: 2, starts_on: '2026-02-01', ends_on: null, manager: { display_name: 'Bea Histórica' } } })
    service.getGOAllAreasPerformanceHistory.mockResolvedValueOnce({ scope: {}, results: [row(), secondRow], next_cursor: null })
    service.getGOOccurrences
      .mockResolvedValueOnce({ results: [{ id: 'first-row-occurrence', task: { title: 'Evidencia de primera fila' }, origin_date_local: '2026-10-04' }], next_cursor: 'cursor-first-row' })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ results: [{ id: 'second-row-occurrence', task: { title: 'Evidencia de segunda fila' }, origin_date_local: '2026-10-05' }], next_cursor: null })
      .mockResolvedValueOnce({ results: [{ id: 'reopened-occurrence', task: { title: 'Evidencia reabierta' }, origin_date_local: '2026-10-06' }], next_cursor: null })
    render(<GOAreaPerformanceHistoryPage />)

    const triggers = await screen.findAllByRole('button', { name: 'Ver evidencia de ocurrencias' })
    fireEvent.click(triggers[0])
    expect(await screen.findByRole('button', { name: /Evidencia de primera fila/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más ocurrencias' }))
    expect(await screen.findByText('No fue posible cargar más ocurrencias.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Evidencia de primera fila/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar cargar más ocurrencias' })).toBeInTheDocument()

    fireEvent.click(triggers[1])
    expect(await screen.findByRole('button', { name: /Evidencia de segunda fila/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evidencia de primera fila/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más ocurrencias' })).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1))
    fireEvent.click(triggers[0])
    expect(await screen.findByRole('button', { name: /Evidencia reabierta/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evidencia de segunda fila/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más ocurrencias' })).not.toBeInTheDocument()
  })

  it('provides loading, empty, neutral authorization error, keyboard focus and responsive reduced-motion structure', async () => {
    let resolveAreas
    service.getGOAuthorizedAreas.mockImplementationOnce(() => new Promise((resolve) => { resolveAreas = resolve }))
    render(<GOAreaPerformanceHistoryPage />)

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    await waitFor(() => expect(resolveAreas).toEqual(expect.any(Function)))
    resolveAreas({ scope: {}, results: areas })
    await screen.findByText('Ana Histórica')
    expect(document.querySelector('.go-area-performance-history')).toHaveClass('tema-analiza')
    expect(document.querySelector('.go-area-performance-history')).toHaveAttribute('data-responsive-breakpoints', '375 768 1024 1440')
    expect(screen.getByLabelText('Resultados del historial de rendimiento de áreas')).toHaveAttribute('tabindex', '0')

    service.getGOAllAreasPerformanceHistory.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }))
    fireEvent.click(screen.getByRole('button', { name: 'Consultar historial' }))
    expect(await screen.findByText(/El servidor mantiene la autorización/)).toBeInTheDocument()
  })
})
