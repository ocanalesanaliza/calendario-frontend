import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DepositHistoryPage from './DepositHistoryPage'

const api = vi.hoisted(() => ({ getDepositHistory: vi.fn(), getDepositHistoryBranch: vi.fn(), getDepositHistoryClosure: vi.fn() }))
vi.mock('../../calendarArea/services/depositHistoryService', () => api)

describe('DepositHistoryPage', () => {
  beforeEach(() => Object.values(api).forEach((mock) => mock.mockReset()))

  it('renders formatted KPI, period context, compact branch rows, and opaque drill-downs', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: { total_sales: '58000.00', cash_sales: '40000.00', card_sales: '18000.00', deposited_amount: '40000.00', outstanding_amount: '18000.00' }, branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryBranch.mockResolvedValue({ branch: { code: 'NTE', name: 'Sucursal Norte' }, closures: [{ id: 'opaque-closure-id', closure_date: '2026-11-02', total_sales: '58000.00', cash_sales: '40000.00', card_sales: '18000.00', deposited_amount: '40000.00', outstanding_amount: '18000.00', reconciliation_status: 'pending_reconciliation' }] })
    api.getDepositHistoryClosure.mockResolvedValue({ closure: { closure_date: '2026-11-02', total_sales: '58000.00', cash_sales: '40000.00', card_sales: '18000.00', deposited_amount: '40000.00', outstanding_amount: '18000.00', reconciliation_status: 'reconciled' }, receipts: [{ reference: 'DEP-001', deposited_on: '2026-11-03', allocated_amount: '40000.00' }] })
    render(<DepositHistoryPage />)

    await screen.findByText('Sucursal Norte')
    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
    expect(api.getDepositHistory).toHaveBeenCalledWith({ from, to })
    expect(screen.getByText('Período consultado:', { exact: false })).toHaveTextContent(/1–30 de noviembre de 2026/)
    expect(screen.getAllByText('Efectivo del cierre')).not.toHaveLength(0)
    expect(screen.getAllByText('Ventas totales')).not.toHaveLength(0)
    expect(screen.getAllByText('Ventas con tarjeta')).not.toHaveLength(0)
    expect(screen.getByText('L 58,000.00')).toBeInTheDocument()
    expect(screen.getAllByText('L 18,000.00')[0]).not.toHaveClass('deposit-history-kpi-value--pending')
    expect(screen.getByTestId('deposit-history-layout')).toHaveAttribute('data-responsive-breakpoints', '375 768 1024 1440')
    const branch = screen.getByRole('button', { name: 'Ver cierres de NTE Sucursal Norte' })
    expect(branch).toHaveTextContent('Ver cierres')
    expect(branch).not.toHaveTextContent('—')

    fireEvent.click(branch)
    await screen.findByText('Cierre del 2 de noviembre de 2026')
    expect(api.getDepositHistoryBranch).toHaveBeenCalledWith('opaque-branch-id', { from, to })
    expect(screen.getByText('Historial de depósitos / NTE · Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Volver a sucursales' })).toBeInTheDocument()
    expect(screen.getByText('Pendiente de conciliación')).toBeInTheDocument()
    expect(screen.getAllByText('L 18,000.00').find((node) => node.classList.contains('deposit-history-kpi-value--pending'))).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver detalle del cierre 2 de noviembre de 2026' })).toHaveTextContent('Ver detalle')

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle del cierre 2 de noviembre de 2026' }))
    const detail = await screen.findByRole('region', { name: 'Detalle del cierre' })
    expect(within(detail).getByText('Historial de depósitos / NTE · Sucursal Norte / Cierre 2 de noviembre de 2026')).toBeInTheDocument()
    expect(within(detail).getByText('Conciliado')).toBeInTheDocument()
    expect(within(detail).getByText('Composición de ventas')).toBeInTheDocument()
    expect(within(detail).getByText('Conciliación de efectivo')).toBeInTheDocument()
    expect(within(detail).getAllByText('L 18,000.00').every((node) => !node.classList.contains('deposit-history-kpi-value--pending'))).toBe(true)
    expect(within(detail).getByText('Comprobantes')).toBeInTheDocument()
    expect(within(detail).getByText('Referencia')).toBeInTheDocument()
    expect(within(detail).getByText('Fecha de depósito')).toBeInTheDocument()
    expect(within(detail).getByText('Aplicado')).toBeInTheDocument()
    expect(within(detail).getByText('DEP-001')).toBeInTheDocument()
    expect(within(detail).getByText('3 de noviembre de 2026')).toBeInTheDocument()
    expect(within(detail).getAllByText('L 40,000.00').length).toBeGreaterThanOrEqual(3)
    expect(api.getDepositHistoryClosure).toHaveBeenCalledWith('opaque-closure-id')

    fireEvent.click(screen.getByRole('button', { name: '← Volver a cierres' }))
    expect(await screen.findByText('Historial de depósitos / NTE · Sucursal Norte')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Volver a sucursales' }))
    expect(await screen.findByText('Sucursal Norte')).toBeInTheDocument()
  })

  it('shows a clear empty state when a closure has no receipts', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryBranch.mockResolvedValue({ branch: { code: 'NTE', name: 'Sucursal Norte' }, closures: [{ id: 'opaque-closure-id', closure_date: '2026-11-02', cash_sales: '1.00', deposited_amount: '0.00', outstanding_amount: '1.00', reconciliation_status: 'pending_reconciliation' }] })
    api.getDepositHistoryClosure.mockResolvedValue({ closure: { closure_date: '2026-11-02', cash_sales: '1.00', deposited_amount: '0.00', outstanding_amount: '1.00' }, receipts: [] })
    render(<DepositHistoryPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver cierres de NTE Sucursal Norte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle del cierre 2 de noviembre de 2026' }))
    expect(await screen.findByText('No hay comprobantes para este cierre.')).toBeInTheDocument()
  })

  it('treats a 404 as an absence without exposing server detail', async () => {
    api.getDepositHistory.mockRejectedValue(Object.assign(new Error('secret branch'), { status: 404 }))
    render(<DepositHistoryPage />)

    expect(await screen.findByText('No hay historial disponible para el rango seleccionado.')).toBeInTheDocument()
    expect(screen.queryByText('secret branch')).not.toBeInTheDocument()
  })
})
