import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const rowWithExpiration = { ...row, expiration_date: '2026-11-14' }

function selectXlsx() {
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['xlsx'], 'inventory.xlsx')] } })
}

function renderModal({ previewRows = [row], ...props } = {}) {
  previewInventory.mockResolvedValue({ rows: previewRows, errors: [] })
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

  it('renders correction previews with ISO expiration dates and preserves their canonical payload', async () => {
    renderModal({ previewRows: [rowWithExpiration], correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [] } })

    selectXlsx()
    expect(await screen.findByText('Vencimiento')).toBeInTheDocument()
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Corregir conteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar corrección' }))

    await waitFor(() => expect(correctInventory).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ expiration_date: '2026-11-14' })],
    })))
  })

  it('edits only the physical stock and expiration cells before sending the correction', async () => {
    renderModal({ previewRows: [rowWithExpiration], correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [] } })

    selectXlsx()
    await screen.findByText('Vista previa editable')
    const physicalCell = document.querySelector('.MuiDataGrid-row [data-field="physical_stock"]')
    const expirationCell = document.querySelector('.MuiDataGrid-row [data-field="expiration_date"]')
    expect(physicalCell).toBeTruthy()
    expect(expirationCell).toBeTruthy()
    fireEvent.doubleClick(physicalCell)
    fireEvent.change(physicalCell.querySelector('input'), { target: { value: '9' } })
    fireEvent.keyDown(physicalCell.querySelector('input'), { key: 'Enter' })
    fireEvent.doubleClick(expirationCell)
    fireEvent.change(expirationCell.querySelector('input'), { target: { value: '2026-12-20' } })
    fireEvent.keyDown(expirationCell.querySelector('input'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Motivo de la corrección'), { target: { value: 'Conteo confirmado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar corrección' }))

    await waitFor(() => expect(correctInventory).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ product: 'Arroz', stock: 4, physical_stock: 9, expiration_date: '2026-12-20' })],
    })))
  })

  it('presents missing XLSX headers as a structured, readable error and allows replacing the file', async () => {
    previewInventory.mockRejectedValueOnce(new Error('Codigo Producto Producto Costo Sucursal Punto de Reorden Existencia Existencia Fisica Diferencia Costo por Diferencia Fecha de vencimiento'))
    renderModal({ correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [] } })

    selectXlsx()
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo no coincide con la plantilla esperada')
    expect(screen.getByRole('alert')).toHaveTextContent('Existencia Física')
    expect(screen.getByRole('alert')).toHaveTextContent('Fecha de vencimiento')

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['xlsx'], 'replacement.xlsx')] } })
    await waitFor(() => expect(previewInventory).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'replacement.xlsx' })))
  })

  it('renders initial GA previews with ISO expiration dates', async () => {
    renderModal({ previewRows: [rowWithExpiration], mode: 'area', occurrence: { occurrence_id: 42, task: { mode: 'inventory_area' } } })

    const branch = await screen.findByLabelText('Sucursal')
    fireEvent.change(branch, { target: { value: '7' } })
    selectXlsx()

    expect(await screen.findByText('Vencimiento')).toBeInTheDocument()
  })

  it('keeps blank expiration dates optional in correction payloads', async () => {
    renderModal({ correction: { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: true, revisions: [] } })

    selectXlsx()
    await screen.findByText('Vencimiento')
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Corregir conteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar corrección' }))

    await waitFor(() => expect(correctInventory).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ expiration_date: null })],
    })))
  })
})
