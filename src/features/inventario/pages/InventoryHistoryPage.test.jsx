import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import InventoryHistoryPage from './InventoryHistoryPage'

const { listHistory, getHistoryDetail, useAuth } = vi.hoisted(() => ({ listHistory: vi.fn(), getHistoryDetail: vi.fn(), useAuth: vi.fn() }))

vi.mock('../inventoryService', () => ({ listHistory, getHistoryDetail }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
const submission = {
  id: 501,
  inventory_type: 'inventory_branch',
  execution_date: '2026-11-14',
  task_name: 'Conteo semanal',
  branch: { id: 7, code: 'SC-01', name: 'Sucursal Centro' },
  area: null,
  latest_revision: 2,
  submitted_at: '2026-11-14T10:00:00Z',
  product_count: 12,
  shortage_count: 2,
  surplus_count: 1,
  match_count: 9,
  net_impact: -1250,
  can_correct: true,
}

const detail = {
  ...submission,
  expected_version: 2,
  revisions: [
    { number: 1, submitted_at: '2026-11-14T10:00:00Z', comment: 'Conteo inicial', rows: [{ code: 'A-1', product: 'Arroz', cost: 100, stock: 10, physical_stock: 8, expiration_date: '2026-12-31' }] },
    { number: 2, submitted_at: '2026-11-14T11:00:00Z', comment: 'Ajuste', correction_reason: 'Conteo repetido', rows: [{ code: 'A-1', product: 'Arroz', cost: 100, stock: 10, physical_stock: 10, expiration_date: '2026-12-31' }] },
  ],
}

describe('InventoryHistoryPage', () => {
  function renderPage() {
    return render(<MemoryRouter><InventoryHistoryPage /></MemoryRouter>)
  }

  beforeEach(() => {
    listHistory.mockReset()
    getHistoryDetail.mockReset()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
  })

  it('renders operational summaries without JSON, snapshots, or digests', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: {} })
    renderPage()

    expect(await screen.findByText('Conteo semanal')).toBeInTheDocument()
    expect(screen.getByLabelText('Resumen del historial visible')).toHaveTextContent('Productos contados12')
    expect(screen.getByLabelText('Resumen del historial visible')).toHaveTextContent('L -1,250.00')
    expect(screen.queryByText(/snapshot|digest|frozen_scope|json/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/aprobado|revisado|conciliado/i)).not.toBeInTheDocument()
  })

  it('does not render a scope filter for GS', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: {} })
    renderPage()
    await screen.findByText('Conteo semanal')
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Área')).not.toBeInTheDocument()
  })

  it('does not render the inventory type selector for GS', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_sucursal' } })
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: {} })
    renderPage()

    await screen.findByText('Conteo semanal')
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
    expect(screen.getByText('Inventario de sucursal')).toBeInTheDocument()
  })

  it('reloads GA history using only branch_id selected from backend context', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: { branches: [{ id: 7, code: 'SC-01', name: 'Sucursal Centro' }] } })
    renderPage()
    await screen.findByLabelText('Sucursal')
    fireEvent.change(screen.getByLabelText('Sucursal'), { target: { value: '7' } })
    await waitFor(() => expect(listHistory).toHaveBeenLastCalledWith({ branchId: '7' }))
  })

  it('reloads GO history using only area_id selected from backend context', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: { areas: [{ id: 3, code: 'A-03', name: 'Área Norte' }] } })
    renderPage()
    await screen.findByLabelText('Área')
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '3' } })
    await waitFor(() => expect(listHistory).toHaveBeenLastCalledWith({ areaId: '3' }))
  })

  it('renders canonical rows and switches revisions in detail', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: {} })
    getHistoryDetail.mockResolvedValue({ submission: detail })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Corrección 1' }))
    expect(await screen.findByText(/Conteo repetido/)).toBeInTheDocument()
    expect(screen.getByText('Arroz')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Envío inicial' }))
    expect(await screen.findByText(/Conteo inicial/)).toBeInTheDocument()
    expect(screen.getByText('Filas por página:')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('navigates to the correction screen in the same tab when the backend permits it', async () => {
    listHistory.mockResolvedValue({ submissions: [submission], filter_context: {} })
    getHistoryDetail.mockResolvedValue({ submission: detail })
    function Location() {
      return <output data-testid="location">{useLocation().pathname}</output>
    }
    render(<MemoryRouter><InventoryHistoryPage /><Location /></MemoryRouter>)

    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Corregir' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/historial-inventarios/501/corregir')
  })

  it('does not offer correction when the loaded detail lacks backend permission', async () => {
    listHistory.mockResolvedValue({ submissions: [{ ...submission, can_correct: false }], filter_context: {} })
    getHistoryDetail.mockResolvedValue({ submission: { ...detail, can_correct: false } })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
  })
})
