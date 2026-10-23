import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlantillaDetallePage from './PlantillaDetallePage'

const { getPlantilla, updateTarea, getTareas, duplicarPlantilla } = vi.hoisted(() => ({
  getPlantilla: vi.fn(),
  updateTarea: vi.fn(),
  getTareas: vi.fn(),
  duplicarPlantilla: vi.fn(),
}))

vi.mock('../services/plantillasService', () => ({
  getPlantilla,
  updateTarea,
  updatePlantilla: vi.fn(),
  desactivarPlantilla: vi.fn(),
  duplicarPlantilla,
  addTarea: vi.fn(),
  desactivarTarea: vi.fn(),
  asignarSucursales: vi.fn(),
}))

vi.mock('../../tareas/services/tareasService', () => ({ getTareas }))
vi.mock('../../sucursales/services/sucursalesService', () => ({ getSucursales: vi.fn() }))

const plantilla = {
  id_plantilla: 10,
  nombre: 'Plantilla general',
  descripcion: '',
  activa: true,
  tareas: [{
    id_plantilla_tarea: 21,
    jornada: 'manana',
    hora_sugerida: '08:00',
    aplica_ambas_jornadas: false,
    activa: true,
    tarea: {
      id_tarea: 4,
      nombre: 'Revisión semanal',
      peso: '2.00',
      recurrencia_label: 'Diaria',
    },
    reglas_recurrencia: [{
      tipo: 'semanal',
      dias_semana: '1,2,3,4,5',
      label: 'Solo días seleccionados: lunes, martes, miércoles, jueves y viernes',
      activa: true,
    }],
  }],
}

describe('PlantillaDetallePage: recurrencia por tarea', () => {
  beforeEach(() => {
    getPlantilla.mockReset().mockResolvedValue(plantilla)
    updateTarea.mockReset().mockResolvedValue({})
    getTareas.mockReset().mockResolvedValue([])
    duplicarPlantilla.mockReset()
  })

  it('permite agregar sábado desde la lista y envía la regla semanal', async () => {
    render(
      <MemoryRouter initialEntries={['/plantillas/10']}>
        <Routes>
          <Route path="/plantillas/:id" element={<PlantillaDetallePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Solo días seleccionados: lunes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Revisión semanal' }))
    expect(screen.getByLabelText('Tipo de recurrencia')).toHaveValue('semanal')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sábado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateTarea).toHaveBeenCalledWith(
      '10',
      21,
      expect.objectContaining({
        reglas_recurrencia: [{
          tipo: 'semanal',
          dias_semana: '1,2,3,4,5,6',
          politica_dia_no_laborable: 'omitir',
          activa: true,
        }],
      }),
    ))
  })

  it('no ofrece Registro de Guardia para agregarlo a una plantilla', async () => {
    getTareas.mockResolvedValueOnce([
      { id_tarea: 30, nombre: 'Registro de Guardia', es_revision_guardia: true },
      { id_tarea: 31, nombre: 'Apertura', es_revision_guardia: false },
    ])

    render(
      <MemoryRouter initialEntries={['/plantillas/10']}>
        <Routes>
          <Route path="/plantillas/:id" element={<PlantillaDetallePage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText(/Solo d.as seleccionados: lunes/)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tarea' }))

    expect(await screen.findByText('Apertura')).toBeInTheDocument()
    expect(screen.queryByText('Registro de Guardia')).not.toBeInTheDocument()
  })
})

describe('PlantillaDetallePage: duplicar plantilla', () => {
  function HistoryControls() {
    const navigate = useNavigate()
    const location = useLocation()

    return (
      <>
        <button onClick={() => navigate(-1)}>Volver en historial</button>
        <span data-testid="router-state">{JSON.stringify(location.state)}</span>
      </>
    )
  }

  function renderDetail(initialEntry = '/plantillas/10') {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/plantillas/:id" element={<><HistoryControls /><PlantillaDetallePage /></>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(() => {
    getPlantilla.mockReset().mockResolvedValue(plantilla)
    getTareas.mockReset().mockResolvedValue([])
    duplicarPlantilla.mockReset()
  })

  it.each([true, false])('muestra la acción para una plantilla %s', async (activa) => {
    getPlantilla.mockResolvedValue({ ...plantilla, activa })

    renderDetail()

    expect(await screen.findByRole('button', { name: 'Duplicar plantilla' })).toBeInTheDocument()
  })

  it('muestra la información de la duplicación y permite cancelar sin llamar a la API', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar plantilla' }))

    expect(screen.getByText(/nueva plantilla activa e independiente/)).toBeInTheDocument()
    expect(screen.getByText(/sin asignaciones de sucursales/)).toBeInTheDocument()
    expect(screen.getByText(/tareas activas y las reglas de recurrencia activas/)).toBeInTheDocument()
    expect(screen.getByText(/plantilla original no se modificará/)).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirmButton).toHaveClass('tuvet-btn')
    expect(confirmButton).not.toHaveClass('tuvet-btn-danger-solid')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(duplicarPlantilla).not.toHaveBeenCalled()
  })

  it('mantiene destructiva la confirmación de desactivar', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))

    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveClass('tuvet-btn-danger-solid')
  })

  it('muestra una vez el mensaje en el destino y consume el estado del router', async () => {
    getPlantilla.mockImplementation((templateId) => Promise.resolve(
      String(templateId) === '11' ? { ...plantilla, id_plantilla: 11, nombre: 'Plantilla duplicada' } : plantilla,
    ))
    duplicarPlantilla.mockResolvedValue({ detail: 'Plantilla duplicada', plantilla: { id_plantilla: 11 } })

    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar plantilla' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Plantilla duplicada correctamente.')
    expect(await screen.findByRole('heading', { name: 'Plantilla duplicada' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('router-state')).toHaveTextContent('null'))
    expect(screen.getAllByText('Plantilla duplicada correctamente.')).toHaveLength(1)
    expect(duplicarPlantilla).toHaveBeenCalledWith('10')
  })

  it('oculta el mensaje al volver en el historial a la plantilla origen', async () => {
    getPlantilla.mockImplementation((templateId) => Promise.resolve(
      String(templateId) === '11' ? { ...plantilla, id_plantilla: 11, nombre: 'Plantilla duplicada' } : plantilla,
    ))
    duplicarPlantilla.mockResolvedValue({ id_plantilla: 11 })

    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar plantilla' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Plantilla duplicada correctamente.')

    fireEvent.click(screen.getByRole('button', { name: 'Volver en historial' }))

    expect(await screen.findByRole('heading', { name: 'Plantilla general' })).toBeInTheDocument()
    expect(screen.queryByText('Plantilla duplicada correctamente.')).not.toBeInTheDocument()
  })

  it('solo confirma una vez mientras la solicitud está pendiente', async () => {
    let resolveDuplicate
    duplicarPlantilla.mockReturnValue(new Promise((resolve) => { resolveDuplicate = resolve }))

    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar plantilla' }))
    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    expect(duplicarPlantilla).toHaveBeenCalledTimes(1)
    expect(confirmButton).toBeDisabled()
    resolveDuplicate({ id_plantilla: 11 })
  })

  it('muestra en línea el error exacto de una plantilla sin tareas activas', async () => {
    const noActiveTasks = 'La plantilla no tiene tareas activas y no se puede duplicar.'
    duplicarPlantilla.mockRejectedValue(new Error(noActiveTasks))

    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar plantilla' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText(noActiveTasks)).toBeInTheDocument()
  })

  it('no muestra el mensaje transitorio al abrir o recargar directamente el destino sin estado del router', async () => {
    getPlantilla.mockResolvedValue({ ...plantilla, id_plantilla: 11 })

    renderDetail('/plantillas/11')

    await screen.findByRole('heading', { name: 'Plantilla general' })
    expect(screen.queryByText('Plantilla duplicada correctamente.')).not.toBeInTheDocument()
  })
})
