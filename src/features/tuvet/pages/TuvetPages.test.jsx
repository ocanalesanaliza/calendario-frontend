import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aIso } from '../utils/periodos'
import TuvetMisTareasPage from './TuvetMisTareasPage'
import TuvetRevisionesPage from './TuvetRevisionesPage'

const HOY = aIso(new Date())
const enDias = (dias) => { const fecha = new Date(); fecha.setDate(fecha.getDate() + dias); return aIso(fecha) }

function renderMisTareas(ruta = '/tuvet/mis-tareas') {
  render(<MemoryRouter initialEntries={[ruta]}><TuvetMisTareasPage /></MemoryRouter>)
}

const service = vi.hoisted(() => ({
  getMisTareas: vi.fn(),
  getRevisiones: vi.fn(),
  marcarOcurrencia: vi.fn(),
  aprobarOcurrencia: vi.fn(),
  rechazarOcurrencia: vi.fn(),
  descargarDocumento: vi.fn(),
}))

vi.mock('../services/tuvetService', async (importOriginal) => ({ ...(await importOriginal()), ...service }))

const ocurrencia = (extra = {}) => ({
  id: 501,
  nombre: 'Verificar inventario',
  departamento: { id: 4, nombre: 'Laboratorio' },
  plantilla: { id: 15, nombre: 'Control diario' },
  gerente_sucursal: { id: 31, nombre_completo: 'María Pérez' },
  requiere_aprobacion: true,
  requiere_documento: false,
  fecha_programada: HOY,
  fecha_limite: `${HOY}T23:59:59.999999-06:00`,
  estado: 'pendiente',
  vencida: false,
  retraso_minutos: 0,
  documentos: [],
  eventos: [],
  ...extra,
})

describe('TuvetMisTareasPage', () => {
  beforeEach(() => Object.values(service).forEach((mock) => mock.mockReset()))

  it('marca una tarea sin documento y la pasa a revisión', async () => {
    service.getMisTareas.mockResolvedValue({ count: 1, results: [ocurrencia()] })
    service.marcarOcurrencia.mockResolvedValue(ocurrencia({ estado: 'en_revision' }))

    renderMisTareas()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar realizada' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar realizada' }).at(-1))

    await waitFor(() => expect(service.marcarOcurrencia).toHaveBeenCalledWith(501, undefined))
    expect(await screen.findByText('Tarea enviada a revisión.')).toBeInTheDocument()
  })

  it('exige documento cuando la tarea lo requiere', async () => {
    service.getMisTareas.mockResolvedValue({ count: 1, results: [ocurrencia({ requiere_documento: true })] })

    renderMisTareas()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar realizada' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar realizada' }).at(-1))

    expect(await screen.findByText(/Esta tarea requiere adjuntar un documento/)).toBeInTheDocument()
    expect(service.marcarOcurrencia).not.toHaveBeenCalled()
  })

  it('muestra el último comentario de rechazo en una tarea pendiente', async () => {
    service.getMisTareas.mockResolvedValue({
      count: 1,
      results: [ocurrencia({ eventos: [{ id: 1, tipo: 'rechazada', comentario: 'Falta la firma', actor: { nombre: 'Ana' }, creado_en: '2026-10-20T18:00:00-06:00' }] })],
    })

    renderMisTareas()
    expect(await screen.findByText('Falta la firma')).toBeInTheDocument()
  })

  it('por defecto muestra solo las tareas de hoy y las atrasadas', async () => {
    service.getMisTareas.mockResolvedValue({
      count: 3,
      results: [
        ocurrencia({ id: 1, nombre: 'Tarea de hoy' }),
        ocurrencia({ id: 2, nombre: 'Tarea futura', fecha_programada: enDias(3) }),
        ocurrencia({ id: 3, nombre: 'Tarea atrasada', fecha_programada: enDias(-1), vencida: true }),
      ],
    })

    renderMisTareas()

    expect(await screen.findByText('Tarea de hoy')).toBeInTheDocument()
    expect(screen.getByText('Tarea atrasada')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Atrasadas \(1\)/ })).toBeInTheDocument()
    expect(screen.queryByText('Tarea futura')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('en la vista semanal no permite marcar una tarea futura', async () => {
    const futura = enDias(1)
    service.getMisTareas.mockResolvedValue({ count: 1, results: [ocurrencia({ id: 2, nombre: 'Tarea de mañana', fecha_programada: futura })] })

    renderMisTareas(`/tuvet/mis-tareas?periodo=mes&fecha=${futura}`)

    expect(await screen.findByText('Tarea de mañana')).toBeInTheDocument()
    expect(screen.getByText(/Disponible desde/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar realizada' })).not.toBeInTheDocument()
  })

  it('muestra el mensaje del backend si rechaza marcar una tarea aún no habilitada', async () => {
    service.getMisTareas.mockResolvedValue({ count: 1, results: [ocurrencia()] })
    const error = new Error('La tarea todavía no está habilitada. Podrá marcarse a partir del 2026-10-29.')
    error.status = 400
    error.fields = { fecha_programada: ['La tarea todavía no está habilitada. Podrá marcarse a partir del 2026-10-29.'] }
    service.marcarOcurrencia.mockRejectedValue(error)

    renderMisTareas()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar realizada' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar realizada' }).at(-1))

    expect(await screen.findByText(/todavía no está habilitada/)).toBeInTheDocument()
  })
})

describe('TuvetRevisionesPage', () => {
  beforeEach(() => Object.values(service).forEach((mock) => mock.mockReset()))

  it('aprueba una tarea en revisión', async () => {
    service.getRevisiones.mockResolvedValue({ count: 1, results: [ocurrencia({ estado: 'en_revision' })] })
    service.aprobarOcurrencia.mockResolvedValue(ocurrencia({ estado: 'aprobada' }))

    render(<TuvetRevisionesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))

    await waitFor(() => expect(service.aprobarOcurrencia).toHaveBeenCalledWith(501))
    expect(await screen.findByText('Tarea aprobada.')).toBeInTheDocument()
  })

  it('exige comentario para rechazar', async () => {
    service.getRevisiones.mockResolvedValue({ count: 1, results: [ocurrencia({ estado: 'en_revision' })] })
    service.rechazarOcurrencia.mockResolvedValue(ocurrencia({ estado: 'pendiente' }))

    render(<TuvetRevisionesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const dialogo = screen.getByRole('dialog')
    fireEvent.click(dialogo.querySelector('button[type="submit"]'))
    expect(await screen.findByText(/Indica el motivo del rechazo/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Motivo del rechazo/)).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText(/Motivo del rechazo/), { target: { value: 'Documento incompleto' } })
    fireEvent.click(dialogo.querySelector('button[type="submit"]'))
    await waitFor(() => expect(service.rechazarOcurrencia).toHaveBeenCalledWith(501, 'Documento incompleto'))
  })
})
