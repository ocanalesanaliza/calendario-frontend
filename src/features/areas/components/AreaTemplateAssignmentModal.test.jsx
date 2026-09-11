import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaTemplateAssignmentModal from './AreaTemplateAssignmentModal'

const service = vi.hoisted(() => ({ assignOrReplace: vi.fn(), cancelPending: vi.fn(), getAssignableAreaTemplates: vi.fn(), getState: vi.fn() }))
vi.mock('../../calendarArea/services/areaTemplateAssignmentsService', () => service)

const area = { id: 3, nombre: 'Ventas' }
describe('AreaTemplateAssignmentModal', () => {
  beforeEach(() => { Object.values(service).forEach((mock) => mock.mockReset()); service.getAssignableAreaTemplates.mockResolvedValue([{ id: 9, name: 'Apertura', description: 'Sin historial', current_version: { version: 2 } }]); service.getState.mockResolvedValue({ actions: { assign: true, replace: true, cancel_pending: true }, current_assignment: { template: { name: 'Actual', current_version: { version: 1 } } }, pending_assignment: { id: 12, template: { name: 'Futura' }, fecha_inicio: '2026-10-01' } }); service.assignOrReplace.mockResolvedValue({}); service.cancelPending.mockResolvedValue({}) })

  it('carga el estado, reemplaza con fecha opcional y cancela una asignación futura confirmada', async () => {
    render(<AreaTemplateAssignmentModal area={area} onClose={vi.fn()} />)
    expect(await screen.findByText(/Reemplazo futuro/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Plantilla'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText(/Fecha de inicio/), { target: { value: '2026-10-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar plantilla' }))
    await waitFor(() => expect(service.assignOrReplace).toHaveBeenCalledWith(3, { template_id: 9, version: 2, fecha_inicio: '2026-10-15' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reemplazar plantilla' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reemplazo futuro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }))
    await waitFor(() => expect(service.cancelPending).toHaveBeenCalledWith(3, 12))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar reemplazo futuro' })).toBeEnabled())
  })

  it('muestra el 403 sin presentar una acción exitosa falsa', async () => {
    service.getState.mockRejectedValue({ status: 403 })
    render(<AreaTemplateAssignmentModal area={area} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para asignar plantillas a esta área.')
    expect(screen.queryByLabelText('Plantilla')).not.toBeInTheDocument()
  })
})
