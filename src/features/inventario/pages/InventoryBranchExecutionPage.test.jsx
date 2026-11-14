import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InventoryBranchExecutionPage from './InventoryBranchExecutionPage'

const { getMisTareas, previewInventory, submitInventoryBranch } = vi.hoisted(() => ({
  getMisTareas: vi.fn(),
  previewInventory: vi.fn(),
  submitInventoryBranch: vi.fn(),
}))

vi.mock('../../operacion/services/operacionService', () => ({ getMisTareas }))
vi.mock('../inventoryService', () => ({
  previewInventory,
  submitInventoryBranch,
  newIdempotencyKey: () => 'stable-key',
}))

const availableTask = {
  id_sucursal_tarea: 44,
  disponible_para_registro: true,
  estado_ui: 'disponible',
  tarea: { nombre: 'Inventario semanal', modo_cumplimiento: 'inventory_branch' },
}
const response = { meta: { fecha_consultada: '2026-09-05' }, results: [availableTask] }
const previewRows = [
  { code: 'A-1', product: 'Arroz', cost: 10, stock: 4, physical_stock: null, expiration_date: null, branch: 'TEG - Boulevard Morazán' },
  { code: 'B-2', product: 'Frijoles', cost: 12, stock: 2, physical_stock: 0, expiration_date: null, branch: 'TEG - Boulevard Morazán' },
]

function RouteState() {
  const location = useLocation()
  return <output data-testid="route-state">{location.pathname}{location.search}</output>
}

function renderPage(entry = '/mis-tareas/inventario/44?fecha=2026-09-05') {
  return render(<MemoryRouter initialEntries={[entry]}><RouteState /><Routes>
    <Route path="/mis-tareas" element={<p>Mis tareas</p>} />
    <Route path="/mis-tareas/inventario/:idSucursalTarea" element={<InventoryBranchExecutionPage />} />
  </Routes></MemoryRouter>)
}

async function previewFile() {
  const file = new File(['xlsx'], 'inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  fireEvent.change(await screen.findByLabelText('Archivo XLSX'), { target: { files: [file] } })
  await screen.findByRole('status')
  return file
}

async function editCell(id, field, label) {
  fireEvent.click(document.querySelector(`.MuiDataGrid-row[data-id="${id}"] [data-field="${field}"]`))
  return screen.findByLabelText(label)
}

describe('InventoryBranchExecutionPage', () => {
  beforeEach(() => {
    getMisTareas.mockReset().mockResolvedValue(response)
    previewInventory.mockReset().mockResolvedValue({ rows: previewRows })
    submitInventoryBranch.mockReset().mockResolvedValue({})
  })

  it('renders preview-null physical stock as pending and allows editing it', async () => {
    renderPage()
    await previewFile()

    expect(screen.getByRole('heading', { name: 'Conteo de inventario' })).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(await editCell('A-1', 'physical_stock', 'Existencia física para Arroz')).toHaveValue(null)
    expect(screen.getByLabelText('Existencia física para Arroz')).toBeEnabled()
    expect(await editCell('A-1', 'expiration_date', 'Vencimiento para Arroz')).toBeEnabled()
  })

  it('treats zero as counted, leaves expiration optional, and blocks submit while a physical stock is blank', async () => {
    renderPage()
    await previewFile()

    expect(screen.getByText('1 de 2')).toBeInTheDocument()
    expect(screen.getByText('Impacto por faltantes')).toBeInTheDocument()
    expect(screen.getAllByText('L -24.00').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Registrar inventario' })).toBeDisabled()
    expect(await editCell('B-2', 'expiration_date', 'Vencimiento para Frijoles')).toHaveValue('')

    fireEvent.change(await editCell('A-1', 'physical_stock', 'Existencia física para Arroz'), { target: { value: '0' } })
    fireEvent.keyDown(screen.getByLabelText('Existencia física para Arroz'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('2 de 2')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Registrar inventario' })).toBeEnabled()
  })

  it('renders an em dash for blank preview values and a DataGrid impact column', async () => {
    renderPage()
    await previewFile()

    expect(screen.getByRole('columnheader', { name: 'Impacto' })).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('keeps Estado color contained in its badge and moves Tab only between visible editable cells', async () => {
    renderPage()
    await previewFile()

    const statusCell = document.querySelector('.MuiDataGrid-row[data-id="B-2"] [data-field="status"]')
    expect(statusCell).toHaveClass('inventory-branch-status-cell')
    expect(statusCell).not.toHaveClass('shortage')
    expect(statusCell.querySelector('.inventory-branch-status')).toHaveClass('shortage')

    const physical = await editCell('A-1', 'physical_stock', 'Existencia física para Arroz')
    fireEvent.change(physical, { target: { value: '0' } })
    fireEvent.keyDown(physical, { key: 'Tab' })
    expect(await screen.findByLabelText('Vencimiento para Arroz')).toHaveFocus()

    const expiration = screen.getByLabelText('Vencimiento para Arroz')
    fireEvent.keyDown(expiration, { key: 'Tab' })
    expect(await screen.findByLabelText('Existencia física para Frijoles')).toHaveFocus()

    const nextPhysical = screen.getByLabelText('Existencia física para Frijoles')
    fireEvent.keyDown(nextPhysical, { key: 'Tab', shiftKey: true })
    expect(await screen.findByLabelText('Vencimiento para Arroz')).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText('Vencimiento para Arroz'), { key: 'Tab', shiftKey: true })
    expect(await screen.findByLabelText('Existencia física para Arroz')).toHaveFocus()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
  })

  it('keeps edits after search and exposes only physical stock and expiration as editable fields', async () => {
    renderPage()
    await previewFile()

    fireEvent.change(screen.getByLabelText('Buscar por código o producto'), { target: { value: 'Arroz' } })
    fireEvent.change(await editCell('A-1', 'physical_stock', 'Existencia física para Arroz'), { target: { value: '5' } })
    fireEvent.keyDown(screen.getByLabelText('Existencia física para Arroz'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Buscar por código o producto'), { target: { value: '' } })

    expect(await editCell('A-1', 'physical_stock', 'Existencia física para Arroz')).toHaveValue(5)
    expect(screen.queryByLabelText('Código para Arroz')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Producto para Arroz')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.MuiDataGrid-cell--editable')).toHaveLength(4)
  })

  it('submits the unchanged server payload and returns to the task list without a date filter', async () => {
    renderPage()
    const file = await previewFile()
    fireEvent.change(await editCell('A-1', 'physical_stock', 'Existencia física para Arroz'), { target: { value: '5' } })
    fireEvent.keyDown(screen.getByLabelText('Existencia física para Arroz'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Comentario opcional'), { target: { value: 'Conteo confirmado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar inventario' }))

    await waitFor(() => expect(submitInventoryBranch).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: 44,
      file,
      comment: 'Conteo confirmado',
      idempotencyKey: 'stable-key',
      rows: [
        expect.objectContaining({ code: 'A-1', physical_stock: '5' }),
        expect.objectContaining({ code: 'B-2', physical_stock: 0 }),
      ],
    })))
    await waitFor(() => expect(screen.getByTestId('route-state')).toHaveTextContent(/^\/mis-tareas$/))
  })

  it('returns without mutating the task when cancelled', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar y salir' }))
    expect(screen.getByTestId('route-state')).toHaveTextContent('/mis-tareas?fecha=2026-09-05')
    expect(submitInventoryBranch).not.toHaveBeenCalled()
  })
})
