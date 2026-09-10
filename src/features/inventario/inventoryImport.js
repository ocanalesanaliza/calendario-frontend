import * as XLSX from 'xlsx'

export const REQUIRED_HEADERS = ['Codigo Producto', 'Producto', 'Costo', 'Sucursal', 'Punto de Reorden', 'Existencia']

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

const NORMALIZED_REQUIRED_HEADERS = REQUIRED_HEADERS.map(normalizeHeader)

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const headers = new Set(row.map(normalizeHeader))
    return NORMALIZED_REQUIRED_HEADERS.every((header) => headers.has(header))
  })
}

function parseNonNegativeNumber(value, label, excelRow) {
  if (isBlank(value) || !Number.isFinite(Number(value))) {
    throw new Error(`Fila ${excelRow}: ${label} debe ser un número mayor o igual a cero.`)
  }
  return Number(value)
}

export function parseInventoryRows(rows) {
  const headerRowIndex = findHeaderRow(rows)
  if (headerRowIndex === -1) throw new Error('No se encontraron todos los encabezados requeridos en una misma hoja.')

  const columns = new Map(rows[headerRowIndex].map((header, index) => [normalizeHeader(header), index]))
  const products = []
  const codes = new Map()

  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const excelRow = headerRowIndex + index + 2
    const valueFor = (header) => row[columns.get(normalizeHeader(header))]
    if (REQUIRED_HEADERS.every((header) => isBlank(valueFor(header)))) return
    const code = String(valueFor('Codigo Producto') ?? '').trim()
    const product = String(valueFor('Producto') ?? '').trim()
    const branch = String(valueFor('Sucursal') ?? '').trim()

    if (!code) throw new Error(`Fila ${excelRow}: Código es obligatorio.`)
    if (!product) throw new Error(`Fila ${excelRow}: Producto es obligatorio.`)
    if (!branch) throw new Error(`Fila ${excelRow}: Sucursal es obligatoria.`)

    const cost = parseNonNegativeNumber(valueFor('Costo'), 'Costo', excelRow)
    const systemStock = parseNonNegativeNumber(valueFor('Existencia'), 'Existencia', excelRow)
    const normalizedCode = code.normalize('NFKC').trim().toLocaleLowerCase()
    if (codes.has(normalizedCode)) {
      throw new Error(`Fila ${excelRow}: Código duplicado "${code}" (también aparece en la fila ${codes.get(normalizedCode)}).`)
    }
    codes.set(normalizedCode, excelRow)

    if (systemStock !== 0) {
      products.push({ code, product, branch, cost, systemStock, excelRow })
    }
  })

  return products
}

export function parseInventoryWorkbook(workbook) {
  const matches = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    try {
      return { sheetName, products: parseInventoryRows(rows) }
    } catch (error) {
      if (error.message === 'No se encontraron todos los encabezados requeridos en una misma hoja.') return null
      throw error
    }
  }).filter(Boolean)

  if (matches.length === 0) {
    throw new Error(`No se encontró una hoja compatible. Encabezados requeridos: ${REQUIRED_HEADERS.join(', ')}.`)
  }
  if (matches.length > 1) {
    throw new Error('Se encontraron varias hojas compatibles. Deje solo una hoja con los encabezados requeridos.')
  }
  return matches[0].products
}

export function getCountDetails(product, physicalStock, expirationDate) {
  const physical = Number(physicalStock)
  const isPhysicalValid = physicalStock !== '' && Number.isFinite(physical) && physical >= 0
  const isExpirationValid = Boolean(expirationDate)
  const difference = isPhysicalValid ? physical - product.systemStock : null
  const impact = difference === null ? null : difference * product.cost
  const status = difference === null ? null : difference < 0 ? 'faltante' : difference > 0 ? 'sobrante' : 'coincide'
  return { isPhysicalValid, isExpirationValid, difference, impact, status }
}

export function calculateSummary(counts) {
  return counts.reduce((summary, count) => {
    const { impact } = getCountDetails(count.product, count.physicalStock, count.expirationDate)
    if (impact === null) return summary
    return {
      shortageImpact: summary.shortageImpact + (impact < 0 ? impact : 0),
      surplusImpact: summary.surplusImpact + (impact > 0 ? impact : 0),
      netImpact: summary.netImpact + impact,
    }
  }, { shortageImpact: 0, surplusImpact: 0, netImpact: 0 })
}
