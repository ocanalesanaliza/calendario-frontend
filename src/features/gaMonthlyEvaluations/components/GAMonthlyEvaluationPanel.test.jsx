import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GAMonthlyEvaluationPanel from './GAMonthlyEvaluationPanel'

const service = vi.hoisted(() => ({
  getGAMonthlyEvaluations: vi.fn(), createGAMonthlyEvaluation: vi.fn(), correctGAMonthlyEvaluation: vi.fn(), getGAMonthlyEvaluationHistory: vi.fn(),
}))
vi.mock('../services/gaMonthlyEvaluationsService', () => service)

describe('GAMonthlyEvaluationPanel', () => {
  beforeEach(() => {
    Object.values(service).forEach((mock) => mock.mockReset())
    service.getGAMonthlyEvaluations.mockResolvedValue({ evaluations: [] })
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'stable-command-key') })
  })

  it('creates a missing monthly evaluation with a stable command key after validation', async () => {
    service.createGAMonthlyEvaluation.mockResolvedValue({ evaluation: { id: 8, score: '87.50', comment: '', issuer_go: { name: 'GO Ana' } } })
    render(<GAMonthlyEvaluationPanel gaId={7} month="2026-02" mode="go" />)

    await screen.findByText('No hay evaluación mensual vigente.')
    fireEvent.click(screen.getByRole('button', { name: 'Emitir evaluación' }))
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '87.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evaluación' }))

    await waitFor(() => expect(service.createGAMonthlyEvaluation).toHaveBeenCalledWith({ ga_id: 7, month: '2026-02', score: '87.50', comment: '', idempotency_key: 'stable-command-key' }))
  })

  it('requires a correction reason, submits it, and exposes complete history only to GO', async () => {
    service.getGAMonthlyEvaluations.mockResolvedValue({ evaluations: [{ id: 8, score: '87.50', comment: 'Initial', issuer_go: { name: 'GO Ana' } }] })
    service.correctGAMonthlyEvaluation.mockResolvedValue({ evaluation: { id: 9, score: '90.00', comment: '', issuer_go: { name: 'GO Ana' } } })
    service.getGAMonthlyEvaluationHistory.mockResolvedValue({ history: [{ id: 8, version: 1, score: '87.50', reason: '' }, { id: 9, version: 2, score: '90.00', reason: 'Follow-up' }] })
    render(<GAMonthlyEvaluationPanel gaId={7} month="2026-02" mode="go" />)

    await screen.findByText('87.50')
    fireEvent.click(screen.getByRole('button', { name: 'Corregir evaluación' }))
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
    expect(await screen.findByText(/El motivo es obligatorio/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Motivo de la corrección'), { target: { value: 'Follow-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
    await waitFor(() => expect(service.correctGAMonthlyEvaluation).toHaveBeenCalledWith(8, expect.objectContaining({ score: '90', reason: 'Follow-up', idempotency_key: 'stable-command-key' })))

    fireEvent.click(screen.getByRole('button', { name: 'Ver historial completo' }))
    expect(await screen.findByText('Versión 2')).toBeInTheDocument()
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
  })

  it('shows GA only the current score, optional comment, and issuer', async () => {
    service.getGAMonthlyEvaluations.mockResolvedValue({ evaluations: [{ id: 8, score: '87.50', comment: 'Initial', issuer_go: { name: 'GO Ana' }, version: 4, reason: 'Hidden' }] })
    render(<GAMonthlyEvaluationPanel month="2026-02" mode="ga" />)

    expect(await screen.findByText('87.50')).toBeInTheDocument()
    expect(screen.getByText('Initial')).toBeInTheDocument()
    expect(screen.getByText('GO Ana')).toBeInTheDocument()
    expect(screen.queryByText(/Versión|Hidden|historial/i)).not.toBeInTheDocument()
  })
})
