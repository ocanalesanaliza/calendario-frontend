import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Button, TextField } from '@mui/material'
import { DataGrid, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from '@mui/x-data-grid'
import { calculateSummary, formatCurrency, getCountDetails, parseInventoryWorkbook } from '../inventoryImport'
import { applyInventoryGridRowUpdate, filterInventoryGridRows, getInventoryEditCellTargetAfterCommit, isInventoryExpirationDateValid, isInventoryPhysicalStockValid, toInventoryGridRows } from '../inventoryGrid'
import '../styles/InventarioDemo.css'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_VISIBLE_ROWS = 500
const STATUS_FILTERS = [
  ['pendiente', 'Pendientes'],
  ['faltante', 'Faltantes'],
  ['sobrante', 'Sobrantes'],
  ['coincide', 'Coincide'],
]

function InventoryEditCell({ id, field, value, api, inputProps }) {
  async function handleKeyDown(event) {
    if (event.key !== 'Tab') return

    const latestValue = event.currentTarget.value
    event.preventDefault()
    event.stopPropagation()
    event.defaultMuiPrevented = true

    const target = await getInventoryEditCellTargetAfterCommit({
      api,
      id,
      field,
      value: latestValue,
      event,
      visibleRowIds: gridPaginatedVisibleSortedGridRowIdsSelector({ current: api }),
      shiftKey: event.shiftKey,
    })
    if (!target) return
    if (target.id === id && target.field === field) return

    api.stopCellEditMode({ id, field })
    api.startCellEditMode(target)
  }

  return <input className="inventory-demo-grid-input" autoFocus value={value ?? ''} onKeyDown={handleKeyDown} onChange={(event) => api.setEditCellValue({ id, field, value: event.target.value }, event)} {...inputProps} />
}

function PhysicalStockEditCell(props) {
  return <InventoryEditCell {...props} inputProps={{ type: 'number', min: '0', step: 'any', inputMode: 'decimal', 'aria-label': 'Existencia física' }} />
}

function ExpirationDateEditCell({ id, field, value, api }) {
  return <InventoryEditCell id={id} field={field} value={value} api={api} inputProps={{ type: 'date', 'aria-label': 'Vencimiento manual' }} />
}

export default function InventarioDemoPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const apiRef = useGridApiRef()
  const [counts, setCounts] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const isComplete = counts.length > 0 && counts.every(({ product, physicalStock, expirationDate }) => {
    const details = getCountDetails(product, physicalStock, expirationDate)
    return details.isPhysicalValid && details.isExpirationValid
  })
  const summary = calculateSummary(counts)
  const gridRows = useMemo(() => toInventoryGridRows(counts), [counts])
  const filteredRows = useMemo(() => filterInventoryGridRows(gridRows, search, statusFilter), [gridRows, search, statusFilter])
  const columns = useMemo(() => [
    { field: 'code', headerName: 'Código', minWidth: 120, flex: 0.7 },
    { field: 'product', headerName: 'Producto', minWidth: 190, flex: 1.4 },
    { field: 'cost', headerName: 'Costo', minWidth: 125, flex: 0.7 },
    { field: 'systemStock', headerName: 'Esperado', minWidth: 115, type: 'number', flex: 0.6 },
    { field: 'physicalStock', headerName: 'Existencia física', minWidth: 155, editable: true, flex: 0.9, renderEditCell: PhysicalStockEditCell, preProcessEditCellProps: ({ props }) => ({ ...props, error: !isInventoryPhysicalStockValid(props.value) }) },
    { field: 'expirationDate', headerName: 'Vencimiento manual', minWidth: 170, editable: true, flex: 1, renderEditCell: ExpirationDateEditCell, preProcessEditCellProps: ({ props }) => ({ ...props, error: !isInventoryExpirationDateValid(props.value) }) },
    { field: 'difference', headerName: 'Diferencia', minWidth: 115, type: 'number', flex: 0.6, valueFormatter: (value) => value ?? '—' },
    { field: 'status', headerName: 'Estado', minWidth: 120, flex: 0.7, renderCell: ({ value }) => value ? <span className={`inventory-demo-status ${value}`}>{value}</span> : '—' },
    { field: 'impact', headerName: 'Impacto', minWidth: 130, flex: 0.8, valueFormatter: (value) => value === null ? '—' : formatCurrency(value) },
  ], [])

  async function handleFile(event) {
    const file = event.target.files?.[0]
    setError('')
    setMessage('')
    setConfirmed(false)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Seleccione únicamente un archivo .xlsx.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 5 MB.')
      return
    }
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const products = parseInventoryWorkbook(workbook)
      if (products.length > MAX_VISIBLE_ROWS) throw new Error(`El archivo contiene más de ${MAX_VISIBLE_ROWS} productos con existencia.`)
      setCounts(products.map((product) => ({ product, physicalStock: '', expirationDate: '' })))
      setMessage(products.length ? `${products.length} productos listos para conteo.` : 'El archivo es válido, pero no contiene productos con existencia mayor que cero.')
    } catch (importError) {
      setCounts([])
      setError(importError instanceof Error ? importError.message : 'No fue posible leer el archivo local.')
    }
  }

  function processRowUpdate(updatedRow) {
    const update = applyInventoryGridRowUpdate(counts, updatedRow)
    setCounts(update.counts)
    setConfirmed(false)
    return update.row
  }

  function reset() {
    setCounts([])
    setError('')
    setMessage('')
    setConfirmed(false)
    setSearch('')
    setStatusFilter('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function confirm() {
    if (!isComplete) return
    setConfirmed(true)
  }

  return (
    <section className="inventory-demo-page" aria-labelledby="inventory-demo-title">
      <header className="inventory-demo-header">
        <div><h1 id="inventory-demo-title">Conteo de inventario</h1><p>Cargue un XLSX local y registre el conteo físico.</p></div>
        <button type="button" className="inventory-demo-secondary" onClick={() => navigate('/')}>Cancelar y salir</button>
      </header>

      
      <div className="inventory-demo-upload">
        <label htmlFor="inventory-file">Archivo XLSX de inventario (máximo 5 MB)</label>
        <input ref={inputRef} id="inventory-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} />
        <p>Encabezados requeridos: Codigo Producto, Producto, Costo, Sucursal, Punto de Reorden y Existencia.</p>
      </div>
      {error && <p className="inventory-demo-error" role="alert">{error}</p>}
      {message && <p className="inventory-demo-message" aria-live="polite">{message}</p>}

      {counts.length > 0 && <>
        <p className="inventory-demo-branch"><strong>Sucursal:</strong> {counts[0].product.branch}</p>
        <div className="inventory-demo-grid-controls">
          <TextField label="Buscar por código o producto" size="small" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="inventory-demo-filter-buttons" aria-label="Filtrar por estado">
            {STATUS_FILTERS.map(([value, label]) => <Button key={value} type="button" size="small" variant={statusFilter === value ? 'contained' : 'outlined'} onClick={() => setStatusFilter((current) => current === value ? '' : value)}>{label}</Button>)}
            {(search || statusFilter) && <Button type="button" size="small" onClick={() => { setSearch(''); setStatusFilter('') }}>Limpiar filtros</Button>}
          </div>
          <p className="inventory-demo-row-count" aria-live="polite">{filteredRows.length} de {counts.length} productos</p>
        </div>
        <div className="inventory-demo-grid-wrap" aria-label="Tabla de conteo de inventario; desplácese horizontalmente si es necesario">
          <DataGrid
            rows={filteredRows}
            columns={columns}
            apiRef={apiRef}
            onCellClick={(params, event) => {
              if (!params.colDef.editable) return
              event.defaultMuiPrevented = true
              apiRef.current.startCellEditMode({ id: params.id, field: params.field })
            }}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(updateError) => setError(updateError instanceof Error ? updateError.message : 'No fue posible actualizar el conteo.')}
            pagination
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            disableRowSelectionOnClick
            density="compact"
            sx={{ border: 0, minWidth: 1050, '& .MuiDataGrid-columnHeaders': { backgroundColor: '#f8fafc', color: '#475569' }, '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: '2px solid #6366f1' } }}
          />
        </div>
        <div className="inventory-demo-summary" aria-live="polite"><div><span>Impacto por faltantes</span><strong>{formatCurrency(summary.shortageImpact)}</strong></div><div><span>Impacto por sobrantes</span><strong>{formatCurrency(summary.surplusImpact)}</strong></div><div><span>Impacto neto firmado</span><strong>{formatCurrency(summary.netImpact)}</strong></div></div>
        <footer className="inventory-demo-actions"><button type="button" className="inventory-demo-secondary" onClick={reset}>Reiniciar</button><button type="button" className="inventory-demo-primary" disabled={!isComplete} onClick={confirm}>Confirmar resumen local</button></footer>
        {!isComplete && <p className="inventory-demo-help inventory-demo-help-warning" aria-live="polite">Complete una existencia física no negativa y una fecha de vencimiento manual para cada producto visible.</p>}
        {confirmed && <section className="inventory-demo-confirmation" role="status"><h2>Resumen confirmado localmente</h2><p>{counts.length} productos revisados. Impacto neto: <strong>{formatCurrency(summary.netImpact)}</strong>.</p></section>}
      </>}
    </section>
  )
}
