import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SolicitudesPendientesPage from './SolicitudesPendientesPage'

const {
  useAuth,
  getTrabajosCampo,
  aceptarTrabajoCampo,
  rechazarTrabajoCampo,
  cancelarTrabajoCampo,
  getSolicitudesVacacion,
  aceptarSolicitudVacacion,
  rechazarSolicitudVacacion,
  cancelarSolicitudVacacion,
} = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getTrabajosCampo: vi.fn(),
  aceptarTrabajoCampo: vi.fn(),
  rechazarTrabajoCampo: vi.fn(),
  cancelarTrabajoCampo: vi.fn(),
  getSolicitudesVacacion: vi.fn(),
  aceptarSolicitudVacacion: vi.fn(),
  rechazarSolicitudVacacion: vi.fn(),
  cancelarSolicitudVacacion: vi.fn(),
}))

vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../services/trabajosCampoService', () => ({
  getTrabajosCampo,
  aceptarTrabajoCampo,
  rechazarTrabajoCampo,
  cancelarTrabajoCampo,
}))
vi.mock('../../vacacionesProgramadas/services/vacacionesProgramadasService', () => ({
  getSolicitudesVacacion,
  aceptarSolicitudVacacion,
  rechazarSolicitudVacacion,
  cancelarSolicitudVacacion,
}))
vi.mock('../components/TrabajoCampoModal', () => ({ default: () => null }))
vi.mock('../../vacacionesProgramadas/components/VacacionModal', () => ({ default: () => null }))

const fieldWork = { id_trabajo_campo: 11, fecha: '2026-10-20', jornada: 'manana', estado: 'pendiente', estado_label: 'Pendiente', usuario: { nombre: 'GS Uno' }, solicitado_por: { id_usuario: 7 } }
const vacation = { id_solicitud_vacacion: 21, fecha_inicio: '2026-10-21', fecha_fin: '2026-10-21', estado: 'pendiente', estado_label: 'Pendiente', usuario: { nombre: 'GS Uno' }, solicitado_por: { id_usuario: 7 } }

function setup(profile) {
  useAuth.mockReturnValue({ perfil: profile })
  getTrabajosCampo.mockResolvedValue({ results: [fieldWork] })
  getSolicitudesVacacion.mockResolvedValue({ results: [vacation] })
  render(<MemoryRouter><SolicitudesPendientesPage /></MemoryRouter>)
}

describe('SolicitudesPendientesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aceptarTrabajoCampo.mockResolvedValue({})
    rechazarTrabajoCampo.mockResolvedValue({})
    cancelarTrabajoCampo.mockResolvedValue({})
    aceptarSolicitudVacacion.mockResolvedValue({})
    rechazarSolicitudVacacion.mockResolvedValue({})
    cancelarSolicitudVacacion.mockResolvedValue({})
  })

  it.each([
    ['GA', { type: 'gerente_area' }],
    ['Systems', { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true }],
    ['Admin Master', { type: 'admin_master' }],
  ])('%s receives the administrative pending and history tabs', async (_role, profile) => {
    setup(profile)

    const pendingTab = await screen.findByRole('button', { name: 'Pendientes' })
    expect(pendingTab).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Historial de solicitudes' })).toBeInTheDocument()
    expect(await screen.findByText('Trabajo de campo pendiente')).toBeInTheDocument()
    expect(screen.getByText('Vacaciones programadas pendientes')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Aceptar' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).not.toBeInTheDocument()
  })

  it('keeps GS on its own-request, cancellation-only view without decision controls', async () => {
    setup({ type: 'gerente_sucursal', id: 7 })

    expect(await screen.findByText('Mis solicitudes de trabajo de campo')).toBeInTheDocument()
    expect(screen.getByText('Vacaciones programadas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pendientes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Historial de solicitudes' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cancelar solicitud' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
  })

  it('restores field-work-only history search, pagination, and status presentation without decision controls', async () => {
    const historyRequest = { ...fieldWork, estado: 'aceptado', estado_label: 'Aceptada' }
    setup({ type: 'gerente_area' })
    await screen.findByText('Trabajo de campo pendiente')
    getTrabajosCampo.mockImplementation((params) => Promise.resolve(
      params?.estado === 'pendiente'
        ? { results: [fieldWork] }
        : { results: [historyRequest], count: 11, total_pages: 2 }
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Historial de solicitudes' }))

    expect(await screen.findByText('GS Uno')).toBeInTheDocument()
    expect(screen.getByText('Aceptada')).toBeInTheDocument()
    expect(screen.queryByText('Vacaciones programadas pendientes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
    expect(getTrabajosCampo).toHaveBeenCalledWith({ page: 1, page_size: 10 })
    expect(getSolicitudesVacacion).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, email o motivo...'), { target: { value: 'GS Uno' } })
    await waitFor(() => expect(getTrabajosCampo).toHaveBeenLastCalledWith({ page: 1, page_size: 10, buscar: 'GS Uno' }))

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(getTrabajosCampo).toHaveBeenLastCalledWith({ page: 2, page_size: 10, buscar: 'GS Uno' }))
  })

  it.each([
    ['field work', 'Trabajo de campo pendiente', rechazarTrabajoCampo, 11],
    ['vacation', 'Vacaciones programadas pendientes', rechazarSolicitudVacacion, 21],
  ])('requires and trims a rejection reason for %s before calling its service', async (_family, sectionTitle, reject, id) => {
    setup({ type: 'gerente_area' })
    const section = (await screen.findByText(sectionTitle)).closest('.solicitudes-section')
    fireEvent.click(within(section).getByRole('button', { name: 'Rechazar' }))
    const dialog = screen.getByRole('dialog', { name: 'Rechazar solicitud' })

    fireEvent.change(within(dialog).getByLabelText('Motivo de rechazo'), { target: { value: '   ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('obligatorio')
    expect(reject).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Motivo de rechazo'), { target: { value: '  Sin cobertura  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(reject).toHaveBeenCalledWith(id, 'Sin cobertura'))
    await waitFor(() => expect(getTrabajosCampo).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getSolicitudesVacacion).toHaveBeenCalledTimes(2))
  })

  it('shows a generic non-disclosing error when a collection request is denied', async () => {
    getTrabajosCampo.mockRejectedValueOnce(Object.assign(new Error('Not found outside territory'), { status: 404 }))
    getSolicitudesVacacion.mockResolvedValue({ results: [] })
    useAuth.mockReturnValue({ perfil: { type: 'admin_master' } })
    render(<MemoryRouter><SolicitudesPendientesPage /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las solicitudes')
    expect(screen.queryByText(/territory|fuera/i)).not.toBeInTheDocument()
  })
})
