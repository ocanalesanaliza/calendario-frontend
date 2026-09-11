import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlantillaDetallePage from './PlantillaDetallePage'

const { getPlantilla, updateTarea, getTareas } = vi.hoisted(() => ({
  getPlantilla: vi.fn(),
  updateTarea: vi.fn(),
  getTareas: vi.fn(),
}))

vi.mock('../services/plantillasService', () => ({
  getPlantilla,
  updateTarea,
  updatePlantilla: vi.fn(),
  desactivarPlantilla: vi.fn(),
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
    fireEvent.click(screen.getByTitle('Editar'))
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
