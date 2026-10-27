import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MonthlyPerformanceCorrectionsPage from './MonthlyPerformanceCorrectionsPage'

const service = vi.hoisted(() => ({ validate: vi.fn(), create: vi.fn(), audit: vi.fn() }))
vi.mock('../services/monthlyPerformanceCorrectionsService', () => ({
  validateMonthlyPerformanceCorrection: service.validate,
  createMonthlyPerformanceCorrection: service.create,
  getMonthlyPerformanceCorrectionAudit: service.audit,
}))
vi.mock('../../performanceHistory/pages/SystemsPerformanceHistoryPage', () => ({ default: () => <p>selector de historial</p> }))

const target = { snapshotId: 'opaque-snapshot', summary: { area: 'Área Norte', responsibility: 'Responsable', period: 'octubre de 2026', state: 'closed', version: 4, expected_weight: '20', credited_weight: '15', percentage: '75' } }
function renderPage(state = { target }) { return render(<MemoryRouter initialEntries={[{ pathname: '/correcciones-rendimiento-mensual', state }]}><Routes><Route path="/correcciones-rendimiento-mensual" element={<MonthlyPerformanceCorrectionsPage />} /></Routes></MemoryRouter>) }

describe('MonthlyPerformanceCorrectionsPage', () => {
  beforeEach(() => {
    service.validate.mockReset(); service.create.mockReset(); service.audit.mockReset()
    service.audit.mockResolvedValue([])
    service.validate.mockResolvedValue({ valid: true, proposed_successor: { version: 5, state: 'corrected', expected_weight: '20', credited_weight: '15', percentage: '75' } })
  })

  it('uses the standalone history selector without exposing the opaque target identity', () => {
    renderPage(null)
    expect(screen.getByText('selector de historial')).toBeInTheDocument()
    expect(screen.queryByText('opaque-snapshot')).not.toBeInTheDocument()
    expect(window.location.search).not.toContain('snapshot')
  })

  it('validates before opening explicit confirmation and cancellation never writes', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Evidencia preservada revisada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    await screen.findByText('Resultado propuesto')
    expect(service.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(service.create).not.toHaveBeenCalled()
  })

  it('requires a non-whitespace reason and focuses its invalid field', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    expect(await screen.findByText(/Describe el motivo/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Motivo/)).toHaveFocus())
    expect(service.validate).not.toHaveBeenCalled()
  })

  it('writes only after confirmation and reuses the validated idempotency command', async () => {
    service.create.mockResolvedValue({ receipt: { replayed: true } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Evidencia preservada revisada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    await screen.findByText('Resultado propuesto')
    const validationPayload = service.validate.mock.calls[0][0]
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar corrección' }))
    await waitFor(() => expect(service.create).toHaveBeenCalledWith(validationPayload))
    expect(await screen.findByText(/mismo comprobante/)).toBeInTheDocument()
    expect(screen.queryByText('opaque-snapshot')).not.toBeInTheDocument()
  })

  it('clears a stale validation proposal and requires a new validation', async () => {
    service.validate.mockRejectedValueOnce({ status: 412 })
    renderPage()
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Motivo válido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    expect(await screen.findByText(/cambió antes de confirmar/)).toBeInTheDocument()
    expect(screen.queryByText('Resultado propuesto')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    await screen.findByText('Resultado propuesto')
    expect(service.validate).toHaveBeenCalledTimes(2)
    expect(service.validate.mock.calls[0][0].idempotency_key).not.toBe(service.validate.mock.calls[1][0].idempotency_key)
  })

  it('clears stale and reused-idempotency write proposals before another validation', async () => {
    service.create.mockRejectedValueOnce({ status: 409 })
    renderPage()
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Motivo válido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    await screen.findByText('Resultado propuesto')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar corrección' }))
    expect(await screen.findByText(/confirmación ya se usó/)).toBeInTheDocument()
    expect(screen.queryByText('Resultado propuesto')).not.toBeInTheDocument()
  })

  it('rejects invalid manual bounds and permits valid manual dry validation', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: /Ajuste manual excepcional/ }))
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Ajuste fundamentado' } })
    fireEvent.change(screen.getByLabelText('Peso esperado'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Peso acreditado'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    expect(await screen.findByText('El peso esperado debe ser mayor que cero.')).toBeInTheDocument()
    expect(screen.getByText('El peso acreditado debe estar entre cero y el peso esperado.')).toBeInTheDocument()
    expect(service.validate).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Peso esperado'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Peso acreditado'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    expect(await screen.findByText('El peso acreditado debe estar entre cero y el peso esperado.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Peso acreditado'), { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar corrección' }))
    await screen.findByText('Resultado propuesto')
    expect(service.validate).toHaveBeenLastCalledWith(expect.objectContaining({ adjustment: { expected_weight: '10', credited_weight: '7.5' } }))
  })

  it('distinguishes legacy audit rows from corrected rows without exposing opaque identifiers', async () => {
    service.audit.mockResolvedValue([{ version: 1, state: 'closed', expected_weight: '10', credited_weight: '10', percentage: '100', t8_receipt: null }, { version: 2, state: 'corrected', expected_weight: '10', credited_weight: '7.5', percentage: '75', t8_receipt: { classification: 'ajuste_manual_excepcional', reason: 'Evidencia corregida', timestamp: '2026-10-27T12:00:00Z', receipt_id: 'do-not-show' } }])
    renderPage()
    expect(await screen.findByText(/sin comprobante de corrección T8/i)).toBeInTheDocument()
    expect(screen.getAllByText('Ajuste manual excepcional')).toHaveLength(2)
    expect(screen.getByText('Evidencia corregida')).toBeInTheDocument()
    expect(screen.queryByText('do-not-show')).not.toBeInTheDocument()
    expect(window.location.href).not.toContain('opaque-snapshot')
  })
})
