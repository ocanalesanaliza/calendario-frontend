import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TareasPage from './TareasPage'

const { getTareas, createTarea } = vi.hoisted(() => ({
  getTareas: vi.fn(),
  createTarea: vi.fn(),
}))

vi.mock('../services/tareasService', () => ({
  getTareas,
  createTarea,
  updateTarea: vi.fn(),
  desactivarTarea: vi.fn(),
  getSubtareas: vi.fn(),
  createSubtarea: vi.fn(),
  updateSubtarea: vi.fn(),
  desactivarSubtarea: vi.fn(),
}))

describe('TareasPage: selector de recurrencia', () => {
  beforeEach(() => {
    getTareas.mockReset().mockResolvedValue([])
    createTarea.mockReset().mockResolvedValue({})
  })

  it('envía los días semanales seleccionados sin usar un campo de texto libre', async () => {
    render(<TareasPage />)
    await screen.findByText('No hay tareas registradas.')

    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Revisión fin de semana' } })
    fireEvent.change(screen.getByLabelText('Tipo de recurrencia'), { target: { value: 'semanal' } })

    expect(screen.queryByText('Valor recurrencia')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sábado' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Domingo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))

    await waitFor(() => expect(createTarea).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Revisión fin de semana',
      tipo_recurrencia: 'semanal',
      valor_recurrencia: '6,7',
    })))
  })
})
