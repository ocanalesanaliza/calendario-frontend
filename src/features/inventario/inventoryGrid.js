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

const EDITABLE_FIELDS = ['physicalStock', 'expirationDate']

export function isInventoryPhysicalStockValid(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
}

export function isInventoryExpirationDateValid(value) {
  return Boolean(value)
}

export function getInventoryEditCellTarget({ field, rowId, visibleRowIds, shiftKey }) {
  const currentRowIndex = visibleRowIds.indexOf(rowId)
  if (currentRowIndex === -1 || !EDITABLE_FIELDS.includes(field)) return null

  if (field === 'physicalStock') {
    if (!shiftKey) return { id: rowId, field: 'expirationDate' }
    const previousRowId = visibleRowIds[currentRowIndex - 1]
    return previousRowId === undefined ? { id: rowId, field } : { id: previousRowId, field: 'expirationDate' }
  }

  if (shiftKey) return { id: rowId, field: 'physicalStock' }
  const nextRowId = visibleRowIds[currentRowIndex + 1]
  return nextRowId === undefined ? { id: rowId, field } : { id: nextRowId, field: 'physicalStock' }
}

export async function getInventoryEditCellTargetAfterCommit({ api, id, field, value, event, visibleRowIds, shiftKey }) {
  const isValid = await api.setEditCellValue({ id, field, value }, event)
  if (!isValid) return null

  return getInventoryEditCellTarget({ field, rowId: id, visibleRowIds, shiftKey })
}
