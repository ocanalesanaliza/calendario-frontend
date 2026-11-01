import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DepositDemoModal } from './DepositDemoModal'

const api = vi.hoisted(() => ({
  openDepositReport: vi.fn(), getDepositReport: vi.fn(), captureDepositClosure: vi.fn(), addDepositReceipt: vi.fn(), allocateDepositReceipt: vi.fn(), declareNoDepositado: vi.fn(), submitDepositReport: vi.fn(),
}))

vi.mock('../services/depositService', () => api)

const task = { id_sucursal_tarea: 44, tarea: { nombre: 'Depósito diario', modo_cumplimiento: 'deposit' } }
const report = (overrides = {}) => ({
  id: 'opaque-report-id', state: 'draft', optimistic_version: 1,
  occurrence: { execution_date: '2026-11-02', scheduled_shift: 'manana', branch_code: 'NORTE' },
  closures: [{ id: 71, closure_date: '2026-11-01', sales_captured: false, total_sales: null, cash_sales: null, card_sales: null, no_depositado_reason: null }],
  receipts: [], submission: null, ...overrides,
})

function renderModal() {
  return render(<DepositDemoModal tarea={task} fecha="2026-11-02" sucursal="Sucursal Norte" onClose={vi.fn()} />)
}

describe('DepositDemoModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.openDepositReport.mockResolvedValue({ report: report() })
  })

  it('captures a server-provided closure and advances to the returned report', async () => {
    api.captureDepositClosure.mockResolvedValue({ report: report({ optimistic_version: 2, closures: [{ ...report().closures[0], sales_captured: true, total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00' }] }) })
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')

    fireEvent.change(screen.getByLabelText('Ventas totales *'), { target: { value: '100.00' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Ventas con tarjeta *'), { target: { value: '30.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capturar ventas' }))

    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenCalledWith('opaque-report-id', 71, expect.objectContaining({ total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00', expected_version: 1 })))
    expect(await screen.findByText(/Ventas capturadas:/)).toBeInTheDocument()
  })

  it('shows field errors, focuses the first missing sales control, and does not capture incomplete sales', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Capturar ventas' }))

    expect(await screen.findByText('Ingresa las ventas totales.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ventas totales *')).toHaveFocus()
    expect(screen.getByLabelText('Ventas totales *')).toHaveAttribute('aria-invalid', 'true')
    expect(api.captureDepositClosure).not.toHaveBeenCalled()
  })

  it('adds and assigns a receipt using only server-returned report and closure ids', async () => {
    const captured = report({ optimistic_version: 2, closures: [{ ...report().closures[0], sales_captured: true, total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00' }] })
    api.openDepositReport.mockResolvedValue({ report: captured })
    api.addDepositReceipt.mockResolvedValue({ report: { ...captured, optimistic_version: 3, receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', deposited_on: '2026-11-02', allocations: [] }] } })
    api.allocateDepositReceipt.mockResolvedValue({ report: { ...captured, optimistic_version: 4, receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', deposited_on: '2026-11-02', allocations: [{ id: 91, closure_entry_id: 71, allocated_amount: '70.00' }] }] } })
    renderModal()
    await screen.findByLabelText('Monto depositado *')

    fireEvent.change(screen.getByLabelText('Monto depositado *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Referencia *'), { target: { value: 'REF-1' } })
    fireEvent.change(screen.getByLabelText('Fecha de depósito *'), { target: { value: '2026-11-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar comprobante' }))
    await screen.findByText('Comprobante REF-1')

    fireEvent.change(screen.getByLabelText('Cierre capturado *'), { target: { value: '71' } })
    fireEvent.change(screen.getByLabelText('Monto asignado *'), { target: { value: '70.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar comprobante' }))
    await waitFor(() => expect(api.allocateDepositReceipt).toHaveBeenCalledWith('opaque-report-id', 81, expect.objectContaining({ closure_entry_id: 71, allocated_amount: '70.00', expected_version: 3 })))
  })

  it('requires a nonblank reason before declaring no depositado', async () => {
    api.declareNoDepositado.mockResolvedValue({ report: report({ optimistic_version: 2, closures: [{ ...report().closures[0], no_depositado_reason: 'Bank service unavailable' }] }) })
    renderModal()
    const button = await screen.findByRole('button', { name: 'Declarar no depositado' })
    fireEvent.click(button)
    expect(api.declareNoDepositado).not.toHaveBeenCalled()
    expect(await screen.findByText('Explica el motivo de no depositado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo de no depositado *')).toHaveFocus()

    fireEvent.change(screen.getByLabelText('Motivo de no depositado *'), { target: { value: 'Bank service unavailable' } })
    fireEvent.click(button)
    await waitFor(() => expect(api.declareNoDepositado).toHaveBeenCalledWith('opaque-report-id', 71, expect.objectContaining({ reason: 'Bank service unavailable', expected_version: 1 })))
  })

  it('validates incomplete receipt and allocation forms before sending a request', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar comprobante' }))
    expect(await screen.findByText('Ingresa el monto depositado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto depositado *')).toHaveFocus()
    expect(api.addDepositReceipt).not.toHaveBeenCalled()
  })

  it('validates incomplete allocation before sending a request', async () => {
    const captured = report({ optimistic_version: 2, closures: [{ ...report().closures[0], sales_captured: true }], receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', deposited_on: '2026-11-02', allocations: [] }] })
    api.openDepositReport.mockResolvedValue({ report: captured })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar comprobante' }))

    expect(await screen.findByText('Selecciona un cierre capturado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Cierre capturado *')).toHaveFocus()
    expect(api.allocateDepositReceipt).not.toHaveBeenCalled()
  })

  it('submits with the current version and renders the server-submitted state', async () => {
    api.submitDepositReport.mockResolvedValue({ report: report({ state: 'submitted', optimistic_version: 2, submission: { state: 'submitted', closures: [], receipts: [] } }) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    await waitFor(() => expect(api.submitDepositReport).toHaveBeenCalledWith('opaque-report-id', expect.objectContaining({ expected_version: 1 })))
    expect(await screen.findByText('El reporte fue enviado correctamente.')).toBeInTheDocument()
  })

  it('exposes an operational conflict without losing the recoverable report', async () => {
    api.submitDepositReport.mockRejectedValue(Object.assign(new Error('deposit_api_disabled'), { status: 409, detail: 'deposit_api_disabled' }))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    await waitFor(() => expect(api.submitDepositReport).toHaveBeenCalledWith('opaque-report-id', expect.objectContaining({ expected_version: 1 })))
    expect(await screen.findByText(/no está habilitado actualmente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar reporte completo' })).toBeInTheDocument()
  })
})
