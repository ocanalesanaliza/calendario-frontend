import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlantillasAreaPage from './PlantillasAreaPage'

const { createAreaTemplate, getAreaTemplates, getTareas } = vi.hoisted(() => ({
  createAreaTemplate: vi.fn(),
  getAreaTemplates: vi.fn(),
  getTareas: vi.fn(),
}))

vi.mock('../../calendarArea/services/areaTemplatesService', () => ({ createAreaTemplate, getAreaTemplates }))
vi.mock('../../tareas/services/tareasService', () => ({ getTareas }))

describe('PlantillasAreaPage', () => {
  const renderPage = () => render(<MemoryRouter><PlantillasAreaPage /></MemoryRouter>)
  beforeEach(() => {
    getAreaTemplates.mockReset().mockResolvedValue([])
    createAreaTemplate.mockReset().mockResolvedValue({})
    getTareas.mockReset().mockResolvedValue([])
  })

  it('muestra el estado de carga y el vacío', async () => {
    let resolveTemplates
    getAreaTemplates.mockReturnValue(new Promise((resolve) => { resolveTemplates = resolve }))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando plantillas de área...')
    resolveTemplates([])

    expect(await screen.findByText('No hay plantillas de área registradas.')).toBeInTheDocument()
  })

  it('muestra el error y reintenta la carga', async () => {
    getAreaTemplates.mockRejectedValueOnce(new Error('Servicio no disponible')).mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('No hay plantillas de área registradas.')).toBeInTheDocument()
    expect(getAreaTemplates).toHaveBeenCalledTimes(2)
  })

  it('muestra las columnas administrativas del listado', async () => {
    getAreaTemplates.mockResolvedValue([{
      id: 8,
      name: 'Apertura de área',
      description: 'Tareas de apertura',
      active: true,
      current_version: { version: 3, tasks: [{ task_id: 4 }] },
    }])
    renderPage()

    expect(await screen.findByText('Apertura de área')).toBeInTheDocument()
    expect(screen.getByText('Tareas de apertura')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Plantillas de área registradas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apertura de área' })).toHaveAttribute('href', '/plantillas-area/8')
  })

  it('crea la plantilla con la tarea inicial y la jornada seleccionada', async () => {
    getTareas.mockResolvedValue([{ id_tarea: 4, nombre: 'Abrir caja' }])
    renderPage()
    await screen.findByText('No hay plantillas de área registradas.')

    fireEvent.click(screen.getByRole('button', { name: 'Nueva plantilla de área' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(getTareas).toHaveBeenCalledWith('area')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Apertura' } })
    fireEvent.change(screen.getByLabelText('Descripción (opcional)'), { target: { value: 'Inicio de jornada' } })
    fireEvent.change(screen.getByLabelText('Tarea inicial'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'ambas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    await waitFor(() => expect(createAreaTemplate).toHaveBeenCalledWith({
      name: 'Apertura',
      description: 'Inicio de jornada',
      tasks: [{ task_id: 4, jornada: 'manana', aplica_ambas_jornadas: true }],
    }))
  })
})
