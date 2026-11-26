import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import InventoryCorrectionPage from './InventoryCorrectionPage'

const { getHistoryDetail, previewInventory, correctInventory } = vi.hoisted(() => ({ getHistoryDetail: vi.fn(), previewInventory: vi.fn(), correctInventory: vi.fn() }))

vi.mock('../inventoryService', () => ({ getHistoryDetail, previewInventory, correctInventory, newIdempotencyKey: () => 'stable-key' }))

function Location() { return <output data-testid="location">{useLocation().pathname}</output> }

describe('InventoryCorrectionPage', () => {
  it('loads the selected correction and returns to history in the same tab', async () => {
    getHistoryDetail.mockResolvedValue({ submission: { id: 501, inventory_type: 'inventory_branch', expected_version: 2 } })
    render(<MemoryRouter initialEntries={['/historial-inventarios/501/corregir']}><Routes><Route path="/historial-inventarios/:submissionId/corregir" element={<InventoryCorrectionPage />} /><Route path="/historial-inventarios" element={<Location />} /></Routes></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Corrección de inventario' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar y salir' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/historial-inventarios')
  })
})
