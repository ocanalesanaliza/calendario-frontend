import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const capturedClosure = (overrides = {}) => ({ id: 71, closure_date: '2026-11-01', sales_captured: true, total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00', no_depositado_reason: null, ...overrides })
const backendError = ({ status = 400, detail }) => Object.assign(new Error(detail), { status, detail })

function renderModal() {
  return render(<DepositDemoModal tarea={task} fecha="2026-11-02" sucursal="Sucursal Norte" onClose={vi.fn()} />)
}

describe('DepositDemoModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.openDepositReport.mockResolvedValue({ report: report() })
  })

  it('captures a server-provided closure and advances to the returned report', async () => {
    api.captureDepositClosure.mockResolvedValue({ report: report({ optimistic_version: 2, closures: [capturedClosure()] }) })
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')
    fireEvent.change(screen.getByLabelText('Ventas totales *'), { target: { value: '100.00' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Ventas con tarjeta *'), { target: { value: '30.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capturar ventas' }))
    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenCalledWith('opaque-report-id', 71, expect.objectContaining({ total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00', expected_version: 1 })))
    expect(await screen.findByText(/Ventas capturadas:/)).toBeInTheDocument()
  })

  it('captures balanced sales without requiring a discrepancy explanation', async () => {
    api.captureDepositClosure.mockResolvedValue({ report: report({ optimistic_version: 2, closures: [capturedClosure()] }) })
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')
    fireEvent.change(screen.getByLabelText('Ventas totales *'), { target: { value: '100.00' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Ventas con tarjeta *'), { target: { value: '30.00' } })

    expect(screen.queryByLabelText('Explicación del descuadre')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Capturar ventas' }))

    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenCalledWith('opaque-report-id', 71, expect.objectContaining({
      total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00', sales_discrepancy_reason: '',
    })))
  })

  it('shows a localized sales discrepancy warning and requires a focused explanation before capture', async () => {
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')
    fireEvent.change(screen.getByLabelText('Ventas totales *'), { target: { value: '100.00' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Ventas con tarjeta *'), { target: { value: '20.00' } })

    expect(await screen.findByText(/Descuadre de ventas: L 10\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Las ventas totales no coinciden con efectivo más tarjeta/)).toBeInTheDocument()
    const explanation = screen.getByLabelText('Explicación del descuadre *')
    fireEvent.change(explanation, { target: { value: ' \n ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capturar ventas' }))

    expect(await screen.findByText('Explica el descuadre de ventas.')).toBeInTheDocument()
    expect(explanation).toHaveFocus()
    expect(api.captureDepositClosure).not.toHaveBeenCalled()
  })

  it('sends a per-closure discrepancy explanation without applying it to another closure', async () => {
    const firstClosure = report().closures[0]
    const secondClosure = { ...firstClosure, id: 72, closure_date: '2026-11-02' }
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [firstClosure, secondClosure] }) })
    api.captureDepositClosure
      .mockResolvedValueOnce({ report: report({ optimistic_version: 2, closures: [capturedClosure(), secondClosure] }) })
      .mockResolvedValueOnce({ report: report({ optimistic_version: 3, closures: [capturedClosure(), capturedClosure({ id: 72, closure_date: '2026-11-02' })] }) })
    renderModal()
    const cards = await screen.findAllByRole('article')
    const firstCard = cards.find((card) => card.textContent.includes('2026-11-01'))
    const initialSecondCard = cards.find((card) => card.textContent.includes('2026-11-02'))

    for (const [card, values] of [[firstCard, ['100.00', '70.00', '20.00']], [initialSecondCard, ['100.00', '70.00', '30.00']]]) {
      const inputs = card.querySelectorAll('input[type="number"]')
      fireEvent.change(inputs[0], { target: { value: values[0] } })
      fireEvent.change(inputs[1], { target: { value: values[1] } })
      fireEvent.change(inputs[2], { target: { value: values[2] } })
    }
    fireEvent.change(within(firstCard).getByLabelText('Explicación del descuadre *'), { target: { value: 'El POS no registró una venta.' } })
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Capturar ventas' }))

    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenNthCalledWith(1, 'opaque-report-id', 71, expect.objectContaining({ sales_discrepancy_reason: 'El POS no registró una venta.' })))
    const updatedCards = await screen.findAllByRole('article')
    const updatedSecondCard = updatedCards.find((card) => card.textContent.includes('2026-11-02'))
    expect(within(updatedSecondCard).queryByLabelText('Explicación del descuadre *')).not.toBeInTheDocument()
    fireEvent.click(within(updatedSecondCard).getByRole('button', { name: 'Capturar ventas' }))
    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenNthCalledWith(2, 'opaque-report-id', 72, expect.objectContaining({ sales_discrepancy_reason: '' })))
  })

  it('renders the complete themed Tuvet dialog shell', async () => {
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')

    const backdrop = document.querySelector('.tuvet-modal-backdrop')
    const dialog = screen.getByRole('dialog', { name: 'Registrar depósito' })
    expect(backdrop).toBeInTheDocument()
    expect(document.querySelectorAll('.tuvet-modal')).toHaveLength(1)
    expect(dialog).toHaveClass('tuvet-modal', 'tuvet-modal-wide', 'tema-analiza')
    expect(dialog.querySelector('.tuvet-modal-header .tuvet-icon-btn[aria-label="Cerrar"]')).toBeInTheDocument()
    expect(dialog.querySelector('.deposit-flow')).toBeInTheDocument()
    expect(dialog.querySelector('.tuvet-modal-footer button')).toHaveTextContent('Cerrar')
  })

  it('shows field errors, focuses the first missing sales control, and does not capture incomplete sales', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Capturar ventas' }))
    expect(await screen.findByText('Ingresa las ventas totales.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ventas totales *')).toHaveFocus()
    expect(screen.getByLabelText('Ventas totales *')).toHaveAttribute('aria-invalid', 'true')
    expect(api.captureDepositClosure).not.toHaveBeenCalled()
  })

  it('keeps a captured closure sales summary visible and offers no-deposit declaration', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure()] }) })
    renderModal()
    expect(await screen.findByText(/Ventas capturadas:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Declarar no depositado' })).toBeEnabled()
  })

  it('does not enable no-deposit declarations until every closure has captured sales', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure(), { ...report().closures[0], id: 72, closure_date: '2026-11-02' }] }) })
    renderModal()
    const actions = await screen.findAllByRole('button', { name: 'Declarar no depositado' })
    expect(actions).toHaveLength(2)
    actions.forEach((action) => expect(action).toBeDisabled())
    expect(screen.getByText('Capture sales for every presented closure before declaring a closure as not deposited.')).toBeInTheDocument()
  })

  it('offers a declaration action for every eligible closure after all sales are captured', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure(), capturedClosure({ id: 72, closure_date: '2026-11-02' })] }) })
    renderModal()
    const actions = await screen.findAllByRole('button', { name: 'Declarar no depositado' })
    expect(actions).toHaveLength(2)
    actions.forEach((action) => expect(action).toBeEnabled())
  })

  it('requires a nonblank reason after selecting no-deposit declaration', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure()] }) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Declarar no depositado' }))
    const reasonField = await screen.findByLabelText('Motivo de no depositado *')
    expect(reasonField).toBeRequired()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar declaración' }))
    expect(api.declareNoDepositado).not.toHaveBeenCalled()
    expect(await screen.findByText('Explica el motivo de no depositado.')).toBeInTheDocument()
    expect(reasonField).toHaveFocus()
  })

  it('sends opaque ids, current version, and an idempotency key, then renders the saved declaration', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ optimistic_version: 9, closures: [capturedClosure({ id: 'opaque-closure-entry' })] }) })
    api.declareNoDepositado.mockResolvedValue({ report: report({ optimistic_version: 10, closures: [capturedClosure({ id: 'opaque-closure-entry', no_depositado_reason: 'Bank service unavailable' })] }) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Declarar no depositado' }))
    fireEvent.change(screen.getByLabelText('Motivo de no depositado *'), { target: { value: 'Bank service unavailable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar declaración' }))
    await waitFor(() => expect(api.declareNoDepositado).toHaveBeenCalledWith('opaque-report-id', 'opaque-closure-entry', expect.objectContaining({ reason: 'Bank service unavailable', expected_version: 9, idempotency_key: expect.any(String) })))
    expect(await screen.findByText('No depositado: Bank service unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Declarar no depositado' })).not.toBeInTheDocument()
  })

  it('adds and assigns a receipt using only server-returned report and closure ids', async () => {
    const captured = report({ optimistic_version: 2, closures: [capturedClosure()] })
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

  it('validates incomplete receipt and allocation forms before sending a request', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar comprobante' }))
    expect(await screen.findByText('Ingresa el monto depositado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto depositado *')).toHaveFocus()
    expect(api.addDepositReceipt).not.toHaveBeenCalled()
  })

  it('validates incomplete allocation before sending a request', async () => {
    const captured = report({ optimistic_version: 2, closures: [capturedClosure()], receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', deposited_on: '2026-11-02', allocations: [] }] })
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

  it('translates the uncaptured-closure backend detail to the approved Spanish message', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure()] }) })
    api.declareNoDepositado.mockRejectedValue(backendError({ detail: 'All presented closures require captured sales before financial declarations or allocations.' }))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Declarar no depositado' }))
    fireEvent.change(screen.getByLabelText('Motivo de no depositado *'), { target: { value: 'Banco cerrado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar declaración' }))
    expect(await screen.findByText('Captura las ventas de todos los cierres presentados antes de declarar un cierre como no depositado o asignar comprobantes.')).toBeInTheDocument()
  })

  it('translates known conflicts to the Spanish recoverable-conflict message', async () => {
    api.submitDepositReport.mockRejectedValue(backendError({ status: 409, detail: 'stale_report' }))
    api.getDepositReport.mockResolvedValue({ report: report() })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    expect(await screen.findByText('El reporte cambió o ya no admite esta acción. Actualizamos la información para que puedas continuar.')).toBeInTheDocument()
  })

  it('uses a neutral Spanish fallback for unknown backend details', async () => {
    api.openDepositReport.mockRejectedValue(backendError({ detail: 'Unexpected English backend detail.' }))
    renderModal()
    expect(await screen.findByText('No se pudo completar la acción. Revisa los datos e inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected English backend detail.')).not.toBeInTheDocument()
  })
})
