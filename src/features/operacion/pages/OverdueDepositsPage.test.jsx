import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OverdueDepositsPage from './OverdueDepositsPage'

const service = vi.hoisted(() => ({ getDepositCompliance: vi.fn(), openOverdueDepositReport: vi.fn() }))

vi.mock('../services/depositService', () => service)

const report = (overrides = {}) => ({
  id: 'opaque-report-id', state: 'draft', optimistic_version: 1,
  closures: [], receipts: [],
  ...overrides,
})

describe('OverdueDepositsPage', () => {
  beforeEach(() => {
    service.getDepositCompliance.mockReset()
    service.openOverdueDepositReport.mockReset()
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Norte', obligations: [{
      id: 'opaque-obligation-id', execution_date: '2026-11-25', can_prepare_substitute: true, substitute_eligibility: 'special_situation_applicable',
    }] }] })
  })

  it('renders dedicated operational obligation rows and opens the selected opaque bridge unchanged', async () => {
    service.openOverdueDepositReport.mockResolvedValue({ report: report(), access: { can_read_draft: true, can_prepare_draft: true, can_submit: true } })
    render(<OverdueDepositsPage />)

    expect(await screen.findByRole('heading', { name: 'Depósitos vencidos' })).toBeInTheDocument()
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('Depósito del 25 de noviembre de 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Preparar depósito vencido de Sucursal Norte' }))

    await waitFor(() => expect(service.openOverdueDepositReport).toHaveBeenCalledWith('opaque-obligation-id'))
    expect(await screen.findByRole('dialog', { name: 'Registrar depósito vencido' })).toBeInTheDocument()
  })

  it('identifies two overdue obligations from one branch by their localized execution date', async () => {
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Boulevard Morazán', obligations: [
      { id: 'opaque-obligation-25', execution_date: '2026-11-25', can_prepare_substitute: true, substitute_eligibility: 'special_situation_applicable' },
      { id: 'opaque-obligation-26', execution_date: '2026-11-26', can_prepare_substitute: true, substitute_eligibility: 'special_situation_applicable' },
    ] }] })
    render(<OverdueDepositsPage />)

    expect(await screen.findByText('Depósito del 25 de noviembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Depósito del 26 de noviembre de 2026')).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal Boulevard Morazán')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Preparar depósito vencido de Sucursal Boulevard Morazán' })).toHaveLength(2)
  })

  it('uses the standard Analiza page shell and retains the empty operational state', async () => {
    service.getDepositCompliance.mockResolvedValue({ branches: [] })
    render(<OverdueDepositsPage />)

    expect(await screen.findByRole('heading', { name: 'Depósitos vencidos' })).toBeVisible()
    expect(screen.getByText('Obligaciones vencidas.')).toBeVisible()
    expect(screen.getByText('No hay obligaciones vencidas disponibles para preparar.')).toBeVisible()
    expect(document.querySelector('.overdue-deposits-page')).toHaveClass('tema-analiza', 'tuvet-page')
    expect(document.querySelector('.overdue-deposits-page .tuvet-page-header')).toBeInTheDocument()
  })

  it('shows visible non-eligible obligations without a prepare CTA', async () => {
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Sur', obligations: [{
      id: 'opaque-not-eligible', execution_date: '2026-11-25', can_prepare_substitute: false, substitute_eligibility: 'not_applicable',
    }] }] })
    render(<OverdueDepositsPage />)

    expect(await screen.findByRole('heading', { name: 'Sin preparación sustituta' })).toBeInTheDocument()
    expect(screen.getByText('Sucursal Sur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preparar depósito vencido de Sucursal Sur' })).not.toBeInTheDocument()
  })

  it('hides submitted obligations while retaining pending eligible and ineligible obligations', async () => {
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Sur', obligations: [
      { id: 'opaque-submitted', execution_date: '2026-11-24', is_submitted: true, can_prepare_substitute: false, substitute_eligibility: 'not_applicable' },
      { id: 'opaque-pending-ineligible', execution_date: '2026-11-25', is_submitted: false, can_prepare_substitute: false, substitute_eligibility: 'not_applicable' },
      { id: 'opaque-pending-eligible', execution_date: '2026-11-26', is_submitted: false, can_prepare_substitute: true, substitute_eligibility: 'special_situation_applicable' },
    ] }] })
    render(<OverdueDepositsPage />)

    expect(await screen.findByText('Depósito del 25 de noviembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Depósito del 26 de noviembre de 2026')).toBeInTheDocument()
    expect(screen.queryByText('Depósito del 24 de noviembre de 2026')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sin preparación sustituta' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Preparación sustituta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preparar depósito vencido de Sucursal Sur' })).toBeInTheDocument()
  })

  it('requires special-situation eligibility even when preparation is otherwise authorized', async () => {
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Sur', obligations: [{
      id: 'opaque-no-special', execution_date: '2026-11-25', can_prepare_substitute: true, substitute_eligibility: 'not_applicable',
    }] }] })
    render(<OverdueDepositsPage />)

    expect(await screen.findByText('Sucursal Sur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preparar depósito vencido de Sucursal Sur' })).not.toBeInTheDocument()
  })

  it('keeps an unavailable draft action unavailable exclusively from access', async () => {
    service.openOverdueDepositReport.mockResolvedValue({ report: report({ state: 'draft', closures: [{ id: 'opaque-closure', closure_date: '2026-11-01', sales_captured: false }] }), access: { can_read_draft: false, can_prepare_draft: false, can_submit: false } })
    render(<OverdueDepositsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Preparar depósito vencido de Sucursal Norte' }))
    expect(await screen.findByText('No tienes permiso para preparar este reporte vencido.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Capturar ventas' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y enviar reporte' })).toBeDisabled()
  })
})
