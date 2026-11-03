import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DepositReviewWorklistModal from './DepositReviewWorklistModal'

const api = vi.hoisted(() => ({
  getDepositReviewWorklist: vi.fn(),
  getDepositReviewDetail: vi.fn(),
  recordDepositReviewDecision: vi.fn(),
}))

vi.mock('../../calendarArea/services/depositReviewWorklistService', () => api)

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

describe('DepositReviewWorklistModal', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getDepositReviewWorklist.mockResolvedValue(worklist())
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
})
