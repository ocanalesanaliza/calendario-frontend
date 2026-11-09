import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlantillaAreaDetallePage from './PlantillaAreaDetallePage'

const service = vi.hoisted(() => ({ archiveAreaTemplate: vi.fn(), getAreaTemplateDetail: vi.fn(), getAreaTemplateVersionHistory: vi.fn(), publishAreaTemplateVersion: vi.fn(), getTareas: vi.fn() }))
vi.mock('../../calendarArea/services/areaTemplatesService', () => service)
vi.mock('../../tareas/services/tareasService', () => ({ getTareas: service.getTareas }))

const detail = { id: 4, name: 'Apertura', description: 'Inicio', active: true, current_version: { version: 2, tasks: [{ task_id: 7, task_name: 'Abrir caja', jornada: 'manana', aplica_ambas_jornadas: false }, { task_id: 8, task_name: 'Revisar', jornada: 'manana', aplica_ambas_jornadas: true }] } }
 function renderPage() { render(<MemoryRouter initialEntries={['/plantillas-area/4']}><Routes><Route path="/plantillas-area/:id" element={<PlantillaAreaDetallePage />} /></Routes></MemoryRouter>) }

describe('PlantillaAreaDetallePage', () => {
  beforeEach(() => { Object.values(service).forEach((mock) => mock.mockReset()); service.getAreaTemplateDetail.mockResolvedValue(detail); service.getAreaTemplateVersionHistory.mockResolvedValue([{ version: 1, tasks: [{ task_id: 7 }] }, detail.current_version]); service.getTareas.mockResolvedValue([{ id: 7, nombre: 'Abrir caja' }, { id: 8, nombre: 'Revisar' }]); service.publishAreaTemplateVersion.mockResolvedValue({}); service.archiveAreaTemplate.mockResolvedValue({}) })

  it('muestra metadatos, jornadas y el historial de versiones', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Apertura' })).toBeInTheDocument()
    expect(screen.getByText('Ambas jornadas')).toBeInTheDocument()
    expect(screen.getByText('Versión 1')).toBeInTheDocument()
  })

  it('publica una versión completa con las jornadas seleccionadas', async () => {
    renderPage(); await screen.findByText('Abrir caja')
    fireEvent.click(screen.getByRole('button', { name: 'Publicar nueva versión' }))
    const dialog = await screen.findByRole('dialog', { name: /Publicar nueva versión de Apertura/ })
    fireEvent.change(within(dialog).getByLabelText('Tarea 1'), { target: { value: '7' } })
    fireEvent.change(within(dialog).getByLabelText('Jornada 1'), { target: { value: 'ambas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir tarea' }))
    fireEvent.change(within(dialog).getByLabelText('Tarea 2'), { target: { value: '8' } })
    fireEvent.change(within(dialog).getByLabelText('Jornada 2'), { target: { value: 'tarde' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publicar nueva versión' }))
    await waitFor(() => expect(service.publishAreaTemplateVersion).toHaveBeenCalledWith('4', { tasks: [{ task_id: 7, jornada: 'manana', aplica_ambas_jornadas: true }, { task_id: 8, jornada: 'tarde', aplica_ambas_jornadas: false }] }))
  })

  it.each([
    [{ ...detail, name: 'Apertura' }, 'Apertura'],
    [{ ...detail, name: undefined, nombre: 'Cierre' }, 'Cierre'],
    [{ template: { ...detail, name: 'Inventario' } }, 'Inventario'],
    [{ ...detail, name: undefined, nombre: undefined }, 'esta plantilla'],
  ])('muestra el título de publicación para la forma de detalle recibida', async (templateDetail, expectedName) => {
    service.getAreaTemplateDetail.mockResolvedValue(templateDetail)
    renderPage()
    await screen.findByRole('button', { name: 'Publicar nueva versión' })

    fireEvent.click(screen.getByRole('button', { name: 'Publicar nueva versión' }))

    expect(await screen.findByRole('dialog', { name: `Publicar nueva versión de ${expectedName}` })).toBeInTheDocument()
  })

  it('explica el conflicto de evidencia terminal sin exponer el código del backend', async () => {
    service.publishAreaTemplateVersion.mockRejectedValue({ status: 409, fields: { assignment: 'future_assignment_occurrences_conflict' }, message: 'future_assignment_occurrences_conflict' })
    renderPage()
    await screen.findByText('Abrir caja')
    fireEvent.click(screen.getByRole('button', { name: 'Publicar nueva versión' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publicar nueva versión de Apertura' })
    fireEvent.change(within(dialog).getByLabelText('Tarea 1'), { target: { value: '7' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publicar nueva versión' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se puede cambiar o cancelar este reemplazo porque ya existen ocurrencias con evidencia terminal. Conserva o revisa esa evidencia antes de modificar la asignación.')
    expect(within(dialog).queryByText('future_assignment_occurrences_conflict')).not.toBeInTheDocument()
  })

  it('aclara que publicar conserva versiones y no reasigna Áreas automáticamente', async () => {
    renderPage()
    await screen.findByText('Abrir caja')
    fireEvent.click(screen.getByRole('button', { name: 'Publicar nueva versión' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publicar nueva versión de Apertura' })

    expect(within(dialog).getByText('La publicación crea una nueva versión completa. Las versiones anteriores no se modifican. Publicar no reasigna Áreas automáticamente. La asignación o el reemplazo se realiza explícitamente desde el Área y con su fecha efectiva.')).toBeInTheDocument()
  })

  it('mantiene la confirmación de archivo abierta cuando el backend informa un conflicto', async () => {
    service.archiveAreaTemplate.mockRejectedValue({ status: 409, message: 'Tiene asignaciones futuras' })
    renderPage(); await screen.findByText('Abrir caja')
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Archivar plantilla de área' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archivar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tiene asignaciones futuras')
  })
})
