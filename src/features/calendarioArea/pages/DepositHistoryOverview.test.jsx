import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DepositHistoryOverview from './DepositHistoryOverview'

const branches = [
  { id: 'north', code: 'NTE', name: 'Sucursal Norte', total_sales: '1000', cash_sales: '500', deposited_amount: '400', outstanding_amount: '100' },
  { id: 'south', code: 'SUR', name: 'Sucursal Sur', total_sales: '2000', cash_sales: '800', deposited_amount: '800', outstanding_amount: '0' },
]
const history = { summary: { total_sales: '3000', cash_sales: '1300', card_sales: '1700', deposited_amount: '1200', outstanding_amount: '100' } }
const compliance = { branches: [
  { branch_id: 'north', calendar_status: 'resolved', expected_count: 25, submitted_count: 18, missing_count: 7 },
  { branch_id: 'south', calendar_status: 'resolved', expected_count: 26, submitted_count: 26, missing_count: 0 },
] }

function setup(extraHistory = {}, extraBranches = branches) {
  const open = vi.fn()
  render(<DepositHistoryOverview history={{ ...history, ...extraHistory }} branches={extraBranches} period="1–30 de noviembre de 2026" onOpenBranch={open} />)
  return open
}

describe('DepositHistoryOverview', () => {
  it('keeps the financial table and the separate three-series compliance chart together', () => {
    const open = setup({ submission_compliance: compliance })
    expect(screen.getByText('L 3,000.00')).toBeInTheDocument()
    const financial = screen.getByRole('table', { name: /Comparativa financiera/ })
    expect(within(financial).getByText('L 1,000.00')).toBeInTheDocument()
    expect(within(financial).getByText('L 400.00')).toBeInTheDocument()
    expect(within(financial).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent === '51 esperados · 44 enviados · 7 no enviados')).toBeInTheDocument()
    expect(screen.getByText(/86.3 % de cumplimiento/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Comparativa de envíos/ })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ver datos de cumplimiento'))
    const counts = screen.getByRole('table', { name: /Cantidad de cierres/ })
    expect(within(counts).getByRole('columnheader', { name: 'Esperados' })).toBeInTheDocument()
    expect(within(counts).getByRole('columnheader', { name: 'Enviados' })).toBeInTheDocument()
    expect(within(counts).getByRole('columnheader', { name: 'No enviados' })).toBeInTheDocument()
    fireEvent.click(within(financial).getByRole('button', { name: 'Ver cierres de NTE Sucursal Norte' }))
    expect(open).toHaveBeenCalledWith(branches[0])
  })

  it('searches, filters and sorts branch amounts without changing the overall summary', () => {
    setup()
    const financial = screen.getByRole('table', { name: /Comparativa financiera/ })
    expect(within(financial).getAllByRole('row')[1]).toHaveTextContent('NTE')
    fireEvent.click(within(financial).getByRole('button', { name: 'Ventas' }))
    expect(within(financial).getAllByRole('row')[1]).toHaveTextContent('SUR')
    expect(within(financial).getByRole('columnheader', { name: 'Ventas' })).toHaveAttribute('aria-sort', 'descending')
    fireEvent.click(screen.getByRole('button', { name: 'Con pendientes · 1' }))
    expect(within(financial).queryByText('Sucursal Sur')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar sucursal o código' }), { target: { value: 'no existe' } })
    expect(within(financial).getByText('No hay sucursales que coincidan con estos filtros.')).toBeInTheDocument()
    expect(screen.getByText('L 3,000.00')).toBeInTheDocument()
  })

  it('does not infer missing submissions or turn absent financial amounts into zero', () => {
    setup({}, [{ id: 'unknown', code: 'NEW', name: 'Sin datos financieros' }])
    expect(screen.getByText('Cumplimiento aún no disponible')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Comparativa de envíos/ })).not.toBeInTheDocument()
    const financial = screen.getByRole('table', { name: /Comparativa financiera/ })
    expect(within(financial).getAllByText('—')).toHaveLength(4)
    expect(within(financial).getByText('Sin estado')).toBeInTheDocument()
    expect(within(financial).queryByText('L 0.00')).not.toBeInTheDocument()
  })

  it('excludes unresolved calendars, inconsistent counts and inaccessible branch IDs', () => {
    setup({ submission_compliance: { branches: [compliance.branches[0],
      { branch_id: 'south', calendar_status: 'unavailable', expected_count: 26, submitted_count: 0, missing_count: 26 },
      { branch_id: 'south', calendar_status: 'resolved', expected_count: 26, submitted_count: 30, missing_count: -4 },
      { branch_id: 'south', calendar_status: 'resolved', expected_count: null, submitted_count: 0, missing_count: 0 },
      { branch_id: 'hidden', calendar_status: 'resolved', expected_count: 100, submitted_count: 0, missing_count: 100 },
    ] } })
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent === '25 esperados · 18 enviados · 7 no enviados')).toBeInTheDocument()
    expect(screen.getByText(/72 % de cumplimiento/)).toBeInTheDocument()
    expect(screen.getByText(/Calendario sin resolver para 1 sucursal/)).toBeInTheDocument()
  })

  it('handles zero expected closures without an invalid percentage', () => {
    setup({ submission_compliance: { branches: [{ ...compliance.branches[0], expected_count: 0, submitted_count: 0, missing_count: 0 }] } }, [branches[0]])
    expect(screen.getByText('Sin cierres esperados')).toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  })
})
