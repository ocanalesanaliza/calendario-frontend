import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DepositReviewWorklistModal from './DepositReviewWorklistModal'

const api = vi.hoisted(() => ({
  getDepositReviewWorklist: vi.fn(),
  getDepositReviewDetail: vi.fn(),
  recordDepositReviewDecision: vi.fn(),
  finalizeDepositReviewWorklist: vi.fn(),
}))

vi.mock('../../calendarArea/services/depositReviewWorklistService', () => api)
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const occurrenceVirtualId = 'occurrence-opaque-123'
const reportAvailableCase = {
  id: 'case-opaque-report-456', branch_code: 'PSO-002', branch_name: 'PSO - El Paraíso', closure_date: '2026-11-02', classification: 'report_available', decision: null,
}
const pendingCase = {
  id: 'case-opaque-pending-789', branch_code: 'SUC-002', closure_date: '2026-11-02', classification: 'pending', decision: null,
}
const noRecordCase = {
  id: 'case-opaque-none-321', branch_code: 'SUC-003', closure_date: '2026-11-02', classification: 'sin_registro', decision: null,
}

function worklist(cases = [reportAvailableCase, pendingCase, noRecordCase]) {
  return {
    id: occurrenceVirtualId,
    state: 'pending',
    origin_date: '2026-11-03',
    historical_context: { scheduled_on: '2026-11-03', effective_on: '2026-11-03', attribution_month: '2026-11-01' },
    cases,
  }
}

function detail() {
  return {
    case: { branch_code: 'PSO-002', branch_name: 'PSO - El Paraíso', closure_date: '2026-11-02' },
    closure: {
      total_sales: '100.00', cash_sales: '60.00', card_sales: '40.00', deposited_amount: '75.00', outstanding_amount: '25.00', no_depositado_reason: 'El banco estaba cerrado',
    },
    receipts: [{ reference: 'REF-001', deposited_on: '2026-11-03', deposited_amount: '999.00', allocated_amount: '75.00' }],
  }
}

function renderModal() {
  return render(<DepositReviewWorklistModal occurrenceVirtualId={occurrenceVirtualId} onClose={vi.fn()} onTerminal={vi.fn()} />)
}

function reportDetail() {
  const selected = detail()
  return {
    ...selected,
    report_closures: [
      { ...selected.closure, closure_date: '2026-11-04', is_selected: false, total_sales: '321.00', outstanding_amount: '17.25', sales_discrepancy_amount: '-8.50', sales_discrepancy_reason: null, no_depositado_reason: 'Depósito del jueves pendiente', receipts: [] },
      { ...selected.closure, closure_date: selected.case.closure_date, is_selected: true, receipts: selected.receipts },
      { ...selected.closure, closure_date: '2026-11-01', is_selected: false, total_sales: '212.00', outstanding_amount: '13.75', sales_discrepancy_amount: '4.50', sales_discrepancy_reason: 'Ajuste del domingo', no_depositado_reason: 'Banco del domingo cerrado', receipts: [{ reference: 'REF-CONTEXT', deposited_on: '2026-11-05', deposited_amount: '888.00', allocated_amount: '33.00' }] },
    ],
  }
}

async function openReport(data) {
  api.getDepositReviewDetail.mockResolvedValue(data)
  renderModal()
  const trigger = await screen.findByRole('button', { name: 'Ver depósito para PSO-002' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
  await within(dialog).findByText('REF-001')
  return { dialog, trigger }
}

describe('DepositReviewWorklistModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getDepositReviewWorklist.mockResolvedValue(worklist())
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
  })

  it('isolates the selected closure and chronologically sorted context without mutating the report', async () => {
    const data = reportDetail()
    const snapshot = structuredClone(data)
    Object.freeze(data.report_closures)
    const { dialog, trigger } = await openReport(data)
    const selected = within(dialog).getByRole('article', { name: 'En revisión · Cierre 2026-11-02' })
    const context = within(dialog).getByRole('region', { name: 'Otros cierres de este reporte' })
    const cards = within(context).getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('heading', { name: 'Cierre 2026-11-01' })).toBeInTheDocument()
    expect(within(cards[1]).getByRole('heading', { name: 'Cierre 2026-11-04' })).toBeInTheDocument()
    expect(data).toEqual(snapshot)
    expect(within(dialog).getAllByRole('article')).toHaveLength(3)
    expect(selected).toHaveTextContent('REF-001')
    expect(selected).not.toHaveTextContent('REF-CONTEXT')
    expect(cards[0]).not.toHaveTextContent('REF-001')
    expect(cards[0]).toHaveTextContent('REF-CONTEXT')
    expect(cards[0]).toHaveTextContent('2026-11-05')
    expect(cards[0]).toHaveTextContent('L 33.00')
    expect(cards[0]).not.toHaveTextContent('888.00')
    expect(cards[0]).toHaveTextContent('Banco del domingo cerrado')
    expect(cards[0]).not.toHaveTextContent('Depósito del jueves pendiente')
    expect(cards[1]).toHaveTextContent('Depósito del jueves pendiente')
    expect(cards[1]).toHaveTextContent('No hay comprobantes aplicables para este cierre.')
    for (const [card, total, pending, discrepancy, reason] of [
      [cards[0], '212.00', '13.75', '4.50', 'Ajuste del domingo'],
      [cards[1], '321.00', '17.25', '-8.50', 'Sin explicación registrada.'],
    ]) {
      const summary = within(card).getByRole('region', { name: 'Resumen del cierre' })
      const warning = within(card).getByRole('region', { name: 'Descuadre de ventas' })
      expect(summary).toHaveTextContent(`L ${total}`)
      expect(summary).toHaveTextContent('L 60.00')
      expect(summary).toHaveTextContent('L 40.00')
      expect(summary).toHaveTextContent('L 75.00')
      expect(summary).toHaveTextContent(`Diferencia pendienteL ${pending}`)
      expect(summary).not.toHaveTextContent('Descuadre de ventas')
      expect(warning).toHaveTextContent(`L ${discrepancy}`)
      expect(warning).toHaveTextContent(reason)
    }
    const ids = [...dialog.querySelectorAll('[id]')].map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(dialog.querySelectorAll('input, select, textarea, [contenteditable="true"]')).toHaveLength(0)
    expect(within(dialog).queryByRole('button', { name: /Conforme|observación|Guardar/ })).not.toBeInTheDocument()
    const buttons = within(dialog).getAllByRole('button')
    buttons.at(-1).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(buttons[0]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(buttons.at(-1)).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(api.recordDepositReviewDecision).not.toHaveBeenCalled()
    expect(api.getDepositReviewDetail).toHaveBeenCalledExactlyOnceWith(occurrenceVirtualId, reportAvailableCase.id)
  })

  it('preserves selected evidence and opaque decision identity after closing contextual detail', async () => {
    const data = reportDetail()
    const snapshot = structuredClone(data)
    api.recordDepositReviewDecision.mockResolvedValue({ worklist: worklist([]) })
    const { dialog, trigger } = await openReport(data)
    const selected = within(dialog).getByRole('article', { name: 'En revisión · Cierre 2026-11-02' })
    expect([...selected.querySelectorAll('dd')].map((node) => node.textContent)).toEqual([
      'L 100.00', 'L 60.00', 'L 40.00', 'L 75.00', 'L 25.00', 'El banco estaba cerrado', 'REF-001', '2026-11-03', 'L 75.00',
    ])
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Conforme para PSO-002' }))
    await waitFor(() => expect(api.recordDepositReviewDecision).toHaveBeenCalledExactlyOnceWith(occurrenceVirtualId, reportAvailableCase.id, expect.objectContaining({ decision: 'conforme', comment: '' })))
    expect(data).toEqual(snapshot)
  })

  it('requires an explicit false selection flag and preserves duplicate receipt allocations', async () => {
    const data = reportDetail()
    const row = {
      ...data.report_closures[2], outstanding_amount: '-19.87', sales_discrepancy_amount: '+3.25', sales_discrepancy_reason: '  ',
      receipts: [
        { reference: 'OWN', deposited_on: '2026-11-05', allocated_amount: '0.21' },
        { reference: 'OWN', deposited_on: '2026-11-05', allocated_amount: '0.22' },
      ],
    }
    data.report_closures = [{ ...row, is_selected: true }, { ...row, is_selected: 0 }, { ...row, is_selected: undefined }, row]
    const { dialog } = await openReport(data)
    const context = within(dialog).getByRole('region', { name: 'Otros cierres de este reporte' })
    const cards = within(context).getAllByRole('article')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('L -19.87')
    expect(cards[0]).toHaveTextContent('L 3.25')
    expect(cards[0]).toHaveTextContent('Sin explicación registrada.')
    const receipts = within(cards[0]).getAllByRole('listitem')
    expect(receipts).toHaveLength(2)
    expect(receipts[0]).toHaveTextContent('OWN')
    expect(receipts[0]).toHaveTextContent('L 0.21')
    expect(receipts[1]).toHaveTextContent('OWN')
    expect(receipts[1]).toHaveTextContent('L 0.22')
  })

  it.each([undefined, null, [], [{ ...detail().closure, closure_date: '2026-11-02', is_selected: true }]])('omits context when there are no other closures (%j)', async (closures) => {
    const { dialog } = await openReport({ ...detail(), report_closures: closures })
    expect(within(dialog).queryByRole('region', { name: 'Otros cierres de este reporte' })).not.toBeInTheDocument()
  })

  it.each(['0', '0.00', '-0.000', null, undefined, '', ' ', 'invalid', 'NaN', 'Infinity', '0x10', '1e2'])('does not warn for a zero, historical or invalid decimal (%s) in either closure', async (amount) => {
    const data = reportDetail()
    data.closure.sales_discrepancy_amount = amount
    data.report_closures = data.report_closures.map((closure) => ({ ...closure, sales_discrepancy_amount: amount }))
    const { dialog } = await openReport(data)
    for (const card of within(dialog).getAllByRole('article')) {
      expect(within(card).queryByRole('region', { name: 'Descuadre de ventas' })).not.toBeInTheDocument()
      expect(card).not.toHaveTextContent('Sin explicación registrada.')
    }
  })

  it('translates classifications and only exposes the actions allowed for each dynamic case', async () => {
    renderModal()

    expect(await screen.findByText('Depósito enviado')).toBeInTheDocument()
    expect(screen.queryByText('report_available')).not.toBeInTheDocument()
    expect(screen.getByText('Pendiente de envío')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conforme para SUC-002' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Con observación para SUC-002' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin registro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sin registro revisado para SUC-003' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conforme para SUC-003' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Con observación para SUC-003' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver depósito para PSO-002' })).toBeInTheDocument()
  })

  it('shows the branch name for each worklist case and falls back to the branch code when absent', async () => {
    renderModal()

    expect(await screen.findByRole('heading', { name: 'PSO - El Paraíso' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SUC-002' })).toBeInTheDocument()
  })

  it('renders the branch hierarchy, five localized summary amounts, and applicable receipts read-only', async () => {
    api.getDepositReviewDetail.mockResolvedValue(detail())
    renderModal()

    const openDetail = await screen.findByRole('button', { name: 'Ver depósito para PSO-002' })
    openDetail.focus()
    fireEvent.click(openDetail)

    await waitFor(() => expect(api.getDepositReviewDetail).toHaveBeenCalledWith(occurrenceVirtualId, 'case-opaque-report-456'))
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
    expect(dialog).toHaveTextContent('PSO - El Paraíso')
    expect(dialog).toHaveTextContent('PSO-002 · Cierre 2026-11-02')
    expect(dialog).toHaveTextContent('Resumen del cierre')
    expect(dialog).toHaveTextContent('2026-11-02')
    expect(dialog).toHaveTextContent('L 100.00')
    expect(dialog).toHaveTextContent('L 60.00')
    expect(dialog).toHaveTextContent('L 40.00')
    expect(dialog).toHaveTextContent('L 75.00')
    expect(dialog).toHaveTextContent('L 25.00')
    expect(dialog).toHaveTextContent('REF-001')
    expect(dialog).toHaveTextContent('2026-11-03')
    expect(dialog).toHaveTextContent('Fecha de depósito')
    expect(dialog).toHaveTextContent('Monto aplicado a este cierre')
    expect(dialog).not.toHaveTextContent('999.00')
    expect(dialog.querySelectorAll('input, textarea, select')).toHaveLength(0)
    expect(within(dialog).queryByRole('button', { name: /Conforme|observación|Guardar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar detalle del depósito' })).toBeInTheDocument()
  })

  it('shows a Spanish detail error with a safe retry and supports Escape to close the detail', async () => {
    api.getDepositReviewDetail.mockRejectedValueOnce(new Error('network'))
    api.getDepositReviewDetail.mockResolvedValueOnce(detail())
    renderModal()

    const openDetail = await screen.findByRole('button', { name: 'Ver depósito para PSO-002' })
    openDetail.focus()
    fireEvent.click(openDetail)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el detalle del depósito.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar detalle del depósito' }))
    expect(await screen.findByText('REF-001')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Detalle del depósito' })).not.toBeInTheDocument())
    expect(openDetail).toHaveFocus()
  })

  it('falls back to branch_code when a detail has no branch_name', async () => {
    api.getDepositReviewDetail.mockResolvedValue({ ...detail(), case: { branch_code: 'PSO-002', closure_date: '2026-11-02' } })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver depósito para PSO-002' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
    expect(dialog).toHaveTextContent('PSO-002')
    expect(dialog).not.toHaveTextContent('undefined')
  })

  it('shows the no-deposit reason in the closure summary when provided', async () => {
    api.getDepositReviewDetail.mockResolvedValue({ ...detail(), closure: { ...detail().closure, no_depositado_reason: 'El banco estaba cerrado' } })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver depósito para PSO-002' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
    expect(dialog).toHaveTextContent('Motivo de no depósito')
    expect(dialog).toHaveTextContent('El banco estaba cerrado')
  })

  it('keeps the pending deposit difference separate from a sales discrepancy warning', async () => {
    api.getDepositReviewDetail.mockResolvedValue({ ...detail(), closure: { ...detail().closure, sales_discrepancy_amount: '10.00', sales_discrepancy_reason: 'El POS no registró una venta.' } })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver depósito para PSO-002' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
    expect(dialog).toHaveTextContent('Diferencia pendiente')
    expect(dialog).toHaveTextContent('L 25.00')
    expect(dialog).toHaveTextContent('Descuadre de ventas')
    expect(dialog).toHaveTextContent('L 10.00')
    expect(dialog).toHaveTextContent('Explicación del descuadre')
    expect(dialog).toHaveTextContent('El POS no registró una venta.')
  })

  it('shows a historical fallback when a sales discrepancy has no recorded explanation', async () => {
    api.getDepositReviewDetail.mockResolvedValue({ ...detail(), closure: { ...detail().closure, sales_discrepancy_amount: '10.00', sales_discrepancy_reason: null } })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver depósito para PSO-002' }))

    expect(await screen.findByText('Sin explicación registrada.')).toBeInTheDocument()
  })

  it('does not render a sales discrepancy warning for a balanced closure', async () => {
    api.getDepositReviewDetail.mockResolvedValue({ ...detail(), closure: { ...detail().closure, sales_discrepancy_amount: '0.00', sales_discrepancy_reason: null } })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver depósito para PSO-002' }))

    const dialog = await screen.findByRole('dialog', { name: 'Detalle del depósito' })
    expect(dialog).not.toHaveTextContent('Descuadre de ventas')
    expect(dialog).not.toHaveTextContent('Explicación del descuadre')
  })

  it('requires a focused non-empty comment before saving an observation', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Con observación para PSO-002' }))

    const comment = await screen.findByLabelText('Comentario *')
    expect(comment).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar observación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El comentario es obligatorio para registrar una observación.')
    expect(comment).toHaveFocus()
    expect(api.recordDepositReviewDecision).not.toHaveBeenCalled()

    api.recordDepositReviewDecision.mockResolvedValue({ worklist: worklist([]) })
    fireEvent.change(comment, { target: { value: 'Falta comprobante bancario.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar observación' }))
    await waitFor(() => expect(api.recordDepositReviewDecision).toHaveBeenCalledWith(occurrenceVirtualId, 'case-opaque-report-456', expect.objectContaining({ decision: 'con_observacion', comment: 'Falta comprobante bancario.' })))
  })

  it('rejects whitespace-only observation comments without sending a decision', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Con observación para PSO-002' }))
    const comment = await screen.findByLabelText('Comentario *')

    fireEvent.change(comment, { target: { value: ' \n\t ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar observación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El comentario es obligatorio para registrar una observación.')
    expect(comment).toHaveFocus()
    expect(api.recordDepositReviewDecision).not.toHaveBeenCalled()
  })

  it('cancels an observation without calling the endpoint', async () => {
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Con observación para PSO-002' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(api.recordDepositReviewDecision).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Registrar observación' })).not.toBeInTheDocument()
  })

  it('returns focus to the observation trigger after Escape closes its modal', async () => {
    renderModal()
    const trigger = await screen.findByRole('button', { name: 'Con observación para PSO-002' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(await screen.findByRole('dialog', { name: 'Registrar observación' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar observación' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('keeps Conforme as a direct action', async () => {
    api.recordDepositReviewDecision.mockResolvedValue({ worklist: worklist([]) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Conforme para PSO-002' }))

    await waitFor(() => expect(api.recordDepositReviewDecision).toHaveBeenCalledWith(occurrenceVirtualId, 'case-opaque-report-456', expect.objectContaining({ decision: 'conforme', comment: '' })))
  })

  it('uses the successful Sin registro response to render the terminal decision and remove its action', async () => {
    api.recordDepositReviewDecision.mockResolvedValue({ worklist: worklist([
      reportAvailableCase,
      pendingCase,
      { ...noRecordCase, decision: 'sin_registro_revisado' },
    ]) })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Sin registro revisado para SUC-003' }))
    fireEvent.change(await screen.findByLabelText('Comentario *'), { target: { value: 'No hubo depósito registrado.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar decisión' }))

    expect(await screen.findByText('Sin registro revisado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sin registro revisado para SUC-003' })).not.toBeInTheDocument()
  })

  it('presents persisted decisions in Spanish without further actions', async () => {
    api.getDepositReviewWorklist.mockResolvedValue(worklist([{ ...reportAvailableCase, decision: 'con_observacion' }]))
    renderModal()

    expect(await screen.findByText('Con observación')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /SUC-001/ })).not.toBeInTheDocument()
  })

  it('describes an empty worklist as a dynamic review', async () => {
    api.getDepositReviewWorklist.mockResolvedValue(worklist([]))
    renderModal()

    expect(await screen.findByText('No hay Sucursales o cierres aplicables para esta revisión en este momento.')).toBeInTheDocument()
    expect(screen.getByText(/actualmente aplicables/)).toBeInTheDocument()
    expect(screen.queryByText(/congelados/)).not.toBeInTheDocument()
  })

  it('lets GA explicitly finalize only after every case has a terminal decision', async () => {
    api.getDepositReviewWorklist.mockResolvedValue(worklist([{ ...reportAvailableCase, decision: 'conforme' }, { ...noRecordCase, decision: 'sin_registro_revisado' }]))
    api.finalizeDepositReviewWorklist.mockResolvedValue({ worklist: { ...worklist([]), state: 'completed' } })
    renderModal()

    const finalize = await screen.findByRole('button', { name: 'Finalizar revisión' })
    expect(finalize).toBeEnabled()
    fireEvent.click(finalize)
    await waitFor(() => expect(api.finalizeDepositReviewWorklist).toHaveBeenCalledWith(occurrenceVirtualId, expect.objectContaining({ idempotency_key: expect.any(String) })))
    expect(await screen.findByText('La revisión de depósitos quedó completada.')).toBeInTheDocument()
  })

  it('keeps finalization disabled with an accessible explanation while a case is pending', async () => {
    renderModal()
    const finalize = await screen.findByRole('button', { name: 'Finalizar revisión' })
    expect(finalize).toBeDisabled()
    expect(document.getElementById(finalize.getAttribute('aria-describedby'))).toHaveTextContent('Aún hay casos sin una decisión final.')
  })

  it('does not expose GA finalization to GO and safely handles finalization errors', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_operaciones' } })
    api.getDepositReviewWorklist.mockResolvedValue(worklist([{ ...reportAvailableCase, decision: 'conforme' }]))
    renderModal()
    expect(await screen.findByText('Conforme')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar revisión' })).not.toBeInTheDocument()
  })

  it.each([
    [403, 'No tienes acceso a esta revisión de depósitos.'],
    [404, 'La revisión de depósitos ya no está disponible.'],
    [409, 'La revisión cambió o ya fue finalizada. Actualizamos la información disponible.'],
  ])('shows a safe finalization message for HTTP %s', async (status, message) => {
    api.getDepositReviewWorklist.mockResolvedValue(worklist([{ ...reportAvailableCase, decision: 'conforme' }]))
    api.finalizeDepositReviewWorklist.mockRejectedValue({ status, message: 'backend secret' })
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar revisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('backend secret')).not.toBeInTheDocument()
  })

  it('does not complete the review merely because the last case gets a decision', async () => {
    const onTerminal = vi.fn()
    api.getDepositReviewWorklist.mockResolvedValue(worklist([{ ...reportAvailableCase }]))
    api.recordDepositReviewDecision.mockResolvedValue({ worklist: worklist([{ ...reportAvailableCase, decision: 'conforme' }]) })
    render(<DepositReviewWorklistModal occurrenceVirtualId={occurrenceVirtualId} onClose={vi.fn()} onTerminal={onTerminal} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Conforme para PSO-002' }))
    await screen.findByRole('button', { name: 'Finalizar revisión' })
    expect(onTerminal).not.toHaveBeenCalled()
  })
})
