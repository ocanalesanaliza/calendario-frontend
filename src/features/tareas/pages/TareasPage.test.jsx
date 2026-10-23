import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TareasPage from './TareasPage'

const { getTareas, createTarea, desactivarTarea } = vi.hoisted(() => ({
  getTareas: vi.fn(),
  createTarea: vi.fn(),
  desactivarTarea: vi.fn(),
}))

vi.mock('../services/tareasService', () => ({
  getTareas,
  createTarea,
  updateTarea: vi.fn(),
  desactivarTarea,
  getSubtareas: vi.fn(),
  createSubtarea: vi.fn(),
  updateSubtarea: vi.fn(),
  desactivarSubtarea: vi.fn(),
}))

const tarea = (extra = {}) => ({
  id_tarea: 7,
  nombre: 'Revisión de caja',
  ambito: 'sucursal',
  tipo_recurrencia: 'diario',
  valor_recurrencia: null,
  peso: '2.00',
  es_recordatorio: false,
  bloquea_jornada_posterior: true,
  activa: true,
  ...extra,
})

describe('TareasPage: catálogo', () => {
  beforeEach(() => {
    getTareas.mockReset().mockResolvedValue([])
    createTarea.mockReset().mockResolvedValue({})
    desactivarTarea.mockReset().mockResolvedValue({})
  })

  it('envía los días semanales seleccionados sin usar un campo de texto libre', async () => {
    render(<TareasPage />)
    await screen.findByText(/Todavía no hay tareas en el catálogo/)

    fireEvent.click(screen.getByRole('button', { name: '+ Nueva tarea' }))
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Revisión fin de semana' } })
    fireEvent.change(screen.getByLabelText('Tipo de recurrencia'), { target: { value: 'semanal' } })

    expect(screen.queryByText('Valor recurrencia')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sábado' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Domingo' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }))

    await waitFor(() => expect(createTarea).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Revisión fin de semana',
      tipo_recurrencia: 'semanal',
      valor_recurrencia: '6,7',
    })))
  })

  it('muestra los errores debajo de cada campo y no envía el formulario', async () => {
    render(<TareasPage />)
    await screen.findByText(/Todavía no hay tareas en el catálogo/)

    fireEvent.click(screen.getByRole('button', { name: '+ Nueva tarea' }))
    fireEvent.change(screen.getByLabelText('Tipo de recurrencia'), { target: { value: 'semanal' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }))

    expect(await screen.findByText(/Escribe el nombre de la tarea/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Selecciona al menos un día de la semana.')).toBeInTheDocument()
    expect(createTarea).not.toHaveBeenCalled()
  })

  it('pide confirmación antes de desactivar una tarea', async () => {
    getTareas.mockResolvedValue([tarea()])
    render(<TareasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('¿Desactivar la tarea “Revisión de caja”?')
    expect(desactivarTarea).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' }).at(-1))
    await waitFor(() => expect(desactivarTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByText('Tarea “Revisión de caja” desactivada.')).toBeInTheDocument()
  })

  it('filtra por estado y búsqueda sin distinguir tildes', async () => {
    getTareas.mockResolvedValue([tarea(), tarea({ id_tarea: 8, nombre: 'Limpieza', activa: false })])
    render(<TareasPage />)
    await screen.findByText('Revisión de caja')

    fireEvent.click(screen.getByRole('button', { name: 'Inactivas (1)' }))
    expect(screen.getByText('Limpieza')).toBeInTheDocument()
    expect(screen.queryByText('Revisión de caja')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Todas (2)' }))
    fireEvent.change(screen.getByLabelText('Buscar tarea por nombre'), { target: { value: 'revision' } })
    expect(screen.getByText('Revisión de caja')).toBeInTheDocument()
    expect(screen.queryByText('Limpieza')).not.toBeInTheDocument()
  })
})
