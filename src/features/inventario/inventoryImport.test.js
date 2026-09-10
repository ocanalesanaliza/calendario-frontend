import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { calculateSummary, formatCurrency, getCountDetails, parseInventoryRows, parseInventoryWorkbook } from './inventoryImport'

const headers = [' \uFEFFcodigo producto ', 'Producto', 'Costo', 'Sucursal', 'Punto  de Reorden', 'Existencia']
const product = ['A-1', 'Arroz', 12.5, 'Centro', 4, 8]

describe('inventory import', () => {
  it('detects normalized headers without depending on the worksheet name', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, product]), 'Any name')

    expect(parseInventoryWorkbook(workbook)).toEqual([{ code: 'A-1', product: 'Arroz', branch: 'Centro', cost: 12.5, systemStock: 8, excelRow: 2 }])
  })

  it('rejects invalid relevant rows, excludes valid zero stock rows, and rejects duplicate codes', () => {
    expect(() => parseInventoryRows([headers, ['A-1', '', 12, 'Centro', 4, 1]])).toThrow('Fila 2: Producto es obligatorio.')
    expect(parseInventoryRows([headers, ['A-0', 'Sin stock', 12, 'Centro', 4, 0]])).toEqual([])
    expect(() => parseInventoryRows([headers, product, [' a-1 ', 'Otro', 4, 'Centro', 1, 2]])).toThrow('Fila 3: Código duplicado')
  })

  it('requires a single normalized branch across every relevant row', () => {
    expect(parseInventoryRows([headers, product, ['B-2', 'Frijoles', 10, ' centro ', 1, 0]])).toHaveLength(1)
    expect(() => parseInventoryRows([headers, product, ['B-2', 'Frijoles', 10, 'Norte', 1, 0]])).toThrow('El archivo contiene productos de más de una sucursal.')
  })

  it('calculates differences, statuses, impacts, and summary totals', () => {
    const counted = { product: { ...parseInventoryRows([headers, product])[0] }, physicalStock: '6', expirationDate: '2026-12-31' }
    const extra = { product: { ...counted.product, code: 'B-2', systemStock: 3, cost: 10 }, physicalStock: '5', expirationDate: '2026-12-31' }

    expect(getCountDetails(counted.product, counted.physicalStock, counted.expirationDate)).toMatchObject({ difference: -2, impact: -25, status: 'faltante', isPhysicalValid: true, isExpirationValid: true })
    expect(calculateSummary([counted, extra])).toEqual({ shortageImpact: -25, surplusImpact: 20, netImpact: -5 })
    expect(formatCurrency(12.5)).toBe('L 12.50')
  })
})
