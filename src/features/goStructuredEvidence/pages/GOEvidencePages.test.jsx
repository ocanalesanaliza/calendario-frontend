import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GOInventoryEvidencePage from './GOInventoryEvidencePage'
import GODepositEvidencePage from './GODepositEvidencePage'

const service = vi.hoisted(() => ({ getGOEvidence: vi.fn() }))
vi.mock('../goStructuredEvidenceService', () => service)

function renderRoute(path, element) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/evidencia-go/inventario/:reference" element={element} /><Route path="/evidencia-go/depositos/:reference" element={element} /></Routes></MemoryRouter>)
}

describe('GO structured evidence pages', () => {
  beforeEach(() => service.getGOEvidence.mockReset())

  it('resolves inventory evidence and renders read-only inventory data', async () => {
    service.getGOEvidence.mockResolvedValueOnce({ inventory: { task_name: 'Inventario Norte', revisions: [{ number: 1, rows: [{ product: 'Producto A', physical_stock: 4 }] }] } })
    renderRoute('/evidencia-go/inventario/opaque-ref', <GOInventoryEvidencePage />)

    expect(await screen.findByRole('heading', { name: 'Inventario GO' })).toBeInTheDocument()
    expect(await screen.findByText('Inventario Norte')).toBeInTheDocument()
    expect(screen.getByText('Producto A')).toBeInTheDocument()
    expect(service.getGOEvidence).toHaveBeenCalledWith('opaque-ref')
    expect(screen.queryByRole('button', { name: /corregir|guardar|finalizar|decidir/i })).not.toBeInTheDocument()
  })

  it('resolves deposit evidence and renders every read-only returned deposit detail', async () => {
    service.getGOEvidence.mockResolvedValueOnce({ deposit_review: { cases: [{ branch_name: 'Sucursal Norte', closure: { total_sales: '100.00', receipts: [{ reference: 'REC-1' }], reconciliation: { decision: 'conforme', ga_comment: 'Revisado por GA' } } }] } })
    renderRoute('/evidencia-go/depositos/opaque-ref', <GODepositEvidencePage />)

    expect(await screen.findByRole('heading', { name: 'Revisión de depósitos GO' })).toBeInTheDocument()
    expect(await screen.findByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('REC-1')).toBeInTheDocument()
    expect(screen.getByText('Revisado por GA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /corregir|guardar|finalizar|decidir/i })).not.toBeInTheDocument()
  })

  it.each([[403, 'No tienes autorización para consultar esta evidencia.'], [404, 'La evidencia solicitada ya no está disponible.']])('renders safe %s errors', async (status, message) => {
    service.getGOEvidence.mockRejectedValueOnce(Object.assign(new Error('request failed'), { status }))
    renderRoute('/evidencia-go/inventario/opaque-ref', <GOInventoryEvidencePage />)
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
  })
})
