import { describe, expect, it } from 'vitest'
import { applyInventoryGridRowUpdate, filterBranchInventoryGridRows, filterInventoryGridRows, getInventoryEditCellTarget, getInventoryEditCellTargetAfterCommit, isBranchInventoryPhysicalStockValid, isInventoryExpirationDateValid, isInventoryPhysicalStockValid, toBranchInventoryGridRow, toInventoryGridRows } from './inventoryGrid'

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

describe('branch inventory grid rows', () => {
  it('keeps null physical stock pending while accepting zero without an expiration date', () => {
    expect(toBranchInventoryGridRow({ code: 'A-1', product: 'Arroz', stock: 4, physical_stock: null }).status).toBe('pending')
    expect(toBranchInventoryGridRow({ code: 'B-2', product: 'Frijoles', cost: 12, stock: 2, physical_stock: 0, expiration_date: null })).toMatchObject({ status: 'shortage', difference: -2, impact: -24 })
    expect(isBranchInventoryPhysicalStockValid(0)).toBe(true)
  })

  it('supports the GS snake_case editable fields without changing the default demo fields', () => {
    const visibleRowIds = ['B-2', 'A-1', 'C-3']
    expect(getInventoryEditCellTarget({ field: 'physical_stock', rowId: 'A-1', visibleRowIds, shiftKey: false, physicalStockField: 'physical_stock', expirationDateField: 'expiration_date' })).toEqual({ id: 'A-1', field: 'expiration_date' })
    expect(getInventoryEditCellTarget({ field: 'expiration_date', rowId: 'A-1', visibleRowIds, shiftKey: false, physicalStockField: 'physical_stock', expirationDateField: 'expiration_date' })).toEqual({ id: 'C-3', field: 'physical_stock' })
    expect(getInventoryEditCellTarget({ field: 'physical_stock', rowId: 'A-1', visibleRowIds, shiftKey: true, physicalStockField: 'physical_stock', expirationDateField: 'expiration_date' })).toEqual({ id: 'B-2', field: 'expiration_date' })
  })

  it('derives preview-only impact for shortage, surplus, match, and blank physical stock', () => {
    expect(toBranchInventoryGridRow({ stock: 5, cost: 4, physical_stock: 3 })).toMatchObject({ difference: -2, impact: -8, status: 'shortage' })
    expect(toBranchInventoryGridRow({ stock: 5, cost: 4, physical_stock: 7 })).toMatchObject({ difference: 2, impact: 8, status: 'surplus' })
    expect(toBranchInventoryGridRow({ stock: 5, cost: 4, physical_stock: 5 })).toMatchObject({ difference: 0, impact: 0, status: 'match' })
    expect(toBranchInventoryGridRow({ stock: 5, cost: 4, physical_stock: '' })).toMatchObject({ difference: null, impact: null, status: 'pending' })
  })

  it('filters server preview rows without changing their editable values', () => {
    const rows = [
      toBranchInventoryGridRow({ code: 'A-1', product: 'Arroz', stock: 4, physical_stock: '5' }),
      toBranchInventoryGridRow({ code: 'B-2', product: 'Frijoles', stock: 2, physical_stock: null }),
    ]

    expect(filterBranchInventoryGridRows(rows, 'arroz', '')).toEqual([rows[0]])
    expect(filterBranchInventoryGridRows(rows, '', 'pending')).toEqual([rows[1]])
    expect(rows[0].physical_stock).toBe('5')
  })
})
