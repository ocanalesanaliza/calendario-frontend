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
    service.getGOEvidence.mockResolvedValueOnce({ inventory: { branch: { code: 'CMG-002', name: 'CMG – Comayagua' }, execution_date: '2026-11-19', task_name: 'Inventario Norte', revisions: [{ number: 1, submitted_at: '2026-11-19T22:01:30Z', comment: 'Conteo validado con la sucursal.', rows: [{ product: 'Producto A', stock: 5, physical_stock: 4, difference: -1 }] }] } })
    renderRoute('/evidencia-go/inventario/opaque-ref', <GOInventoryEvidencePage />)

    expect(await screen.findByRole('heading', { name: 'Inventario GO' })).toBeInTheDocument()
    expect(await screen.findByText('CMG – Comayagua')).toBeInTheDocument()
    expect(screen.getByText('19 nov 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Revisión 1' })).toBeInTheDocument()
    expect(screen.getByText('Productos revisados')).toBeInTheDocument()
    expect(screen.getByText('Con diferencia')).toBeInTheDocument()
    expect(screen.getByText('Unidades contadas')).toBeInTheDocument()
    expect(screen.getByLabelText('Resumen de la revisión')).toHaveTextContent('Productos revisados1Con diferencia1Unidades contadas4')
    expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Diferencia' })).toBeInTheDocument()
    expect(screen.getByText('Producto A')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '5' })).toBeInTheDocument()
    expect(screen.getByText('-1')).toHaveClass('go-structured-evidence__difference--negative')
    expect(screen.getByRole('heading', { name: 'Comentario de GA' })).toBeInTheDocument()
    expect(screen.getByText('Conteo validado con la sucursal.')).toBeInTheDocument()
    expect(screen.queryByText('Task Name')).not.toBeInTheDocument()
    expect(screen.queryByText('Submitted At')).not.toBeInTheDocument()
    expect(service.getGOEvidence).toHaveBeenCalledWith('opaque-ref')
    expect(screen.queryByRole('button', { name: /corregir|guardar|finalizar|decidir/i })).not.toBeInTheDocument()
  })

  it('resolves deposit evidence and renders every read-only returned deposit detail', async () => {
    service.getGOEvidence.mockResolvedValueOnce({ deposit_review: { origin_date: '2026-11-04', closures: [{ branch_code: 'TEG-007', branch_name: 'Sucursal Centro Norte', closure_date: '2026-11-03', total_sales: '24000.00', cash_sales: '6000.00', card_sales: '18000.00', deposited_amount: '6000.00', outstanding_amount: '3000.00', sales_discrepancy_amount: '100.00' }], receipts: [{ branch_code: 'TEG-007', reference: 'REC-1', deposited_on: '2026-11-04', deposited_amount: '6000.00' }], decisions: [{ branch_code: 'TEG-007', closure_date: '2026-11-03', decision: 'con_observacion', comment: 'Revisado por GA' }] } })
    renderRoute('/evidencia-go/depositos/opaque-ref', <GODepositEvidencePage />)

    expect(await screen.findByRole('heading', { name: 'Revisión de depósitos GO' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Sucursal Centro Norte' })).toBeInTheDocument()
    expect(screen.getByText('Ventas totales')).toBeInTheDocument()
    expect(screen.getByText('L 24,000.00')).toBeInTheDocument()
    expect(screen.getByText('Monto reportado')).toBeInTheDocument()
    expect(screen.getByText('Monto pendiente').parentElement).toHaveClass('go-structured-evidence__metric--attention')
    expect(screen.getByText('Diferencia de ventas').parentElement).toHaveClass('go-structured-evidence__metric--attention')
    expect(screen.getByRole('heading', { name: 'Línea de depósitos' })).toBeInTheDocument()
    expect(screen.getByText('Cierre de ventas')).toBeInTheDocument()
    expect(screen.getByText('Depósito registrado')).toBeInTheDocument()
    expect(document.querySelector('.go-structured-evidence__status')).toHaveTextContent('Con observaciones')
    expect(document.querySelector('.go-structured-evidence__status')).toHaveClass('go-structured-evidence__status--attention')
    expect(screen.getByText('Comprobante REC-1')).toBeInTheDocument()
    expect(screen.getByText('Observación de GA: Revisado por GA')).toBeInTheDocument()
    expect(screen.queryByText('Total Sales')).not.toBeInTheDocument()
    expect(screen.queryByText('Reconciliation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /corregir|guardar|finalizar|decidir/i })).not.toBeInTheDocument()
  })

  it.each([{ branch_name: null }, {}])('falls back to the branch code when deposit branch_name is unavailable', async (branch) => {
    service.getGOEvidence.mockResolvedValueOnce({ deposit_review: { closures: [{ branch_code: 'TEG-008', ...branch, closure_date: '2026-11-03', total_sales: '100.00' }], receipts: [], decisions: [] } })
    renderRoute('/evidencia-go/depositos/opaque-ref', <GODepositEvidencePage />)

    expect(await screen.findByRole('heading', { name: 'Sucursal TEG-008' })).toBeInTheDocument()
  })

  it('keeps a conforming closure compact when reconciliation has no additional detail', async () => {
    service.getGOEvidence.mockResolvedValueOnce({ deposit_review: { closures: [{ branch_code: 'CMG-001', branch_name: 'Sucursal Comayagua', closure_date: '2026-11-03', total_sales: '34000.00', outstanding_amount: '0.00', sales_discrepancy_amount: '0.00' }], receipts: [{ branch_code: 'CMG-001', reference: 'REC-2', deposited_on: '2026-11-04', deposited_amount: '11000.00' }], decisions: [{ branch_code: 'CMG-001', closure_date: '2026-11-03', decision: 'conforme', comment: '' }] } })
    renderRoute('/evidencia-go/depositos/opaque-ref', <GODepositEvidencePage />)

    expect(await screen.findByText('Sucursal Comayagua')).toBeInTheDocument()
    expect(document.querySelector('.go-structured-evidence__status')).toHaveTextContent('Conforme')
    expect(screen.queryByRole('heading', { name: 'Conciliación' })).not.toBeInTheDocument()
    expect(document.querySelector('.go-structured-evidence__detail-grid')).toHaveClass('go-structured-evidence__detail-grid--single')
  })

  it.each([[403, 'No tienes autorización para consultar esta evidencia.'], [404, 'La evidencia solicitada ya no está disponible.']])('renders safe %s errors', async (status, message) => {
    service.getGOEvidence.mockRejectedValueOnce(Object.assign(new Error('request failed'), { status }))
    renderRoute('/evidencia-go/inventario/opaque-ref', <GOInventoryEvidencePage />)
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
  })
})
