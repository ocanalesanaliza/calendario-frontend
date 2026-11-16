import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InventoryAreaExecutionPage from './InventoryAreaExecutionPage'

const { discoverAreaBranches, getMonthlyAreaOccurrences, previewInventory, submitInventoryArea } = vi.hoisted(() => ({
  discoverAreaBranches: vi.fn(),
  getMonthlyAreaOccurrences: vi.fn(),
  previewInventory: vi.fn(),
  submitInventoryArea: vi.fn(),
}))

vi.mock('../../calendarioArea/services/calendarioAreaService', () => ({ getMonthlyAreaOccurrences }))
vi.mock('../inventoryService', () => ({
  discoverAreaBranches,
  previewInventory,
  submitInventoryArea,
  newIdempotencyKey: () => 'stable-area-key',
}))

const occurrence = {
  occurrence_id: 117,
  effective_date: '2026-09-03',
  task: { name: 'Inventario de área', mode: 'inventory_area' },
}
const previewRows = [
  { code: 'A-1', product: 'Arroz', stock: 4, cost: 10, physical_stock: null, expiration_date: null },
  { code: 'B-2', product: 'Frijoles', stock: 2, cost: 12, physical_stock: 0, expiration_date: null },
]

function RouteState() {
  const location = useLocation()
  return <output data-testid="route-state">{location.pathname}{location.search}</output>
}

function renderPage(entry = '/calendario-area/inventario/117?fecha=2026-09-03') {
  return render(<MemoryRouter initialEntries={[entry]}><RouteState /><Routes>
    <Route path="/calendario-area" element={<p>Calendario del área</p>} />
    <Route path="/calendario-area/inventario/:idOcurrencia" element={<InventoryAreaExecutionPage />} />
  </Routes></MemoryRouter>)
}

async function selectBranchAndPreview() {
  fireEvent.change(await screen.findByLabelText('Sucursal autorizada'), { target: { value: '8' } })
  const file = new File(['xlsx'], 'inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  fireEvent.change(screen.getByLabelText('Archivo XLSX'), { target: { files: [file] } })
  await screen.findByRole('status')
  return file
}

describe('InventoryAreaExecutionPage', () => {
  beforeEach(() => {
    getMonthlyAreaOccurrences.mockReset().mockResolvedValue({ occurrences: [occurrence] })
    discoverAreaBranches.mockReset().mockResolvedValue({ branches: [{ id: 8, code: 'TGU-01', name: 'Centro' }] })
    previewInventory.mockReset().mockResolvedValue({ rows: previewRows })
    submitInventoryArea.mockReset().mockResolvedValue({})
  })

  it('reloads the direct route and resolves its authorized area inventory occurrence', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Conteo de inventario de área' })).toBeInTheDocument()
    expect(getMonthlyAreaOccurrences).toHaveBeenCalledWith('2026-09')
    expect(discoverAreaBranches).toHaveBeenCalledWith(117)
  })

  it.each([
    ['/calendario-area/inventario/117', { occurrences: [occurrence] }],
    ['/calendario-area/inventario/404?fecha=2026-09-03', { occurrences: [occurrence] }],
    ['/calendario-area/inventario/117?fecha=2026-09-03', { occurrences: [{ ...occurrence, task: { ...occurrence.task, mode: 'simple' } }] }],
  ])('renders a safe state for an invalid or unavailable route', async (entry, response) => {
    getMonthlyAreaOccurrences.mockResolvedValue(response)
    renderPage(entry)
    expect(await screen.findByRole('heading', { name: 'Inventario no disponible' })).toBeInTheDocument()
  })

  it('requires an authorized branch before enabling XLSX upload', async () => {
    renderPage()
    expect(await screen.findByLabelText('Archivo XLSX')).toBeDisabled()
    expect(screen.getByText('Selecciona una sucursal autorizada antes de cargar el archivo.')).toBeInTheDocument()
  })

  it('shows the selected XLSX in a file card and can remove it before submission', async () => {
    renderPage()
    await selectBranchAndPreview()

    expect(screen.getByText('inventory.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reemplazar archivo' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }))

    expect(screen.queryByText('inventory.xlsx')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Archivo XLSX')).toHaveValue('')
    expect(screen.queryByText(/2 productos listos para conteo/)).not.toBeInTheDocument()
  })

  it('commits edits with Tab and moves only through visible editable cells', async () => {
    renderPage()
    await selectBranchAndPreview()

    fireEvent.click(document.querySelector('.MuiDataGrid-row[data-id="A-1"] [data-field="physical_stock"]'))
    const physical = await screen.findByLabelText('Existencia física para Arroz')
    fireEvent.change(physical, { target: { value: '3' } })
    fireEvent.keyDown(physical, { key: 'Tab' })

    expect(await screen.findByLabelText('Vencimiento para Arroz')).toHaveFocus()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar inventario' })).toBeEnabled()
    await waitFor(() => {
      const firstRow = document.querySelector('.MuiDataGrid-row[data-id="A-1"]')
      expect(within(firstRow).getByText('Faltante')).toBeInTheDocument()
      expect(within(firstRow).getByText('-1')).toBeInTheDocument()
      expect(within(firstRow).getByText('L -10.00')).toBeInTheDocument()
    })

    const expiration = screen.getByLabelText('Vencimiento para Arroz')
    fireEvent.keyDown(expiration, { key: 'Tab' })
    expect(await screen.findByLabelText('Existencia física para Frijoles')).toHaveFocus()
  })

  it('shows the calculated difference and monetary impact summary', async () => {
    renderPage()
    await selectBranchAndPreview()

    expect(screen.getByRole('columnheader', { name: 'Costo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Diferencia' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Impacto' })).toBeInTheDocument()
    expect(screen.getByText('Impacto por faltantes')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Impacto del conteo' })).getAllByText('L -24.00')).toHaveLength(2)
  })

  it('submits the initial area inventory through the existing API with normalized editable rows', async () => {
    renderPage()
    const file = await selectBranchAndPreview()
    fireEvent.click(document.querySelector('.MuiDataGrid-row[data-id="A-1"] [data-field="physical_stock"]'))
    fireEvent.change(await screen.findByLabelText('Existencia física para Arroz'), { target: { value: '5' } })
    fireEvent.keyDown(screen.getByLabelText('Existencia física para Arroz'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Comentario opcional'), { target: { value: 'Conteo confirmado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar inventario' }))

    await waitFor(() => expect(submitInventoryArea).toHaveBeenCalledWith(expect.objectContaining({
      areaOccurrenceId: 117,
      branchId: '8',
      file,
      comment: 'Conteo confirmado',
      idempotencyKey: 'stable-area-key',
      rows: [
        expect.objectContaining({ code: 'A-1', physical_stock: '5' }),
        expect.objectContaining({ code: 'B-2', physical_stock: 0 }),
      ],
    })))
    await waitFor(() => expect(screen.getByTestId('route-state')).toHaveTextContent('/calendario-area?fecha=2026-09-03'))
  })
})
