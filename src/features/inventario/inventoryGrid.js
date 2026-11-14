import { formatCurrency, getCountDetails } from './inventoryImport'

export function toInventoryGridRow({ product, physicalStock, expirationDate }) {
  const details = getCountDetails(product, physicalStock, expirationDate)
  return {
    id: product.code,
    code: product.code,
    product: product.product,
    cost: formatCurrency(product.cost),
    systemStock: product.systemStock,
    physicalStock,
    expirationDate,
    difference: details.difference,
    status: details.status,
    impact: details.impact,
  }
}

export function toInventoryGridRows(counts) {
  return counts.map(toInventoryGridRow)
}

export function applyInventoryGridRowUpdate(counts, updatedRow) {
  const updatedCount = counts.find((count) => count.product.code === updatedRow.id)
  if (!updatedCount) return { counts, row: updatedRow }

  const nextCount = {
    ...updatedCount,
    physicalStock: updatedRow.physicalStock,
    expirationDate: updatedRow.expirationDate,
  }
  return {
    counts: counts.map((count) => count.product.code === updatedRow.id ? nextCount : count),
    row: toInventoryGridRow(nextCount),
  }
}

export function filterInventoryGridRows(rows, search, status) {
  const normalizedSearch = search.trim().toLocaleLowerCase()

  return rows.filter((row) => {
    const matchesSearch = !normalizedSearch
      || row.code.toLocaleLowerCase().includes(normalizedSearch)
      || row.product.toLocaleLowerCase().includes(normalizedSearch)
    const matchesStatus = !status || (status === 'pendiente' ? row.status === null : row.status === status)
    return matchesSearch && matchesStatus
  })
}

export function isInventoryPhysicalStockValid(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
}

export function isInventoryExpirationDateValid(value) {
  return Boolean(value)
}

export function getInventoryEditCellTarget({ field, rowId, visibleRowIds, shiftKey, physicalStockField = 'physicalStock', expirationDateField = 'expirationDate' }) {
  const currentRowIndex = visibleRowIds.indexOf(rowId)
  if (currentRowIndex === -1 || ![physicalStockField, expirationDateField].includes(field)) return null

  if (field === physicalStockField) {
    if (!shiftKey) return { id: rowId, field: expirationDateField }
    const previousRowId = visibleRowIds[currentRowIndex - 1]
    return previousRowId === undefined ? { id: rowId, field } : { id: previousRowId, field: expirationDateField }
  }

  if (shiftKey) return { id: rowId, field: physicalStockField }
  const nextRowId = visibleRowIds[currentRowIndex + 1]
  return nextRowId === undefined ? { id: rowId, field } : { id: nextRowId, field: physicalStockField }
}

export async function getInventoryEditCellTargetAfterCommit({ api, id, field, value, event, visibleRowIds, shiftKey, physicalStockField, expirationDateField }) {
  const isValid = await api.setEditCellValue({ id, field, value }, event)
  if (!isValid) return null

  return getInventoryEditCellTarget({ field, rowId: id, visibleRowIds, shiftKey, physicalStockField, expirationDateField })
}

export function isBranchInventoryPhysicalStockValid(value) {
  return value !== null
    && value !== undefined
    && String(value).trim() !== ''
    && Number.isFinite(Number(value))
    && Number(value) >= 0
}

export function toBranchInventoryGridRow(row, index) {
  const expectedStock = row.stock ?? row.system_stock ?? row.expected_stock ?? 0
  const isCounted = isBranchInventoryPhysicalStockValid(row.physical_stock)
  const difference = isCounted ? Number(row.physical_stock) - Number(expectedStock) : null
  const status = !isCounted ? 'pending' : difference === 0 ? 'match' : difference < 0 ? 'shortage' : 'surplus'
  const cost = Number(row.cost)
  const impact = difference === null || !Number.isFinite(cost) ? null : difference * cost

  return {
    ...row,
    id: row.__id ?? row.code ?? row.product ?? index,
    expectedStock,
    difference,
    status,
    impact,
  }
}

export function filterBranchInventoryGridRows(rows, search, status) {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  return rows.filter((row) => {
    const matchesSearch = !normalizedSearch
      || String(row.code ?? '').toLocaleLowerCase().includes(normalizedSearch)
      || String(row.product ?? '').toLocaleLowerCase().includes(normalizedSearch)
    const matchesStatus = !status || (status === 'completed' ? row.status !== 'pending' : row.status === status)
    return matchesSearch && matchesStatus
  })
}
