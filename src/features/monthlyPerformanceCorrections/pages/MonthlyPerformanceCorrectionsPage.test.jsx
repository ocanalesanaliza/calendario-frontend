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
})
