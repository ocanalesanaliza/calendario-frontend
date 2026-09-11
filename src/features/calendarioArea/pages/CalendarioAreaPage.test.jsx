import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarioAreaPage from './CalendarioAreaPage'

const { completeAreaOccurrence, getMonthlyAreaOccurrences, rescheduleAreaOccurrence } = vi.hoisted(() => ({ completeAreaOccurrence: vi.fn(), getMonthlyAreaOccurrences: vi.fn(), rescheduleAreaOccurrence: vi.fn() }))

vi.mock('../services/calendarioAreaService', () => ({ completeAreaOccurrence, getMonthlyAreaOccurrences, rescheduleAreaOccurrence }))
vi.mock('@fullcalendar/react', () => ({
  default: ({ events, datesSet, eventClick }) => (
    <div data-testid="full-calendar" data-read-only={String(events.every((event) => event.editable === false))}>
      {events.map((event) => <button type="button" key={event.id} onClick={(click) => eventClick({ event: { ...event, extendedProps: event.extendedProps }, jsEvent: click.nativeEvent })}>{event.title}</button>)}
      <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 10, 1) } })}>Siguiente mes</button>
    </div>
  ),
}))

describe('CalendarioAreaPage', () => {
  const occurrence = { occurrence_id: 4, task: 'Auditoría', status: 'pendiente', effective_date: '2026-09-03', scheduled_date: '2026-09-02', weight: 20, all_day: true, coverage_snapshot: { jornada: 'manana', aplica_ambas_jornadas: true }, template: { name: 'Apertura' }, template_version: { number: 3 } }

  beforeEach(() => {
    getMonthlyAreaOccurrences.mockReset()
    completeAreaOccurrence.mockReset()
    rescheduleAreaOccurrence.mockReset()
  })

  it('shows loading and then the monthly occurrences as read-only events', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })

    render(<CalendarioAreaPage />)

    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-read-only', 'true')
  })

  it('opens an accessible detail dialog with optional metadata and restores focus on Escape', async () => {
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
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(event).toHaveFocus()
  })

  it('does not expose commands for a non-pending occurrence', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, status: 'vencida', coverage_snapshot: undefined, template: undefined, template_version: undefined }] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
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
    rescheduleAreaOccurrence.mockRejectedValueOnce(Object.assign(new Error('Fecha inválida'), { status: 400 }))
      .mockRejectedValueOnce(Object.assign(new Error('No autorizado'), { status: 403 }))
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Auditoría' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-09-05' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Cobertura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de validación: Fecha inválida')
    expect(rescheduleAreaOccurrence).toHaveBeenCalledWith(4, { target_date: '2026-09-05', reason: 'Cobertura' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado')
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
})
