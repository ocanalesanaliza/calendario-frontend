import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MisTareasPage from './MisTareasPage'

const { getMisTareas, registrarTarea, registrarTareasLote, getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo, getRevisionGuardia, guardarRevisionGuardia } = vi.hoisted(() => ({ getMisTareas: vi.fn(), registrarTarea: vi.fn(), registrarTareasLote: vi.fn(), getTrabajosCampo: vi.fn(), aceptarTrabajoCampo: vi.fn(), rechazarTrabajoCampo: vi.fn(), getRevisionGuardia: vi.fn(), guardarRevisionGuardia: vi.fn() }))
let perfil = { type: 'gerente_sucursal', sucursal: { nombre: 'Sucursal Norte' } }
const revokeMyTasksAccess = vi.fn()

vi.mock('../services/operacionService', () => ({ getMisTareas, registrarTarea, registrarTareasLote }))
vi.mock('../../trabajosCampo/services/trabajosCampoService', () => ({ getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo }))
vi.mock('../services/revisionesGuardiaService', () => ({ getRevisionGuardia, guardarRevisionGuardia }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth: () => ({ perfil, revokeMyTasksAccess }) }))

const taskResponse = { meta: { fecha_consultada: '2026-09-05', hora_servidor: '10:00', jornada_servidor: 'manana' }, resumen: { total: 1, disponibles: 1, registradas: 0, cerradas: 0, bloqueadas: 0, manana: { total: 1 }, tarde: { total: 0 } }, results: [{ id_sucursal_tarea: 44, jornada: 'manana', hora: '09:00', hora_fin_registro: '18:00', disponible_para_registro: true, estado_ui: 'disponible', estado_ui_label: 'Disponible', tarea: { id_tarea: 18, nombre: 'Envio de deposito de Sucursal.' } }] }

describe('MisTareasPage deposit demonstrations', () => {
  beforeEach(() => { perfil = { type: 'gerente_sucursal', can_access_my_tasks: true, sucursal: { nombre: 'Sucursal Norte' } }; getMisTareas.mockReset().mockResolvedValue(taskResponse); getTrabajosCampo.mockReset().mockResolvedValue({ results: [] }); registrarTarea.mockReset(); registrarTareasLote.mockReset(); aceptarTrabajoCampo.mockReset(); rechazarTrabajoCampo.mockReset(); getRevisionGuardia.mockReset(); guardarRevisionGuardia.mockReset(); revokeMyTasksAccess.mockReset() })

  it('opens the GS deposit demo, validates cash sales, and shows local feedback without registering', async () => {
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)
    const checkbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Registrar 1 tarea/i }))
    expect(await screen.findByRole('dialog', { name: 'Registrar depósito' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Ventas totales'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo'), { target: { value: '101' } })
    expect(screen.getByRole('alert')).toHaveTextContent('no pueden superar')
    fireEvent.change(screen.getByLabelText('Ventas en efectivo'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Efectivo depositado'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'REF-01' } })
    fireEvent.change(screen.getByLabelText('Fecha real de depósito'), { target: { value: '2026-09-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El depósito se envió para revisión a su gerente de área.')
    expect(registrarTarea).not.toHaveBeenCalled()
  })

  it('does not load or render Mis tareas when the capability is absent', async () => {
    perfil = { type: 'gerente_sucursal', can_access_my_tasks: false }

    render(
      <MemoryRouter initialEntries={['/mis-tareas']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(getMisTareas).not.toHaveBeenCalled()
    expect(getTrabajosCampo).not.toHaveBeenCalled()
  })

  it('revokes visual access and redirects when Mis tareas receives a 403', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 })
    getMisTareas.mockRejectedValueOnce(forbidden)

    render(
      <MemoryRouter initialEntries={['/mis-tareas']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(revokeMyTasksAccess).toHaveBeenCalledTimes(1)
  })

  it('revokes visual access and redirects when field-work requests receive a 403', async () => {
    getTrabajosCampo.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(<MemoryRouter initialEntries={['/mis-tareas']}><Routes><Route path="/" element={<p>Inicio</p>} /><Route path="/mis-tareas" element={<MisTareasPage />} /></Routes></MemoryRouter>)

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(revokeMyTasksAccess).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['aceptar', aceptarTrabajoCampo, 'Aceptar'],
    ['rechazar', rechazarTrabajoCampo, 'Rechazar'],
  ])('revokes visual access and redirects when %s field work receives a 403', async (_action, request, buttonName) => {
    perfil = { type: 'gerente_area', can_access_my_tasks: true }
    getTrabajosCampo.mockResolvedValue({ results: [{ id_trabajo_campo: 9, fecha: '2026-09-05', jornada: 'manana' }] })
    request.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(<MemoryRouter initialEntries={['/mis-tareas']}><Routes><Route path="/" element={<p>Inicio</p>} /><Route path="/mis-tareas" element={<MisTareasPage />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: buttonName }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(revokeMyTasksAccess).toHaveBeenCalledTimes(1)
  })

  it('revokes visual access and redirects when individual registration receives a 403', async () => {
    getMisTareas.mockResolvedValue({ ...taskResponse, results: [{ ...taskResponse.results[0], tarea: { id_tarea: 1, nombre: 'Apertura' } }] })
    registrarTarea.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(<MemoryRouter initialEntries={['/mis-tareas']}><Routes><Route path="/" element={<p>Inicio</p>} /><Route path="/mis-tareas" element={<MisTareasPage />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('checkbox', { name: /Seleccionar Apertura/i }))
    fireEvent.click(screen.getByRole('button', { name: /Registrar 1 tarea/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(revokeMyTasksAccess).toHaveBeenCalledTimes(1)
  })

  it('revokes visual access and redirects when batch registration receives a 403', async () => {
    getMisTareas.mockResolvedValue({ ...taskResponse, resumen: { ...taskResponse.resumen, total: 2, disponibles: 2, manana: { total: 2 } }, results: [
      { ...taskResponse.results[0], tarea: { id_tarea: 1, nombre: 'Apertura' } },
      { ...taskResponse.results[0], id_sucursal_tarea: 45, tarea: { id_tarea: 2, nombre: 'Cierre' } },
    ] })
    registrarTareasLote.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))

    render(<MemoryRouter initialEntries={['/mis-tareas']}><Routes><Route path="/" element={<p>Inicio</p>} /><Route path="/mis-tareas" element={<MisTareasPage />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('checkbox', { name: /Seleccionar Apertura/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar Cierre/i }))
    fireEvent.click(screen.getByRole('button', { name: /Registrar 2 tareas/i }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(revokeMyTasksAccess).toHaveBeenCalledTimes(1)
  })

  it('opens Revisión de Guardia without selecting or registering the task and saves every configured guard', async () => {
    const revisionTask = {
      id_sucursal_tarea: 15,
      jornada: 'manana',
      hora: '09:00',
      disponible_para_registro: true,
      estado_ui: 'disponible',
      estado_ui_label: 'Disponible',
      tarea: { id_tarea: 30, nombre: 'Revisión de Guardia', es_revision_guardia: true },
      revision_guardia: { requiere_formulario: true, numero_guardias: 2, id_sucursal_tarea: 15 },
    }
    getMisTareas.mockResolvedValue({ ...taskResponse, meta: { ...taskResponse.meta, fecha_consultada: '2026-09-09' }, results: [revisionTask] })
    getRevisionGuardia.mockResolvedValue({ fecha: '2026-09-09', numero_guardias: 2, guardias_requeridos: [1, 2], puede_guardar: true, motivo_no_disponible: null, revision: null })
    guardarRevisionGuardia.mockResolvedValue({ revision: { id: 9 } })

    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)
    const taskName = await screen.findByText('Revisión de Guardia')
    expect(screen.queryByRole('checkbox', { name: /Revisión de Guardia/i })).not.toBeInTheDocument()
    fireEvent.click(taskName)

    expect(await screen.findByRole('dialog', { name: 'Revisión de Guardia' })).toBeInTheDocument()
    expect(getRevisionGuardia).toHaveBeenCalledWith(15, '2026-09-09')
    const primerosNombres = screen.getAllByLabelText(/Primer nombre/)
    const primerosApellidos = screen.getAllByLabelText(/Primer apellido/)
    const identidades = screen.getAllByLabelText(/Identidad/)
    fireEvent.change(primerosNombres[0], { target: { value: 'Ana' } })
    fireEvent.change(primerosApellidos[0], { target: { value: 'López' } })
    fireEvent.change(identidades[0], { target: { value: '0801-2000-12345' } })
    fireEvent.change(primerosNombres[1], { target: { value: 'Beto' } })
    fireEvent.change(primerosApellidos[1], { target: { value: 'Pérez' } })
    fireEvent.change(identidades[1], { target: { value: '0801-2000-1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('debe contener 13 dígitos')

    fireEvent.change(identidades[1], { target: { value: '0801-2000-12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se permiten identidades repetidas')

    fireEvent.change(identidades[1], { target: { value: '0801-2001-54321' } })
    fireEvent.click(screen.getAllByLabelText('Botas')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))

    expect(guardarRevisionGuardia).toHaveBeenCalledWith(expect.objectContaining({
      id_sucursal_tarea: 15,
      fecha: '2026-09-09',
      guardias: [
        expect.objectContaining({ numero_guardia: 1, primer_nombre: 'Ana', identidad: '0801-2000-12345', uniforme: expect.objectContaining({ botas: true }) }),
        expect.objectContaining({ numero_guardia: 2, primer_nombre: 'Beto', identidad: '0801-2001-54321' }),
      ],
    }))
    expect(registrarTarea).not.toHaveBeenCalled()
    expect(registrarTareasLote).not.toHaveBeenCalled()
  })
})
