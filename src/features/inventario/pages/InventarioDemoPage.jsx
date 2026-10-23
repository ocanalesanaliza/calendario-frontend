import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { DataGrid, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from '@mui/x-data-grid'
import { calculateSummary, formatCurrency, getCountDetails, parseInventoryWorkbook } from '../inventoryImport'
import { applyInventoryGridRowUpdate, filterInventoryGridRows, getInventoryEditCellTargetAfterCommit, isInventoryExpirationDateValid, isInventoryPhysicalStockValid, toInventoryGridRows } from '../inventoryGrid'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Aviso, FileDrop, FormSection, Icono } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { formatTamano } from '../../tuvet/utils/archivos'
import '../../tuvet/tuvet.css'
import '../styles/InventarioDemo.css'
import '../styles/InventarioConteo.css'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_VISIBLE_ROWS = 500
const STATUS_FILTERS = [
  ['pendiente', 'Pendientes'],
  ['faltante', 'Faltantes'],
  ['sobrante', 'Sobrantes'],
  ['coincide', 'Coincide'],
]
// Cada estado del conteo lleva texto e insignia; nunca solo color.
const STATUS_BADGE = {
  faltante: ['tuvet-badge-vencida', 'Faltante'],
  sobrante: ['tuvet-badge-en_revision', 'Sobrante'],
  coincide: ['tuvet-badge-aprobada', 'Coincide'],
}

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

function EstadoConteo({ value }) {
  if (!value) return <span className="tuvet-badge tuvet-badge-pendiente">Pendiente</span>
  const [clase, etiqueta] = STATUS_BADGE[value] ?? ['tuvet-badge-cancelada', value]
  return <span className={`tuvet-badge ${clase}`}>{etiqueta}</span>
}

export default function InventarioDemoPage() {
  const navigate = useNavigate()
  const apiRef = useGridApiRef()
  const [archivo, setArchivo] = useState(null)
  const [counts, setCounts] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [confirmar, dialogo] = useConfirmacion()

  const contados = counts.filter(({ product, physicalStock, expirationDate }) => {
    const details = getCountDetails(product, physicalStock, expirationDate)
    return details.isPhysicalValid && details.isExpirationValid
  }).length
  const isComplete = counts.length > 0 && contados === counts.length
  const avance = counts.length ? Math.round((contados / counts.length) * 100) : 0
  const summary = calculateSummary(counts)
  const gridRows = useMemo(() => toInventoryGridRows(counts), [counts])
  const filteredRows = useMemo(() => filterInventoryGridRows(gridRows, search, statusFilter), [gridRows, search, statusFilter])
  const conteoPorEstado = useMemo(() => Object.fromEntries(
    STATUS_FILTERS.map(([value]) => [value, filterInventoryGridRows(gridRows, '', value).length]),
  ), [gridRows])
  const columns = useMemo(() => [
    { field: 'code', headerName: 'Código', minWidth: 120, flex: 0.7 },
    { field: 'product', headerName: 'Producto', minWidth: 190, flex: 1.4 },
    { field: 'cost', headerName: 'Costo', minWidth: 125, flex: 0.7 },
    { field: 'systemStock', headerName: 'Esperado', minWidth: 115, type: 'number', flex: 0.6 },
    { field: 'physicalStock', headerName: 'Existencia física', minWidth: 155, editable: true, flex: 0.9, renderEditCell: PhysicalStockEditCell, preProcessEditCellProps: ({ props }) => ({ ...props, error: !isInventoryPhysicalStockValid(props.value) }) },
    { field: 'expirationDate', headerName: 'Vencimiento manual', minWidth: 170, editable: true, flex: 1, renderEditCell: ExpirationDateEditCell, preProcessEditCellProps: ({ props }) => ({ ...props, error: !isInventoryExpirationDateValid(props.value) }) },
    { field: 'difference', headerName: 'Diferencia', minWidth: 115, type: 'number', flex: 0.6, valueFormatter: (value) => value ?? '—' },
    { field: 'status', headerName: 'Estado', minWidth: 120, flex: 0.7, renderCell: ({ value }) => <EstadoConteo value={value} /> },
    { field: 'impact', headerName: 'Impacto', minWidth: 130, flex: 0.8, valueFormatter: (value) => value === null ? '—' : formatCurrency(value) },
  ], [])

  async function handleArchivo(file) {
    setArchivo(file)
    setError('')
    setMessage('')
    setConfirmed(false)
    if (!file) {
      setCounts([])
      return
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('El archivo debe ser un Excel .xlsx. Expórtalo de nuevo con ese formato.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('El archivo supera el límite de 5 MB. Reduce las filas o divide el inventario.')
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

  function limpiar() {
    setArchivo(null)
    setCounts([])
    setError('')
    setMessage('')
    setConfirmed(false)
    setSearch('')
    setStatusFilter('')
  }

  // Reiniciar o salir descartan el conteo local: se confirma solo si hay algo que perder.
  async function reset() {
    if (contados > 0) {
      const ok = await confirmar({
        title: 'Reiniciar conteo',
        message: '¿Descartar el conteo actual y cargar otro archivo?',
        detail: `Se perderán los ${contados} productos ya contados. El conteo no se guarda en el servidor.`,
        confirmLabel: 'Descartar y reiniciar',
      })
      if (!ok) return
    }
    limpiar()
  }

  async function salir() {
    if (contados > 0) {
      const ok = await confirmar({
        title: 'Salir del conteo',
        message: '¿Salir sin terminar el conteo?',
        detail: `Se perderán los ${contados} productos ya contados. El conteo no se guarda en el servidor.`,
        confirmLabel: 'Salir',
      })
      if (!ok) return
    }
    navigate('/')
  }

  function confirm() {
    if (!isComplete) return
    setConfirmed(true)
  }

  return (
    <section className="tema-analiza tuvet-page inventario-conteo" aria-labelledby="inventory-demo-title">
      <div className="tuvet-page-header">
        <div>
          <h1 id="inventory-demo-title">Conteo de inventario</h1>
          <p>Carga el inventario de la sucursal en Excel y registra la existencia física de cada producto.</p>
        </div>
        <div className="tuvet-page-actions">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={salir}>Cancelar y salir</button>
        </div>
      </div>

      <FormSection title="1. Archivo de inventario" description="Encabezados requeridos: Codigo Producto, Producto, Costo, Sucursal, Punto de Reorden y Existencia.">
        <FileDrop
          key={archivo ? 'con-archivo' : 'sin-archivo'}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          file={archivo}
          onChange={handleArchivo}
          formatSize={formatTamano}
          hint="Excel .xlsx · máximo 5 MB · hasta 500 productos con existencia"
          invalid={Boolean(error)}
        />
      </FormSection>

      <Aviso tipo="error">{error}</Aviso>
      <Aviso tipo="success">{message}</Aviso>

      {counts.length > 0 && <>
        <section className="ic-resumen" aria-label="Avance del conteo">
          <div className="ic-sucursal">
            <span className="ic-sucursal-icono"><Icono nombre="edificio" /></span>
            <div className="tv-persona">
              <span className="tuvet-hint">Sucursal</span>
              <strong>{counts[0].product.branch}</strong>
            </div>
          </div>
          <div className="ic-avance">
            <div className="ic-avance-fila">
              <span className="tv-kpi-titulo">Productos contados</span>
              <strong className="ic-avance-valor">{contados} de {counts.length}</strong>
            </div>
            <div className="ic-barra" role="progressbar" aria-valuemin={0} aria-valuemax={counts.length} aria-valuenow={contados} aria-label={`${contados} de ${counts.length} productos contados`}>
              <div className="ic-barra-relleno" style={{ width: `${avance}%` }} />
            </div>
          </div>
        </section>

        <section className="ic-controles" aria-label="Filtros">
          <label className="tv-buscador">
            <Icono nombre="buscar" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o producto" aria-label="Buscar por código o producto" />
          </label>
          <div className="tuvet-filtros" role="group" aria-label="Filtrar por estado">
            {STATUS_FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`tuvet-chip ${statusFilter === value ? 'active' : ''}`}
                aria-pressed={statusFilter === value}
                onClick={() => setStatusFilter((current) => current === value ? '' : value)}
              >
                {label} ({conteoPorEstado[value]})
              </button>
            ))}
            {(search || statusFilter) && (
              <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => { setSearch(''); setStatusFilter('') }}>Limpiar filtros</button>
            )}
          </div>
          <p className="ic-contador" aria-live="polite">{filteredRows.length} de {counts.length} productos</p>
        </section>

        <p className="tuvet-hint ic-ayuda">Haz clic en <strong>Existencia física</strong> o <strong>Vencimiento manual</strong> para escribir; <kbd>Tab</kbd> pasa a la siguiente celda editable.</p>

        <div className="inventory-demo-grid-wrap ic-grid" aria-label="Tabla de conteo de inventario; desplázate horizontalmente si es necesario">
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
            sx={{
              border: 0,
              minWidth: 1050,
              fontFamily: 'var(--tv-font)',
              color: 'var(--tv-fg)',
              '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: 'var(--tv-surface-muted)', color: 'var(--tv-subtle)' },
              '& .MuiDataGrid-columnHeaderTitle': { fontSize: '.75rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' },
              '& .MuiDataGrid-cell': { borderColor: 'var(--tv-surface-sunken)' },
              '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--tv-surface-muted)' },
              '& .MuiDataGrid-cell--editable': { cursor: 'text' },
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-cell:focus-within': { outline: '2px solid var(--tv-primary-accent)', outlineOffset: '-2px' },
            }}
          />
        </div>

        <section className="tv-kpis ic-kpis" aria-label="Impacto del conteo" aria-live="polite">
          <div className="tv-kpi tv-kpi-peligro">
            <span className="tv-kpi-titulo">Impacto por faltantes</span>
            <span className="tv-kpi-valor">{formatCurrency(summary.shortageImpact)}</span>
            <span className="tv-kpi-detalle">{conteoPorEstado.faltante} productos</span>
          </div>
          <div className="tv-kpi tv-kpi-marca">
            <span className="tv-kpi-titulo">Impacto por sobrantes</span>
            <span className="tv-kpi-valor">{formatCurrency(summary.surplusImpact)}</span>
            <span className="tv-kpi-detalle">{conteoPorEstado.sobrante} productos</span>
          </div>
          <div className="tv-kpi">
            <span className="tv-kpi-titulo">Impacto neto</span>
            <span className="tv-kpi-valor">{formatCurrency(summary.netImpact)}</span>
            <span className="tv-kpi-detalle">{conteoPorEstado.coincide} coinciden</span>
          </div>
        </section>

        {!isComplete && (
          <Aviso tipo="warning">Faltan {counts.length - contados} productos: completa una existencia física no negativa y una fecha de vencimiento para cada uno.</Aviso>
        )}
        {confirmed && (
          <Aviso tipo="success">Resumen confirmado localmente: {counts.length} productos revisados, impacto neto {formatCurrency(summary.netImpact)}.</Aviso>
        )}

        <footer className="ic-acciones">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={reset}>Reiniciar</button>
          <button type="button" className="tuvet-btn" disabled={!isComplete} onClick={confirm}>Confirmar resumen local</button>
        </footer>
      </>}
      {dialogo}
    </section>
  )
}
