import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AusenciasAreaPage from './AusenciasAreaPage'

const { useAuth, createIdempotencyKey, getGAVacationRequests, createGAVacationRequest, actOnGAVacationRequest, getGASpecialSituations, getCatalog, createGASpecialSituation, deactivateGASpecialSituation } = vi.hoisted(() => ({
  useAuth: vi.fn(), createIdempotencyKey: vi.fn(), getGAVacationRequests: vi.fn(), createGAVacationRequest: vi.fn(), actOnGAVacationRequest: vi.fn(), getGASpecialSituations: vi.fn(), getCatalog: vi.fn(), createGASpecialSituation: vi.fn(), deactivateGASpecialSituation: vi.fn(),
}))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../calendarArea/services/gaVacationRequestsService', () => ({ getGAVacationRequests, createGAVacationRequest, actOnGAVacationRequest }))
vi.mock('../../calendarArea/services/gaSpecialSituationsService', () => ({ getGASpecialSituations, getCatalog, createGASpecialSituation, deactivateGASpecialSituation }))
vi.mock('../../calendarArea/services/calendarAreaApi', () => ({ createIdempotencyKey }))

const ga = { type: 'gerente_area', activo: true, habilitado: true }
const manager = { type: 'gerente_operaciones', activo: true, habilitado: true }
const request = { id: 4, date: '2026-09-10', status: 'pending', segments: [{ date: '2026-09-10', slot: 'morning' }] }
const situation = { id: 7, date: '2026-09-11', type: 'capacitacion', reason: 'Curso', slot: 'afternoon', gerente_area: { id: 8, nombre: 'Ana GA' } }
const catalog = { area_managers: [{ id: 8, display_name: 'Ana GA · Operaciones' }], types: [{ value: 'capacitacion', label: 'Capacitación' }], slots: [{ value: 'full_day', label: 'Full day' }, { value: 'morning', label: 'Morning' }] }

function setup(profile = ga, { vacations = [request], special = [situation], catalogError } = {}) {
  useAuth.mockReturnValue({ perfil: profile })
  getGAVacationRequests.mockResolvedValue({ results: vacations })
  getGASpecialSituations.mockResolvedValue({ results: special })
  if (catalogError) getCatalog.mockRejectedValueOnce(catalogError).mockResolvedValue(catalog)
  else getCatalog.mockResolvedValue(catalog)
  render(<AusenciasAreaPage />)
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

describe('AusenciasAreaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createIdempotencyKey.mockReturnValue('command-key')
    createGAVacationRequest.mockResolvedValue({})
    actOnGAVacationRequest.mockResolvedValue({})
    createGASpecialSituation.mockResolvedValue({})
    deactivateGASpecialSituation.mockResolvedValue({})
  })

  it('shows the GA-only view and preserves the selected slot for a single date', async () => {
    setup()
    expect(await screen.findByText('Mis solicitudes')).toBeInTheDocument()
    expect(getGASpecialSituations).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'afternoon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenCalledWith({ segments: [{ date: '2026-10-01', slot: 'afternoon' }] }, 'command-key'))
  })

  it('creates inclusive full-day segments for a date range', async () => {
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-21' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin (opcional)'), { target: { value: '2026-09-24' } })
    expect(screen.getByText('Del 21 al 24 de septiembre de 2026 · 4 días solicitados')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenCalledWith({ segments: [
      { date: '2026-09-21', slot: 'full_day' },
      { date: '2026-09-22', slot: 'full_day' },
      { date: '2026-09-23', slot: 'full_day' },
      { date: '2026-09-24', slot: 'full_day' },
    ] }, 'command-key'))
  })

  it('excludes Sundays from the standard range requested-day count', async () => {
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-19' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin (opcional)'), { target: { value: '2026-09-21' } })

    expect(screen.getByText('Del 19 al 21 de septiembre de 2026 · 2 días solicitados')).toBeInTheDocument()
  })

  it('formats start-only and same-day standard selections with a singular requested-day count', async () => {
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-09-21' } })
    expect(screen.getByText('21 de septiembre de 2026 · 1 día solicitado')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Fecha de fin (opcional)'), { target: { value: '2026-09-21' } })
    expect(screen.getByText('El 21 de septiembre de 2026 · 1 día solicitado')).toBeInTheDocument()
  })

  it('shows a client validation error for an end date before the start date', async () => {
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-03' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin (opcional)'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha de fin no puede ser anterior')
    expect(createGAVacationRequest).not.toHaveBeenCalled()
  })

  it('allows non-consecutive segments in advanced mode', async () => {
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.click(screen.getByRole('button', { name: '¿Necesitas fechas o jornadas no consecutivas?' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'morning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar fecha' }))
    fireEvent.change(screen.getAllByLabelText('Fecha')[1], { target: { value: '2026-10-03' } })
    fireEvent.change(screen.getAllByLabelText('Jornada')[1], { target: { value: 'afternoon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenCalledWith({ segments: [
      { date: '2026-10-01', slot: 'morning' },
      { date: '2026-10-03', slot: 'afternoon' },
    ] }, 'command-key'))
  })

  it('renders GA vacation requests as cards with segment metadata and a status badge', async () => {
    setup(ga, { vacations: [{ ...request, reason: 'Viaje familiar' }] })
    const card = await screen.findByRole('article')
    expect(card).toHaveTextContent('2026-09-10')
    expect(card).toHaveTextContent('2026-09-10 · Mañana')
    expect(card).toHaveTextContent('Viaje familiar')
    expect(screen.getByText('Pendiente')).toHaveClass('ausencias-area-status-badge')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Situaciones especiales de GA')).not.toBeInTheDocument()
  })

  it('only exposes GA cancellation for pending vacation requests', async () => {
    setup(ga, { vacations: [{ ...request, id: 5, status: 'approved' }] })
    expect(await screen.findByText('Aprobada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).not.toBeInTheDocument()
  })

  it('requires confirmation before a GA cancels and surfaces stable 409 errors', async () => {
    actOnGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('overlap'), { status: 409 }))
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La información cambió o entra en conflicto')
    expect(actOnGAVacationRequest).toHaveBeenCalledWith(4, 'cancel', { reason: '' }, 'command-key')
  })

  it('shows the requester identity supplied by the vacation list without another request', async () => {
    setup(manager, { vacations: [{ ...request, gerente_area: { id: 8, nombre: 'Ana GA' } }] })

    const [vacationTable, specialSituationsTable] = await screen.findAllByRole('table')
    expect(within(vacationTable).getByRole('columnheader', { name: 'Gerente Área' })).toBeInTheDocument()
    expect(within(vacationTable).getByText('Ana GA')).toBeInTheDocument()
    expect(within(specialSituationsTable).getByText('Ana GA')).toBeInTheDocument()
    expect(getGAVacationRequests).toHaveBeenCalledTimes(1)
    expect(getGASpecialSituations).toHaveBeenCalledTimes(1)
  })

  it('renders an em dash instead of an undefined GA when requester data is null', async () => {
    setup(manager, {
      vacations: [{ ...request, gerente_area_id: null, gerente_area: null }],
      special: [{ ...situation, gerente_area_id: null, gerente_area: null }],
    })

    const [vacationTable, specialSituationsTable] = await screen.findAllByRole('table')
    expect(within(vacationTable).getAllByRole('row')[1]).toHaveTextContent('—')
    expect(within(specialSituationsTable).getAllByRole('row')[1]).toHaveTextContent('—')
    expect(screen.queryByText('GA #undefined')).not.toBeInTheDocument()
  })
  it('lets GO approve and reject with a reason and shows special situation controls', async () => {
    setup(manager)
    expect(await screen.findByRole('button', { name: 'Nueva situación' })).toHaveClass('ausencias-area-admin-new-situation')
    expect(screen.getByRole('tab', { name: /Vacaciones/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Situaciones especiales/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.getByText('Pendiente')).toHaveClass('ausencias-area-admin-badge')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    const approveDialog = screen.getByRole('dialog', { name: 'Aprobar vacaciones' })
    fireEvent.change(within(approveDialog).getByLabelText('Motivo'), { target: { value: 'Cobertura validada' } })
    fireEvent.click(within(approveDialog).getByRole('button', { name: 'Aprobar' }))
    await waitFor(() => expect(actOnGAVacationRequest).toHaveBeenCalledWith(4, 'approve', { reason: 'Cobertura validada' }, 'command-key'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    const rejectDialog = screen.getByRole('dialog', { name: 'Rechazar vacaciones' })
    fireEvent.change(within(rejectDialog).getByLabelText('Motivo'), { target: { value: 'Fecha no disponible' } })
    fireEvent.click(within(rejectDialog).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(actOnGAVacationRequest).toHaveBeenCalledWith(4, 'reject', { reason: 'Fecha no disponible' }, 'command-key'))
  })

  it.each([
    ['Systems', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true }],
    ['plain Admin Master', { type: 'admin_master' }],
    ['global Admin Master', { es_admin_maestro: true }],
  ])('gives %s vacation decisions and special-situation management without cancellation', async (_role, profile) => {
    setup(profile)

    expect(await screen.findByRole('button', { name: 'Nueva situación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it('lets an Admin Master select catalog types without exposing type management', async () => {
    setup({ type: 'admin_master' }, { special: [] })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))

    expect(await screen.findByRole('option', { name: 'Capacitación' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tipo/i })).not.toBeInTheDocument()
  })

  it.each([
    ['GA', ga],
    ['GS', { type: 'gerente_sucursal' }],
  ])('does not show GA special-situation management to %s', async (_role, profile) => {
    setup(profile)

    await screen.findByText(profile.type === 'gerente_area' ? 'Mis solicitudes' : 'Solicitudes de vacaciones')
    expect(screen.queryByRole('button', { name: 'Nueva situación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
  })

  it('rejects a whitespace-only rejection reason locally and trims a valid reason', async () => {
    setup(manager)
    await screen.findByRole('button', { name: 'Rechazar' })
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    const dialog = screen.getByRole('dialog', { name: 'Rechazar vacaciones' })
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: '   ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El motivo es obligatorio')
    expect(actOnGAVacationRequest).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: '  Sin cobertura  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(actOnGAVacationRequest).toHaveBeenCalledWith(4, 'reject', { reason: 'Sin cobertura' }, 'command-key'))
  })

  it('renders a single requested day with its slot in the administrative period column', async () => {
    setup(manager, { vacations: [{ id: 9, state: 'pending', segments: [{ date: '2026-09-14', slot: 'morning' }] }] })
    const vacationRow = (await screen.findAllByRole('table'))[0].querySelector('tbody tr')
    const cells = within(vacationRow).getAllByRole('cell')

    const vacationTable = (await screen.findAllByRole('table'))[0]
    expect(within(vacationTable).getByRole('columnheader', { name: 'Período solicitado' })).toBeInTheDocument()
    expect(within(vacationTable).queryByRole('columnheader', { name: 'Fecha' })).not.toBeInTheDocument()
    expect(within(vacationTable).queryByRole('columnheader', { name: 'Segmentos' })).not.toBeInTheDocument()
    expect(cells[1]).toHaveTextContent('14 de septiembre de 2026 · Mañana')
  })

  it('compresses consecutive full-day segments into an administrative period range', async () => {
    setup(manager, { vacations: [{ id: 10, state: 'pending', segments: [
      { date: '2026-09-14', slot: 'full_day' },
      { date: '2026-09-15', slot: 'full_day' },
      { date: '2026-09-16', slot: 'full_day' },
    ] }] })

    expect((await screen.findAllByRole('table'))[0]).toHaveTextContent('Del 14 al 16 de septiembre de 2026 · Jornada completa')
  })

  it('lists every mixed or non-consecutive segment in the administrative period', async () => {
    setup(manager, { vacations: [{ id: 11, state: 'pending', segments: [
      { date: '2026-09-14', slot: 'morning' },
      { date: '2026-09-16', slot: 'afternoon' },
      { date: '2026-09-17', slot: 'full_day' },
    ] }] })

    expect((await screen.findAllByRole('table'))[0]).toHaveTextContent('14 de septiembre de 2026 · Mañana, 16 de septiembre de 2026 · Tarde, 17 de septiembre de 2026 · Jornada completa')
  })

  it('normalizes Spanish approved and accepted variants with the approved badge modifier', async () => {
    setup(manager, { vacations: [
      { id: 12, state: 'aprobado', segments: [{ date: '2026-09-14', slot: 'full_day' }] },
      { id: 13, state: 'aprobada', segments: [{ date: '2026-09-15', slot: 'full_day' }] },
      { id: 14, state: 'aceptado', segments: [{ date: '2026-09-16', slot: 'full_day' }] },
      { id: 15, state: 'aceptada', segments: [{ date: '2026-09-17', slot: 'full_day' }] },
    ] })
    const vacationRows = within((await screen.findAllByRole('table'))[0]).getAllByRole('row').slice(1)

    vacationRows.forEach((row) => {
      expect(within(row).getByText('Aprobada')).toHaveClass('ausencias-area-admin-badge--approved')
    })
  })

  it('shows an honest fallback when an administrative vacation request has no reason', async () => {
    setup(manager, { vacations: [
      { id: 16, state: 'pending', segments: [{ date: '2026-09-14', slot: 'full_day' }] },
      { id: 17, state: 'pending', motivo: '   ', segments: [{ date: '2026-09-15', slot: 'full_day' }] },
    ] })

    const vacationTable = (await screen.findAllByRole('table'))[0]
    expect(within(vacationTable).getAllByText('Sin motivo especificado')).toHaveLength(2)
  })

  it('uses the API state field as canonical and only exposes resolution actions for pending requests', async () => {
    setup(manager, { vacations: [
      { id: 12, state: 'pending', status: 'approved', segments: [{ date: '2026-09-14', slot: 'full_day' }] },
      { id: 13, state: 'approved', status: 'pending', segments: [{ date: '2026-09-15', slot: 'full_day' }] },
      { id: 14, state: 'rejected', status: 'pending', segments: [{ date: '2026-09-16', slot: 'full_day' }] },
      { id: 15, state: 'cancelled', status: 'pending', segments: [{ date: '2026-09-17', slot: 'full_day' }] },
    ] })
    const vacationRows = within((await screen.findAllByRole('table'))[0]).getAllByRole('row').slice(1)

    expect(vacationRows[0]).toHaveTextContent('Pendiente')
    expect(within(vacationRows[0]).getByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(within(vacationRows[0]).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(vacationRows[1]).toHaveTextContent('Aprobada')
    expect(vacationRows[2]).toHaveTextContent('Rechazada')
    expect(vacationRows[3]).toHaveTextContent('Cancelada')
    vacationRows.slice(1).forEach((row) => {
      expect(within(row).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
    })
  })

  it('creates a situation from the Calendar catalog without selecting occurrences', async () => {
    setup(manager, { special: [] })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    expect(screen.getByRole('dialog')).toHaveClass('ausencias-area-admin-situation-modal')
    expect(screen.getByRole('dialog').querySelector('form')).toHaveClass('ausencias-area-admin-situation-form')
    expect(await screen.findByRole('option', { name: 'Ana GA · Operaciones' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mañana' })).toHaveValue('morning')
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-02' } })
    await waitFor(() => expect(getCatalog).toHaveBeenLastCalledWith('2026-10-02'))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Tipo existente'), { target: { value: 'capacitacion' } })
    fireEvent.change(screen.getByLabelText('Razón'), { target: { value: 'Curso' } })
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'morning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear situación' }))
    await waitFor(() => expect(createGASpecialSituation).toHaveBeenCalledWith({ gerente_area_id: '8', date: '2026-10-02', type: 'capacitacion', reason: 'Curso', slot: 'morning' }, 'command-key'))
  })

  it('creates a situation range and filters the catalog by both dates', async () => {
    setup(manager, { special: [] })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    await screen.findByRole('option', { name: 'Ana GA · Operaciones' })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-02' } })
    fireEvent.change(screen.getByLabelText('Fecha fin (opcional)'), { target: { value: '2026-10-04' } })
    await waitFor(() => expect(getCatalog).toHaveBeenLastCalledWith('2026-10-02', '2026-10-04'))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Tipo existente'), { target: { value: 'capacitacion' } })
    fireEvent.change(screen.getByLabelText('Razón'), { target: { value: 'Curso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear situación' }))
    await waitFor(() => expect(createGASpecialSituation).toHaveBeenCalledWith({ gerente_area_id: '8', date: '2026-10-02', end_date: '2026-10-04', type: 'capacitacion', reason: 'Curso', slot: 'full_day' }, 'command-key'))
  })

  it('rejects a situation end date before its start date without submitting', async () => {
    setup(manager, { special: [] })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    await screen.findByRole('option', { name: 'Ana GA · Operaciones' })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-04' } })
    fireEvent.change(screen.getByLabelText('Fecha fin (opcional)'), { target: { value: '2026-10-02' } })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Tipo existente'), { target: { value: 'capacitacion' } })
    fireEvent.change(screen.getByLabelText('Razón'), { target: { value: 'Curso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear situación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha de fin no puede ser anterior a la fecha de inicio.')
    expect(createGASpecialSituation).not.toHaveBeenCalled()
  })

  it('rejects a situation range longer than 31 inclusive days without submitting', async () => {
    setup(manager, { special: [] })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    await screen.findByRole('option', { name: 'Ana GA · Operaciones' })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Fecha fin (opcional)'), { target: { value: '2026-11-01' } })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Tipo existente'), { target: { value: 'capacitacion' } })
    fireEvent.change(screen.getByLabelText('Razón'), { target: { value: 'Curso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear situación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El rango no puede superar 31 días, incluidos ambos extremos.')
    expect(createGASpecialSituation).not.toHaveBeenCalled()
  })

  it('retries a rejected catalog without inventing options', async () => {
    setup(manager, { catalogError: Object.assign(new Error('denied'), { status: 403 }) })
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor mantiene la autorización')
    expect(screen.queryByRole('option', { name: 'Ana GA · Operaciones' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('option', { name: 'Ana GA · Operaciones' })).toBeInTheDocument()
  })

  it('deactivates a situation', async () => {
    setup(manager)
    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('tab', { name: /Situaciones especiales/ }))
    expect(screen.getByRole('cell', { name: 'Capacitación' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
    await waitFor(() => expect(deactivateGASpecialSituation).toHaveBeenCalledWith(7, 'command-key'))
  })

  it('shows 403, 400, and retry states without relying on the UI guard', async () => {
    getGAVacationRequests.mockRejectedValueOnce(Object.assign(new Error('denied'), { status: 403 })).mockResolvedValueOnce({ results: [] })
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor mantiene la autorización')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(getGAVacationRequests).toHaveBeenCalledTimes(2))
    createGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('invalid slot'), { status: 400 }))
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos enviados')
  })

  it('uses generic non-disclosing copy for a 404 operation failure', async () => {
    actOnGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('foreign vacation request'), { status: 404 }))
    setup(manager)
    await screen.findByRole('button', { name: 'Aprobar' })
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Aprobar vacaciones' })).getByRole('button', { name: 'Aprobar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No tienes permisos para realizar esta acción')
    expect(alert).not.toHaveTextContent('foreign vacation request')
  })

  it('reuses a command key after a transport failure in the same modal', async () => {
    createIdempotencyKey.mockReturnValueOnce('retry-key').mockReturnValue('new-key')
    createGAVacationRequest.mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce({})
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('network error')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenNthCalledWith(2, { segments: [{ date: '2026-10-01', slot: 'full_day' }] }, 'retry-key'))
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1)
  })

  it('replaces a command key after a 400 response', async () => {
    createIdempotencyKey.mockReturnValueOnce('invalid-key').mockReturnValueOnce('replacement-key')
    createGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('invalid slot'), { status: 400 })).mockResolvedValueOnce({})
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos enviados')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenNthCalledWith(2, { segments: [{ date: '2026-10-01', slot: 'full_day' }] }, 'replacement-key'))
  })

  it('replaces a command key after a 403 response', async () => {
    createIdempotencyKey.mockReturnValueOnce('forbidden-key').mockReturnValueOnce('replacement-key')
    createGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('denied'), { status: 403 })).mockResolvedValueOnce({})
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor mantiene la autorización')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenNthCalledWith(2, { segments: [{ date: '2026-10-01', slot: 'full_day' }] }, 'replacement-key'))
  })

  it('refreshes data and replaces a command key after a 409 response', async () => {
    createIdempotencyKey.mockReturnValueOnce('conflict-key').mockReturnValueOnce('replacement-key')
    createGAVacationRequest.mockRejectedValueOnce(Object.assign(new Error('overlap'), { status: 409 })).mockResolvedValueOnce({})
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La información cambió o entra en conflicto')
    await waitFor(() => expect(getGAVacationRequests).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenNthCalledWith(2, { segments: [{ date: '2026-10-01', slot: 'full_day' }] }, 'replacement-key'))
  })

  it('discards a stale catalog response after selecting another date', async () => {
    const initialCatalog = deferred()
    const datedCatalog = deferred()
    useAuth.mockReturnValue({ perfil: manager })
    getGAVacationRequests.mockResolvedValue({ results: [request] })
    getGASpecialSituations.mockResolvedValue({ results: [situation] })
    getCatalog.mockImplementation((date) => date ? datedCatalog.promise : initialCatalog.promise)
    render(<AusenciasAreaPage />)

    await screen.findByRole('button', { name: 'Nueva situación' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-02' } })
    datedCatalog.resolve({ ...catalog, area_managers: [{ id: 9, display_name: 'Beto GA · Operaciones' }] })
    expect(await screen.findByRole('option', { name: 'Beto GA · Operaciones' })).toBeInTheDocument()

    initialCatalog.resolve(catalog)
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Ana GA · Operaciones' })).not.toBeInTheDocument())
  })
})
