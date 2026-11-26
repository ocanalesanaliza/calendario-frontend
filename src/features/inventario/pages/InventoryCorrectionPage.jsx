import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DataGrid, gridPaginatedVisibleSortedGridRowIdsSelector, useGridApiRef } from '@mui/x-data-grid'
import { esES } from '@mui/x-data-grid/locales'
import { Icono } from '../../tuvet/components/TuvetUi'
import { correctInventory, getHistoryDetail, newIdempotencyKey, previewInventory } from '../inventoryService'
import { filterBranchInventoryGridRows, getInventoryEditCellTargetAfterCommit, toBranchInventoryGridRow } from '../inventoryGrid'
import { isInventoryFieldEditable } from '../inventoryExecution'
import './InventoryAreaExecutionPage.css'

const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const STATUS_LABELS = { pending: 'Pendiente', match: 'Coincide', shortage: 'Faltante', surplus: 'Sobrante' }
const HEADERS = ['Código', 'Producto', 'Producto Costo', 'Sucursal', 'Punto de Reorden', 'Existencia', 'Existencia Física', 'Diferencia', 'Costo por Diferencia', 'Fecha de vencimiento']
const rowId = (row, index) => row.code ?? row.product ?? index
const formatFileSize = (size) => !Number.isFinite(size) ? '' : size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
const formatCost = (value) => Number.isFinite(Number(value)) ? `L ${Number(value).toFixed(2)}` : '—'
const normalized = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const templateError = (value) => ['codigo', 'producto', 'existencia fisica', 'fecha de vencimiento'].every((part) => normalized(value).includes(part))

function StatusBadge({ value }) { return <span className={`inventory-area-status ${value}`}>{STATUS_LABELS[value]}</span> }
function GridEditCell({ id, field, value, api, row, disabled, onValueChange }) {
  async function moveWithTab(event) {
    if (event.key !== 'Tab') return
    event.preventDefault(); event.stopPropagation(); event.defaultMuiPrevented = true
    const target = await getInventoryEditCellTargetAfterCommit({ api, id, field, value: event.currentTarget.value, event, visibleRowIds: gridPaginatedVisibleSortedGridRowIdsSelector({ current: api }), shiftKey: event.shiftKey, physicalStockField: 'physical_stock', expirationDateField: 'expiration_date' })
    if (!target) return
    api.stopCellEditMode({ id, field }); if (target.id !== id || target.field !== field) api.startCellEditMode(target)
  }
  return <input autoFocus className="inventory-area-grid-input" aria-label={`${field === 'physical_stock' ? 'Existencia física' : 'Vencimiento'} para ${row.product ?? row.code}`} type={field === 'physical_stock' ? 'number' : 'date'} min={field === 'physical_stock' ? '0' : undefined} step={field === 'physical_stock' ? 'any' : undefined} disabled={disabled} value={value ?? ''} onKeyDown={moveWithTab} onChange={(event) => { onValueChange(id, field, event.target.value); api.setEditCellValue({ id, field, value: event.target.value }, event) }} />
}

export default function InventoryCorrectionPage() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const apiRef = useGridApiRef()
  const key = useRef(newIdempotencyKey())
  const [correction, setCorrection] = useState(null)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setCorrection((await getHistoryDetail(submissionId)).submission) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }, [submissionId])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  const gridRows = useMemo(() => rows.map(toBranchInventoryGridRow), [rows])
  const filteredRows = useMemo(() => filterBranchInventoryGridRows(gridRows, search, statusFilter), [gridRows, search, statusFilter])
  const total = gridRows.length
  const counted = gridRows.filter((row) => row.status !== 'pending').length
  const incomplete = total - counted
  const complete = total > 0 && incomplete === 0
  const counts = useMemo(() => Object.fromEntries(Object.keys(STATUS_LABELS).map((status) => [status, gridRows.filter((row) => row.status === status).length])), [gridRows])
  const summary = useMemo(() => gridRows.reduce((totals, row) => ({ shortageImpact: totals.shortageImpact + (row.impact < 0 ? row.impact : 0), surplusImpact: totals.surplusImpact + (row.impact > 0 ? row.impact : 0), netImpact: totals.netImpact + (row.impact ?? 0) }), { shortageImpact: 0, surplusImpact: 0, netImpact: 0 }), [gridRows])
  const updateRow = useCallback((id, field, value) => { if (isInventoryFieldEditable(field)) setRows((current) => current.map((row) => row.__id === id ? { ...row, [field]: value } : row)) }, [])
  const columns = useMemo(() => [
    { field: 'code', headerName: 'Código', minWidth: 115, flex: .7 }, { field: 'product', headerName: 'Producto', minWidth: 220, flex: 1.5 }, { field: 'cost', headerName: 'Costo', minWidth: 110, flex: .65, valueFormatter: (value) => formatCost(value) }, { field: 'expectedStock', headerName: 'Esperado', minWidth: 115, flex: .6 },
    { field: 'physical_stock', headerName: 'Existencia física', minWidth: 160, flex: .9, editable: true, renderEditCell: (params) => <GridEditCell {...params} disabled={sending} onValueChange={updateRow} /> }, { field: 'expiration_date', headerName: 'Vencimiento', minWidth: 155, flex: .9, editable: true, renderEditCell: (params) => <GridEditCell {...params} disabled={sending} onValueChange={updateRow} /> },
    { field: 'difference', headerName: 'Diferencia', minWidth: 115, flex: .6, valueFormatter: (value) => value ?? '—' }, { field: 'status', headerName: 'Estado', minWidth: 120, flex: .7, cellClassName: 'inventory-area-status-cell', renderCell: ({ value }) => <StatusBadge value={value} /> }, { field: 'impact', headerName: 'Impacto', minWidth: 130, flex: .75, valueFormatter: (value) => value === null ? '—' : formatCost(value) },
  ], [sending, updateRow])
  async function selectFile(event) {
    const next = event.target.files?.[0]
    setError(''); setSuccess(''); setRows([]); setSearch(''); setStatusFilter('')
    if (!next?.name?.toLowerCase().endsWith('.xlsx')) { setFile(null); setError('Selecciona un archivo XLSX para continuar.'); return }
    setFile(next); setPreviewing(true)
    try { const result = await previewInventory(next); const nextRows = (result.rows ?? []).map((row, index) => ({ ...row, __id: rowId(row, index) })); setRows(nextRows); if (result.errors?.length) setError(result.errors.join(' ')); else setSuccess(`${nextRows.length} productos listos para conteo.`) } catch (requestError) { setFile(null); setError(requestError.message || 'No se pudo previsualizar el inventario.') } finally { setPreviewing(false) }
  }
  function removeFile() { setFile(null); setRows([]); setSuccess(''); setError(''); setSearch(''); setStatusFilter(''); if (inputRef.current) inputRef.current.value = '' }
  async function submit(event) {
    event.preventDefault()
    if (!file || !complete || !reason.trim()) { setError(!file ? 'Selecciona un archivo XLSX para continuar.' : !complete ? 'Completa una existencia física válida para cada producto antes de enviar la corrección.' : 'Indica el motivo de la corrección.'); return }
    setSending(true); setError('')
    try { await correctInventory({ submissionId: correction.id, inventoryType: correction.inventory_type, file, rows: rows.map((row) => { const serialized = { ...row }; delete serialized.__id; return serialized }), comment, reason, expectedVersion: correction.expected_version, idempotencyKey: key.current }); navigate('/historial-inventarios', { replace: true }) } catch (requestError) { setError(requestError.status === 409 ? 'El historial cambió. Tu borrador se conserva; recarga el detalle antes de enviarlo de nuevo.' : requestError.status === 403 ? 'No tienes autorización para realizar esta operación. Tu borrador se conserva.' : requestError.message); setSending(false) }
  }
  if (loading) return <div className="loading-state">Cargando corrección de inventario...</div>
  if (!correction) return <section className="inventory-area-page inventory-area-state"><h1>Corrección no disponible</h1><p>{error || 'No se pudo cargar el inventario solicitado.'}</p><button type="button" onClick={() => navigate('/historial-inventarios')}>Volver al historial</button></section>
  const branchName = correction.branch?.name ?? correction.branch?.nombre ?? rows[0]?.branch ?? 'Sucursal del inventario'
  return <main className="inventory-area-page" aria-labelledby="inventory-correction-title"><header className="inventory-area-header"><div><p className="inventory-area-eyebrow">Corrección · {correction.inventory_type === 'inventory_area' ? 'Inventario de área' : 'Inventario de sucursal'}</p><h1 id="inventory-correction-title">Corrección de inventario</h1><p>Carga el XLSX y actualiza el conteo físico del inventario registrado.</p></div><button type="button" className="inventory-area-button secondary" disabled={sending} onClick={() => navigate('/historial-inventarios')}>Cancelar y salir</button></header><form onSubmit={submit} noValidate>
    <section className="inventory-area-card inventory-area-upload-card"><div><h2>1. Archivo de inventario</h2><p>El servidor valida el XLSX y prepara la vista previa; no se guarda ningún borrador local.</p></div><input ref={inputRef} id="inventory-correction-file" className="inventory-area-file-input" aria-label="Archivo XLSX" type="file" accept={XLSX} disabled={sending || previewing} onChange={selectFile} />{file ? <div className="inventory-area-selected-file"><span className="inventory-area-file-icon" aria-hidden="true"><Icono nombre="archivo" /></span><div><strong>{file.name}</strong><span>{formatFileSize(file.size)} · Vista previa del servidor</span></div><div className="inventory-area-file-actions"><button type="button" className="inventory-area-link" disabled={sending || previewing} onClick={() => inputRef.current?.click()}>Reemplazar</button><button type="button" className="inventory-area-link danger" disabled={sending || previewing} onClick={removeFile}>Quitar</button></div></div> : <label className="inventory-area-file-drop" htmlFor="inventory-correction-file"><strong>{previewing ? 'Preparando vista previa…' : 'Seleccionar archivo XLSX'}</strong><span>Arrastra o selecciona el archivo de inventario.</span></label>}</section>
    {error && (templateError(error) ? <section className="inventory-xlsx-format-error" role="alert"><h3>El archivo no coincide con la plantilla esperada</h3><p>Revisa los encabezados y reemplaza el archivo.</p><ul>{HEADERS.map((header) => <li key={header}>{header}</li>)}</ul></section> : <p className="inventory-area-alert error" role="alert">{error}</p>)}{success && <p className="inventory-area-alert success" role="status">✓ {success}</p>}
    {total > 0 && <><section className="inventory-area-summary" aria-label="Contexto y avance"><div className="inventory-area-context"><span className="inventory-area-context-icon" aria-hidden="true"><Icono nombre="edificio" /></span><div><span>Sucursal</span><strong>{branchName}</strong></div></div><div className="inventory-area-progress"><div><span>Productos contados</span><strong>{counted} de {total}</strong></div><div className="inventory-area-progress-track" role="progressbar" aria-label={`${counted} de ${total} productos contados`}><span style={{ width: `${total ? Math.round((counted / total) * 100) : 0}%` }} /></div></div></section><section className="inventory-area-kpis" aria-label="Impacto del conteo"><div className="inventory-area-kpi shortage"><span>Impacto por faltantes</span><strong>{formatCost(summary.shortageImpact)}</strong><small>{counts.shortage} productos</small></div><div className="inventory-area-kpi surplus"><span>Impacto por sobrantes</span><strong>{formatCost(summary.surplusImpact)}</strong><small>{counts.surplus} productos</small></div><div className="inventory-area-kpi"><span>Impacto neto</span><strong>{formatCost(summary.netImpact)}</strong><small>{counts.match} coinciden</small></div></section><section className="inventory-area-controls" aria-label="Búsqueda y filtros"><label className="inventory-area-search"><span aria-hidden="true"><Icono nombre="buscar" /></span><input type="search" aria-label="Buscar por código o producto" placeholder="Buscar por código o producto" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="inventory-area-filters" role="group" aria-label="Filtrar por estado">{Object.entries(STATUS_LABELS).map(([status, label]) => <button key={status} type="button" className={statusFilter === status ? 'active' : ''} aria-pressed={statusFilter === status} onClick={() => setStatusFilter((current) => current === status ? '' : status)}>{label} ({counts[status]})</button>)}</div><p>{filteredRows.length} de {total} productos</p></section><p className="inventory-area-help">Edita solamente <strong>Existencia física</strong> y <strong>Vencimiento</strong>.</p><div className="inventory-area-grid"><DataGrid apiRef={apiRef} rows={filteredRows} columns={columns} processRowUpdate={(row) => row} isCellEditable={(params) => !sending && isInventoryFieldEditable(params.field)} onCellClick={(params, event) => { if (params.colDef.editable && !sending && apiRef.current.getCellMode(params.id, params.field) === 'view') { event.defaultMuiPrevented = true; apiRef.current.startCellEditMode({ id: params.id, field: params.field }) } }} pagination initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick density="compact" localeText={esES.components.MuiDataGrid.defaultProps.localeText} sx={{ border: 0, minWidth: 1000 }} /></div>{!complete && <p className="inventory-area-alert warning">Faltan {incomplete} productos. Completa una existencia física válida; el vencimiento es opcional.</p>}</>}
    <section className="inventory-area-comment-section"><label htmlFor="inventory-correction-comment">Comentario opcional</label><textarea id="inventory-correction-comment" maxLength="1000" disabled={sending} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Agrega una observación para el registro, si es necesaria." /></section><section className="inventory-area-comment-section"><label htmlFor="inventory-correction-reason">Motivo de la corrección</label><textarea id="inventory-correction-reason" maxLength="1000" required disabled={sending} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Indica por qué se corrige el inventario." /></section>{error.includes('recarga') && <button type="button" className="inventory-area-button secondary" onClick={load}>Recargar detalle</button>}<footer className="inventory-area-actions"><button type="submit" className="inventory-area-button primary" disabled={sending || !complete}>{sending ? 'Enviando…' : 'Enviar corrección'}</button></footer>
  </form></main>
}
