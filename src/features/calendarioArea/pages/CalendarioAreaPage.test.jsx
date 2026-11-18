import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarioAreaPage from './CalendarioAreaPage'
import { normalizeMonthlyAreaOccurrencesResponse } from '../../calendarArea/services/monthlyAreaOccurrence'

const { cancelAdHocActivity, cancelManualCatalogEntry, completeAdHocActivity, completeAreaOccurrence, completeManualCatalogEntry, createAdHocActivity, createManualCatalogEntry, finalizeDepositReviewWorklist, getManualPlanningContext, getMonthlyAreaAbsences, getMonthlyAreaOccurrences, getMonthlyAreaPerformance, getTareas, gotoDate, justifyManualCatalogEntryScopeLoss, navigate, rescheduleAreaOccurrence, rescheduleManualCatalogEntry, updateAdHocActivity, updateManualCatalogEntry, getDepositReviewWorklist, recordDepositReviewDecision, useAuth } = vi.hoisted(() => ({ cancelAdHocActivity: vi.fn(), cancelManualCatalogEntry: vi.fn(), completeAdHocActivity: vi.fn(), completeAreaOccurrence: vi.fn(), completeManualCatalogEntry: vi.fn(), createAdHocActivity: vi.fn(), createManualCatalogEntry: vi.fn(), finalizeDepositReviewWorklist: vi.fn(), getManualPlanningContext: vi.fn(), getMonthlyAreaAbsences: vi.fn(), getMonthlyAreaOccurrences: vi.fn(), getMonthlyAreaPerformance: vi.fn(), getTareas: vi.fn(), gotoDate: vi.fn(), justifyManualCatalogEntryScopeLoss: vi.fn(), navigate: vi.fn(), rescheduleAreaOccurrence: vi.fn(), rescheduleManualCatalogEntry: vi.fn(), updateAdHocActivity: vi.fn(), updateManualCatalogEntry: vi.fn(), getDepositReviewWorklist: vi.fn(), recordDepositReviewDecision: vi.fn(), useAuth: vi.fn() }))
let datesSetHandler

const toIsoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const isoDate = (offsetDays = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toIsoDate(date)
}

const dayCellClickDate = isoDate(3)

// The real service returns the normalized payload; fixtures keep the raw backend contract.
function serviceResponse(payload = {}) {
  return normalizeMonthlyAreaOccurrencesResponse({ occurrences: [], ...payload })
}

vi.mock('../services/calendarioAreaService', () => ({ cancelAdHocActivity, cancelManualCatalogEntry, completeAdHocActivity, completeAreaOccurrence, completeManualCatalogEntry, createAdHocActivity, createManualCatalogEntry, getManualPlanningContext, getMonthlyAreaAbsences, getMonthlyAreaOccurrences, getMonthlyAreaPerformance, justifyManualCatalogEntryScopeLoss, rescheduleAreaOccurrence, rescheduleManualCatalogEntry, updateAdHocActivity, updateManualCatalogEntry }))
vi.mock('../../tareas/services/tareasService', () => ({ getTareas }))
vi.mock('../../calendarArea/services/depositReviewWorklistService', () => ({ finalizeDepositReviewWorklist, getDepositReviewWorklist, recordDepositReviewDecision }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('react-router-dom', async (importActual) => ({ ...(await importActual()), useNavigate: () => navigate }))
vi.mock('@fullcalendar/react', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef(({ events, datesSet, eventClick, eventClassNames, eventContent, dateClick }, ref) => {
      useImperativeHandle(ref, () => ({ getApi: () => ({ gotoDate }) }))
      datesSetHandler = datesSet
      return <div data-testid="full-calendar" data-read-only={String(events.every((event) => event.editable === false))}>
        <div className="fc-col-header" data-testid="calendar-weekday-header" />
        <div className="fc-daygrid-day fc-day-today" data-testid="calendar-current-day" />
        {events.map((event) => <button type="button" aria-label={event.extendedProps?.aria_label ?? event.title} className={[event.classNames, eventClassNames?.({ event })].flat().join(' ')} key={event.id} onClick={(click) => eventClick({ event: { ...event, extendedProps: event.extendedProps }, jsEvent: click.nativeEvent })}>{eventContent?.({ event }) ?? event.title}</button>)}
        <button type="button" onClick={() => dateClick?.({ dateStr: dayCellClickDate, allDay: true })}>Día futuro</button>
        <button type="button" onClick={() => dateClick?.({ dateStr: isoDate(-3), allDay: true })}>Día pasado</button>
        <button type="button" onClick={() => dateClick?.({ dateStr: '2026-09-18T09:00:00', allDay: false })}>Hora 9</button>
        <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 9, 1) } })}>Mes anterior</button>
        <button type="button" onClick={() => datesSet({ view: { currentStart: new Date(2026, 10, 1) } })}>Siguiente mes</button>
      </div>
    }),
  }
})

describe('CalendarioAreaPage', () => {
  const occurrence = { occurrence_id: 4, task: 'Auditoría', status: 'pendiente', effective_date: '2026-09-03', scheduled_date: '2026-09-02', weight: 20, all_day: true, coverage_snapshot: { jornada: 'manana', aplica_ambas_jornadas: true }, template: { name: 'Apertura' }, template_version: { number: 3 } }

  beforeEach(() => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    getMonthlyAreaOccurrences.mockReset()
    getMonthlyAreaAbsences.mockReset()
    getMonthlyAreaAbsences.mockResolvedValue({ month: '2026-09', absences: [] })
    getMonthlyAreaPerformance.mockReset()
    getMonthlyAreaPerformance.mockResolvedValue({ month: '2026-09', performances: [] })
    completeAreaOccurrence.mockReset()
    completeAdHocActivity.mockReset()
    completeManualCatalogEntry.mockReset()
    cancelAdHocActivity.mockReset()
    cancelManualCatalogEntry.mockReset()
    justifyManualCatalogEntryScopeLoss.mockReset()
    createAdHocActivity.mockReset()
    createManualCatalogEntry.mockReset()
    getManualPlanningContext.mockReset()
    getManualPlanningContext.mockResolvedValue({ areas: [{ id: 8, nombre: 'Operaciones' }], branches: [{ id_sucursal: 11, nombre: 'Centro' }] })
    getTareas.mockReset()
    getTareas.mockResolvedValue([{ id_tarea: 123, nombre: 'Auditoría manual', manual_planning_enabled: true, manual_planning_kind: 'quantitative' }])
    rescheduleAreaOccurrence.mockReset()
    rescheduleManualCatalogEntry.mockReset()
    updateAdHocActivity.mockReset()
    updateManualCatalogEntry.mockReset()
    getDepositReviewWorklist.mockReset()
    recordDepositReviewDecision.mockReset()
    finalizeDepositReviewWorklist.mockReset()
    navigate.mockReset()
    gotoDate.mockReset()
  })

  it('shows loading and then the monthly occurrences as read-only events', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })

    render(<CalendarioAreaPage />)

    expect(screen.getByText('Cargando calendario...')).toBeInTheDocument()
    expect(screen.getByText('Cargando calendario...').closest('.calendario-area-state--loading')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar').closest('.calendario-area-calendar__scroll')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar').closest('.calendario-area-calendar')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-read-only', 'true')
  })

  it('creates a quantitative catalog entry with optional branch context and refreshes the visible month', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    createManualCatalogEntry.mockResolvedValue({ entry: { id: 10 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    expect(await screen.findByLabelText('Área')).toHaveValue('8')
    fireEvent.change(screen.getByLabelText('Tipo de entrada'), { target: { value: 'catalog' } })
    fireEvent.change(screen.getByLabelText('Tarea de catálogo'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Fecha programada'), { target: { value: isoDate(0) } })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '11' } })
    fireEvent.change(screen.getByLabelText('Nota de planificación'), { target: { value: 'Visita' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    await waitFor(() => expect(createManualCatalogEntry).toHaveBeenCalledWith({ area_id: 8, task_id: 123, scheduled_date: isoDate(0), branch_id: 11, planning_note: 'Visita' }, expect.any(String)))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
    expect(gotoDate).not.toHaveBeenCalled()
  })

  it('opens manual planning from a day cell click with the clicked date prefilled', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    createManualCatalogEntry.mockResolvedValue({ entry: { id: 12 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Día futuro' }))

    expect(await screen.findByLabelText('Fecha programada')).toHaveValue(dayCellClickDate)
    fireEvent.change(screen.getByLabelText('Tarea de catálogo'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    await waitFor(() => expect(createManualCatalogEntry).toHaveBeenCalledWith({ area_id: 8, task_id: 123, scheduled_date: dayCellClickDate }, expect.any(String)))
  })

  it('ignores timed cells and day clicks while a detail dialog is open', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })

    render(<CalendarioAreaPage />)
    await screen.findByText('Auditoría')

    fireEvent.click(screen.getByRole('button', { name: 'Hora 9' }))
    expect(screen.queryByRole('dialog', { name: 'Planificar tarea manual' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Auditoría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Día futuro' }))
    expect(screen.getByRole('dialog', { name: 'Auditoría' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Planificar tarea manual' })).not.toBeInTheDocument()
  })

  it('offers Crear como completada only for a qualitative task scheduled today', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getTareas.mockResolvedValue([{ id_tarea: 321, nombre: 'Cualitativa', manual_planning_enabled: true, manual_planning_kind: 'qualitative' }])

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    fireEvent.change(await screen.findByLabelText('Tarea de catálogo'), { target: { value: '321' } })

    expect(screen.getByLabelText('Fecha programada')).toHaveValue(isoDate(0))
    expect(screen.getByLabelText('Crear como completada')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fecha programada'), { target: { value: isoDate(1) } })
    expect(screen.queryByLabelText('Crear como completada')).not.toBeInTheDocument()
  })

  it('sends starts_completed when a qualitative task is created as completed today', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getTareas.mockResolvedValue([{ id_tarea: 321, nombre: 'Cualitativa', manual_planning_enabled: true, manual_planning_kind: 'qualitative' }])
    createManualCatalogEntry.mockResolvedValue({ entry: { id: 71 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    fireEvent.change(await screen.findByLabelText('Tarea de catálogo'), { target: { value: '321' } })
    fireEvent.click(screen.getByLabelText('Crear como completada'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    await waitFor(() => expect(createManualCatalogEntry).toHaveBeenCalledTimes(1))
    expect(createManualCatalogEntry.mock.calls[0][0]).toMatchObject({ scheduled_date: isoDate(0), starts_completed: true })
  })

  it('omits starts_completed from a future qualitative payload', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getTareas.mockResolvedValue([{ id_tarea: 321, nombre: 'Cualitativa', manual_planning_enabled: true, manual_planning_kind: 'qualitative' }])
    createManualCatalogEntry.mockResolvedValue({ entry: { id: 72 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    fireEvent.change(await screen.findByLabelText('Tarea de catálogo'), { target: { value: '321' } })
    fireEvent.change(screen.getByLabelText('Fecha programada'), { target: { value: isoDate(1) } })
    expect(screen.queryByLabelText('Crear como completada')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    await waitFor(() => expect(createManualCatalogEntry).toHaveBeenCalledTimes(1))
    expect(createManualCatalogEntry.mock.calls[0][0].scheduled_date).toBe(isoDate(1))
    expect(createManualCatalogEntry.mock.calls[0][0]).not.toHaveProperty('starts_completed')
  })

  it('opens the dialog for a past day and disables catalog creation with an inline message', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Día pasado' }))

    expect(await screen.findByLabelText('Fecha programada')).toHaveValue(isoDate(-3))
    expect(screen.getByText('Las tareas de catálogo solo admiten hoy o fechas futuras.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear entrada' })).toBeDisabled()
  })

  it('allows an ad hoc entry on that past day and sends the past scheduled date', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    createAdHocActivity.mockResolvedValue({ activity: { id: 73 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Día pasado' }))
    await screen.findByLabelText('Fecha programada')
    fireEvent.change(screen.getByLabelText('Tipo de entrada'), { target: { value: 'ad_hoc' } })

    expect(screen.queryByText('Las tareas de catálogo solo admiten hoy o fechas futuras.')).not.toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Crear entrada' })
    expect(submit).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Actividad pasada' } })
    fireEvent.click(submit)

    await waitFor(() => expect(createAdHocActivity).toHaveBeenCalledWith({ area_id: 8, name: 'Actividad pasada', description: '', scheduled_date: isoDate(-3) }, expect.any(String)))
  })

  it('warns about an absence on the selected date without disabling submission', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaAbsences.mockResolvedValue({ month: '2026-09', absences: [{ id: 10, source: 'vacation', type: 'approved', date: dayCellClickDate, slot: 'full_day' }] })

    render(<CalendarioAreaPage />)
    await screen.findByTestId('full-calendar')
    fireEvent.click(screen.getByRole('button', { name: 'Día futuro' }))

    expect(await screen.findByLabelText('Fecha programada')).toHaveValue(dayCellClickDate)
    expect(screen.getByText('Ese día tenés una ausencia registrada. No se puede planificar en esa fecha.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear entrada' })).toBeEnabled()
  })

  it('maps the absence conflict to Spanish and keeps the dialog open', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    createManualCatalogEntry.mockRejectedValue(Object.assign(new Error('manual_creation_blocked_by_absence'), { status: 409, detail: 'manual_creation_blocked_by_absence' }))

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    fireEvent.change(await screen.findByLabelText('Tarea de catálogo'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese día tenés una ausencia registrada. No se puede planificar en esa fecha.')
    expect(document.body).not.toHaveTextContent('manual_creation_blocked_by_absence')
    expect(screen.getByRole('dialog', { name: 'Planificar tarea manual' })).toBeInTheDocument()
  })

  it('exposes the today min attribute for catalog dates only', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))

    expect(await screen.findByLabelText('Fecha programada')).toHaveAttribute('min', isoDate(0))
    fireEvent.change(screen.getByLabelText('Tipo de entrada'), { target: { value: 'ad_hoc' } })
    expect(screen.getByLabelText('Fecha programada')).not.toHaveAttribute('min')
  })

  it('navigates to the created entry month instead of reloading the current one', async () => {
    const today = new Date()
    const created = new Date(today.getFullYear(), today.getMonth() + 2, 1)
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    createManualCatalogEntry.mockResolvedValue({ entry: { id: 13 } })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Planificar tarea manual' }))
    fireEvent.change(await screen.findByLabelText('Tarea de catálogo'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Fecha programada'), { target: { value: toIsoDate(created) } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear entrada' }))

    await waitFor(() => expect(gotoDate).toHaveBeenCalledWith(created))
    expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers only permitted pending quantitative catalog actions and refreshes after updating its note and branch', async () => {
    const manual = { id: 41, task: { name: 'Catálogo cuantitativo' }, status: 'pending', effective_date: '2026-10-10', planning_note: 'Antes', branch_id: 11, classification: 'quantitative' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [manual] }))
    updateManualCatalogEntry.mockResolvedValue({})
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cuantitativo/ }))
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprogramar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar entrada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Justificar pérdida de alcance' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await screen.findByLabelText('Sucursal')
    fireEvent.change(screen.getByLabelText('Nota de planificación'), { target: { value: 'Después' } })
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateManualCatalogEntry).toHaveBeenCalledWith(41, { planning_note: 'Después', branch_id: 11 }, expect.any(String)))
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
  })

  it('runs quantitative catalog completion and reschedule commands with distinct idempotency keys', async () => {
    const manual = { id: 42, task: { name: 'Catálogo cuantitativo' }, status: 'pending', effective_date: '2026-10-10', planning_note: '', classification: 'quantitative' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [manual] }))
    completeManualCatalogEntry.mockResolvedValue({})
    rescheduleManualCatalogEntry.mockResolvedValue({})
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cuantitativo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Terminada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))
    await waitFor(() => expect(completeManualCatalogEntry).toHaveBeenCalledWith(42, { reason: 'Terminada' }, expect.any(String)))

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cuantitativo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-10-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprogramación' }))
    await waitFor(() => expect(rescheduleManualCatalogEntry).toHaveBeenCalledWith(42, { target_date: '2026-10-11' }, expect.any(String)))
    expect(rescheduleManualCatalogEntry.mock.calls[0][2]).not.toBe(completeManualCatalogEntry.mock.calls[0][2])
  })

  it('labels the manual catalog classification in Spanish', async () => {
    const qualitative = { id: 81, task: { name: 'Catálogo cualitativo' }, status: 'pending', effective_date: '2026-10-10', classification: 'qualitative' }
    const quantitative = { id: 82, task: { name: 'Catálogo cuantitativo' }, status: 'pending', effective_date: '2026-10-10', classification: 'quantitative' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [qualitative, quantitative] }))
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cualitativo/ }))
    const qualitativeDialog = screen.getByRole('dialog', { name: 'Catálogo cualitativo' })
    expect(qualitativeDialog).toHaveTextContent('Clasificación')
    expect(qualitativeDialog).toHaveTextContent('Cualitativa')
    expect(qualitativeDialog).not.toHaveTextContent('qualitative')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' }))

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cuantitativo/ }))
    const quantitativeDialog = screen.getByRole('dialog', { name: 'Catálogo cuantitativo' })
    expect(quantitativeDialog).toHaveTextContent('Cuantitativa')
    expect(quantitativeDialog).not.toHaveTextContent('quantitative')
  })

  it('offers qualitative cancellation and scope-loss only when the returned state permits each action', async () => {
    const qualitative = { id: 43, task: { name: 'Catálogo cualitativo' }, status: 'pending', effective_date: '2026-10-10', classification: 'qualitative' }
    const scopeLoss = { id: 44, task: { name: 'Catálogo sin alcance' }, status: 'pending', effective_date: '2026-10-10', classification: 'quantitative', scope_loss_justification_available: true }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [qualitative, scopeLoss] }))
    cancelManualCatalogEntry.mockResolvedValue({})
    justifyManualCatalogEntryScopeLoss.mockResolvedValue({})
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo cualitativo/ }))
    expect(screen.getByRole('button', { name: 'Cancelar entrada' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Justificar pérdida de alcance' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar entrada' }))
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'No corresponde' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    await waitFor(() => expect(cancelManualCatalogEntry).toHaveBeenCalledWith(43, { reason: 'No corresponde' }, expect.any(String)))

    fireEvent.click(await screen.findByRole('button', { name: /Catálogo sin alcance/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Justificar pérdida de alcance' }))
    fireEvent.change(screen.getByLabelText('Justificación'), { target: { value: 'Sucursal transferida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar justificación' }))
    await waitFor(() => expect(justifyManualCatalogEntryScopeLoss).toHaveBeenCalledWith(44, { comment: 'Sucursal transferida' }, expect.any(String)))
  })

  it('shows scope-loss only for an exactly true server flag and retries a rejected justification with a new key', async () => {
    const hidden = { id: 45, task: { name: 'Sin permiso explícito' }, status: 'pending', effective_date: '2026-10-10', classification: 'quantitative', scope_loss_justification_available: 'true' }
    const visible = { id: 46, task: { name: 'Con permiso explícito' }, status: 'pending', effective_date: '2026-10-10', classification: 'quantitative', scope_loss_justification_available: true }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [hidden, visible] }))
    justifyManualCatalogEntryScopeLoss.mockRejectedValueOnce(Object.assign(new Error('Justificación inválida'), { status: 400 })).mockResolvedValueOnce({})
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Sin permiso explícito/ }))
    expect(screen.queryByRole('button', { name: 'Justificar pérdida de alcance' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' }))

    fireEvent.click(await screen.findByRole('button', { name: /Con permiso explícito/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Justificar pérdida de alcance' }))
    expect(screen.getByLabelText('Justificación')).toHaveAttribute('maxlength', '100')
    fireEvent.change(screen.getByLabelText('Justificación'), { target: { value: 'Sucursal transferida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar justificación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de validación: Justificación inválida')
    const rejectedKey = justifyManualCatalogEntryScopeLoss.mock.calls[0][2]

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar justificación' }))
    await waitFor(() => expect(justifyManualCatalogEntryScopeLoss).toHaveBeenLastCalledWith(46, { comment: 'Sucursal transferida' }, expect.any(String)))
    expect(justifyManualCatalogEntryScopeLoss.mock.calls[1][2]).not.toBe(rejectedKey)
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
  })

  it('updates, completes, and cancels pending ad hoc activities while surfacing recoverable errors', async () => {
    const adHoc = { id: 50, name: 'Actividad local', description: 'Antes', status: 'pending', effective_date: '2026-10-10' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ ad_hoc_activities: [adHoc] }))
    updateAdHocActivity.mockRejectedValueOnce(Object.assign(new Error('Nombre inválido'), { status: 400 })).mockResolvedValueOnce({})
    completeAdHocActivity.mockResolvedValue({})
    cancelAdHocActivity.mockResolvedValue({})
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Actividad local/ }))
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Actividad corregida' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Después' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de validación: Nombre inválido')
    const rejectedKey = updateAdHocActivity.mock.calls[0][2]
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(updateAdHocActivity).toHaveBeenLastCalledWith(50, { name: 'Actividad corregida', description: 'Después' }, expect.any(String)))
    expect(updateAdHocActivity.mock.calls[1][2]).not.toBe(rejectedKey)

    fireEvent.click(await screen.findByRole('button', { name: /Actividad local/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))
    await waitFor(() => expect(completeAdHocActivity).toHaveBeenCalledWith(50, { reason: '' }, expect.any(String)))

    fireEvent.click(await screen.findByRole('button', { name: /Actividad local/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar entrada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    await waitFor(() => expect(cancelAdHocActivity).toHaveBeenCalledWith(50, { reason: '' }, expect.any(String)))
  })

  it('reloads the month without retrying a conflicting manual command', async () => {
    const manual = { id: 51, name: 'Actividad en conflicto', description: '', status: 'pending', effective_date: '2026-10-10' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ ad_hoc_activities: [manual] }))
    completeAdHocActivity.mockRejectedValue(Object.assign(new Error('changed'), { status: 409 }))
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Actividad en conflicto/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('estado de la ocurrencia cambió')
    expect(completeAdHocActivity).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
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
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, coverage_snapshot: { known: true, jornada: 'morning' } }] })
    getMonthlyAreaAbsences.mockRejectedValue(new Error('Ausencias no disponibles.'))
    render(<CalendarioAreaPage />)

    expect(await screen.findByText('Auditoría')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las ausencias del área: Ausencias no disponibles.')
  })

  it('does not render potentially covered tasks before the monthly absences resolve', async () => {
    let resolveAbsences
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, coverage_snapshot: { known: true, jornada: 'morning' } }] })
    getMonthlyAreaAbsences.mockImplementation(() => new Promise((resolve) => { resolveAbsences = resolve }))

    render(<CalendarioAreaPage />)

    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalled())
    expect(screen.queryByText('Auditoría')).not.toBeInTheDocument()
    act(() => resolveAbsences({ absences: [{ id: 10, source: 'vacation', date: '2026-09-03', slot: 'morning' }] }))
    expect(await screen.findByText('Vacaciones · Mañana')).toBeInTheDocument()
    expect(screen.queryByText('Auditoría')).not.toBeInTheDocument()
  })

  it('opens an accessible detail dialog with optional metadata', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    const event = await screen.findByRole('button', { name: /Auditoría/ })
    fireEvent.click(event)
    const dialog = screen.getByRole('dialog', { name: 'Auditoría' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Jornada')
    expect(dialog).toHaveTextContent('Mañana')
    expect(dialog).toHaveTextContent('Ambas jornadas')
    expect(dialog).not.toHaveTextContent('Peso')
    expect(dialog).not.toHaveTextContent('Plantilla')
    expect(dialog).not.toHaveTextContent('Versión')
    expect(screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })).toHaveFocus()
  })

  it('opens a deposit-review worklist using the calendar virtual id instead of the internal occurrence id', async () => {
    const depositOccurrence = { ...occurrence, id: 'occurrence-signed-opaque', occurrence_id: 117, task: { id: 123, name: 'Deposit review', mode: 'deposit_review' } }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [depositOccurrence] })
    getDepositReviewWorklist.mockResolvedValue({
      id: 'occurrence-signed-opaque',
      state: 'pending',
      origin_date: '2026-09-02',
      historical_context: { scheduled_on: '2026-09-02', effective_on: '2026-09-03', attribution_month: '2026-09-01' },
      cases: [{ id: 'case-signed-opaque', branch_code: 'BRANCH-007', closure_date: '2026-09-01', classification: 'report_available', decision: null }],
      terminal: { state: null },
    })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Deposit review/ }))

    expect(await screen.findByRole('dialog', { name: 'Revisión de depósitos' })).toHaveTextContent('BRANCH-007')
    expect(screen.getByRole('dialog')).toHaveTextContent('2026-09-02')
    expect(getDepositReviewWorklist).toHaveBeenCalledWith('occurrence-signed-opaque')
    expect(getDepositReviewWorklist).not.toHaveBeenCalledWith(117)
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sin registro revisado para BRANCH-007' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conforme para BRANCH-007' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Con observación para BRANCH-007' })).toBeInTheDocument()
  })

  it('navigates an area inventory occurrence to its dedicated workspace instead of opening a modal', async () => {
    const inventoryOccurrence = { ...occurrence, occurrence_id: 117, effective_date: '2026-09-03', task: { id: 21, name: 'Inventario de área', mode: 'inventory_area' } }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [inventoryOccurrence] })

    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Inventario de área/ }))

    expect(navigate).toHaveBeenCalledWith('/calendario-area/inventario/117?fecha=2026-09-03')
    expect(screen.queryByRole('dialog', { name: 'Registrar inventario' })).not.toBeInTheDocument()
  })

  it('does not offer sin_registro_revisado for a pending case', async () => {
    const depositOccurrence = { ...occurrence, id: 'occurrence-signed-opaque', occurrence_id: undefined, task: { id: 123, name: 'Deposit review', mode: 'deposit_review' } }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [depositOccurrence] })
    getDepositReviewWorklist.mockResolvedValue({
      id: 'occurrence-signed-opaque', state: 'pending', origin_date: '2026-09-02',
      historical_context: { scheduled_on: '2026-09-02', effective_on: '2026-09-03', attribution_month: '2026-09-01' },
      cases: [{ id: 'case-signed-opaque', branch_code: 'BRANCH-007', closure_date: '2026-09-01', classification: 'pending', decision: null }], terminal: { state: null },
    })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Deposit review/ }))

    expect(await screen.findByText('Pendiente de envío')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conforme para BRANCH-007' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Con observación para BRANCH-007' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sin registro revisado para BRANCH-007' })).not.toBeInTheDocument()
  })

  it('preserves the ordinary occurrence dialog for a non-deposit-review task', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, id: 'ordinary-opaque', task: { id: 9, name: 'Auditoría', mode: 'simple' } }] })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))

    expect(screen.getByRole('dialog', { name: 'Auditoría' })).toBeInTheDocument()
    expect(getDepositReviewWorklist).not.toHaveBeenCalled()
  })

  it('sends exact opaque decision payloads and refreshes the calendar only after explicit finalization', async () => {
    const depositOccurrence = { ...occurrence, id: 'occurrence-signed-opaque', occurrence_id: undefined, task: { id: 123, name: 'Deposit review', mode: 'deposit_review' } }
    const pendingWorklist = {
      id: 'occurrence-signed-opaque', state: 'pending', origin_date: '2026-09-02',
      historical_context: { scheduled_on: '2026-09-02', effective_on: '2026-09-03', attribution_month: '2026-09-01' },
      cases: [{ id: 'case-signed-opaque', branch_code: 'BRANCH-007', closure_date: '2026-09-01', classification: 'report_available', decision: null }], terminal: { state: null },
    }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [depositOccurrence] })
    getDepositReviewWorklist.mockResolvedValue(pendingWorklist)
    recordDepositReviewDecision.mockResolvedValue({ worklist: { ...pendingWorklist, cases: [{ ...pendingWorklist.cases[0], decision: 'conforme' }] } })
    finalizeDepositReviewWorklist.mockResolvedValue({ worklist: { ...pendingWorklist, state: 'completed', cases: [{ ...pendingWorklist.cases[0], decision: 'conforme' }], terminal: { state: 'completed' } } })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Deposit review/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Conforme para BRANCH-007' }))

    await waitFor(() => expect(recordDepositReviewDecision).toHaveBeenCalledWith('occurrence-signed-opaque', 'case-signed-opaque', expect.objectContaining({ decision: 'conforme', comment: '' })))
    expect(recordDepositReviewDecision.mock.calls[0][2].idempotency_key).toEqual(expect.any(String))
    expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar revisión' }))
    await waitFor(() => expect(finalizeDepositReviewWorklist).toHaveBeenCalledWith('occurrence-signed-opaque', expect.objectContaining({ idempotency_key: expect.any(String) })))
    expect(await screen.findByText('La revisión de depósitos quedó completada.')).toBeInTheDocument()
    await waitFor(() => expect(getMonthlyAreaOccurrences).toHaveBeenCalledTimes(2))
  })

  it('requires and focuses a comment for sin_registro_revisado, then sends it', async () => {
    const depositOccurrence = { ...occurrence, id: 'occurrence-signed-opaque', occurrence_id: undefined, task: { id: 123, name: 'Deposit review', mode: 'deposit_review' } }
    const pendingWorklist = { id: 'occurrence-signed-opaque', state: 'pending', origin_date: '2026-09-02', historical_context: { scheduled_on: '2026-09-02', effective_on: '2026-09-03', attribution_month: '2026-09-01' }, cases: [{ id: 'case-signed-opaque', branch_code: 'BRANCH-007', closure_date: '2026-09-01', classification: 'sin_registro', decision: null }], terminal: { state: null } }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [depositOccurrence] })
    getDepositReviewWorklist.mockResolvedValue(pendingWorklist)
    recordDepositReviewDecision.mockResolvedValue({ worklist: pendingWorklist })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Deposit review/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sin registro revisado para BRANCH-007' }))
    const comment = screen.getByLabelText(/Comentario/)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar decisión' }))
    expect(await screen.findByText('El comentario es obligatorio para registrar que no hay un depósito revisado.')).toBeInTheDocument()
    expect(comment).toHaveFocus()
    fireEvent.change(comment, { target: { value: 'No hay comprobante disponible.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar decisión' }))
    await waitFor(() => expect(recordDepositReviewDecision).toHaveBeenCalledWith('occurrence-signed-opaque', 'case-signed-opaque', expect.objectContaining({ decision: 'sin_registro_revisado', comment: 'No hay comprobante disponible.' })))
  })

  it('refetches a worklist after a 409 and keeps the review recoverable', async () => {
    const depositOccurrence = { ...occurrence, id: 'occurrence-signed-opaque', occurrence_id: undefined, task: { id: 123, name: 'Deposit review', mode: 'deposit_review' } }
    const pendingWorklist = { id: 'occurrence-signed-opaque', state: 'pending', origin_date: '2026-09-02', historical_context: { scheduled_on: '2026-09-02', effective_on: '2026-09-03', attribution_month: '2026-09-01' }, cases: [{ id: 'case-signed-opaque', branch_code: 'BRANCH-007', closure_date: '2026-09-01', classification: 'report_available', decision: null }], terminal: { state: null } }
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [depositOccurrence] })
    getDepositReviewWorklist.mockResolvedValue(pendingWorklist)
    recordDepositReviewDecision.mockRejectedValue(Object.assign(new Error('changed'), { status: 409 }))
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Deposit review/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Conforme para BRANCH-007' }))

    expect(await screen.findByText('La revisión cambió o ya fue resuelta. Se recargó la bandeja.')).toBeInTheDocument()
    await waitFor(() => expect(getDepositReviewWorklist).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('dialog', { name: 'Revisión de depósitos' })).toBeInTheDocument()
  })

  it('traps Tab from the last dialog control to the first', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })
    const lastButton = screen.getByRole('button', { name: 'Reprogramar' })
    lastButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })

  it('traps Shift+Tab from the first dialog control to the last', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
    const closeButton = screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' })
    const lastButton = screen.getByRole('button', { name: 'Reprogramar' })
    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(lastButton).toHaveFocus()
  })

  it('closes on Escape and restores focus to the calendar occurrence', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    const event = await screen.findByRole('button', { name: /Auditoría/ })
    fireEvent.click(event)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(event).toHaveFocus()
  })

  it('labels and enables commands only for the pending public status', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Pendiente')
    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprogramar' })).toBeInTheDocument()
  })

  it('allows completing a deferred occurrence without allowing it to be rescheduled again', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, status: 'diferida' }] })
    render(<CalendarioAreaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))

    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
  })

  it('does not expose commands for a non-pending occurrence', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, status: 'scheduled', coverage_snapshot: undefined, template: undefined, template_version: undefined }] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('scheduled')
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Jornada')).not.toBeInTheDocument()
  })

  it('confirms completion, prevents a duplicate submission, and reloads the month', async () => {
    let resolveCommand
    completeAreaOccurrence.mockReturnValue(new Promise((resolve) => { resolveCommand = resolve }))
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence] })
    render(<CalendarioAreaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar completar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Completando...' }))
    expect(completeAreaOccurrence).toHaveBeenCalledTimes(1)
    expect(completeAreaOccurrence).toHaveBeenCalledWith(4, expect.any(String))
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
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
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
    fireEvent.click(await screen.findByRole('button', { name: /Auditoría/ }))
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
    expect(screen.getAllByText('Área: Operaciones')).toHaveLength(2)
    expect(screen.getByText('Cierre mensual')).toBeInTheDocument()
    expect(screen.getByText('Cierre adicional')).toBeInTheDocument()
    expect(screen.getAllByText('Peso esperado')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente mes' }))
    await waitFor(() => expect(getMonthlyAreaPerformance).toHaveBeenLastCalledWith('2026-11'))
  })

  it('applies the Analiza token scope and distinct event-chip structure to calendar occurrences', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [occurrence, { ...occurrence, occurrence_id: 5, task: 'Inventario' }] })

    render(<CalendarioAreaPage />)

    expect((await screen.findByText('Auditoría')).closest('button')).toHaveClass('calendario-area-event-chip')
    expect(screen.getByText('Inventario').closest('button')).toHaveClass('calendario-area-event-chip')
    expect(screen.getByText('Auditoría').closest('button')).toHaveClass('calendario-area-event-chip--occurrence')
    expect(screen.getByText('Auditoría').closest('.tema-analiza')).toHaveAttribute('data-responsive-breakpoints', '375 768 1024 1440')
    expect(screen.getByTestId('full-calendar').closest('.calendario-area-calendar__surface')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-weekday-header')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-current-day')).toBeInTheDocument()
  })

  it('renders each occurrence with a visible title, compact SVG marker, and accessible status label', async () => {
    const statuses = [
      ['pendiente', 'Pendiente', 'pending'],
      ['completada', 'Completada', 'complete'],
      ['vencida', 'Vencida', 'overdue'],
      ['justificada', 'Justificada', 'justified'],
      ['diferida', 'Diferida', 'deferred'],
    ]
    getMonthlyAreaOccurrences.mockResolvedValue({
      occurrences: statuses.map(([status], index) => ({ ...occurrence, occurrence_id: index + 10, task: `Tarea ${status}`, status })),
    })

    render(<CalendarioAreaPage />)

    for (const [status, label, marker] of statuses) {
      const task = await screen.findByText(`Tarea ${status}`)
      const chip = task.closest('button')
      expect(chip).toHaveClass(`calendar-occurrence--${status}`)
      expect(chip).toHaveAccessibleName(`Tarea ${status} · ${label}`)
      expect(chip).not.toHaveTextContent(label)
      expect(chip.querySelector('[data-calendar-status-marker]')).toHaveAttribute('data-calendar-status-marker', marker)
    }
    expect(screen.getByText('Tarea diferida').closest('button')).toHaveClass('calendar-occurrence--diferida')
    expect(screen.getByText('Tarea pendiente').closest('button')).not.toHaveClass('calendar-occurrence--diferida')
  })

  it('presents a completed manual catalog entry with the completed chip family and no actions', async () => {
    const manual = { id: 47, task: { name: 'Catálogo completado' }, status: 'completed', effective_date: '2026-10-10', classification: 'qualitative' }
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: [manual] }))

    render(<CalendarioAreaPage />)

    const chip = (await screen.findByText('Catálogo completado')).closest('button')
    expect(chip).toHaveClass('calendar-occurrence--completada')
    expect(chip).toHaveAccessibleName('Catálogo completado · Tarea manual de catálogo · Completada')
    expect(chip.querySelector('[data-calendar-status-marker]')).toHaveAttribute('data-calendar-status-marker', 'complete')
    fireEvent.click(chip)
    expect(screen.getByRole('dialog', { name: 'Catálogo completado' })).toHaveTextContent('Completada')
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
  })

  it('renders overdue, cancelled, and rescheduled manual entries with their own chip families and no actions', async () => {
    const entries = [
      { id: 61, task: { name: 'Vencida manual' }, status: 'overdue', effective_date: '2026-10-10', classification: 'qualitative' },
      { id: 62, task: { name: 'Cancelada manual' }, status: 'cancelled', effective_date: '2026-10-10', classification: 'qualitative' },
      { id: 63, task: { name: 'Reprogramada manual' }, status: 'rescheduled', effective_date: '2026-10-10', classification: 'quantitative' },
    ]
    getMonthlyAreaOccurrences.mockResolvedValue(serviceResponse({ manual_catalog_entries: entries }))

    render(<CalendarioAreaPage />)

    for (const [title, className, label, marker] of [
      ['Vencida manual', 'calendar-occurrence--vencida', 'Vencida', 'overdue'],
      ['Cancelada manual', 'calendar-occurrence--cancelada', 'Cancelada', 'cancelled'],
      ['Reprogramada manual', 'calendar-occurrence--reprogramada', 'Reprogramada', 'rescheduled'],
    ]) {
      const chip = (await screen.findByText(title)).closest('button')
      expect(chip).toHaveClass(className)
      expect(chip).toHaveAccessibleName(`${title} · Tarea manual de catálogo · ${label}`)
      expect(chip.querySelector('[data-calendar-status-marker]')).toHaveAttribute('data-calendar-status-marker', marker)
      fireEvent.click(chip)
      expect(screen.getByRole('dialog', { name: title })).toHaveTextContent(label)
      expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancelar entrada' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la ocurrencia' }))
    }
  })

  it('uses the pending chip family for an unknown occurrence status without crashing', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [{ ...occurrence, task: 'Tarea futura', status: 'en espera' }] })

    render(<CalendarioAreaPage />)

    const task = await screen.findByText('Tarea futura')
    expect(task.closest('button')).toHaveClass('calendar-occurrence--pendiente')
    expect(task.closest('button')).toHaveAccessibleName('Tarea futura · en espera')
    expect(task.closest('button')).not.toHaveTextContent('en espera')
    expect(task.closest('button').querySelector('[data-calendar-status-marker]')).toHaveAttribute('data-calendar-status-marker', 'pending')
  })

  it('presents separated provisional, definitive, and not-applicable performance segments without aggregation', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockResolvedValue({
      month: '2026-09',
      performances: [
        { area: { id: 8, name: 'Operaciones' }, responsibility_id: 3, month: '2026-09', state: 'provisional', weights: { expected: 40, credited: 0 }, percentage: 0 },
        { area: { id: 8, name: 'Operaciones' }, responsibility_id: 9, month: '2026-09', state: 'closed', weights: { expected: 60, credited: 60 }, percentage: 100 },
        { area: { id: 8, name: 'Operaciones' }, responsibility_id: 10, month: '2026-09', state: 'not_applicable', weights: { expected: 0, credited: 0 }, percentage: 0 },
      ],
    })

    render(<CalendarioAreaPage />)

    expect(await screen.findByText('Datos provisionales')).toBeInTheDocument()
    expect(screen.getByText('Cierre definitivo disponible')).toBeInTheDocument()
    expect(screen.getAllByText('No aplica')).toHaveLength(2)
    expect(screen.getAllByText('Área: Operaciones')).toHaveLength(3)
    expect(screen.getAllByText('Peso esperado')[0].parentElement).toHaveTextContent('40')
    expect(screen.getAllByText('Peso acreditado')[1].parentElement).toHaveTextContent('60')
    expect(screen.queryByText('Rendimiento combinado')).not.toBeInTheDocument()
  })

  it('renders the pending monthly-close response as intentional guidance rather than a technical error', async () => {
    getMonthlyAreaOccurrences.mockResolvedValue({ occurrences: [] })
    getMonthlyAreaPerformance.mockRejectedValue(Object.assign(new Error('monthly_performance_not_closed'), { status: 409, detail: 'monthly_performance_not_closed' }))

    render(<CalendarioAreaPage />)

    expect(await screen.findByText('El rendimiento definitivo de este mes todavía no está disponible.')).toBeInTheDocument()
    expect(document.querySelector('.monthly-performance__notice--pending')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('alert', { name: /rendimiento mensual/i })).not.toBeInTheDocument()
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
    expect(await screen.findByText('El rendimiento definitivo de este mes todavía no está disponible.')).toBeInTheDocument()
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
