import { useEffect, useRef, useState } from 'react'
import { Aviso, EstadoCarga, Modal, PageHeader } from '../../tuvet/components/TuvetUi'
import { getGOAllAreasPerformanceHistory, getGOAreaPerformanceHistory, getGOAuthorizedAreas, getGOOccurrenceDetail, getGOOccurrences, getGOResponsibilityGaps } from '../services/goPerformanceHistoryService'
import GAMonthlyEvaluationPanel from '../../gaMonthlyEvaluations/components/GAMonthlyEvaluationPanel'
import '../../tuvet/tuvet.css'
import './GOAreaPerformanceHistoryPage.css'

const PAGE_SIZE = 25
const ALL_AREAS_VALUE = '__all_areas__'
const OCCURRENCE_STATUS = {
  pendiente: { label: 'Pendiente', tone: 'pending' },
  pending: { label: 'Pendiente', tone: 'pending' },
  completada: { label: 'Completada', tone: 'completed' },
  completed: { label: 'Completada', tone: 'completed' },
  aprobada: { label: 'Completada', tone: 'completed' },
  approved: { label: 'Completada', tone: 'completed' },
  vencida: { label: 'Vencida', tone: 'overdue' },
  overdue: { label: 'Vencida', tone: 'overdue' },
  justificada: { label: 'Justificada', tone: 'justified' },
  justified: { label: 'Justificada', tone: 'justified' },
  diferida: { label: 'Diferida', tone: 'deferred' },
  deferred: { label: 'Diferida', tone: 'deferred' },
}
const MANUAL_CLASSIFICATION_LABELS = {
  qualitative: 'Cualitativa',
  quantitative: 'Cuantitativa',
}
const EVIDENCE_ACTION_ROUTES = {
  inventory_area: { path: '/evidencia-go/inventario', label: 'Ver inventario de área' },
  manual_inventory_area: { path: '/evidencia-go/inventario', label: 'Ver inventario de área' },
  deposit_review: { path: '/evidencia-go/depositos', label: 'Ver revisión de depósitos' },
}

function evidenceActionRejection(action) {
  const route = EVIDENCE_ACTION_ROUTES[action?.type]
  const reference = typeof action?.reference === 'string' ? action.reference.trim() : ''
  if (!route) return 'unknown_type'
  if (!reference) return 'missing_reference'
  if (/^(?:[a-z][a-z\d+.-]*:|[/\\]{1,2})/i.test(reference)) return 'url_like_reference'
  return null
}

function safeEvidenceAction(action) {
  if (evidenceActionRejection(action)) return null
  const route = EVIDENCE_ACTION_ROUTES[action.type]
  const reference = action.reference.trim()
  return { ...route, type: action.type, reference }
}

function manualEvidenceAction(occurrence) {
  if (occurrence?.provenance !== 'manual_catalog' || occurrence?.latest_status !== 'completed') return null
  const actions = Array.isArray(occurrence?.structured_evidence) ? occurrence.structured_evidence : []
  return actions.map(safeEvidenceAction).find((action) => action?.type === 'manual_inventory_area') ?? null
}

function diagnosticActions(actions) {
  return Array.isArray(actions) ? actions.map((action) => {
    const reference = typeof action?.reference === 'string' ? action.reference.trim() : ''
    return {
      type: typeof action?.type === 'string' ? action.type : null,
      reference_present: Boolean(reference),
      reference_length: reference.length,
    }
  }) : []
}

function diagnosticRejectedActions(actions) {
  return Array.isArray(actions) ? actions.map((action) => {
    const rejectionReason = evidenceActionRejection(action)
    return rejectionReason ? { ...diagnosticActions([action])[0], rejection_reason: rejectionReason } : null
  }).filter(Boolean) : []
}

function logEvidenceDiagnostic(event, data) {
  if (import.meta.env.DEV || import.meta.env.VITE_GO_EVIDENCE_DIAGNOSTICS === 'true') {
    console.info('[GO evidence diagnostic]', event, data)
  }
}

function diagnosticDetail(detail) {
  return {
    ...detail,
    evidence_actions: diagnosticActions(detail?.evidence_actions),
  }
}

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(start, end) {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  return (endYear - startYear) * 12 + (endMonth - startMonth)
}

function rangeMessage(fromMonth, toMonth) {
  if (!fromMonth || !toMonth || fromMonth > toMonth || monthsBetween(fromMonth, toMonth) >= 24) {
    return 'El rango debe ser menor de 24 meses y la fecha inicial no puede ser posterior a la final.'
  }
  return ''
}

function areaLabel(area) {
  const label = [area?.codigo, area?.nombre].filter(Boolean).join(' · ') || 'Área sin nombre'
  return area?.activo === false ? `${label} · Inactiva` : label
}

function formatMonth(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return '—'
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatDateParts(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    date: new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat('es', { timeStyle: 'short' }).format(date),
  }
}

function isNotApplicable(performance) {
  return performance?.state === 'not_applicable'
}

function formatCompactDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function performanceStatus(performance) {
  if (isNotApplicable(performance)) return { label: 'No aplica', tone: 'neutral' }
  if (performance?.kind === 'definitive') return { label: 'Definitivo', tone: 'definitive' }
  if (performance?.kind === 'provisional') return { label: 'Provisional', tone: 'provisional' }
  return { label: 'Estado no disponible', tone: 'neutral' }
}

function evaluationActionLabel(row) {
  if (row?.monthly_evaluation === null) return 'Evaluar GA'
  if (row?.monthly_evaluation) return 'Gestionar evaluación'
  return 'Gestionar evaluación mensual'
}

function displayValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`
}

function openEvidenceAction(action) {
  window.open(`${action.path}/${encodeURIComponent(action.reference)}`, '_blank', 'noopener,noreferrer')
}

function normalizeError(error, fallback) {
  if (error?.status === 403) return 'No tienes autorización para consultar este historial. El servidor mantiene la autorización para cada Área y rango solicitado.'
  return fallback
}

function managerLabel(responsibility) {
  const name = responsibility?.manager?.display_name
  return typeof name === 'string' && name.trim() ? name : 'Gerente histórico no disponible'
}

function rangeDates(fromMonth, toMonth) {
  const [year, month] = toMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { fromDate: `${fromMonth}-01`, toDate: `${toMonth}-${String(lastDay).padStart(2, '0')}` }
}

function occurrenceItems(data) {
  return Array.isArray(data?.results) ? data.results : (Array.isArray(data?.occurrences) ? data.occurrences : [])
}

function occurrenceId(occurrence) {
  const id = occurrence?.id
  return id === null || id === undefined || id === '' ? null : String(id)
}

function occurrenceStatus(status) {
  return OCCURRENCE_STATUS[status] ?? { label: 'Estado no disponible', tone: 'neutral' }
}

function manualClassificationLabel(classification) {
  return MANUAL_CLASSIFICATION_LABELS[classification] ?? displayValue(classification)
}

function revisionHistory(detail) {
  const history = Array.isArray(detail?.revision_history) ? detail.revision_history : []
  const latest = detail?.latest_revision
  if (!latest?.effective_at) return history
  return history.some((revision) => revision?.effective_at === latest.effective_at) ? history : [...history, latest]
}

function uniqueOccurrences(items, existing = []) {
  const knownIds = new Set(existing.map(occurrenceId).filter(Boolean))
  return [...existing, ...items.filter((item) => {
    const id = occurrenceId(item)
    if (!id || knownIds.has(id)) return false
    knownIds.add(id)
    return true
  })]
}

function HistoryRow({ row, onOccurrences, onEvaluation }) {
  const performance = row?.performance ?? {}
  const notApplicable = isNotApplicable(performance)
  const status = performanceStatus(performance)
  const updated = formatDateParts(performance.as_of)

  return (
    <tr>
      <td className="go-performance-area" data-label="Área"><strong>{areaLabel(row?.area)}</strong><span>{managerLabel(row?.responsibility)}</span></td>
      <td className="go-performance-number" data-label="Rendimiento">{notApplicable ? 'No aplica' : displayValue(performance.percentage, '%')}</td>
      <td data-label="Estado"><span className={`go-performance-state go-performance-state-${status.tone}`}>{status.label}</span></td>
      <td className="go-performance-updated" data-label="Actualizado">{updated ? <><span>{updated.date}</span><span>{updated.time}</span></> : '—'}</td>
      <td className="go-performance-actions-cell" data-label="Acciones"><div className="go-performance-row-actions">{row?.responsibility?.manager?.id ? <button type="button" className="tuvet-btn go-performance-row-action" onClick={() => onEvaluation(row)}>{evaluationActionLabel(row)}</button> : null}<button type="button" className="tuvet-btn tuvet-btn-link go-performance-evidence-action" onClick={() => onOccurrences(row)}>Ver evidencia de ocurrencias</button></div></td>
    </tr>
  )
}

function performanceSummary(rows) {
  return rows.reduce((summary, row) => {
    const status = performanceStatus(row?.performance)
    summary.total += 1
    if (status.tone === 'definitive') summary.definitive += 1
    else if (status.tone === 'provisional') summary.provisional += 1
    else if (status.tone === 'neutral' && isNotApplicable(row?.performance)) summary.notApplicable += 1
    return summary
  }, { total: 0, definitive: 0, provisional: 0, notApplicable: 0 })
}

export default function GOAreaPerformanceHistoryPage() {
  const [initialMonth] = useState(currentMonth)
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState('')
  const [fromMonth, setFromMonth] = useState(initialMonth)
  const [toMonth, setToMonth] = useState(initialMonth)
  const [rows, setRows] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [occurrenceModal, setOccurrenceModal] = useState(null)
  const [occurrences, setOccurrences] = useState([])
  const [occurrenceCursor, setOccurrenceCursor] = useState(null)
  const [manualOccurrences, setManualOccurrences] = useState([])
  const [evidenceTab, setEvidenceTab] = useState('scheduled')
  const [expandedManualOccurrenceId, setExpandedManualOccurrenceId] = useState(null)
  const [occurrencesLoading, setOccurrencesLoading] = useState(false)
  const [occurrencesLoadingMore, setOccurrencesLoadingMore] = useState(false)
  const [occurrencesError, setOccurrencesError] = useState('')
  const [occurrencesLoadMoreError, setOccurrencesLoadMoreError] = useState('')
  const [occurrenceDetail, setOccurrenceDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [issuedOccurrenceIds, setIssuedOccurrenceIds] = useState(() => new Set())
  const [gapModalOpen, setGapModalOpen] = useState(false)
  const [evaluationModal, setEvaluationModal] = useState(null)
  const [gaps, setGaps] = useState([])
  const [gapCursor, setGapCursor] = useState(null)
  const [gapsLoading, setGapsLoading] = useState(false)
  const [gapsError, setGapsError] = useState('')
  const latestRequest = useRef(0)
  const latestOccurrencesRequest = useRef(0)

  const allAreasSelected = areaId === ALL_AREAS_VALUE
  const summary = performanceSummary(rows)
  const hasManualOccurrences = manualOccurrences.length > 0

  function resetRangePresentation() {
    latestOccurrencesRequest.current += 1
    setRows([])
    setNextCursor(null)
    setError('')
    setOccurrenceModal(null)
    resetOccurrences()
    setGapModalOpen(false)
    setEvaluationModal(null)
    setGaps([])
    setGapCursor(null)
    setGapsError('')
    setGapsLoading(false)
  }

  async function loadRange({ requestedAreaId = areaId, cursor, append = false, explicit = false } = {}) {
    const invalid = rangeMessage(fromMonth, toMonth)
    if (invalid) {
      setRangeError(invalid)
      return
    }
    setRangeError('')
    setError('')
    const requestId = ++latestRequest.current
    if (!append) resetRangePresentation()
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      let effectiveAreaId = requestedAreaId
      if (!append) {
        const areaData = await getGOAuthorizedAreas({ fromMonth, toMonth })
        const authorizedAreas = Array.isArray(areaData?.results) ? areaData.results : []
        if (requestId !== latestRequest.current) return
        setAreas(authorizedAreas)
        effectiveAreaId = requestedAreaId === ALL_AREAS_VALUE
          ? ALL_AREAS_VALUE
          : authorizedAreas.some((area) => String(area.id) === String(requestedAreaId))
          ? String(requestedAreaId)
          : ALL_AREAS_VALUE
        setAreaId(effectiveAreaId)
        if (authorizedAreas.length === 0) {
          setRows([])
          setNextCursor(null)
          return
        }
      }
      const data = effectiveAreaId === ALL_AREAS_VALUE
        ? await getGOAllAreasPerformanceHistory({ fromMonth, toMonth, cursor, limit: PAGE_SIZE })
        : await getGOAreaPerformanceHistory({ areaId: effectiveAreaId, fromMonth, toMonth, cursor, limit: PAGE_SIZE })
      if (requestId !== latestRequest.current) return
      setRows((previous) => append ? [...previous, ...(data?.results ?? [])] : (data?.results ?? []))
      setNextCursor(data?.next_cursor ?? null)
    } catch (requestError) {
      if (requestId === latestRequest.current) setError(normalizeError(requestError, explicit ? 'No fue posible actualizar el historial de rendimiento de áreas.' : 'No fue posible cargar el historial de rendimiento de áreas.'))
    } finally {
      if (requestId === latestRequest.current) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { loadRange() }, 0)
    return () => window.clearTimeout(timer)
  // The initial current-month consultation is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(event) {
    event.preventDefault()
    loadRange({ explicit: true })
  }

  function retry() {
    loadRange({ explicit: true })
  }

  function selectArea(event) {
    const selectedAreaId = event.target.value
    setAreaId(selectedAreaId)
    resetRangePresentation()
    if (selectedAreaId === ALL_AREAS_VALUE) void loadRange({ requestedAreaId: selectedAreaId, explicit: true })
  }

  function resetOccurrences() {
    setOccurrences([])
    setOccurrenceCursor(null)
    setManualOccurrences([])
    setEvidenceTab('scheduled')
    setExpandedManualOccurrenceId(null)
    setOccurrenceDetail(null)
    setOccurrencesError('')
    setOccurrencesLoadMoreError('')
    setDetailError('')
    setOccurrencesLoading(false)
    setOccurrencesLoadingMore(false)
    setIssuedOccurrenceIds(new Set())
  }

  async function loadOccurrences(row, { cursor, append = false } = {}) {
    const requestId = ++latestOccurrencesRequest.current
    if (append) {
      setOccurrencesLoadingMore(true)
      setOccurrencesLoadMoreError('')
    } else {
      setOccurrencesLoading(true)
      setOccurrencesError('')
    }

    try {
      const data = await getGOOccurrences({ areaId: row?.area?.id, responsibilityId: row?.responsibility?.id, fromMonth: row?.period, toMonth: row?.period, cursor, limit: PAGE_SIZE })
      if (requestId !== latestOccurrencesRequest.current) return
      const nextOccurrences = append ? uniqueOccurrences(occurrenceItems(data), occurrences) : uniqueOccurrences(occurrenceItems(data))
      setOccurrences(nextOccurrences)
      if (!append) setManualOccurrences(Array.isArray(data?.manual_results) ? data.manual_results : [])
      setIssuedOccurrenceIds(new Set(nextOccurrences.map(occurrenceId).filter(Boolean)))
      setOccurrenceCursor(data?.next_cursor ?? null)
    } catch (error) {
      if (requestId !== latestOccurrencesRequest.current) return
      if (append) setOccurrencesLoadMoreError('No fue posible cargar más ocurrencias.')
      else setOccurrencesError(normalizeError(error, 'No fue posible cargar la evidencia de ocurrencias autorizadas.'))
    } finally {
      if (requestId === latestOccurrencesRequest.current) {
        if (append) setOccurrencesLoadingMore(false)
        else setOccurrencesLoading(false)
      }
    }
  }

  function openOccurrences(row) {
    resetOccurrences()
    setOccurrenceModal(row)
    void loadOccurrences(row)
  }

  function retryMoreOccurrences() {
    if (occurrenceModal && occurrenceCursor) void loadOccurrences(occurrenceModal, { cursor: occurrenceCursor, append: true })
  }

  async function openOccurrenceDetail(occurrence) {
    const id = String(occurrence?.id ?? '')
    if (!issuedOccurrenceIds.has(id)) return
    const evidenceActions = Array.isArray(occurrence?.structured_evidence) ? occurrence.structured_evidence : []
    logEvidenceDiagnostic('occurrence selected', { occurrence_id: id, structured_evidence: diagnosticActions(evidenceActions) })
    setDetailLoading(true)
    setDetailError('')
    try {
      const detail = await getGOOccurrenceDetail(id)
      logEvidenceDiagnostic('fetched detail', diagnosticDetail(detail))
      const detailWithEvidence = {
        ...detail,
        evidence_actions: evidenceActions,
      }
      const eligibleActions = evidenceActions.map(safeEvidenceAction).filter(Boolean)
      logEvidenceDiagnostic('state evidence actions', { evidence_actions: diagnosticActions(detailWithEvidence.evidence_actions) })
      logEvidenceDiagnostic('eligible actions', { actions: diagnosticActions(eligibleActions) })
      logEvidenceDiagnostic('rejected actions', { actions: diagnosticRejectedActions(evidenceActions) })
      setOccurrenceDetail(detailWithEvidence)
    } catch (error) {
      setDetailError(normalizeError(error, 'No fue posible cargar el detalle de la ocurrencia autorizada.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeOccurrences() {
    latestOccurrencesRequest.current += 1
    resetOccurrences()
    setOccurrenceModal(null)
  }

  async function loadGaps({ cursor, append = false } = {}) {
    const dates = rangeDates(fromMonth, toMonth)
    setGapsLoading(true)
    setGapsError('')
    try {
      const data = await getGOResponsibilityGaps({ areaId, ...dates, cursor, limit: PAGE_SIZE })
      const items = Array.isArray(data?.results) ? data.results : []
      setGaps((previous) => append ? [...previous, ...items] : items)
      setGapCursor(data?.next_cursor ?? null)
    } catch (error) {
      setGapsError(normalizeError(error, 'No fue posible cargar las brechas de responsabilidad del Área.'))
    } finally {
      setGapsLoading(false)
    }
  }

  function openGaps() {
    if (allAreasSelected) return
    setGapModalOpen(true)
    setGaps([])
    setGapCursor(null)
    void loadGaps()
  }

  function openEvaluation(row) {
    if (!row?.responsibility?.manager?.id || !row?.period) return
    setEvaluationModal(row)
  }

  return (
    <main className="tema-analiza tuvet-page go-area-performance-history" data-responsive-breakpoints="375 768 1024 1440">
      <PageHeader title="Rendimiento de áreas" />
      <form className="go-performance-filters" onSubmit={submit} aria-label="Filtros del historial de rendimiento de áreas">
        <div className="go-performance-field">
          <label htmlFor="go-performance-area">Área</label>
          <select id="go-performance-area" value={areaId} onChange={selectArea} disabled={loading || areas.length === 0}>
            <option value={ALL_AREAS_VALUE}>Todos</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{areaLabel(area)}</option>)}
          </select>
        </div>
        <div className="go-performance-field"><label htmlFor="go-performance-from">Desde</label><input id="go-performance-from" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></div>
        <div className="go-performance-field"><label htmlFor="go-performance-to">Hasta</label><input id="go-performance-to" type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} /></div>
        <div className="go-performance-actions" role="group" aria-label="Consultas del historial seleccionado">
          <button type="submit" className="tuvet-btn" disabled={loading}>Consultar historial</button>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={openGaps} disabled={loading || !areaId || allAreasSelected}>Consultar brechas de responsabilidad del Área</button>
        </div>
      </form>
      {allAreasSelected && <p className="go-performance-helper">Selecciona un Área específica para consultar brechas de responsabilidad.</p>}
      {rangeError && <Aviso tipo="warning">{rangeError}</Aviso>}

      <EstadoCarga loading={loading} error={error} onRetry={retry} empty={!loading && !error && areas.length === 0} emptyText="No hay áreas autorizadas para el rango seleccionado.">
        {areas.length > 0 && rows.length === 0 && !loading ? <div className="go-performance-empty">{allAreasSelected ? 'No hay Áreas autorizadas para el rango seleccionado.' : 'No hay resultados para el Área y período seleccionados.'}</div> : (
          <>
            <section className="go-performance-summary" aria-label="Resumen de resultados"><span><strong>{summary.total}</strong> Áreas</span><span><strong>{summary.definitive}</strong> definitivos</span><span><strong>{summary.provisional}</strong> provisionales</span><span><strong>{summary.notApplicable}</strong> no aplica</span></section>
            <div className="go-performance-table-wrap" tabIndex="0" aria-label="Resultados del historial de rendimiento de áreas">
              <table className="go-performance-table">
                <thead><tr><th className="go-performance-area">Área y Gerente de Área</th><th>Rendimiento</th><th>Estado</th><th className="go-performance-updated">Actualizado</th><th>Acciones</th></tr></thead>
                <tbody>{rows.map((row, index) => <HistoryRow key={`${row?.area?.id ?? 'area'}-${row?.responsibility?.id ?? index}-${row?.period ?? 'period'}`} row={row} onOccurrences={openOccurrences} onEvaluation={openEvaluation} />)}</tbody>
              </table>
            </div>
          </>
        )}
        {nextCursor && <button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-load-more" onClick={() => loadRange({ cursor: nextCursor, append: true })} disabled={loadingMore}>{loadingMore ? 'Cargando más…' : 'Cargar más'}</button>}
      </EstadoCarga>
      {occurrenceModal && <Modal title="Evidencia de ocurrencias" subtitle="Consulta de solo lectura autorizada para el segmento seleccionado." icon="archivo" wide onClose={closeOccurrences} footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={closeOccurrences}>Cerrar</button>}>
        {occurrenceDetail ? (() => {
          const currentStatus = occurrenceStatus(occurrenceDetail?.latest_revision?.status)
          const revisions = revisionHistory(occurrenceDetail)
          const currentRevision = occurrenceDetail?.latest_revision?.effective_at
          return <div className="go-evidence-detail">
            <button type="button" className="tuvet-btn tuvet-btn-link go-evidence-back" onClick={() => { setOccurrenceDetail(null); setDetailError('') }}>Volver a la lista</button>
            <header className="go-evidence-detail-header"><div><h3>{occurrenceDetail?.task?.title ?? 'Tarea sin título disponible'}</h3><p>Actualizada {formatCompactDate(currentRevision)}</p></div><span className={`go-evidence-detail-status go-evidence-record-status-${currentStatus.tone}`}>{currentStatus.label}</span></header>
            <section className="go-evidence-detail-section" aria-labelledby="go-evidence-detail-metadata-title">
              <h4 id="go-evidence-detail-metadata-title">Detalles de la ocurrencia</h4>
              <dl className="go-evidence-detail-metadata"><div><dt>Fecha de origen</dt><dd>{formatDate(occurrenceDetail?.origin_date_local)}</dd></div><div><dt>Mes de atribución</dt><dd>{formatMonth(occurrenceDetail?.attribution_month)}</dd></div><div><dt>Peso congelado</dt><dd>{displayValue(occurrenceDetail?.frozen_weight)}</dd></div></dl>
            </section>
            <section className="go-evidence-detail-timeline" aria-labelledby="go-evidence-detail-history-title">
              <h4 id="go-evidence-detail-history-title">Historial de revisiones</h4>
              <ol className="go-evidence-revision-list" aria-label="Historial de revisiones">{revisions.map((revision, index) => { const status = occurrenceStatus(revision?.status); const isCurrent = revision?.effective_at === currentRevision; return <li key={`${revision?.effective_at ?? 'revision'}-${index}`} className={isCurrent ? 'is-current' : ''}><span className={`go-evidence-revision-marker go-evidence-record-status-${status.tone}`} aria-hidden="true" /><div><strong>{status.label}</strong><time dateTime={revision?.effective_at ?? undefined}>{formatCompactDate(revision?.effective_at)}</time></div>{isCurrent ? <span className="go-evidence-current-label">Estado actual</span> : null}</li> })}</ol>
            </section>
            {(occurrenceDetail.evidence_actions ?? []).map(safeEvidenceAction).filter(Boolean).map((action) => <button key={`${action.path}-${action.reference}`} type="button" className="tuvet-btn tuvet-btn-secondary go-evidence-action" onClick={() => openEvidenceAction(action)}>{action.label}</button>)}
          </div>
        })() : <EstadoCarga loading={occurrencesLoading || detailLoading} error={occurrencesError || detailError} onRetry={() => { if (detailError) setOccurrenceDetail(null); else openOccurrences(occurrenceModal) }} empty={!occurrencesLoading && !occurrencesError && occurrences.length === 0 && manualOccurrences.length === 0} emptyText="No hay ocurrencias autorizadas para este segmento.">
          <div className="go-evidence-tabs" role="tablist" aria-label="Tipo de evidencia">
            <button id="go-evidence-scheduled-tab" type="button" role="tab" aria-selected={evidenceTab === 'scheduled'} aria-controls="go-evidence-scheduled-panel" onClick={() => setEvidenceTab('scheduled')}>Tareas programadas <span>{occurrences.length}</span></button>
            {hasManualOccurrences && <button id="go-evidence-manual-tab" type="button" role="tab" aria-selected={evidenceTab === 'manual'} aria-controls="go-evidence-manual-panel" onClick={() => setEvidenceTab('manual')}>Tareas registradas de forma manual <span>{manualOccurrences.length}</span></button>}
          </div>
          {evidenceTab === 'scheduled' && <section id="go-evidence-scheduled-panel" role="tabpanel" aria-labelledby="go-evidence-scheduled-tab">
            <ul className="go-evidence-list">{occurrences.map((occurrence) => {
              const status = occurrenceStatus(occurrence?.latest_status)
              return <li key={occurrenceId(occurrence)}><button type="button" className="tuvet-btn tuvet-btn-secondary go-evidence-record" onClick={() => void openOccurrenceDetail(occurrence)}><span className="go-evidence-record-title">{occurrence?.task?.title ?? 'Ocurrencia autorizada'}</span><span className="go-evidence-record-meta"><span className="go-evidence-record-date-meta"><span>Fecha de origen</span><time className="go-evidence-record-date" dateTime={occurrence?.origin_date_local ?? undefined}>{formatDate(occurrence?.origin_date_local)}</time></span><span className={`go-evidence-record-status go-evidence-record-status-${status.tone}`} aria-label={`Estado: ${status.label}`}>{status.label}</span></span></button></li>
            })}</ul>
          </section>}
          {hasManualOccurrences && evidenceTab === 'manual' && <section id="go-evidence-manual-panel" role="tabpanel" aria-labelledby="go-evidence-manual-tab">
            <ul className="go-evidence-list">{manualOccurrences.map((occurrence, index) => {
              const adHoc = occurrence?.provenance === 'ad_hoc'
              const title = adHoc ? occurrence?.name : occurrence?.task?.title
              const status = occurrenceStatus(occurrence?.latest_status)
              const evidenceAction = manualEvidenceAction(occurrence)
              const itemId = `manual-${occurrence?.provenance ?? 'unknown'}-${occurrence?.id ?? index}`
              const expanded = expandedManualOccurrenceId === itemId
              return <li key={itemId} className="go-evidence-record go-evidence-record--manual">
                <span className="go-evidence-record-title">{title ?? 'Entrada manual'}</span>
                <span className="go-evidence-record-meta"><span>Fecha: {formatDate(occurrence?.origin_date_local)}</span><span className={`go-evidence-record-status go-evidence-record-status-${status.tone}`} aria-label={`Estado: ${status.label}`}>{status.label}</span></span>
                {evidenceAction && <button type="button" className="tuvet-btn tuvet-btn-secondary go-evidence-action" onClick={() => openEvidenceAction(evidenceAction)}>{evidenceAction.label}</button>}
                <button type="button" className="tuvet-btn tuvet-btn-link go-evidence-manual-detail-toggle" aria-expanded={expanded} aria-controls={`${itemId}-details`} onClick={() => setExpandedManualOccurrenceId(expanded ? null : itemId)} aria-label={`Ver información de ${title ?? 'entrada manual'}`}>Ver información</button>
                {expanded && <dl id={`${itemId}-details`} className="go-evidence-manual-details">
                  {!adHoc && <><div><dt>Clasificación</dt><dd>{manualClassificationLabel(occurrence?.classification)}</dd></div><div><dt>Peso congelado</dt><dd>{displayValue(occurrence?.frozen_weight)}</dd></div>{occurrence?.planning_note ? <div className="go-evidence-manual-details-wide"><dt>Nota de planificación</dt><dd>{occurrence.planning_note}</dd></div> : null}</>}
                  {adHoc && occurrence?.description ? <div className="go-evidence-manual-details-wide"><dt>Descripción</dt><dd>{occurrence.description}</dd></div> : null}
                  <div><dt>Creada el</dt><dd>{formatDate(occurrence?.created_at)}</dd></div>
                  {occurrence?.cancelled_at ? <div><dt>Cancelada el</dt><dd>{formatDate(occurrence.cancelled_at)}</dd></div> : null}
                </dl>}
              </li>
            })}</ul>
          </section>}
          {occurrenceCursor && <div className="go-evidence-pagination">
            {occurrencesLoadMoreError && <Aviso tipo="warning">{occurrencesLoadMoreError}</Aviso>}
            <button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-load-more" onClick={retryMoreOccurrences} disabled={occurrencesLoadingMore}>{occurrencesLoadingMore ? 'Cargando más…' : (occurrencesLoadMoreError ? 'Reintentar cargar más ocurrencias' : 'Cargar más ocurrencias')}</button>
          </div>}
        </EstadoCarga>}
      </Modal>}
      {gapModalOpen && <Modal title="Brechas de responsabilidad del Área" subtitle="Evidencia operativa independiente del rendimiento." icon="alerta" tone="primary" wide onClose={() => setGapModalOpen(false)} footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setGapModalOpen(false)}>Cerrar</button>}>
        <EstadoCarga loading={gapsLoading && gaps.length === 0} error={gapsError} onRetry={() => void loadGaps()} empty={!gapsLoading && !gapsError && gaps.length === 0} emptyText="No hay brechas de responsabilidad para el Área y rango seleccionados.">
          <ul className="go-gap-list">{gaps.map((gap, index) => <li key={`${gap?.detected_at ?? 'gap'}-${index}`}><dl><dt>Inicio efectivo</dt><dd>{formatDate(gap?.effective_start)}</dd><dt>Fecha de detección</dt><dd>{formatDate(gap?.detected_at)}</dd><dt>Estado</dt><dd>{gap?.status ?? '—'}</dd><dt>Motivo de apertura</dt><dd>{gap?.opening_reason ?? '—'}</dd><dt>Procedencia de apertura</dt><dd>{gap?.opening_provenance ?? '—'}</dd>{gap?.resolution && <><dt>Resolución registrada</dt><dd>{gap.resolution?.reason ?? gap.resolution?.status ?? '—'}</dd></>}</dl></li>)}</ul>
          {gapCursor && <button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-load-more" onClick={() => void loadGaps({ cursor: gapCursor, append: true })} disabled={gapsLoading}>{gapsLoading ? 'Cargando más…' : 'Cargar más'}</button>}
        </EstadoCarga>
      </Modal>}
      {evaluationModal && <Modal title="Evaluación mensual" subtitle="La autorización final y el estado de cierre se verifican en el servidor." icon="archivo" wide onClose={() => setEvaluationModal(null)} footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setEvaluationModal(null)}>Cerrar</button>}>
        <GAMonthlyEvaluationPanel gaId={evaluationModal.responsibility.manager.id} month={evaluationModal.period} mode="go" />
      </Modal>}
    </main>
  )
}
