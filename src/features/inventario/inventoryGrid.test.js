import { describe, expect, it } from 'vitest'
import { filterInventoryGridRows, toInventoryGridRows } from './inventoryGrid'

const counts = [
  { product: { code: 'A-1', product: 'Arroz', cost: 12.5, systemStock: 8 }, physicalStock: '6', expirationDate: '2026-12-31' },
  { product: { code: 'B-2', product: 'Frijoles', cost: 10, systemStock: 3 }, physicalStock: '', expirationDate: '' },
  { product: { code: 'C-3', product: 'Harina', cost: 8, systemStock: 5 }, physicalStock: '7', expirationDate: '2026-12-31' },
]

describe('inventory grid rows', () => {
  it('uses product codes as stable ids and exposes derived count values', () => {
    expect(toInventoryGridRows(counts)).toMatchObject([
      { id: 'A-1', cost: 'L 12.50', difference: -2, status: 'faltante', impact: -25 },
      { id: 'B-2', status: null, difference: null, impact: null },
      { id: 'C-3', difference: 2, status: 'sobrante', impact: 16 },
    ])
  })

  it('filters by code or product without discarding entered count values', () => {
    const rows = toInventoryGridRows(counts)

    expect(filterInventoryGridRows(rows, 'frij', '')).toEqual([rows[1]])
    expect(filterInventoryGridRows(rows, '', 'pendiente')).toEqual([rows[1]])
    expect(filterInventoryGridRows(rows, '', 'faltante')).toEqual([rows[0]])
  })
})
