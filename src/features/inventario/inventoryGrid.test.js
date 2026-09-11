import { describe, expect, it } from 'vitest'
import { applyInventoryGridRowUpdate, filterInventoryGridRows, getInventoryEditCellTarget, getInventoryEditCellTargetAfterCommit, isInventoryExpirationDateValid, isInventoryPhysicalStockValid, toInventoryGridRows } from './inventoryGrid'

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

  it('returns an immediately recomputed row while retaining counts as the source of truth', () => {
    const staleRow = { ...toInventoryGridRows(counts)[0], physicalStock: '8', expirationDate: '2027-01-01' }
    const update = applyInventoryGridRowUpdate(counts, staleRow)

    expect(update.counts[0]).toMatchObject({ physicalStock: '8', expirationDate: '2027-01-01' })
    expect(update.row).toMatchObject({ difference: 0, status: 'coincide', impact: 0 })
  })
})

describe('inventory edit-cell navigation', () => {
  const visibleRowIds = ['B-2', 'A-1', 'C-3']

  it('moves forward only between editable fields in the current visible row or next visible row', () => {
    expect(getInventoryEditCellTarget({ field: 'physicalStock', rowId: 'A-1', visibleRowIds, shiftKey: false })).toEqual({ id: 'A-1', field: 'expirationDate' })
    expect(getInventoryEditCellTarget({ field: 'expirationDate', rowId: 'A-1', visibleRowIds, shiftKey: false })).toEqual({ id: 'C-3', field: 'physicalStock' })
  })

  it('moves backward only between editable fields in the current visible row or previous visible row', () => {
    expect(getInventoryEditCellTarget({ field: 'expirationDate', rowId: 'A-1', visibleRowIds, shiftKey: true })).toEqual({ id: 'A-1', field: 'physicalStock' })
    expect(getInventoryEditCellTarget({ field: 'physicalStock', rowId: 'A-1', visibleRowIds, shiftKey: true })).toEqual({ id: 'B-2', field: 'expirationDate' })
  })

  it('retains the current editable cell at the visible boundaries and rejects hidden rows', () => {
    expect(getInventoryEditCellTarget({ field: 'physicalStock', rowId: 'B-2', visibleRowIds, shiftKey: true })).toEqual({ id: 'B-2', field: 'physicalStock' })
    expect(getInventoryEditCellTarget({ field: 'expirationDate', rowId: 'C-3', visibleRowIds, shiftKey: false })).toEqual({ id: 'C-3', field: 'expirationDate' })
    expect(getInventoryEditCellTarget({ field: 'difference', rowId: 'A-1', visibleRowIds, shiftKey: false })).toBeNull()
    expect(getInventoryEditCellTarget({ field: 'physicalStock', rowId: 'hidden', visibleRowIds, shiftKey: false })).toBeNull()
  })

  it('waits for the latest value to be accepted before returning a navigation target', async () => {
    const api = { setEditCellValue: async (params) => params.value === '9' }

    await expect(getInventoryEditCellTargetAfterCommit({ api, id: 'A-1', field: 'physicalStock', value: '9', visibleRowIds, shiftKey: false })).resolves.toEqual({ id: 'A-1', field: 'expirationDate' })
    await expect(getInventoryEditCellTargetAfterCommit({ api, id: 'A-1', field: 'physicalStock', value: '-1', visibleRowIds, shiftKey: false })).resolves.toBeNull()
  })

  it('validates values before Tab can commit and move the edit cell', () => {
    expect(isInventoryPhysicalStockValid('9')).toBe(true)
    expect(isInventoryPhysicalStockValid('')).toBe(false)
    expect(isInventoryPhysicalStockValid('-1')).toBe(false)
    expect(isInventoryExpirationDateValid('2027-01-01')).toBe(true)
    expect(isInventoryExpirationDateValid('')).toBe(false)
  })
})
