import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InventoryHistoryPage from './InventoryHistoryPage'

const { listHistory, getHistoryDetail } = vi.hoisted(() => ({ listHistory: vi.fn(), getHistoryDetail: vi.fn() }))

vi.mock('../inventoryService', () => ({ listHistory, getHistoryDetail }))

describe('InventoryHistoryPage', () => {
  it('muestra historial sin vocabulario de aprobación o conciliación', async () => {
    listHistory.mockResolvedValue({ submissions: [{ id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: false, revisions: [] }] })
    render(<InventoryHistoryPage />)

    expect(await screen.findByRole('heading', { name: 'Historial de inventarios' })).toBeInTheDocument()
    expect(screen.getByText('Inventario de sucursal')).toBeInTheDocument()
    expect(screen.queryByText(/aprobado|revisado|conciliado/i)).not.toBeInTheDocument()
  })

  it('oculta Corregir si can_correct es falso y lo habilita solo si el backend lo permite', async () => {
    listHistory.mockResolvedValue({ submissions: [
      { id: 501, inventory_type: 'inventory_branch', expected_version: 2, can_correct: false, revisions: [] },
      { id: 502, inventory_type: 'inventory_area', expected_version: 1, can_correct: true, revisions: [] },
    ] })
    getHistoryDetail.mockResolvedValue({ submission: { id: 502, inventory_type: 'inventory_area', expected_version: 1, can_correct: true, revisions: [] } })
    render(<InventoryHistoryPage />)

    expect(await screen.findByText('Inventario de área')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Corregir' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir' }))
    expect(getHistoryDetail).toHaveBeenCalledWith(502)
  })
})
