import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TareasPage from './TareasPage'

const { getTareas, createTarea, updateTarea, desactivarTarea } = vi.hoisted(() => ({
  getTareas: vi.fn(),
  createTarea: vi.fn(),
  updateTarea: vi.fn(),
  desactivarTarea: vi.fn(),
}))

vi.mock('../services/tareasService', () => ({
  getTareas,
  createTarea,
  updateTarea,
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
    updateTarea.mockReset().mockResolvedValue({})
    desactivarTarea.mockReset().mockResolvedValue({})
  })

  async function abrirModalCrear() {
    render(<TareasPage />)
    await screen.findByText(/Todavía no hay tareas en el catálogo/)
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva tarea' }))
  }

  function completarFormulario(nombre = 'Cierre diario') {
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: nombre } })
  }

  it('inicia la creación con el modo de cumplimiento simple y muestra su guía prospectiva', async () => {
    await abrirModalCrear()

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeChecked()
    expect(screen.getByText(/aplica prospectivamente/)).toBeInTheDocument()
    expect(screen.getByText(/no modifica el historial ni convierte ocurrencias existentes/i)).toBeInTheDocument()
    expect(screen.getByText(/no activa un flujo de usuario ni una bandera/i)).toBeInTheDocument()
  })

  it('muestra el modo devuelto por el servidor al editar', async () => {
    getTareas.mockResolvedValue([tarea({ modo_cumplimiento: 'deposit' })])
    render(<TareasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('radio', { name: /Depósito/ })).toBeChecked()
  })

  it('usa simple al editar una respuesta heredada sin modo de cumplimiento', async () => {
    getTareas.mockResolvedValue([tarea()])
    render(<TareasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeChecked()
  })

  it('ofrece solo simple y depósito para Sucursal', async () => {
    await abrirModalCrear()

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Depósito/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Revisión de depósito/ })).not.toBeInTheDocument()
  })

  it('ofrece solo simple y revisión de depósito para Área', async () => {
    await abrirModalCrear()
    fireEvent.click(screen.getByRole('radio', { name: /^Área/ }))

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Revisión de depósito/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Depósito/ })).not.toBeInTheDocument()
  })

  it('restablece depósito a simple al cambiar de Sucursal a Área', async () => {
    await abrirModalCrear()
    fireEvent.click(screen.getByRole('radio', { name: /^Depósito/ }))
    fireEvent.click(screen.getByRole('radio', { name: /^Área/ }))

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeChecked()
  })

  it('restablece revisión de depósito a simple al cambiar de Área a Sucursal', async () => {
    await abrirModalCrear()
    fireEvent.click(screen.getByRole('radio', { name: /^Área/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Revisión de depósito/ }))
    fireEvent.click(screen.getByRole('radio', { name: /^Sucursal/ }))

    expect(screen.getByRole('radio', { name: /Checklist simple/ })).toBeChecked()
  })

  it('envía modo_cumplimiento en el POST existente', async () => {
    await abrirModalCrear()
    completarFormulario()
    fireEvent.click(screen.getByRole('radio', { name: /^Depósito/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }))

    await waitFor(() => expect(createTarea).toHaveBeenCalledWith(expect.objectContaining({
      ambito: 'sucursal',
      modo_cumplimiento: 'deposit',
    })))
  })

  it('envía modo_cumplimiento en el PATCH existente', async () => {
    getTareas.mockResolvedValue([tarea({ modo_cumplimiento: 'deposit_review', ambito: 'area' })])
    render(<TareasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateTarea).toHaveBeenCalledWith(7, expect.objectContaining({
      ambito: 'area',
      modo_cumplimiento: 'deposit_review',
    })))
  })

  it('muestra una falla de autorización o validación sin confirmar éxito', async () => {
    createTarea.mockRejectedValue(new Error('No tienes autorización para gestionar el catálogo.'))
    await abrirModalCrear()
    completarFormulario()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes autorización para gestionar el catálogo.')
    expect(screen.queryByText(/Tarea “Cierre diario” creada/)).not.toBeInTheDocument()
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
