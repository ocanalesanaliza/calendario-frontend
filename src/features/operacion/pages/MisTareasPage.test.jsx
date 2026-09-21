import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MisTareasPage from './MisTareasPage'
import MisTareasV2Page from './MisTareasV2Page'

const { getMisTareas, registrarTarea, registrarTareasLote, getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo, getRevisionGuardia, guardarRevisionGuardia } = vi.hoisted(() => ({ getMisTareas: vi.fn(), registrarTarea: vi.fn(), registrarTareasLote: vi.fn(), getTrabajosCampo: vi.fn(), aceptarTrabajoCampo: vi.fn(), rechazarTrabajoCampo: vi.fn(), getRevisionGuardia: vi.fn(), guardarRevisionGuardia: vi.fn() }))
let perfil = { type: 'gerente_sucursal', sucursal: { nombre: 'Sucursal Norte' } }
const revokeMyTasksAccess = vi.fn()

vi.mock('../services/operacionService', () => ({ getMisTareas, registrarTarea, registrarTareasLote }))
vi.mock('../../trabajosCampo/services/trabajosCampoService', () => ({ getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo }))
vi.mock('../services/revisionesGuardiaService', () => ({ getRevisionGuardia, guardarRevisionGuardia }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth: () => ({ perfil, revokeMyTasksAccess }) }))

const taskResponse = { meta: { fecha_consultada: '2026-09-05', fecha_servidor: '2026-09-05', hora_servidor: '10:00', jornada_servidor: 'manana' }, resumen: { total: 1, disponibles: 1, registradas: 0, cerradas: 0, bloqueadas: 0, manana: { total: 1 }, tarde: { total: 0 } }, results: [{ id_sucursal_tarea: 44, jornada: 'manana', hora: '09:00', hora_fin_registro: '18:00', disponible_para_registro: true, estado_ui: 'disponible', estado_ui_label: 'Disponible', tarea: { id_tarea: 18, nombre: 'Envio de deposito de Sucursal.' } }] }

describe('MisTareasPage deposit demonstrations', () => {
  beforeEach(() => { perfil = { type: 'gerente_sucursal', can_access_my_tasks: true, sucursal: { nombre: 'Sucursal Norte' } }; getMisTareas.mockReset().mockResolvedValue(taskResponse); getTrabajosCampo.mockReset().mockResolvedValue({ results: [] }); registrarTarea.mockReset(); registrarTareasLote.mockReset(); aceptarTrabajoCampo.mockReset(); rechazarTrabajoCampo.mockReset(); getRevisionGuardia.mockReset(); guardarRevisionGuardia.mockReset(); revokeMyTasksAccess.mockReset() })

  it('uses the standard confirmation flow for the branch deposit task', async () => {
    registrarTarea.mockResolvedValue({})

    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)
    const checkbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Registrar 1 tarea/i }))
    expect(await screen.findByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Registrar depósito' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(registrarTarea).toHaveBeenCalledWith({
      id_tarea: 18,
      fecha: '2026-09-05',
      notas: undefined,
    }))
  })

  it('renders the compact task overview with an explicit active jornada', async () => {
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)

    expect(await screen.findByText('Disponibles')).toBeInTheDocument()
    expect(screen.getByText('Jornada de mañana')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-09-05')
    expect(screen.getByRole('button', { name: 'Mañana1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tarde0' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('groups only the V2 view by valid start time and leaves invalid times last', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 4, disponibles: 4, manana: { total: 4 } },
      results: [
        { ...taskResponse.results[0], id_sucursal_tarea: 1, hora: '11:00', tarea: { id_tarea: 1, nombre: 'Once' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 2, hora: '09:00', tarea: { id_tarea: 2, nombre: 'Nueve' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 3, hora: '09:00:30', tarea: { id_tarea: 3, nombre: 'Nueve y media' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 4, hora: 'not-a-time', tarea: { id_tarea: 4, nombre: 'Sin horario' } },
      ],
    })

    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual(['09:00', '11:00', 'Horario no disponible'])
    const nineOClockGroup = screen.getByRole('heading', { name: '09:00' }).closest('section')
    expect(within(nineOClockGroup).getByText('Nueve').closest('.tareas-cards')).toBeInTheDocument()
    expect(within(nineOClockGroup).getAllByText(/Nueve/).map((task) => task.textContent)).toEqual(['Nueve', 'Nueve y media'])
    const unscheduledGroup = screen.getByRole('heading', { name: 'Horario no disponible' }).closest('section')
    expect(within(unscheduledGroup).getByText('Sin horario')).toBeInTheDocument()
  })

  it('keeps the original view as an ungrouped task grid', async () => {
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)

    await screen.findByText('Envio de deposito de Sucursal.')
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(document.querySelector('.mis-tareas-v2-page')).not.toBeInTheDocument()
    expect(document.querySelector('.tareas-cards > .tarea-card')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Disponibles/i })).not.toBeInTheDocument()
  })

  it('filters and restores only available tasks in V2 without loading data again', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 2, disponibles: 1, manana: { total: 2 } },
      results: [
        { ...taskResponse.results[0], tarea: { id_tarea: 1, nombre: 'Disponible mañana' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 45, disponible_para_registro: false, estado_ui: 'bloqueada', estado_ui_label: 'Bloqueada', tarea: { id_tarea: 2, nombre: 'No disponible mañana' } },
      ],
    })

    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)

    await screen.findByText('No disponible mañana')
    fireEvent.click(screen.getByRole('button', { name: /Disponibles/i }))

    expect(screen.getByRole('status')).toHaveTextContent('Filtro activo: solo tareas disponibles de esta jornada.')
    expect(screen.getByText('Disponible mañana')).toBeInTheDocument()
    expect(screen.queryByText('No disponible mañana')).not.toBeInTheDocument()
    expect(getMisTareas).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('No disponible mañana')).toBeInTheDocument()
    expect(getMisTareas).toHaveBeenCalledTimes(1)
  })

  it('keeps the V2 available filter active across jornadas and clears hidden selections', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 4, disponibles: 2, manana: { total: 2 }, tarde: { total: 2 } },
      results: [
        { ...taskResponse.results[0], id_sucursal_tarea: 1, tarea: { id_tarea: 1, nombre: 'Disponible mañana' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 2, disponible_para_registro: false, estado_ui: 'bloqueada', estado_ui_label: 'Bloqueada', tarea: { id_tarea: 2, nombre: 'No disponible mañana' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 3, jornada: 'tarde', tarea: { id_tarea: 3, nombre: 'Disponible tarde' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 4, jornada: 'tarde', disponible_para_registro: false, estado_ui: 'bloqueada', estado_ui_label: 'Bloqueada', tarea: { id_tarea: 4, nombre: 'No disponible tarde' } },
      ],
    })

    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('checkbox', { name: /Seleccionar Disponible mañana/i }))
    expect(screen.getByRole('button', { name: /Registrar 1 tarea/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Disponibles/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Tarde2' }))

    expect(screen.getByRole('status')).toHaveTextContent('Filtro activo: solo tareas disponibles de esta jornada.')
    expect(screen.getByText('Disponible tarde')).toBeInTheDocument()
    expect(screen.queryByText('No disponible tarde')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar 1 tarea/i })).not.toBeInTheDocument()
  })

  it('adds the selection emphasis only in the V2 view', async () => {
    const { unmount } = render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)

    const v2Checkbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    const v2Card = v2Checkbox.closest('.tarea-card')
    expect(v2Card).toHaveClass('tarea-card--selection-emphasis')
    expect(within(v2Card).queryByText('Seleccionable')).not.toBeInTheDocument()

    fireEvent.click(v2Card)

    expect(v2Checkbox).toBeChecked()
    expect(v2Card).toHaveClass('tarea-card--selection-confirmed')
    expect(within(v2Card).getByText('Seleccionada')).toBeInTheDocument()
    expect(document.querySelector('.mis-tareas-v2-page')).toHaveClass('mis-tareas-page--selection-active')
    expect(document.querySelector('.seleccion-bar')).toHaveClass('seleccion-bar--v2-active', 'seleccion-bar--v2-fixed')
    expect(screen.getByRole('button', { name: /Registrar 1 tarea/i })).toBeEnabled()

    unmount()
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)

    const originalCheckbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    const originalCard = originalCheckbox.closest('.tarea-card')
    expect(originalCard).not.toHaveClass('tarea-card--selection-emphasis', 'tarea-card--selection-confirmed')
    expect(within(originalCard).queryByText('Seleccionable')).not.toBeInTheDocument()

    fireEvent.click(originalCheckbox)

    expect(document.querySelector('.mis-tareas-page')).not.toHaveClass('mis-tareas-page--selection-active')
    expect(document.querySelector('.seleccion-bar')).not.toHaveClass('seleccion-bar--v2-active', 'seleccion-bar--v2-fixed')
  })

  it('toggles V2 card selection with the keyboard through its native checkbox', async () => {
    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)

    const checkbox = await screen.findByRole('checkbox', { name: /Seleccionar Envio de deposito/i })
    const card = checkbox.closest('.tarea-card')

    checkbox.focus()
    fireEvent.keyDown(checkbox, { key: ' ' })
    expect(checkbox).toBeChecked()
    expect(card).toHaveClass('tarea-card--selection-confirmed')

    fireEvent.keyDown(checkbox, { key: ' ' })
    expect(checkbox).not.toBeChecked()
    expect(card).not.toHaveClass('tarea-card--selection-confirmed')
  })

  it('keeps the full V2 task name available while using the scanable card structure', async () => {
    const longTaskName = 'Verificar el inventario, confirmar las diferencias y registrar las observaciones pendientes de la sucursal'
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      results: [{ ...taskResponse.results[0], tarea: { id_tarea: 18, nombre: longTaskName } }],
    })

    const { unmount } = render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)
    const v2Card = (await screen.findByRole('checkbox', { name: new RegExp(`Seleccionar ${longTaskName}`) })).closest('.tarea-card')

    expect(v2Card).toHaveClass('tarea-card--scanable')
    expect(within(v2Card).getByText(longTaskName)).toHaveClass('tarea-card-nombre--clamped')
    expect(within(v2Card).getByText(longTaskName)).toHaveAttribute('title', longTaskName)
    expect(v2Card.querySelector('.tarea-card-metadata .tarea-card-hora')).toHaveTextContent('09:00 - 18:00')
    expect(v2Card.querySelector('.tarea-card-metadata .badge')).toHaveTextContent('Disponible')

    unmount()
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)

    const originalCard = (await screen.findByRole('checkbox', { name: new RegExp(`Seleccionar ${longTaskName}`) })).closest('.tarea-card')
    expect(originalCard).not.toHaveClass('tarea-card--scanable')
    expect(originalCard.querySelector('.tarea-card-metadata')).not.toBeInTheDocument()
    expect(within(originalCard).getByText(longTaskName)).not.toHaveAttribute('title')
  })

  it('prioritizes urgent and expired tasks from the server date and time only in V2', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 2, disponibles: 2, manana: { total: 2 } },
      meta: { ...taskResponse.meta, hora_servidor: '10:00' },
      results: [
        { ...taskResponse.results[0], id_sucursal_tarea: 1, hora_fin_registro: '10:20', tarea: { id_tarea: 1, nombre: 'Urgente' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 2, hora_fin_registro: '09:59', tarea: { id_tarea: 2, nombre: 'Vencida' } },
      ],
    })

    const { unmount } = render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)
    const urgentCard = (await screen.findByText('Urgente')).closest('.tarea-card')
    const expiredCard = screen.getByText('Vencida').closest('.tarea-card')

    expect(within(urgentCard).getByRole('status')).toHaveTextContent('Quedan 20 min')
    expect(urgentCard).toHaveClass('tarea-card--priority-urgent')
    expect(within(expiredCard).getByRole('status')).toHaveTextContent('Registro vencido')
    expect(expiredCard).toHaveClass('tarea-card--priority-expired')

    unmount()
    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)
    await screen.findByText('Urgente')
    expect(document.querySelector('.tarea-card--priority-urgent, .tarea-card--priority-expired')).not.toBeInTheDocument()
    expect(screen.queryByText('Quedan 20 min')).not.toBeInTheDocument()
    expect(screen.queryByText('Registro vencido')).not.toBeInTheDocument()
  })

  it('keeps unavailable and blocked tasks neutral even when their deadline has passed', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 2, disponibles: 0, bloqueadas: 1, manana: { total: 2 } },
      meta: { ...taskResponse.meta, hora_servidor: '10:00' },
      results: [
        { ...taskResponse.results[0], id_sucursal_tarea: 1, estado_ui: 'no_disponible', estado_ui_label: 'No disponible', disponible_para_registro: false, hora_fin_registro: '09:00', tarea: { id_tarea: 1, nombre: 'No disponible' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 2, estado_ui: 'bloqueada', estado_ui_label: 'Bloqueada', disponible_para_registro: false, hora_fin_registro: '09:00', tarea: { id_tarea: 2, nombre: 'Bloqueada' } },
      ],
    })

    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)
    const unavailableCard = (await screen.findByTitle('No disponible')).closest('.tarea-card')
    const blockedCard = screen.getByTitle('Bloqueada').closest('.tarea-card')

    expect(unavailableCard).toHaveClass('tarea-card--priority-neutral')
    expect(blockedCard).toHaveClass('tarea-card--priority-neutral')
    expect(screen.queryByText(/Quedan \d+ min|Registro vencido/)).not.toBeInTheDocument()
  })

  it('does not calculate priority for a non-current server date or an invalid deadline', async () => {
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      resumen: { ...taskResponse.resumen, total: 2, disponibles: 2, manana: { total: 2 } },
      meta: { ...taskResponse.meta, fecha_consultada: '2026-09-04', hora_servidor: '10:00' },
      results: [
        { ...taskResponse.results[0], id_sucursal_tarea: 1, hora_fin_registro: '10:20', tarea: { id_tarea: 1, nombre: 'Fecha consultada' } },
        { ...taskResponse.results[0], id_sucursal_tarea: 2, hora_fin_registro: 'sin hora', tarea: { id_tarea: 2, nombre: 'Hora inválida' } },
      ],
    })

    render(<MemoryRouter><MisTareasV2Page /></MemoryRouter>)
    const queriedDateCard = (await screen.findByText('Fecha consultada')).closest('.tarea-card')
    const invalidTimeCard = screen.getByText('Hora inválida').closest('.tarea-card')

    expect(queriedDateCard).not.toHaveClass('tarea-card--priority-urgent', 'tarea-card--priority-expired')
    expect(invalidTimeCard).not.toHaveClass('tarea-card--priority-urgent', 'tarea-card--priority-expired')
    expect(screen.queryByText(/Quedan \d+ min|Registro vencido/)).not.toBeInTheDocument()
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

  it('redirects when access is revoked after an authorized render without changing Hook order', async () => {
    const renderRoutes = () => (
      <MemoryRouter initialEntries={['/mis-tareas']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
        </Routes>
      </MemoryRouter>
    )
    const view = render(renderRoutes())

    await screen.findByText('Envio de deposito de Sucursal.')
    perfil = { type: 'gerente_sucursal', can_access_my_tasks: false }

    expect(() => view.rerender(renderRoutes())).not.toThrow()
    expect(await screen.findByText('Inicio')).toBeInTheDocument()
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
    expect(screen.getByRole('group', { name: 'Guardia 1' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Guardia 2' })).toBeInTheDocument()
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

  it('registra que el guardia no se presentó solamente cuando se escribe una nota', async () => {
    const revisionTask = {
      id_sucursal_tarea: 15,
      jornada: 'manana',
      hora: '09:00',
      disponible_para_registro: true,
      estado_ui: 'disponible',
      estado_ui_label: 'Disponible',
      tarea: { id_tarea: 30, nombre: 'Registro de Guardia', es_revision_guardia: true },
      revision_guardia: { requiere_formulario: true, numero_guardias: 2, id_sucursal_tarea: 15 },
    }
    getMisTareas.mockResolvedValue({
      ...taskResponse,
      meta: { ...taskResponse.meta, fecha_consultada: '2026-09-09' },
      results: [revisionTask],
    })
    getRevisionGuardia.mockResolvedValue({
      fecha: '2026-09-09',
      numero_guardias: 2,
      guardias_requeridos: [1, 2],
      puede_guardar: true,
      motivo_no_disponible: null,
      revision: null,
    })
    guardarRevisionGuardia.mockResolvedValue({ revision: { id_revision_guardia: 9 } })

    render(<MemoryRouter><MisTareasPage /></MemoryRouter>)
    fireEvent.click(await screen.findByText('Registro de Guardia'))
    fireEvent.click(await screen.findByRole('button', { name: 'No se presentó guardia' }))
    expect(screen.getByText(/sumará su peso completo/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar ausencia' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La nota es requerida')

    fireEvent.change(screen.getByLabelText('Nota *'), {
      target: { value: 'El guardia asignado no se presentó al turno.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ausencia' }))

    expect(guardarRevisionGuardia).toHaveBeenCalledWith({
      id_sucursal_tarea: 15,
      fecha: '2026-09-09',
      no_se_presento_guardia: true,
      notas: 'El guardia asignado no se presentó al turno.',
    })
    expect(registrarTarea).not.toHaveBeenCalled()
    expect(registrarTareasLote).not.toHaveBeenCalled()
  })
})
