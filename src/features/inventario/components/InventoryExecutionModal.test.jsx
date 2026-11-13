import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InventoryExecutionModal from './InventoryExecutionModal'
import { isInventoryFieldEditable } from '../inventoryExecution'

const { previewInventory, discoverAreaBranches, correctInventory } = vi.hoisted(() => ({ previewInventory: vi.fn(), discoverAreaBranches: vi.fn(), correctInventory: vi.fn() }))

vi.mock('../inventoryService', () => ({
  previewInventory,
  discoverAreaBranches,
  newIdempotencyKey: () => 'stable-key',
  submitInventoryArea: vi.fn(),
  submitInventoryBranch: vi.fn(),
  correctInventory,
}))

const row = {
  code: 'A-1', product: 'Arroz', cost: '12.00', branch: 'Centro', reorder_point: 1, stock: 4,
  physical_stock: 3, difference: '-1.00', difference_cost: '-12.00', expiration_date: null,
}

function renderModal(props = {}) {
  previewInventory.mockResolvedValue({ rows: [row], errors: [] })
  discoverAreaBranches.mockResolvedValue({ branches: [{ id: 7, code: 'INV-001', name: 'Centro' }] })
  return render(<InventoryExecutionModal
    occurrence={{ id: 12, nombre: 'Inventario semanal', modo_cumplimiento: 'inventory_branch' }}
    mode="branch"
    onClose={vi.fn()}
    onSuccess={vi.fn()}
    {...props}
  />)
}

describe('InventoryExecutionModal', () => {
  it('solamente permite editar existencia física y fecha de vencimiento', () => {
    expect(isInventoryFieldEditable('product')).toBe(false)
    expect(isInventoryFieldEditable('stock')).toBe(false)
    expect(isInventoryFieldEditable('physical_stock')).toBe(true)
    expect(isInventoryFieldEditable('expiration_date')).toBe(true)
  })

  it('para GA bloquea la carga hasta seleccionar una sucursal autorizada', () => {
    renderModal({ mode: 'area', occurrence: { occurrence_id: 42, task: { mode: 'inventory_area' } } })

    expect(screen.getByText('Selecciona una sucursal autorizada antes de cargar el archivo.')).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeDisabled()
  })

  it('exige XLSX, motivo y expected_version para corregir', () => {
    renderModal({ correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [row] } })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar corrección' }))
    expect(screen.getByText('Selecciona un archivo XLSX para continuar.')).toBeInTheDocument()
    expect(screen.getByText('Indica el motivo de la corrección.')).toBeInTheDocument()
  })

  it('ante 409 conserva el borrador y ofrece recargar sin reenviar', async () => {
    correctInventory.mockRejectedValueOnce(Object.assign(new Error('stale'), { status: 409 }))
    const onReload = vi.fn()
    renderModal({ correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [] }, onReload })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['xlsx'], 'inventory.xlsx')] } })
    fireEvent.change(document.querySelectorAll('textarea')[1], { target: { value: 'Corregir conteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar corrección' }))

    expect(await screen.findByText(/Tu borrador se conserva/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Recargar detalle' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
