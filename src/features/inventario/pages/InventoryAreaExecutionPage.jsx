import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { DataGrid, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from '@mui/x-data-grid'
import { esES } from '@mui/x-data-grid/locales'
import { getMonthlyAreaOccurrences } from '../../calendarioArea/services/calendarioAreaService'
import { discoverAreaBranches, newIdempotencyKey, previewInventory, submitInventoryArea } from '../inventoryService'
import { filterBranchInventoryGridRows, getInventoryEditCellTargetAfterCommit, toBranchInventoryGridRow } from '../inventoryGrid'
import { isInventoryFieldEditable } from '../inventoryExecution'
import { Icono } from '../../tuvet/components/TuvetUi'
import './InventoryAreaExecutionPage.css'

const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const STATUS_LABELS = { pending: 'Pendiente', match: 'Coincide', shortage: 'Faltante', surplus: 'Sobrante' }

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function rowId(row, index) { return row.code ?? row.product ?? index }

function formatFileSize(size) {
  if (!Number.isFinite(size)) return ''
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function StatusBadge({ value }) {
  return <span className={`inventory-area-status ${value}`}>{STATUS_LABELS[value]}</span>
}

function formatCost(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `L ${amount.toFixed(2)}` : '—'
}

function GridEditCell({ id, field, value, api, onValueChange, row, disabled }) {
  async function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    event.preventDefault()
    event.stopPropagation()
    event.defaultMuiPrevented = true
    const nextValue = event.currentTarget.value
    const target = await getInventoryEditCellTargetAfterCommit({
      api,
      id,
      field,
      value: nextValue,
      event,
      visibleRowIds: gridPaginatedVisibleSortedGridRowIdsSelector({ current: api }),
      shiftKey: event.shiftKey,
      physicalStockField: 'physical_stock',
      expirationDateField: 'expiration_date',
    })
    if (!target) return

    api.stopCellEditMode({ id, field })
    if (target.id === id && target.field === field) return
    api.startCellEditMode(target)
  }

  return <input autoFocus className="inventory-area-grid-input" aria-label={`${field === 'physical_stock' ? 'Existencia física' : 'Vencimiento'} para ${row.product ?? row.code}`} type={field === 'physical_stock' ? 'number' : 'date'} min={field === 'physical_stock' ? '0' : undefined} step={field === 'physical_stock' ? 'any' : undefined} inputMode={field === 'physical_stock' ? 'decimal' : undefined} disabled={disabled} value={value ?? ''} onKeyDown={handleKeyDown} onChange={(event) => { onValueChange(id, field, event.target.value); api.setEditCellValue({ id, field, value: event.target.value }, event) }} />
}

export default function InventoryAreaExecutionPage() {
  const { idOcurrencia, manualEntryId } = useParams()
  const { search: locationSearch } = useLocation()
  const navigate = useNavigate()
  const fecha = new URLSearchParams(locationSearch).get('fecha') ?? ''
  const idempotencyKey = useRef(newIdempotencyKey())
  const fileInputRef = useRef(null)
  const apiRef = useGridApiRef()
  const [occurrence, setOccurrence] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [comment, setComment] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      if (!isValidCalendarDate(fecha)) { if (active) { setOccurrence(undefined); setLoading(false) }; return }
      try {
        const data = await getMonthlyAreaOccurrences(fecha.slice(0, 7))
        const isManual = manualEntryId !== undefined
        const next = isManual
          ? data.manual_catalog_entries?.find((item) => String(item.id) === String(manualEntryId) && item.execution_kind === 'inventory_area')
          : data.occurrences?.find((item) => String(item.occurrence_id ?? item.id) === String(idOcurrencia) && item.task?.mode === 'inventory_area')
        if (!next) { if (active) setOccurrence(undefined); return }
        if (!active) return
        setOccurrence(next)
        const branchData = await discoverAreaBranches(isManual ? { manualEntryId } : next.occurrence_id ?? next.id)
        if (active) setBranches(branchData.branches ?? [])
      } catch (requestError) {
        if (active) setError(requestError.message || 'No se pudo recargar el inventario de área.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [fecha, idOcurrencia, manualEntryId])

  const gridRows = useMemo(() => rows.map(toBranchInventoryGridRow), [rows])
  const filteredRows = useMemo(() => filterBranchInventoryGridRows(gridRows, search, statusFilter), [gridRows, search, statusFilter])
  const total = gridRows.length
  const counted = gridRows.filter((row) => row.status !== 'pending').length
  const incomplete = total - counted
  const complete = total > 0 && incomplete === 0
  const counts = useMemo(() => Object.fromEntries(['pending', 'shortage', 'surplus', 'match'].map((status) => [status, gridRows.filter((row) => row.status === status).length])), [gridRows])
  const summary = useMemo(() => gridRows.reduce((totals, row) => {
    if (row.impact === null) return totals
    if (row.impact < 0) totals.shortageImpact += row.impact
    if (row.impact > 0) totals.surplusImpact += row.impact
    totals.netImpact += row.impact
    return totals
  }, { shortageImpact: 0, surplusImpact: 0, netImpact: 0 }), [gridRows])
  const updateRow = useCallback((id, field, value) => {
    if (!isInventoryFieldEditable(field)) return
    setRows((current) => current.map((row) => row.__id === id ? { ...row, [field]: value } : row))
  }, [])
  const processRowUpdate = useCallback((updated) => updated, [])
  const columns = useMemo(() => [
    { field: 'code', headerName: 'Código', minWidth: 115, flex: 0.7 },
    { field: 'product', headerName: 'Producto', minWidth: 220, flex: 1.5 },
    { field: 'cost', headerName: 'Costo', minWidth: 110, flex: 0.65, valueFormatter: (value) => formatCost(value) },
    { field: 'expectedStock', headerName: 'Esperado', minWidth: 115, type: 'number', flex: 0.6 },
    { field: 'physical_stock', headerName: 'Existencia física', minWidth: 160, flex: 0.9, editable: true, renderEditCell: (params) => <GridEditCell {...params} disabled={sending} onValueChange={updateRow} /> },
    { field: 'expiration_date', headerName: 'Vencimiento', minWidth: 155, flex: 0.9, editable: true, renderEditCell: (params) => <GridEditCell {...params} disabled={sending} onValueChange={updateRow} /> },
    { field: 'difference', headerName: 'Diferencia', minWidth: 115, type: 'number', flex: 0.6, valueFormatter: (value) => value ?? '—' },
    { field: 'status', headerName: 'Estado', minWidth: 120, flex: 0.7, cellClassName: 'inventory-area-status-cell', renderCell: ({ value }) => <StatusBadge value={value} /> },
    { field: 'impact', headerName: 'Impacto', minWidth: 130, flex: 0.75, valueFormatter: (value) => value === null ? '—' : formatCost(value) },
  ], [sending, updateRow])

  function returnToCalendar() { navigate({ pathname: '/calendario-area', search: fecha ? `?fecha=${fecha}` : '' }) }
  async function selectFile(event) {
    const nextFile = event.target.files?.[0]
    setError(''); setSuccess(''); setRows([])
    if (!nextFile?.name?.toLowerCase().endsWith('.xlsx')) { setFile(null); setError('Selecciona un archivo XLSX para continuar.'); return }
    setFile(nextFile); setPreviewing(true)
    try {
      const result = await previewInventory(nextFile)
      const nextRows = (result.rows ?? []).map((row, index) => ({ ...row, __id: rowId(row, index) }))
      setRows(nextRows)
      if (result.errors?.length) setError('El archivo tiene errores que debes corregir antes de enviarlo.')
      else setSuccess(`${nextRows.length} productos listos para conteo.`)
    } catch (requestError) { setFile(null); setError(requestError.message || 'No se pudo previsualizar el inventario.') } finally { setPreviewing(false) }
  }
  function removeFile() {
    setFile(null)
    setRows([])
    setSuccess('')
    setError('')
    setSearch('')
    setStatusFilter('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  async function submit(event) {
    event.preventDefault()
    if (!occurrence || !branchId || !file || !complete) { setError(!branchId ? 'Selecciona una sucursal autorizada antes de cargar el archivo.' : !file ? 'Selecciona un archivo XLSX para continuar.' : 'Completa una existencia física válida para cada producto antes de registrar el inventario.'); return }
    setSending(true); setError('')
    try {
      const serializedRows = rows.map((row) => {
        const serialized = { ...row }
        delete serialized.__id
        return serialized
      })
      await submitInventoryArea({ ...(manualEntryId !== undefined ? { manualEntryId } : { areaOccurrenceId: occurrence.occurrence_id ?? occurrence.id }), branchId, file, rows: serializedRows, comment, idempotencyKey: idempotencyKey.current })
      navigate({ pathname: '/calendario-area', search: fecha ? `?fecha=${fecha}` : '' }, { replace: true })
    } catch (requestError) { setError(requestError.message || 'No se pudo registrar el inventario.'); setSending(false) }
  }

  if (loading) return <div className="loading-state">Cargando inventario de área...</div>
  if (!occurrence || error && !occurrence) return <section className="inventory-area-page inventory-area-state" aria-labelledby="inventory-area-unavailable"><h1 id="inventory-area-unavailable">Inventario no disponible</h1><p>{error || 'La ocurrencia solicitada no está disponible o no corresponde a un inventario de área.'}</p><button type="button" onClick={returnToCalendar}>Volver a Calendario del área</button></section>

  return <main className="inventory-area-page" aria-labelledby="inventory-area-title"><header className="inventory-area-header"><div><p className="inventory-area-eyebrow">Inventario de área · {fecha}</p><h1 id="inventory-area-title">Conteo de inventario de área</h1><p>Selecciona una sucursal autorizada, carga el XLSX y registra el conteo físico.</p></div><button type="button" className="inventory-area-button secondary" disabled={sending} onClick={returnToCalendar}>Cancelar y salir</button></header><form onSubmit={submit} noValidate>
    <section className="inventory-area-card inventory-area-branch-card"><div><h2>1. Sucursal autorizada</h2><p>Selecciona la sucursal antes de cargar el inventario.</p></div><label className="inventory-area-field" htmlFor="inventory-area-branch"><span>Sucursal autorizada</span><select id="inventory-area-branch" aria-label="Sucursal autorizada" value={branchId} disabled={sending} onChange={(event) => setBranchId(event.target.value)}><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label>{!branchId && <p className="inventory-area-inline-note"><Icono nombre="informacion" />Selecciona una sucursal autorizada antes de cargar el archivo.</p>}</section>
    <section className="inventory-area-card inventory-area-upload-card"><div><h2>2. Archivo de inventario</h2><p>El servidor valida el XLSX y prepara la vista previa; no se guarda ningún borrador local.</p></div><input ref={fileInputRef} id="inventory-area-file" className="inventory-area-file-input" aria-label="Archivo XLSX" type="file" accept={XLSX} disabled={!branchId || sending || previewing} onChange={selectFile} />{file ? <div className="inventory-area-selected-file"><span className="inventory-area-file-icon" aria-hidden="true"><Icono nombre="archivo" /></span><div><strong>{file.name}</strong><span>{formatFileSize(file.size)} · Vista previa del servidor</span></div><div className="inventory-area-file-actions"><button type="button" className="inventory-area-link" aria-label="Reemplazar archivo" disabled={sending || previewing} onClick={() => fileInputRef.current?.click()}>Reemplazar</button><button type="button" className="inventory-area-link danger" aria-label="Quitar archivo" disabled={sending || previewing} onClick={removeFile}>Quitar</button></div></div> : <label className={`inventory-area-file-drop ${!branchId ? 'disabled' : ''}`} htmlFor="inventory-area-file"><strong>{previewing ? 'Preparando vista previa…' : 'Seleccionar archivo XLSX'}</strong><span>{branchId ? 'Arrastra o selecciona el archivo de inventario.' : 'Primero selecciona una sucursal autorizada.'}</span></label>}</section>
    {error && <p className="inventory-area-alert error" role="alert">{error}</p>}{success && <p className="inventory-area-alert success" role="status">✓ {success}</p>}
    {total > 0 && <><section className="inventory-area-summary" aria-label="Contexto y avance"><div className="inventory-area-context"><span className="inventory-area-context-icon" aria-hidden="true"><Icono nombre="edificio" /></span><div><span>Sucursal</span><strong>{branches.find((branch) => String(branch.id) === String(branchId))?.name ?? 'Sucursal autorizada'}</strong></div></div><div className="inventory-area-progress"><div><span>Productos contados</span><strong>{counted} de {total}</strong></div><div className="inventory-area-progress-track" role="progressbar" aria-label={`${counted} de ${total} productos contados`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={counted}><span style={{ width: `${total ? Math.round((counted / total) * 100) : 0}%` }} /></div></div></section><section className="inventory-area-kpis" aria-label="Impacto del conteo" aria-live="polite"><div className="inventory-area-kpi shortage"><span>Impacto por faltantes</span><strong>{formatCost(summary.shortageImpact)}</strong><small>{counts.shortage} productos</small></div><div className="inventory-area-kpi surplus"><span>Impacto por sobrantes</span><strong>{formatCost(summary.surplusImpact)}</strong><small>{counts.surplus} productos</small></div><div className="inventory-area-kpi"><span>Impacto neto</span><strong>{formatCost(summary.netImpact)}</strong><small>{counts.match} coinciden</small></div></section><section className="inventory-area-controls" aria-label="Búsqueda y filtros"><label className="inventory-area-search"><span aria-hidden="true"><Icono nombre="buscar" /></span><input type="search" aria-label="Buscar por código o producto" placeholder="Buscar por código o producto" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="inventory-area-filters" role="group" aria-label="Filtrar por estado">{Object.entries(STATUS_LABELS).map(([status, label]) => <button key={status} type="button" className={statusFilter === status ? 'active' : ''} aria-pressed={statusFilter === status} onClick={() => setStatusFilter((current) => current === status ? '' : status)}>{label} ({counts[status]})</button>)}</div><p aria-live="polite">{filteredRows.length} de {total} productos</p></section><p className="inventory-area-help">Edita solamente <strong>Existencia física</strong> y <strong>Vencimiento</strong>.</p><div className="inventory-area-grid"><DataGrid apiRef={apiRef} rows={filteredRows} columns={columns} processRowUpdate={processRowUpdate} isCellEditable={(params) => !sending && isInventoryFieldEditable(params.field)} onCellClick={(params, event) => { if (params.colDef.editable && !sending && apiRef.current.getCellMode(params.id, params.field) === 'view') { event.defaultMuiPrevented = true; apiRef.current.startCellEditMode({ id: params.id, field: params.field }) } }} pagination initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick density="compact" localeText={esES.components.MuiDataGrid.defaultProps.localeText} sx={{ border: 0, minWidth: 1000, fontFamily: 'var(--tv-font, Inter, system-ui, sans-serif)', color: 'var(--tv-fg)', '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: 'var(--tv-surface-muted)', color: 'var(--tv-subtle)' }, '& .MuiDataGrid-cell': { borderColor: 'var(--tv-surface-sunken)' }, '& .MuiDataGrid-cell.inventory-area-status-cell': { backgroundColor: 'transparent !important' }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: '.75rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }, '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--tv-surface-muted)' }, '& .MuiDataGrid-cell--editable': { cursor: 'text' }, '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-cell:focus-within': { outline: '2px solid var(--tv-primary-accent)', outlineOffset: '-2px' } }} /></div>{!complete && <p className="inventory-area-alert warning">Faltan {incomplete} productos. Completa una existencia física válida; el vencimiento es opcional.</p>}</>}
    <section className="inventory-area-comment-section"><label htmlFor="inventory-area-comment">Comentario opcional</label><textarea id="inventory-area-comment" aria-label="Comentario opcional" maxLength="1000" disabled={sending} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Agrega una observación para el registro, si es necesaria." /></section><footer className="inventory-area-actions"><button type="submit" className="inventory-area-button primary" disabled={sending || !complete}>{sending ? 'Registrando…' : 'Registrar inventario'}</button></footer>
  </form></main>
}
