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
    service.getDepositCompliance.mockResolvedValue({ branches: [{ name: 'Sucursal Norte', obligations: ['opaque-obligation-id'] }] })
  })

  it('renders dedicated operational obligation rows and opens the selected opaque bridge unchanged', async () => {
    service.openOverdueDepositReport.mockResolvedValue({ report: report(), access: { can_read_draft: true, can_prepare_draft: true, can_submit: true } })
    render(<OverdueDepositsPage />)

    expect(await screen.findByRole('heading', { name: 'Depósitos vencidos' })).toBeInTheDocument()
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Preparar depósito vencido de Sucursal Norte' }))

    await waitFor(() => expect(service.openOverdueDepositReport).toHaveBeenCalledWith('opaque-obligation-id'))
    expect(await screen.findByRole('dialog', { name: 'Registrar depósito vencido' })).toBeInTheDocument()
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
