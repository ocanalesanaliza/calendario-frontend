import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DepositHistoryPage from './DepositHistoryPage'

const api = vi.hoisted(() => ({ getDepositHistory: vi.fn(), getDepositHistoryBranch: vi.fn(), getDepositHistoryClosure: vi.fn(), getDepositHistoryCompliance: vi.fn(), openSubmittedOverdueDepositReport: vi.fn() }))
vi.mock('../../calendarArea/services/depositHistoryService', () => api)

describe('DepositHistoryPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset())
    api.getDepositHistoryCompliance.mockResolvedValue({ branches: [] })
  })

  it('opens complete submitted overdue financial detail with the backend-issued opaque obligation ID only', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryCompliance.mockResolvedValue({ branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte', state: 'resolved', obligations: ['opaque-obligation-id'] }] })
    api.openSubmittedOverdueDepositReport.mockResolvedValue({
      report: {
        id: 'opaque-report-id', state: 'submitted', closures: [{ id: 'opaque-closure-entry', closure_date: '2026-11-02', total_sales: '100.00', cash_sales: '100.00', card_sales: '0.00', no_depositado_reason: 'Bank closure' }],
        receipts: [{ id: 'opaque-receipt-id', reference: 'DEP-001', deposited_on: '2026-11-03', deposited_amount: '100.00', allocated_amount: '100.00', allocations: [{ id: 'opaque-allocation-id', closure_entry_id: 'opaque-closure-entry', allocated_amount: '100.00' }] }],
      },
    })
    render(<DepositHistoryPage />)

    await screen.findByText('Sucursal Norte')
    expect(api.getDepositHistoryCompliance).toHaveBeenCalled()
    const open = await screen.findByRole('button', { name: 'Ver reporte vencido enviado de NTE · Sucursal Norte' })
    fireEvent.click(open)

    expect(api.openSubmittedOverdueDepositReport).toHaveBeenCalledWith('opaque-obligation-id')
    expect(await screen.findByText('DEP-001')).toBeInTheDocument()
    expect(screen.getByText(/Bank closure/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Capturar ventas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar comprobante' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revisar y enviar reporte/ })).not.toBeInTheDocument()
  })

  it('does not offer a draft overdue report or any preparation action', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryCompliance.mockResolvedValue({ branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte', state: 'pending', obligations: ['opaque-draft-obligation-id'] }] })
    render(<DepositHistoryPage />)

    await screen.findByText('Sucursal Norte')
    expect(screen.queryByRole('button', { name: /Ver reporte vencido enviado/ })).not.toBeInTheDocument()
    expect(api.openSubmittedOverdueDepositReport).not.toHaveBeenCalled()
    expect(screen.queryByText(/Capturar ventas|Agregar comprobante|Declarar no depositado|Revisar y enviar reporte/)).not.toBeInTheDocument()
  })

  it('does not disclose overdue financial detail when the bridge report is not submitted', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryCompliance.mockResolvedValue({ branches: [{ id: 'opaque-branch-id', code: 'NTE', name: 'Sucursal Norte', state: 'resolved', obligations: ['opaque-obligation-id'] }] })
    api.openSubmittedOverdueDepositReport.mockResolvedValue({ report: { state: 'draft', closures: [{ no_depositado_reason: 'hidden' }], receipts: [{ reference: 'HIDDEN-001' }] } })
    render(<DepositHistoryPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Ver reporte vencido enviado/ }))

    expect(api.openSubmittedOverdueDepositReport).toHaveBeenCalledWith('opaque-obligation-id')
    expect(await screen.findByText('El reporte vencido aún no está disponible para consulta.')).toBeInTheDocument()
    expect(screen.queryByText('HIDDEN-001')).not.toBeInTheDocument()
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Capturar ventas|Agregar comprobante|Declarar no depositado|Revisar y enviar reporte/ })).not.toBeInTheDocument()
  })

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

  it('keeps the queried period for drill-downs while new dates are only a draft', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'north', code: 'NTE', name: 'Sucursal Norte' }] })
    api.getDepositHistoryBranch.mockResolvedValue({ branch: { code: 'NTE' }, closures: [] })
    render(<DepositHistoryPage />)
    await screen.findByText('Sucursal Norte')
    const queriedRange = api.getDepositHistory.mock.calls[0][0]
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } })
    expect(api.getDepositHistory).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Ver cierres de NTE Sucursal Norte' }))
    await screen.findByText('Cierres de NTE')
    expect(api.getDepositHistoryBranch).toHaveBeenCalledWith('north', queriedRange)
    fireEvent.submit(screen.getByRole('form', { name: 'Rango del historial de depósitos' }))
    await screen.findByText('Sucursal Norte')
    expect(api.getDepositHistory).toHaveBeenLastCalledWith({ from: '2026-01-01', to: queriedRange.to })
  })

  it('loads the previous month from a quick range without additional branch requests', async () => {
    api.getDepositHistory.mockResolvedValue({ summary: {}, branches: [{ id: 'north', code: 'NTE', name: 'Sucursal Norte' }] })
    render(<DepositHistoryPage />)
    await screen.findByText('Sucursal Norte')
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await screen.findByText('Sucursal Norte')
    const now = new Date()
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const year = previous.getFullYear()
    const month = String(previous.getMonth() + 1).padStart(2, '0')
    const last = new Date(year, previous.getMonth() + 1, 0).getDate()
    expect(api.getDepositHistory).toHaveBeenLastCalledWith({ from: `${year}-${month}-01`, to: `${year}-${month}-${last}` })
    expect(api.getDepositHistoryBranch).not.toHaveBeenCalled()
  })
})
