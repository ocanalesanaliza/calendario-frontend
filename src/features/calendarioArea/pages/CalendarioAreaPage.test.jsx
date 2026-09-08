import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarioAreaPage from './CalendarioAreaPage'

const { getMonthlyAreaOccurrences } = vi.hoisted(() => ({ getMonthlyAreaOccurrences: vi.fn() }))

vi.mock('../services/calendarioAreaService', () => ({ getMonthlyAreaOccurrences }))
vi.mock('@fullcalendar/react', () => ({
  default: ({ events, datesSet }) => (
    <div data-testid="full-calendar" data-read-only={String(events.every((event) => event.editable === false))}>
      {events.map((event) => <span key={event.id}>{event.title}</span>)}
      <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 10, 1) } })}>Siguiente mes</button>
    </div>
  ),
}))

describe('CalendarioAreaPage', () => {
  beforeEach(() => getMonthlyAreaOccurrences.mockReset())

  it('shows loading and then the monthly occurrences as read-only events', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ id: 4, task: 'Auditoría', effective_date: '2026-09-03', scheduled_date: '2026-09-02', weight: 20, all_day: true }] })

    render(<CalendarioAreaPage />)

    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-read-only', 'true')
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
