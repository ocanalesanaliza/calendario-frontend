import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { DataGrid, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from '@mui/x-data-grid'
import { getMisTareas } from '../../operacion/services/operacionService'
import { filterBranchInventoryGridRows, getInventoryEditCellTargetAfterCommit, toBranchInventoryGridRow } from '../inventoryGrid'
import { newIdempotencyKey, previewInventory, submitInventoryBranch } from '../inventoryService'
import { isInventoryFieldEditable } from '../inventoryExecution'
import { Icono } from '../../tuvet/components/TuvetUi'
import './InventoryBranchExecutionPage.css'

const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const STATUS_LABELS = {
  pending: 'Pendiente',
  match: 'Coincide',
  shortage: 'Faltante',
  surplus: 'Sobrante',
}

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function rowId(row, index) {
  return row.code ?? row.product ?? index
}

function isInventoryBranchTask(task) {
  return task?.tarea?.modo_cumplimiento === 'inventory_branch'
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return ''
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function formatCost(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `L ${amount.toFixed(2)}` : '—'
}

function StatusBadge({ value }) {
  return <span className={`inventory-branch-status ${value}`}>{STATUS_LABELS[value]}</span>
}

function GridEditCell({ id, field, value, api, onValueChange, row, type, disabled }) {
  async function handleKeyDown(event) {
    if (event.key !== 'Tab') return

    event.preventDefault()
    event.stopPropagation()
    event.defaultMuiPrevented = true

    const target = await getInventoryEditCellTargetAfterCommit({
      api,
      id,
      field,
      value: event.currentTarget.value,
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

  return <input
    autoFocus
    aria-label={`${field === 'physical_stock' ? 'Existencia física' : 'Vencimiento'} para ${row.product ?? row.code}`}
    className="inventory-branch-grid-input"
    type={type}
    min={type === 'number' ? '0' : undefined}
    step={type === 'number' ? 'any' : undefined}
    inputMode={type === 'number' ? 'decimal' : undefined}
    disabled={disabled}
    value={value ?? ''}
    onKeyDown={handleKeyDown}
    onChange={(event) => { onValueChange(id, field, event.target.value); api.setEditCellValue({ id, field, value: event.target.value }, event) }}
  />
}

function branchName(task, rows) {
  return task?.sucursal?.nombre ?? task?.sucursal_nombre ?? rows[0]?.branch ?? 'Sucursal asignada'
}

export default function InventoryBranchExecutionPage() {
  const { idSucursalTarea } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const fecha = new URLSearchParams(location.search).get('fecha') ?? ''
  const fileInputRef = useRef(null)
  const idempotencyKey = useRef(newIdempotencyKey())
  const apiRef = useGridApiRef()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [comment, setComment] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      if (!isValidCalendarDate(fecha)) {
        if (active) setTask(undefined)
        if (active) setLoading(false)
        return
      }
      try {
        const data = await getMisTareas({ fecha })
        const nextTask = data.results?.find((item) => String(item.id_sucursal_tarea) === String(idSucursalTarea))
        if (active) setTask(nextTask)
      } catch (requestError) {
        if (active) setError(requestError.message || 'No se pudo recargar la tarea de inventario.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [fecha, idSucursalTarea])

  const gridRows = useMemo(() => rows.map(toBranchInventoryGridRow), [rows])
  const filteredRows = useMemo(() => filterBranchInventoryGridRows(gridRows, search, statusFilter), [gridRows, search, statusFilter])
  const counted = gridRows.filter((row) => row.status !== 'pending').length
  const total = gridRows.length
  const incomplete = total - counted
  const isComplete = total > 0 && incomplete === 0
  const progress = total ? Math.round((counted / total) * 100) : 0
  const countByStatus = useMemo(() => Object.fromEntries(['pending', 'shortage', 'surplus', 'match'].map((status) => [status, gridRows.filter((row) => row.status === status).length])), [gridRows])
  const summary = useMemo(() => gridRows.reduce((totals, row) => {
    if (row.impact === null) return totals
    if (row.impact < 0) totals.shortageImpact += row.impact
    if (row.impact > 0) totals.surplusImpact += row.impact
    totals.netImpact += row.impact
    return totals
  }, { shortageImpact: 0, surplusImpact: 0, netImpact: 0 }), [gridRows])
  const unavailable = !loading && (!task || !task.disponible_para_registro || !isInventoryBranchTask(task))

  const updateRow = useCallback((id, field, value) => {
    if (!isInventoryFieldEditable(field)) return
    setRows((current) => current.map((row) => row.__id === id ? { ...row, [field]: value } : row))
  }, [])
  const processRowUpdate = useCallback((updatedRow) => updatedRow, [])
  const columns = useMemo(() => [
    { field: 'code', headerName: 'Código', minWidth: 120, flex: 0.7 },
    { field: 'product', headerName: 'Producto', minWidth: 230, flex: 1.5 },
    { field: 'cost', headerName: 'Costo', minWidth: 110, flex: 0.65, valueFormatter: (value) => formatCost(value) },
    { field: 'expectedStock', headerName: 'Esperado', minWidth: 115, type: 'number', flex: 0.6 },
    { field: 'physical_stock', headerName: 'Existencia física', minWidth: 160, editable: true, flex: 0.9, renderEditCell: (params) => <GridEditCell {...params} type="number" disabled={sending} onValueChange={updateRow} /> },
    { field: 'expiration_date', headerName: 'Vencimiento manual', minWidth: 175, editable: true, flex: 1, renderEditCell: (params) => <GridEditCell {...params} type="date" disabled={sending} onValueChange={updateRow} /> },
    { field: 'difference', headerName: 'Diferencia', minWidth: 115, type: 'number', flex: 0.6, valueFormatter: (value) => value ?? '—' },
    { field: 'status', headerName: 'Estado', minWidth: 125, flex: 0.7, cellClassName: 'inventory-branch-status-cell', renderCell: ({ value }) => <StatusBadge value={value} /> },
    { field: 'impact', headerName: 'Impacto', minWidth: 130, flex: 0.75, valueFormatter: (value) => value === null ? '—' : formatCost(value) },
  ], [sending, updateRow])

  function returnToTasks() {
    navigate({ pathname: '/mis-tareas', search: fecha ? `?fecha=${fecha}` : '' })
  }

  async function handleFileChange(event) {
    const nextFile = event.target.files?.[0]
    setError('')
    setSuccess('')
    setRows([])
    setSearch('')
    setStatusFilter('')
    if (!nextFile || !nextFile.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null)
      setError('Selecciona un archivo XLSX para continuar.')
      return
    }

    setFile(nextFile)
    setPreviewing(true)
    try {
      const result = await previewInventory(nextFile)
      const nextRows = (result.rows ?? []).map((row, index) => ({ ...row, __id: rowId(row, index) }))
      setRows(nextRows)
      if (result.errors?.length) {
        setError('El archivo tiene errores que debes corregir antes de enviarlo.')
      } else {
        setSuccess(nextRows.length ? `${nextRows.length} productos listos para conteo.` : 'El archivo no contiene productos para contar.')
      }
    } catch (requestError) {
      setError(requestError.message || 'No se pudo previsualizar el inventario.')
      setFile(null)
    } finally {
      setPreviewing(false)
    }
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
    if (!task || !task.disponible_para_registro || !isInventoryBranchTask(task)) {
      setError('Esta tarea de inventario ya no está disponible.')
      return
    }
    if (!file) {
      setError('Selecciona un archivo XLSX para continuar.')
      return
    }
    if (!isComplete) {
      setError('Completa una existencia física válida para cada producto antes de registrar el inventario.')
      return
    }
    setSending(true)
    setError('')
    try {
      const serializedRows = rows.map((row) => {
        const serialized = { ...row }
        delete serialized.__id
        return serialized
      })
      await submitInventoryBranch({
        assignmentId: task.id_sucursal_tarea,
        file,
        rows: serializedRows,
        comment,
        idempotencyKey: idempotencyKey.current,
      })
      navigate('/mis-tareas', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar el inventario.')
      setSending(false)
    }
  }

  if (loading) return <div className="loading-state">Cargando tarea de inventario...</div>
  if (unavailable) return <section className="inventory-branch-page" aria-labelledby="inventory-branch-unavailable"><h1 id="inventory-branch-unavailable">Inventario no disponible</h1><p>La tarea solicitada ya no está disponible o no corresponde a un inventario de sucursal.</p><button type="button" className="inventory-branch-button secondary" onClick={returnToTasks}>Volver a Mis tareas</button></section>

  return <main className="inventory-branch-page" aria-labelledby="inventory-branch-title">
    <header className="inventory-branch-header">
      <div>
        <p className="inventory-branch-eyebrow">{task.tarea?.nombre ?? 'Inventario de sucursal'} · {fecha}</p>
        <h1 id="inventory-branch-title">Conteo de inventario</h1>
        <p>Sube el inventario de la sucursal en Excel y registra la existencia física de cada producto.</p>
      </div>
      <button type="button" className="inventory-branch-button secondary" disabled={sending} onClick={returnToTasks}>Cancelar y salir</button>
    </header>

    <form onSubmit={submit} noValidate>
      <section className="inventory-branch-upload-card" aria-labelledby="inventory-branch-file-title">
        <div>
          <h2 id="inventory-branch-file-title">1. Archivo de inventario</h2>
          <p>Selecciona el archivo XLSX para que el servidor valide y prepare la vista previa.</p>
        </div>
        <input ref={fileInputRef} id="inventory-branch-file" className="inventory-branch-file-input" aria-label="Archivo XLSX" type="file" accept={XLSX} disabled={sending || previewing} onChange={handleFileChange} />
        {file ? <div className="inventory-branch-selected-file">
          <span className="inventory-branch-file-icon" aria-hidden="true"><Icono nombre="archivo" /></span>
          <div><strong>{file.name}</strong><span>{formatFileSize(file.size)} · Vista previa del servidor</span></div>
          <div className="inventory-branch-file-actions">
            <button type="button" className="inventory-branch-link" disabled={sending || previewing} onClick={() => fileInputRef.current?.click()}>Reemplazar</button>
            <button type="button" className="inventory-branch-link danger" disabled={sending || previewing} onClick={removeFile}>Quitar</button>
          </div>
        </div> : <label className="inventory-branch-file-drop" htmlFor="inventory-branch-file"><strong>{previewing ? 'Preparando vista previa…' : 'Seleccionar archivo XLSX'}</strong><span>El archivo se procesa en el servidor; no se guarda un borrador local.</span></label>}
      </section>

      {error && <p className="inventory-branch-alert error" role="alert">{error}</p>}
      {success && <p className="inventory-branch-alert success" role="status">✓ {success}</p>}

      {total > 0 && <>
        <section className="inventory-branch-summary" aria-label="Contexto y avance del conteo">
          <div className="inventory-branch-context"><span className="inventory-branch-context-icon" aria-hidden="true"><Icono nombre="edificio" /></span><div><span>Sucursal</span><strong>{branchName(task, rows)}</strong></div></div>
          <div className="inventory-branch-progress"><div><span>Productos contados</span><strong>{counted} de {total}</strong></div><div className="inventory-branch-progress-track" role="progressbar" aria-label={`${counted} de ${total} productos contados`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={counted}><span style={{ width: `${progress}%` }} /></div></div>
        </section>

        <section className="inventory-branch-controls" aria-label="Búsqueda y filtros">
          <label className="inventory-branch-search"><span aria-hidden="true"><Icono nombre="buscar" /></span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o producto" aria-label="Buscar por código o producto" /></label>
          <div className="inventory-branch-filters" role="group" aria-label="Filtrar por estado">
            {[['pending', 'Pendientes'], ['shortage', 'Faltantes'], ['surplus', 'Sobrantes'], ['match', 'Coincide']].map(([value, label]) => <button key={value} type="button" className={statusFilter === value ? 'active' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter((current) => current === value ? '' : value)}>{label} ({countByStatus[value]})</button>)}
            {(search || statusFilter) && <button type="button" className="inventory-branch-link" onClick={() => { setSearch(''); setStatusFilter('') }}>Limpiar filtros</button>}
          </div>
          <p aria-live="polite">{filteredRows.length} de {total} productos</p>
        </section>

        <p className="inventory-branch-help">Escribe en <strong>Existencia física</strong> o <strong>Vencimiento manual</strong>; <kbd>Tab</kbd> pasa a la siguiente celda editable.</p>
        <div className="inventory-branch-grid-wrap" aria-label="Tabla de conteo de inventario; desplázate horizontalmente si es necesario">
          <DataGrid rows={filteredRows} columns={columns} apiRef={apiRef} processRowUpdate={processRowUpdate} onCellClick={(params, event) => { if (params.colDef.editable && !sending && apiRef.current.getCellMode(params.id, params.field) === 'view') { event.defaultMuiPrevented = true; apiRef.current.startCellEditMode({ id: params.id, field: params.field }) } }} pagination initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick density="compact" sx={{ border: 0, minWidth: 1120, fontFamily: 'var(--tv-font)', color: 'var(--tv-fg)', '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: 'var(--tv-surface-muted)', color: 'var(--tv-subtle)' }, '& .MuiDataGrid-cell': { borderColor: 'var(--tv-surface-sunken)' }, '& .MuiDataGrid-cell.inventory-branch-status-cell': { backgroundColor: 'transparent !important' }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: '.75rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }, '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--tv-surface-muted)' }, '& .MuiDataGrid-cell--editable': { cursor: 'text' }, '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-cell:focus-within': { outline: '2px solid var(--tv-primary-accent)', outlineOffset: '-2px' } }} />
        </div>

        <section className="inventory-branch-kpis" aria-label="Impacto del conteo" aria-live="polite">
          <div className="inventory-branch-kpi shortage"><span>Impacto por faltantes</span><strong>{formatCost(summary.shortageImpact)}</strong><small>{countByStatus.shortage} productos</small></div>
          <div className="inventory-branch-kpi surplus"><span>Impacto por sobrantes</span><strong>{formatCost(summary.surplusImpact)}</strong><small>{countByStatus.surplus} productos</small></div>
          <div className="inventory-branch-kpi"><span>Impacto neto</span><strong>{formatCost(summary.netImpact)}</strong><small>{countByStatus.match} coinciden</small></div>
        </section>

        {!isComplete && <p className="inventory-branch-alert warning" aria-live="polite">Faltan {incomplete} productos. Completa una existencia física no negativa; el vencimiento es opcional.</p>}
      </>}

      <section className="inventory-branch-comment-section">
        <label htmlFor="inventory-branch-comment">Comentario opcional</label>
        <textarea id="inventory-branch-comment" aria-label="Comentario opcional" maxLength="1000" value={comment} disabled={sending} onChange={(event) => setComment(event.target.value)} placeholder="Agrega una observación para el registro, si es necesaria." />
      </section>
      <footer className="inventory-branch-actions"><button type="submit" className="inventory-branch-button primary" disabled={sending || !isComplete}>{sending ? 'Registrando…' : 'Registrar inventario'}</button></footer>
    </form>
  </main>
}
