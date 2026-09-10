import { formatCurrency, getCountDetails } from './inventoryImport'

export function toInventoryGridRows(counts) {
  return counts.map(({ product, physicalStock, expirationDate }) => {
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
  })
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
