import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AreaManagerAssignmentModal from './AreaManagerAssignmentModal'

describe('AreaManagerAssignmentModal', () => {
  it('loads eligible managers, filters Systems accounts, and submits the selected manager', async () => {
    const onAssign = vi.fn().mockResolvedValue()
    render(<AreaManagerAssignmentModal target={{ id: 4, nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve({ results: [
      { id_gerente_area: 8, nombre: 'Ana' }, { id_gerente_area: 1, nombre: 'Sistemas', es_cuenta_sistemas: true },
    ] })} onAssign={onAssign} onClose={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando gerentes de área elegibles...')
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Sistemas' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith(8))
  })

  it('confirms and reassigns an occupied area when the API returns detail code', async () => {
    const error = new Error('Conflict')
    error.fields = { detail: 'area_already_assigned' }
    const onAssign = vi.fn().mockRejectedValue(error)
    const onReassign = vi.fn().mockResolvedValue()
    render(<AreaManagerAssignmentModal target={{ id: 4, nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve([{ id: 8, nombre: 'Ana' }])} onAssign={onAssign} onReassign={onReassign} onClose={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByText('Esta área ya está asignada. ¿Deseas programar la reasignación desde mañana?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reasignar desde mañana' }))
    await waitFor(() => expect(onReassign).toHaveBeenCalledWith(8))
  })

  it('keeps the vacant-area flow as a single POST assignment', async () => {
    const onAssign = vi.fn().mockResolvedValue()
    const onReassign = vi.fn()
    render(<AreaManagerAssignmentModal target={{ id: 4, nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve([{ id: 8, nombre: 'Ana' }])} onAssign={onAssign} onReassign={onReassign} onClose={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(onAssign).toHaveBeenCalledWith(8))
    expect(onReassign).not.toHaveBeenCalled()
  })

  it('does not reassign when the confirmation is cancelled', async () => {
    const error = new Error('Conflict')
    error.fields = { detail: 'area_already_assigned' }
    const onClose = vi.fn()
    const onReassign = vi.fn()
    render(<AreaManagerAssignmentModal target={{ id: 4, nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve([{ id: 8, nombre: 'Ana' }])} onAssign={() => Promise.reject(error)} onReassign={onReassign} onClose={onClose} />)

    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))
    await screen.findByText('Esta área ya está asignada. ¿Deseas programar la reasignación desde mañana?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
    expect(onReassign).not.toHaveBeenCalled()
  })

  it('maps the detail conflict code to a readable message when reassignment is unavailable', async () => {
    const error = new Error('Conflict')
    error.fields = { detail: 'area_already_assigned' }
    render(<AreaManagerAssignmentModal target={{ id: 4, nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve([{ id: 8, nombre: 'Ana' }])} onAssign={() => Promise.reject(error)} onClose={vi.fn()} />)

    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta área ya está asignada a otro gerente de área.')
  })

  it('reports loading errors and an empty selector accessibly', async () => {
    const { unmount } = render(<AreaManagerAssignmentModal target={{ nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.resolve([])} onAssign={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText('No hay gerentes de área elegibles disponibles.')).toBeInTheDocument()

    unmount()
    render(<AreaManagerAssignmentModal target={{ nombre: 'Ventas' }} targetType="area" loadEligible={() => Promise.reject(new Error('No disponible'))} onAssign={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible')
  })
})
