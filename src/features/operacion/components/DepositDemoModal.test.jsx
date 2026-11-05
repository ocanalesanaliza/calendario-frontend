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
    expect(api.captureDepositClosure).not.toHaveBeenCalled()
    expect(await screen.findByText('Después de guardar, esta captura no podrá modificarse.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar captura' }))
    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenCalledWith('opaque-report-id', 71, expect.objectContaining({ total_sales: '100.00', cash_sales: '70.00', card_sales: '30.00', expected_version: 1 })))
    expect(await screen.findByText(/Ventas capturadas: L/)).toBeInTheDocument()
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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar captura' }))

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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar captura' }))

    await waitFor(() => expect(api.captureDepositClosure).toHaveBeenNthCalledWith(1, 'opaque-report-id', 71, expect.objectContaining({ sales_discrepancy_reason: 'El POS no registró una venta.' })))
    const updatedCards = await screen.findAllByRole('article')
    const updatedSecondCard = updatedCards.find((card) => card.textContent.includes('2026-11-02'))
    expect(within(updatedSecondCard).queryByLabelText('Explicación del descuadre *')).not.toBeInTheDocument()
    fireEvent.click(within(updatedSecondCard).getByRole('button', { name: 'Capturar ventas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar captura' }))
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
    expect(await screen.findByText(/Ventas capturadas: L/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Declarar no depositado' })).toBeEnabled()
  })

  it('does not enable no-deposit declarations until every closure has captured sales', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure(), { ...report().closures[0], id: 72, closure_date: '2026-11-02' }] }) })
    renderModal()
    const actions = await screen.findAllByRole('button', { name: 'Declarar no depositado' })
    expect(actions).toHaveLength(2)
    actions.forEach((action) => expect(action).toBeDisabled())
    expect(screen.getByText('Captura las ventas de todos los cierres presentados antes de declarar un cierre como no depositado.')).toBeInTheDocument()
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
    expect(api.allocateDepositReceipt).not.toHaveBeenCalled()
    expect(await screen.findByText('Esta asignación no podrá modificarse.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar asignación' }))
    await waitFor(() => expect(api.allocateDepositReceipt).toHaveBeenCalledWith('opaque-report-id', 81, expect.objectContaining({ closure_entry_id: 71, allocated_amount: '70.00', expected_version: 3 })))
  })

  it('renders historical pending closures as a separate reconciliation section', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure()],
      historical_pending_closures: [{ id: 'signed-historical-closure', closure_date: '2026-10-30', total_sales: '90.00', cash_sales: '70.00', card_sales: '20.00', deposited_amount: '40.00', outstanding_amount: '50.00' }],
    }) })
    renderModal()

    const reconciliation = await screen.findByRole('region', { name: 'Conciliación de cierres pendientes' })
    expect(within(reconciliation).getByText('Cierre del 2026-10-30')).toBeInTheDocument()
    expect(within(reconciliation).getByText('Monto aplicado/depositado: L 40.00')).toBeInTheDocument()
    expect(within(reconciliation).getByText('Diferencia pendiente de depósito: L 50.00')).toBeInTheDocument()
    expect(screen.getByText('Cierres presentados: 1')).toBeInTheDocument()
  })

  it('assigns a receipt to a historical closure with its opaque selector only', async () => {
    const initial = report({
      optimistic_version: 2,
      closures: [capturedClosure()],
      historical_pending_closures: [{ id: 'signed-historical-closure', closure_date: '2026-10-30', deposited_amount: '40.00', outstanding_amount: '50.00' }],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '50.00', deposited_on: '2026-11-02', allocations: [] }],
    })
    api.openDepositReport.mockResolvedValue({ report: initial })
    api.allocateDepositReceipt.mockResolvedValue({ report: initial })
    renderModal()

    fireEvent.change(await screen.findByLabelText('Cierre capturado *'), { target: { value: 'historical:signed-historical-closure' } })
    fireEvent.change(screen.getByLabelText('Monto asignado *'), { target: { value: '50.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar comprobante' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar asignación' }))

    await waitFor(() => expect(api.allocateDepositReceipt).toHaveBeenCalledWith('opaque-report-id', 81, expect.objectContaining({ historical_closure_id: 'signed-historical-closure', allocated_amount: '50.00', expected_version: 2, idempotency_key: expect.any(String) })))
    expect(api.allocateDepositReceipt.mock.calls[0][2]).not.toHaveProperty('closure_entry_id')
  })

  it('offers only historical closures whose backend-projected balance remains positive', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure()],
      historical_pending_closures: [
        { id: 'covered-historical-closure', closure_date: '2026-10-29', deposited_amount: '90.00', outstanding_amount: '0.00' },
        { id: 'available-historical-closure', closure_date: '2026-10-30', deposited_amount: '40.00', outstanding_amount: '50.00' },
      ],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '50.00', deposited_on: '2026-11-02', allocations: [] }],
    }) })
    renderModal()

    const selector = await screen.findByLabelText('Cierre capturado *')
    expect(within(selector).queryByRole('option', { name: '2026-10-29' })).not.toBeInTheDocument()
    expect(within(selector).getByRole('option', { name: '2026-10-30' })).toBeInTheDocument()
  })

  it('renders allocations returned for a historical closure', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure()],
      historical_pending_closures: [{ id: 'signed-historical-closure', closure_date: '2026-10-30', deposited_amount: '90.00', outstanding_amount: '0.00' }],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '90.00', deposited_on: '2026-11-02', allocations: [{ id: 91, closure_entry_id: null, historical_closure_id: 'signed-historical-closure', allocated_amount: '90.00' }] }],
    }) })
    renderModal()

    expect(await screen.findByText('Asignado al cierre 2026-10-30: L 90.00')).toBeInTheDocument()
  })

  it('keeps the daily report experience unchanged when there are no historical closures', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure()], historical_pending_closures: [], receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '50.00', deposited_on: '2026-11-02', allocations: [] }] }) })
    renderModal()

    await screen.findByText('Cierre del 2026-11-01')
    expect(screen.queryByRole('region', { name: 'Conciliación de cierres pendientes' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '2026-11-01' })).toBeInTheDocument()
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
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure({ no_depositado_reason: 'El banco estaba cerrado.' })], readiness: { ready_to_submit: true, blockers: [] } }) })
    api.submitDepositReport.mockResolvedValue({ report: report({ state: 'submitted', optimistic_version: 2, submission: { state: 'submitted', closures: [], receipts: [] } }) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar y enviar reporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    await waitFor(() => expect(api.submitDepositReport).toHaveBeenCalledWith('opaque-report-id', expect.objectContaining({ expected_version: 1 })))
    expect(await screen.findByText('El reporte fue enviado correctamente.')).toBeInTheDocument()
  })

  it('exposes an operational conflict without losing the recoverable report', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })], readiness: { ready_to_submit: true, blockers: [] } }) })
    api.submitDepositReport.mockRejectedValue(Object.assign(new Error('deposit_api_disabled'), { status: 409, detail: 'deposit_api_disabled' }))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar y enviar reporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    await waitFor(() => expect(api.submitDepositReport).toHaveBeenCalledWith('opaque-report-id', expect.objectContaining({ expected_version: 1 })))
    expect(await screen.findByText(/no está habilitado actualmente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeInTheDocument()
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
    const ready = report({ closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })], readiness: { ready_to_submit: true, blockers: [] } })
    api.openDepositReport.mockResolvedValue({ report: ready })
    api.submitDepositReport.mockRejectedValue(backendError({ status: 409, detail: 'stale_report' }))
    api.getDepositReport.mockResolvedValue({ report: ready })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar y enviar reporte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar reporte completo' }))
    expect(await screen.findByText('El reporte cambió o ya no admite esta acción. Actualizamos la información para que puedas continuar.')).toBeInTheDocument()
  })

  it('uses a neutral Spanish fallback for unknown backend details', async () => {
    api.openDepositReport.mockRejectedValue(backendError({ detail: 'Unexpected English backend detail.' }))
    renderModal()
    expect(await screen.findByText('No se pudo completar la acción. Revisa los datos e inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Unexpected English backend detail.')).not.toBeInTheDocument()
  })

  it('shows actionable readiness progress and each closure status without financial balances', async () => {
    const closures = [
      report().closures[0],
      capturedClosure({ id: 72, closure_date: '2026-11-02' }),
      capturedClosure({ id: 73, closure_date: '2026-11-03', no_depositado_reason: 'Banco cerrado' }),
      capturedClosure({ id: 74, closure_date: '2026-11-04' }),
    ]
    api.openDepositReport.mockResolvedValue({ report: report({ closures, receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '50.00', deposited_on: '2026-11-04', allocations: [{ closure_entry_id: 74, allocated_amount: '50.00' }] }], readiness: { ready_to_submit: false, blockers: [{ code: 'closure_sales_missing', closure_entry_id: 71, closure_date: '2026-11-01' }, { code: 'closure_resolution_missing', closure_entry_id: 72, closure_date: '2026-11-02' }] } }) })
    renderModal()

    expect(await screen.findByText('Faltan acciones para enviar')).toBeInTheDocument()
    expect(screen.getByText('Cierres presentados: 4')).toBeInTheDocument()
    expect(screen.getByText('Ventas capturadas: 3')).toBeInTheDocument()
    expect(screen.getByText('Cierres resueltos: 2')).toBeInTheDocument()
    expect(screen.getByText('Cierres pendientes: 2')).toBeInTheDocument()
    expect(screen.getByText('Captura las ventas del cierre 2026-11-01.')).toBeInTheDocument()
    expect(screen.getByText('Asigna un comprobante o declara que no hubo depósito para el cierre 2026-11-02.')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de capturar ventas.')).toBeInTheDocument()
    expect(screen.getByText('Ventas capturadas; pendiente de resolver depósito.')).toBeInTheDocument()
    expect(screen.getByText('Declarado como no depositado.')).toBeInTheDocument()
    expect(screen.getByText('Resuelto según validación del reporte.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
  })

  it('keeps sales values and trigger focus when capture confirmation is cancelled or closed with Escape', async () => {
    renderModal()
    await screen.findByText('Cierre del 2026-11-01')
    fireEvent.change(screen.getByLabelText('Ventas totales *'), { target: { value: '100.00' } })
    fireEvent.change(screen.getByLabelText('Ventas en efectivo *'), { target: { value: '70.00' } })
    fireEvent.change(screen.getByLabelText('Ventas con tarjeta *'), { target: { value: '30.00' } })
    const trigger = screen.getByRole('button', { name: 'Capturar ventas' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(api.captureDepositClosure).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
    expect(screen.getByLabelText('Ventas totales *')).toHaveValue(100)
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })

  it('keeps allocation values and trigger focus when allocation confirmation is cancelled', async () => {
    const captured = report({ closures: [capturedClosure()], receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', deposited_on: '2026-11-02', allocations: [] }] })
    api.openDepositReport.mockResolvedValue({ report: captured })
    renderModal()
    const closureSelect = await screen.findByLabelText('Cierre capturado *')
    fireEvent.change(closureSelect, { target: { value: '71' } })
    fireEvent.change(screen.getByLabelText('Monto asignado *'), { target: { value: '70.00' } })
    const trigger = screen.getByRole('button', { name: 'Asignar comprobante' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(api.allocateDepositReceipt).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
    expect(closureSelect).toHaveValue('71')
    expect(screen.getByLabelText('Monto asignado *')).toHaveValue(70)
  })

  it('opens review only for a ready report and does not submit when review is cancelled', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({ closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })], readiness: { ready_to_submit: true, blockers: [] } }) })
    renderModal()
    const review = await screen.findByRole('button', { name: 'Revisar y enviar reporte' })
    expect(screen.getByText('Listo para revisión')).toBeInTheDocument()
    fireEvent.click(review)
    expect(await screen.findByText('El envío del reporte es definitivo.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.submitDepositReport).not.toHaveBeenCalled()
    expect(review).toHaveFocus()
    fireEvent.click(review)
    expect(await screen.findByRole('dialog', { name: 'Revisar y enviar reporte' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(review).toHaveFocus()
  })

  it('renders the final review as separate closure and receipt blocks using exact backend amounts', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure({ deposited_amount: '100.00', outstanding_amount: '0.00' })],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '100.00', allocated_amount: '100.00', unallocated_amount: '0.00', deposited_on: '2026-11-02', allocations: [{ closure_entry_id: 71, allocated_amount: '100.00' }] }],
      readiness: { ready_to_submit: true, blockers: [] },
    }) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar y enviar reporte' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Revisar y enviar reporte' })
    expect(within(confirmation).getByText('Listo para enviar')).toBeInTheDocument()
    expect(within(confirmation).getByText('Todos los comprobantes registrados fueron asignados.')).toBeInTheDocument()
    const closure = within(confirmation).getByRole('article', { name: 'Cierre del 2026-11-01' })
    expect(within(closure).getByText('Monto aplicado/depositado')).toBeInTheDocument()
    expect(within(closure).getByText('L 100.00')).toBeInTheDocument()
    expect(within(closure).getByText('Diferencia pendiente de depósito')).toBeInTheDocument()
    expect(within(closure).getByText('L 0.00')).toBeInTheDocument()
    const receipt = within(confirmation).getByRole('article', { name: 'Comprobante REF-1' })
    expect(within(receipt).getByText('Monto depositado')).toBeInTheDocument()
    expect(within(receipt).getByText('Monto asignado')).toBeInTheDocument()
    expect(within(receipt).getByText('Monto disponible')).toBeInTheDocument()
    expect(within(receipt).getAllByText('L 100.00')).toHaveLength(2)
    expect(within(receipt).getByText('L 0.00')).toBeInTheDocument()
    expect(within(confirmation).getByText('El envío del reporte es definitivo.')).toBeInTheDocument()
  })

  it('shows backend financial context without recalculating the closure outstanding amount', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure({
        total_sales: '130.00', cash_sales: '100.00', card_sales: '20.00',
        deposited_amount: '40.00', outstanding_amount: '987.65',
        sales_discrepancy_amount: '10.00', sales_discrepancy_reason: 'Ajuste de caja',
      })],
      readiness: { ready_to_submit: false, blockers: [{ code: 'closure_resolution_missing', closure_entry_id: 71, closure_date: '2026-11-01' }] },
    }) })
    renderModal()

    expect(await screen.findByText(/Ventas en efectivo: L 100\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Monto aplicado\/depositado: L 40\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Diferencia pendiente de depósito: L 987\.65/)).toBeInTheDocument()
    expect(screen.getByText(/Descuadre de ventas: L 10\.00/)).toBeInTheDocument()
    expect(screen.getByText('Explicación del descuadre: Ajuste de caja')).toBeInTheDocument()
    expect(screen.queryByText(/Diferencia pendiente de depósito: L 60\.00/)).not.toBeInTheDocument()
  })

  it('does not invent financial amounts for a closure without captured sales', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      readiness: { ready_to_submit: false, blockers: [{ code: 'closure_sales_missing', closure_entry_id: 71, closure_date: '2026-11-01' }] },
    }) })
    renderModal()

    await screen.findByText('Cierre del 2026-11-01')
    expect(screen.queryByText(/Monto aplicado\/depositado/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Diferencia pendiente de depósito/)).not.toBeInTheDocument()
  })

  it('shows receipt backend amounts and resolved allocation dates without calculating availability', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure({ outstanding_amount: '31.00', deposited_amount: '69.00' })],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', allocated_amount: '7.00', unallocated_amount: '456.78', deposited_on: '2026-11-02', allocations: [{ closure_entry_id: 71, allocated_amount: '7.00' }] }],
      readiness: { ready_to_submit: false, blockers: [{ code: 'closure_resolution_missing', closure_entry_id: 71, closure_date: '2026-11-01' }] },
    }) })
    renderModal()

    expect(await screen.findByText(/Monto depositado: L 70\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Monto asignado: L 7\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Monto disponible: L 456\.78/)).toBeInTheDocument()
    expect(screen.getByText(/Asignado al cierre 2026-11-01: L 7\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/Monto disponible: L 63\.00/)).not.toBeInTheDocument()
  })

  it('uses backend amounts in allocation confirmation while preserving cancellation and payload', async () => {
    const captured = report({
      closures: [capturedClosure({ outstanding_amount: '333.33', deposited_amount: '70.00' })],
      receipts: [{ id: 81, reference: 'REF-1', deposited_amount: '70.00', allocated_amount: '10.00', unallocated_amount: '222.22', deposited_on: '2026-11-02', allocations: [] }],
      readiness: { ready_to_submit: false, blockers: [{ code: 'closure_resolution_missing', closure_entry_id: 71, closure_date: '2026-11-01' }] },
    })
    api.openDepositReport.mockResolvedValue({ report: captured })
    renderModal()
    const closureSelect = await screen.findByLabelText('Cierre capturado *')
    fireEvent.change(closureSelect, { target: { value: '71' } })
    fireEvent.change(screen.getByLabelText('Monto asignado *'), { target: { value: '12.00' } })
    const trigger = screen.getByRole('button', { name: 'Asignar comprobante' })
    fireEvent.click(trigger)

    expect(await screen.findByText(/Monto disponible del comprobante: L 222\.22/)).toBeInTheDocument()
    expect(screen.getByText(/Pendiente del cierre seleccionado: L 333\.33/)).toBeInTheDocument()
    expect(screen.getByText(/Monto a asignar: L 12\.00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(trigger).toHaveFocus()
    expect(api.allocateDepositReceipt).not.toHaveBeenCalled()
  })

  it.each([
    ['closure_sales_missing', 'Captura las ventas del cierre 2026-11-01.'],
    ['closure_resolution_missing', 'Asigna un comprobante o declara que no hubo depósito para el cierre 2026-11-01.'],
    ['report_receipt_missing', 'Agrega al menos un comprobante para poder enviar el reporte.'],
    ['receipt_unallocated_amount', 'Asigna el monto disponible del comprobante antes de enviar el reporte.'],
    ['unexpected_code', 'El reporte tiene una validación pendiente. Actualiza e inténtalo nuevamente.'],
  ])('uses authoritative readiness blocker %s and keeps submission blocked', async (code, message) => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure()],
      readiness: { ready_to_submit: false, blockers: [{ code, closure_entry_id: 71, closure_date: '2026-11-01' }] },
    }) })
    renderModal()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
  })

  it('shows the backend receipt blocker details and never opens final review', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure()],
      receipts: [{ id: 81, reference: 'REF-PENDIENTE', deposited_amount: '100.00', allocated_amount: '75.00', unallocated_amount: '25.50', deposited_on: '2026-11-02', allocations: [] }],
      readiness: { ready_to_submit: false, blockers: [{ code: 'receipt_unallocated_amount', receipt_id: 81, reference: 'REF-PENDIENTE', unallocated_amount: '25.50' }] },
    }) })
    renderModal()

    expect(await screen.findByText('Comprobante REF-PENDIENTE: monto disponible L 25.50. Asigna el monto restante antes de enviar.')).toBeInTheDocument()
    const review = screen.getByRole('button', { name: 'Revisar y enviar reporte' })
    expect(review).toBeDisabled()
    fireEvent.click(review)
    expect(screen.queryByRole('dialog', { name: 'Revisar y enviar reporte' })).not.toBeInTheDocument()
  })

  it('blocks submission when readiness is missing or invalid and opens final review only when backend marks it ready', async () => {
    api.openDepositReport.mockResolvedValueOnce({ report: report({ closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })] }) })
    const first = renderModal()
    expect(await screen.findByText('El reporte tiene una validación pendiente. Actualiza e inténtalo nuevamente.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
    first.unmount()

    api.openDepositReport.mockResolvedValueOnce({ report: report({
      closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })],
      readiness: { ready_to_submit: 'true', blockers: [] },
    }) })
    const second = renderModal()
    expect(await screen.findByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
    second.unmount()

    api.openDepositReport.mockResolvedValueOnce({ report: report({
      closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })],
      readiness: { ready_to_submit: true, blockers: [] },
    }) })
    renderModal()
    const review = await screen.findByRole('button', { name: 'Revisar y enviar reporte' })
    expect(review).toBeEnabled()
    fireEvent.click(review)
    expect(await screen.findByText('El envío del reporte es definitivo.')).toBeInTheDocument()
  })

  it('blocks contradictory readiness payloads', async () => {
    api.openDepositReport.mockResolvedValue({ report: report({
      closures: [capturedClosure({ no_depositado_reason: 'Banco cerrado' })],
      readiness: { ready_to_submit: true, blockers: [{ code: 'closure_resolution_missing', closure_entry_id: 71, closure_date: '2026-11-01' }] },
    }) })
    renderModal()

    expect(await screen.findByText('Asigna un comprobante o declara que no hubo depósito para el cierre 2026-11-01.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
  })
})
