import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarioAreaPage from './CalendarioAreaPage'

const { completeAreaOccurrence, getMonthlyAreaAbsences, getMonthlyAreaOccurrences, getMonthlyAreaPerformance, rescheduleAreaOccurrence } = vi.hoisted(() => ({ completeAreaOccurrence: vi.fn(), getMonthlyAreaAbsences: vi.fn(), getMonthlyAreaOccurrences: vi.fn(), getMonthlyAreaPerformance: vi.fn(), rescheduleAreaOccurrence: vi.fn() }))
let datesSetHandler

vi.mock('../services/calendarioAreaService', () => ({ completeAreaOccurrence, getMonthlyAreaAbsences, getMonthlyAreaOccurrences, getMonthlyAreaPerformance, rescheduleAreaOccurrence }))
vi.mock('@fullcalendar/react', () => ({
  default: ({ events, datesSet, eventClick }) => {
    datesSetHandler = datesSet
    return <div data-testid="full-calendar" data-read-only={String(events.every((event) => event.editable === false))}>
      {events.map((event) => <button type="button" key={event.id} onClick={(click) => eventClick({ event: { ...event, extendedProps: event.extendedProps }, jsEvent: click.nativeEvent })}>{event.title}</button>)}
      <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 9, 1) } })}>Mes anterior</button>
      <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 10, 1) } })}>Siguiente mes</button>
    </div>
  },
}))

describe('CalendarioAreaPage', () => {
  const occurrence = { occurrence_id: 4, task: 'Auditoría', status: 'pendiente', effective_date: '2026-09-03', scheduled_date: '2026-09-02', weight: 20, all_day: true, coverage_snapshot: { jornada: 'manana', aplica_ambas_jornadas: true }, template: { name: 'Apertura' }, template_version: { number: 3 } }

  beforeEach(() => {
    getMonthlyAreaOccurrences.mockReset()
    getMonthlyAreaAbsences.mockReset()
    getMonthlyAreaAbsences.mockResolvedValue({ month: '2026-09', absences: [] })
    getMonthlyAreaPerformance.mockReset()
    getMonthlyAreaPerformance.mockResolvedValue({ month: '2026-09', performances: [] })
    completeAreaOccurrence.mockReset()
    rescheduleAreaOccurrence.mockReset()
  })

  it('shows loading and then the monthly occurrences as read-only events', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })

    render(<CalendarioAreaPage />)

    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBeInTheDocument()
    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-read-only', 'true')
  })

  it('keeps the calendar mounted with old task and absence events while previous and next month loads complete', async () => {
    let resolveOctoberOccurrences
    let resolveNovemberOccurrences
    let resolveOctoberAbsences
    let resolveNovemberAbsences
    getMonthlyAreaOccurrences.mockResolvedValueOnce({ occurrences: [occurrence] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNovemberOccurrences = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOctoberOccurrences = resolve }))
    getMonthlyAreaAbsences.mockResolvedValueOnce({ absences: [{ id: 10, source: 'vacation', type: 'approved', date: '2026-09-03', slot: 'morning' }] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNovemberAbsences = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOctoberAbsences = resolve }))

    render(<CalendarioAreaPage />)

    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(await screen.findByText('Vacaciones · Mañana')).toBeInTheDocument()
    const calendar = screen.getByTestId('full-calendar')

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente mes' }))
    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBe(calendar)
    expect(screen.getByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByText('Vacaciones · Mañana')).toBeInTheDocument()
    await waitFor(() => {
      expect(getMonthlyAreaOccurrences).toHaveBeenLastCalledWith('2026-11')
      expect(getMonthlyAreaAbsences).toHaveBeenLastCalledWith('2026-11')
      expect(getMonthlyAreaPerformance).toHaveBeenLastCalledWith('2026-11')
    })
    act(() => {
      resolveNovemberOccurrences({ occurrences: [{ ...occurrence, task: 'Noviembre' }] })
      resolveNovemberAbsences({ absences: [{ id: 11, source: 'vacation', type: 'approved', date: '2026-11-03', slot: 'full_day' }] })
    })
    expect(await screen.findByText('Noviembre')).toBeInTheDocument()
    expect(await screen.findByText('Vacaciones · Jornada completa')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBe(calendar)

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBe(calendar)
    expect(screen.getByText('Noviembre')).toBeInTheDocument()
    expect(screen.getByText('Vacaciones · Jornada completa')).toBeInTheDocument()
    await waitFor(() => {
      expect(getMonthlyAreaOccurrences).toHaveBeenLastCalledWith('2026-10')
      expect(getMonthlyAreaAbsences).toHaveBeenLastCalledWith('2026-10')
      expect(getMonthlyAreaPerformance).toHaveBeenLastCalledWith('2026-10')
    })
    act(() => {
      resolveOctoberOccurrences({ occurrences: [{ ...occurrence, task: 'Octubre' }] })
      resolveOctoberAbsences({ absences: [{ id: 12, source: 'special_situation', type: 'capacitacion', date: '2026-10-03', slot: 'afternoon' }] })
    })
    expect(await screen.findByText('Octubre')).toBeInTheDocument()
    expect(await screen.findByText('Situación especial activa · Capacitación · Tarde')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBe(calendar)
  })

  it('shows vacation and special-situation absences without opening the occurrence dialog', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    getMonthlyAreaAbsences.mockResolvedValue({
      month: '2026-09',
      absences: [
        { id: 10, source: 'vacation', type: 'approved', date: '2026-09-03', slot: 'morning' },
        { id: 11, source: 'special_situation', type: 'capacitacion', date: '2026-09-03', slot: 'afternoon' },
      ],
    })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Vacaciones · Mañana' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Situación especial activa · Capacitación · Tarde' })).toBeInTheDocument()
  })

  it('keeps task events visible when absence loading fails', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    getMonthlyAreaAbsences.mockRejectedValue(new Error('Ausencias no disponibles.'))
    render(<CalendarioAreaPage />)

    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las ausencias del área: Ausencias no disponibles.')
  })

  it('opens an accessible detail dialog with optional metadata', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    const event = await screen.findByRole('button', { name: 'Auditoría' })
    fireEvent.click(event)
    const dialog = screen.getByRole('dialog', { name: 'Auditoría' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Jornada')
    expect(dialog).toHaveTextContent('Ambas jornadas')
    expect(dialog).toHaveTextContent('Peso')
    expect(dialog).toHaveTextContent('Plantilla')
    expect(dialog).toHaveTextContent('Versión')
    expect(screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })).toHaveFocus()
  })

  it('traps Tab from the last dialog control to the first', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })
    const lastButton = screen.getByRole('button', { name: 'Reprogramar' })
    lastButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })

  it('traps Shift+Tab from the first dialog control to the last', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })
    const lastButton = screen.getByRole('button', { name: 'Reprogramar' })
    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(lastButton).toHaveFocus()
  })

  it('closes on Escape and restores focus to the calendar occurrence', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    const event = await screen.findByRole('button', { name: 'Auditoría' })
    fireEvent.click(event)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(event).toHaveFocus()
  })

  it('labels and enables commands only for the pending public status', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprogramar' })).toBeInTheDocument()
  })

  it('does not expose commands for a non-pending occurrence', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, status: 'scheduled', coverage_snapshot: undefined, template: undefined, template_version: undefined }] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    expect(screen.getByText('scheduled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Jornada')).not.toBeInTheDocument()
  })

  it('confirms completion, prevents a duplicate submission, and reloads the month', async () => {
    let resolveCommand
    completeAreaOccurrence.mockReturnValue(new Promise((resolve) => { resolveCommand = resolve }))
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Completando...' }))
    expect(completeAreaOccurrence).toHaveBeenCalledTimes(1)
    resolveCommand({})
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
  })

  it('submits the normalized reschedule body and shows command errors', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    rescheduleAreaOccurrence.mockRejectedValueOnce(Object.assign(new Error('Servicio no disponible'), { status: 500 }))
      .mockRejectedValueOnce(Object.assign(new Error('Fecha inválida'), { status: 400 }))
      .mockRejectedValueOnce(Object.assign(new Error('No autorizado'), { status: 403 }))
      .mockResolvedValueOnce({})
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-09-05' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Cobertura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
    const key = rescheduleAreaOccurrence.mock.calls[0][2]
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de validación: Fecha inválida')
    expect(rescheduleAreaOccurrence).toHaveBeenCalledWith(4, { target_date: '2026-09-05', reason: 'Cobertura' }, key)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado')
    expect(rescheduleAreaOccurrence.mock.calls[2][2]).not.toBe(key)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    await waitFor(() => expect(rescheduleAreaOccurrence).toHaveBeenCalledTimes(4))
    expect(rescheduleAreaOccurrence.mock.calls[3][2]).not.toBe(rescheduleAreaOccurrence.mock.calls[2][2])
  })

  it('reloads without retrying a conflicting command', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    completeAreaOccurrence.mockRejectedValue(Object.assign(new Error('Conflicto'), { status: 409 }))
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('estado de la ocurrencia cambió')
    expect(completeAreaOccurrence).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
  })

  it('shows an empty state when the selected month has no occurrences', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })

    render(<CalendarioAreaPage />)

    expect(await screen.findByText('No hay tareas programadas para este mes.')).toBeInTheDocument()
  })

  it('shows an error, retries, and reloads when the visible month changes', async () => {
    getMonthlyAreaOccurrences.mockRejectedValueOnce(new Error('Calendario no disponible.'))
      .mockResolvedValueOnce({ occurrences: [] })
      .mockResolvedValueOnce({ occurrences: [] })

    render(<CalendarioAreaPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Calendario no disponible.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente mes' }))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenLastCalledWith('2026-11'))
  })

  it('renders every persisted performance snapshot from the response envelope', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockResolvedValue({
      month: '2026-09',
      performances: [
        { area: { id: 8, name: 'Operaciones' }, responsibility_id: 3, month: '2026-09', version: 2, state: 'closed', weights: { total: 100, completed: 80 }, percentage: 80, counts: { total: 5, completed: 4 }, closed_at: '2026-09-30T18:00:00Z', reason: 'Cierre mensual' },
        { area: { id: 8, name: 'Operaciones' }, responsibility_id: 9, month: '2026-09', version: 1, state: 'closed', weights: { total: 40, completed: 40 }, percentage: 100, counts: { total: 2, completed: 2 }, closed_at: '2026-09-30T18:00:00Z', reason: 'Cierre adicional' },
      ],
    })

    render(<CalendarioAreaPage />)

    expect(await screen.findByText('Rendimiento mensual')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Responsabilidad 3' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Responsabilidad 9' })).toBeInTheDocument()
    expect(screen.getAllByText('{"id":8,"name":"Operaciones"}')).toHaveLength(2)
    expect(screen.getByText('Cierre mensual')).toBeInTheDocument()
    expect(screen.getByText('Cierre adicional')).toBeInTheDocument()
    expect(screen.getAllByText('Pesos')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente mes' }))
    await waitFor(() => expect(getMonthlyAreaPerformance).toHaveBeenLastCalledWith('2026-11'))
  })

  it('shows an empty performance state', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    render(<CalendarioAreaPage />)
    expect(await screen.findByText('No hay rendimiento mensual disponible para este mes.')).toBeInTheDocument()
  })

  it('handles denied and not-closed performance responses without actions', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockRejectedValueOnce(Object.assign(new Error('No autorizado'), { status: 403 }))
      .mockRejectedValueOnce(Object.assign(new Error('monthly_performance_not_closed'), { status: 409, detail: 'monthly_performance_not_closed' }))
    const { rerender } = render(<CalendarioAreaPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado para consultar el rendimiento mensual.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    rerender(<CalendarioAreaPage key="not-closed" />)
    expect(await screen.findByText('El rendimiento mensual aún no está cerrado.')).toBeInTheDocument()
  })

  it('retries recoverable performance errors and omits absent optional fields', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockRejectedValueOnce(new Error('Servicio no disponible.')).mockResolvedValueOnce({ month: '2026-09', performances: [] })
    render(<CalendarioAreaPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('No hay rendimiento mensual disponible para este mes.')).toBeInTheDocument())
    expect(screen.queryByText('Motivo')).not.toBeInTheDocument()
    expect(screen.queryByText('Pesos')).not.toBeInTheDocument()
  })

  it('keeps only the latest monthly occurrence response after navigation', async () => {
    let resolveNovember
    let resolveDecember
    getMonthlyAreaOccurrences.mockResolvedValueOnce({ occurrences: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNovember = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveDecember = resolve }))
    render(<CalendarioAreaPage />)
    await screen.findByTestId('full-calendar')
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 10, 1) } }))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 11, 1) } }))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(3))
    resolveDecember({ occurrences: [{ ...occurrence, task: 'Diciembre' }] })
    expect(await screen.findByText('Diciembre')).toBeInTheDocument()
    resolveNovember({ occurrences: [{ ...occurrence, task: 'Noviembre' }] })
    await waitFor(() => expect(screen.queryByText('Noviembre')).not.toBeInTheDocument())
  })

  it('refetches absences for the visible month and ignores stale navigation responses', async () => {
    let resolveNovember
    let resolveDecember
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaAbsences.mockResolvedValueOnce({ absences: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNovember = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveDecember = resolve }))
    render(<CalendarioAreaPage />)
    await screen.findByTestId('full-calendar')
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 10, 1) } }))
    await waitFor(() => expect(getMonthlyAreaAbsences).toHaveBeenLastCalledWith('2026-11'))
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 11, 1) } }))
    await waitFor(() => expect(getMonthlyAreaAbsences).toHaveBeenLastCalledWith('2026-12'))
    resolveDecember({ absences: [{ id: 12, source: 'vacation', type: 'approved', date: '2026-12-15', slot: 'full_day' }] })
    expect(await screen.findByText('Vacaciones · Jornada completa')).toBeInTheDocument()
    resolveNovember({ absences: [{ id: 13, source: 'special_situation', type: 'capacitacion', date: '2026-11-15', slot: 'afternoon' }] })
    await waitFor(() => expect(screen.queryByText('Situación especial activa · Capacitación · Tarde')).not.toBeInTheDocument())
  })

  it('keeps only the latest monthly performance response after navigation', async () => {
    let resolveNovember
    let resolveDecember
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockResolvedValueOnce({ performances: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNovember = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveDecember = resolve }))
    render(<CalendarioAreaPage />)
    await screen.findByTestId('full-calendar')
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 10, 1) } }))
    await waitFor(() => expect(getMonthlyAreaPerformance).toHaveBeenCalledTimes(2))
    act(() => datesSetHandler({ view: { currentStart: new Date(2026, 11, 1) } }))
    await waitFor(() => expect(getMonthlyAreaPerformance).toHaveBeenCalledTimes(3))
    resolveDecember({ performances: [{ responsibility_id: 11, month: '2026-12' }] })
    expect(await screen.findByRole('heading', { name: 'Responsabilidad 11' })).toBeInTheDocument()
    resolveNovember({ performances: [{ responsibility_id: 9, month: '2026-11' }] })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Responsabilidad 9' })).not.toBeInTheDocument())
  })
})
