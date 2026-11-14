import { useEffect, useMemo, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import InventoryExecutionModal from '../components/InventoryExecutionModal'
import { getHistoryDetail, listHistory } from '../inventoryService'
import './InventoryHistoryPage.css'

const money = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('es-CR')

function label(type) {
  return type === 'inventory_area' ? 'Inventario de área' : 'Inventario de sucursal'
}

function scopeLabel(item) {
  const scope = item.branch ?? item.area
  return scope ? `${scope.code} · ${scope.name}` : 'Sin alcance disponible'
}

function formatDate(value) {
  if (!value) return '—'
  const [date] = String(value).split('T')
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

function statusFor(row) {
  const expected = Number(row.stock ?? row.system_stock ?? row.expected_stock ?? 0)
  const physical = row.physical_stock
  if (physical === null || physical === undefined || physical === '') return { label: 'Pendiente', tone: 'pending', difference: null, impact: null }
  const difference = Number(physical) - expected
  const impact = difference * Number(row.cost ?? 0)
  if (difference === 0) return { label: 'Coincide', tone: 'match', difference, impact }
  return difference < 0 ? { label: 'Faltante', tone: 'shortage', difference, impact } : { label: 'Sobrante', tone: 'surplus', difference, impact }
}

function detailRows(rows) {
  return (rows ?? []).map((row, index) => ({ ...row, id: row.code ?? row.product ?? index, ...statusFor(row) }))
}

function DetailKpis({ rows }) {
  const summary = rows.reduce((total, row) => ({
    products: total.products + 1,
    shortages: total.shortages + (row.tone === 'shortage' ? 1 : 0),
    surpluses: total.surpluses + (row.tone === 'surplus' ? 1 : 0),
    impact: total.impact + (row.impact ?? 0),
  }), { products: 0, shortages: 0, surpluses: 0, impact: 0 })
  return <div className="inventory-history-kpis inventory-history-kpis-detail" aria-label="Resumen de la versión">
    <Kpi label="Productos" value={number.format(summary.products)} />
    <Kpi label="Faltantes" value={number.format(summary.shortages)} tone="shortage" />
    <Kpi label="Sobrantes" value={number.format(summary.surpluses)} tone="surplus" />
    <Kpi label="Impacto neto" value={money.format(summary.impact)} tone={summary.impact < 0 ? 'shortage' : summary.impact > 0 ? 'surplus' : 'match'} />
  </div>
}

function Kpi({ label: title, value, tone = '' }) {
  return <div className={`inventory-history-kpi ${tone}`}><span>{title}</span><strong>{value}</strong></div>
}

export default function InventoryHistoryPage() {
  const [history, setHistory] = useState([])
  const [filterContext, setFilterContext] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [selectedRevision, setSelectedRevision] = useState(null)
  const [correction, setCorrection] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [date, setDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [areaId, setAreaId] = useState('')

  async function load(scope = {}) {
    setLoading(true); setError('')
    try {
      const result = await listHistory(scope)
      setHistory(result.submissions ?? [])
      setFilterContext(result.filter_context ?? {})
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void Promise.resolve().then(() => load()) }, [])

  const visibleHistory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return history.filter((item) => {
      const text = [item.task_name, item.branch?.code, item.branch?.name, item.area?.code, item.area?.name].filter(Boolean).join(' ').toLocaleLowerCase()
      return (!query || text.includes(query)) && (!type || item.inventory_type === type) && (!date || String(item.execution_date).startsWith(date))
    })
  }, [date, history, search, type])

  const summary = useMemo(() => visibleHistory.reduce((total, item) => ({
    submissions: total.submissions + 1,
    products: total.products + Number(item.product_count ?? 0),
    shortages: total.shortages + Number(item.shortage_count ?? 0),
    surpluses: total.surpluses + Number(item.surplus_count ?? 0),
    impact: total.impact + Number(item.net_impact ?? 0),
  }), { submissions: 0, products: 0, shortages: 0, surpluses: 0, impact: 0 }), [visibleHistory])

  async function openDetail(id) {
    setError('')
    try {
      const item = (await getHistoryDetail(id)).submission
      setDetail(item)
      setSelectedRevision(item.revisions?.at(-1)?.number ?? null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function reloadCorrection() {
    if (!correction) return
    try {
      const item = (await getHistoryDetail(correction.id)).submission
      setDetail(item)
      setCorrection(item)
      setSelectedRevision(item.revisions?.at(-1)?.number ?? null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const currentRevision = detail?.revisions?.find((revision) => revision.number === selectedRevision) ?? detail?.revisions?.at(-1)
  const rows = detailRows(currentRevision?.rows)
  const columns = [
    { field: 'code', headerName: 'Código', width: 110 },
    { field: 'product', headerName: 'Producto', flex: 1, minWidth: 180 },
    { field: 'cost', headerName: 'Costo', width: 125, valueFormatter: (value) => money.format(Number(value ?? 0)) },
    { field: 'stock', headerName: 'Esperado', width: 105, valueGetter: (_value, row) => row.stock ?? row.system_stock ?? row.expected_stock ?? 0 },
    { field: 'physical_stock', headerName: 'Existencia física', width: 145 },
    { field: 'expiration_date', headerName: 'Vencimiento', width: 125, valueFormatter: (value) => formatDate(value) },
    { field: 'difference', headerName: 'Diferencia', width: 110, valueFormatter: (value) => value == null ? '—' : number.format(value) },
    { field: 'label', headerName: 'Estado', width: 125, renderCell: (params) => <span className={`inventory-history-status ${params.row.tone}`}>{params.value}</span> },
    { field: 'impact', headerName: 'Impacto', width: 135, valueFormatter: (value) => value == null ? '—' : money.format(value) },
  ]

  return <section className="tema-analiza tuvet-page inventory-history-page">
    <PageHeader title="Historial de inventarios" description="Consulta conteos enviados, identifica variaciones y revisa cada versión sin exponer datos técnicos." />
    <Aviso tipo="error">{error}</Aviso>
    <EstadoCarga loading={loading} error={error} onRetry={load}>
      <section className="inventory-history-toolbar" aria-label="Filtros de historial">
        <label>Buscar<input className="tuvet-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tarea, sucursal o área" /></label>
        <label>Tipo<select className="tuvet-input" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option><option value="inventory_branch">Inventario de sucursal</option><option value="inventory_area">Inventario de área</option></select></label>
        <label>Fecha<input className="tuvet-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {Array.isArray(filterContext.branches) && <label>Sucursal<select className="tuvet-input" value={branchId} onChange={(event) => { const next = event.target.value; setBranchId(next); void load(next ? { branchId: next } : {}) }}><option value="">Todas las sucursales</option>{filterContext.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label>}
        {Array.isArray(filterContext.areas) && <label>Área<select className="tuvet-input" value={areaId} onChange={(event) => { const next = event.target.value; setAreaId(next); void load(next ? { areaId: next } : {}) }}><option value="">Todas las áreas</option>{filterContext.areas.map((area) => <option key={area.id} value={area.id}>{area.code} · {area.name}</option>)}</select></label>}
      </section>
      <div className="inventory-history-kpis" aria-label="Resumen del historial visible">
        <Kpi label="Envíos" value={number.format(summary.submissions)} />
        <Kpi label="Productos contados" value={number.format(summary.products)} />
        <Kpi label="Faltantes" value={number.format(summary.shortages)} tone="shortage" />
        <Kpi label="Sobrantes" value={number.format(summary.surpluses)} tone="surplus" />
        <Kpi label="Impacto neto" value={money.format(summary.impact)} tone={summary.impact < 0 ? 'shortage' : summary.impact > 0 ? 'surplus' : 'match'} />
      </div>
      {visibleHistory.length === 0 ? <p className="tuvet-muted">No hay inventarios que coincidan con los filtros.</p> : <div className="inventory-history-list" role="table" aria-label="Historial de inventarios"><div className="inventory-history-list-head" role="row"><span>Fecha</span><span>Tarea</span><span>Alcance</span><span>Tipo</span><span>Productos</span><span>Faltantes</span><span>Sobrantes</span><span>Impacto neto</span><span>Versión</span><span /></div>{visibleHistory.map((item) => <div className="inventory-history-list-row" role="row" key={item.id}><span>{formatDate(item.execution_date)}</span><strong>{item.task_name}</strong><span>{scopeLabel(item)}</span><span>{label(item.inventory_type)}</span><span>{number.format(item.product_count ?? 0)}</span><span className="inventory-history-negative">{number.format(item.shortage_count ?? 0)}</span><span className="inventory-history-positive">{number.format(item.surplus_count ?? 0)}</span><span>{money.format(item.net_impact ?? 0)}</span><span>v{item.latest_revision}</span><button className="tuvet-btn tuvet-btn-secondary" type="button" onClick={() => void openDetail(item.id)}>Ver detalle</button></div>)}</div>}
    </EstadoCarga>
    {detail && <section className="inventory-history-detail" aria-label="Detalle de inventario">
      <div className="inventory-history-detail-heading"><div><p className="inventory-history-eyebrow">Detalle de inventario</p><h2>{detail.task_name}</h2><p>{formatDate(detail.execution_date)} · {scopeLabel(detail)} · {label(detail.inventory_type)} · Versión {detail.latest_revision}</p></div><button className="tuvet-btn tuvet-btn-secondary" type="button" onClick={() => setDetail(null)}>Cerrar detalle</button></div>
      <div className="inventory-history-timeline" role="tablist" aria-label="Versiones del envío">{detail.revisions?.map((revision) => <button key={revision.number} type="button" role="tab" aria-selected={revision.number === currentRevision?.number} className={revision.number === currentRevision?.number ? 'selected' : ''} onClick={() => setSelectedRevision(revision.number)}>{revision.number === 1 ? 'Envío inicial' : `Corrección ${revision.number - 1}`}</button>)}</div>
      {currentRevision && <><DetailKpis rows={rows} /><div className="inventory-history-revision-note"><p><strong>{currentRevision.number === 1 ? 'Envío inicial' : `Corrección ${currentRevision.number - 1}`}</strong> · {formatDate(currentRevision.submitted_at)}</p>{currentRevision.comment && <p>Comentario: {currentRevision.comment}</p>}{currentRevision.correction_reason && <p>Motivo de corrección: {currentRevision.correction_reason}</p>}</div><div className="inventory-history-grid"><DataGrid autoHeight disableRowSelectionOnClick rows={rows} columns={columns} pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} /></div></>}
      {detail.can_correct === true && <div className="inventory-history-correction"><button className="tuvet-btn" type="button" onClick={() => setCorrection(detail)}>Corregir</button></div>}
    </section>}
    {correction && <InventoryExecutionModal occurrence={{ nombre: label(correction.inventory_type) }} mode={correction.inventory_type === 'inventory_area' ? 'area' : 'branch'} correction={correction} onClose={() => setCorrection(null)} onReload={reloadCorrection} onSuccess={() => { setCorrection(null); void load() }} />}
  </section>
}
