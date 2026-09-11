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
const catalog = { area_managers: [{ id: 8, display: 'Ana GA · Operaciones' }], types: [{ value: 'capacitacion', label: 'Capacitación' }], slots: [{ value: 'full_day', label: 'Jornada completa' }, { value: 'morning', label: 'Mañana' }] }

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

  it('shows the GA-only view and creates slot payloads with a command key', async () => {
    setup()
    expect(await screen.findByText('Mis solicitudes')).toBeInTheDocument()
    expect(getGASpecialSituations).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'afternoon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    await waitFor(() => expect(createGAVacationRequest).toHaveBeenCalledWith({ segments: [{ date: '2026-10-01', slot: 'afternoon' }] }, 'command-key'))
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

  it('lets GO approve and reject with a reason and shows special situations', async () => {
    setup(manager)
    expect(await screen.findByText('Situaciones especiales de GA')).toBeInTheDocument()
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

  it('creates a situation from the Calendar catalog without selecting occurrences', async () => {
    setup(manager, { special: [] })
    await screen.findByText('Situaciones especiales de GA')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    expect(screen.getByText('El backend justificará automáticamente las ocurrencias afectadas. No debes seleccionarlas manualmente.')).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Ana GA · Operaciones' })).toBeInTheDocument()
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

  it('retries a rejected catalog without inventing options', async () => {
    setup(manager, { catalogError: Object.assign(new Error('denied'), { status: 403 }) })
    await screen.findByText('Situaciones especiales de GA')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor mantiene la autorización')
    expect(screen.queryByRole('option', { name: 'Ana GA · Operaciones' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('option', { name: 'Ana GA · Operaciones' })).toBeInTheDocument()
  })

  it('deactivates a situation', async () => {
    setup(manager)
    await screen.findByText('Situaciones especiales de GA')
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
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar vacaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos enviados')
  })

  it('reuses a command key after a transport failure in the same modal', async () => {
    createIdempotencyKey.mockReturnValueOnce('retry-key').mockReturnValue('new-key')
    createGAVacationRequest.mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce({})
    setup()
    await screen.findByText('Mis solicitudes')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
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
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
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
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
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
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
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

    await screen.findByText('Situaciones especiales de GA')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-02' } })
    datedCatalog.resolve({ ...catalog, area_managers: [{ id: 9, display: 'Beto GA · Operaciones' }] })
    expect(await screen.findByRole('option', { name: 'Beto GA · Operaciones' })).toBeInTheDocument()

    initialCatalog.resolve(catalog)
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Ana GA · Operaciones' })).not.toBeInTheDocument())
  })
})
