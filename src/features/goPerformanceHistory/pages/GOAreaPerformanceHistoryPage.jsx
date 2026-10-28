import { useEffect, useRef, useState } from 'react'
import { Aviso, EstadoCarga, Modal, PageHeader } from '../../tuvet/components/TuvetUi'
import { getGOAllAreasPerformanceHistory, getGOAreaPerformanceHistory, getGOAuthorizedAreas, getGOOccurrenceDetail, getGOOccurrences, getGOResponsibilityGaps } from '../services/goPerformanceHistoryService'
import '../../tuvet/tuvet.css'
import './GOAreaPerformanceHistoryPage.css'

const PAGE_SIZE = 25
const ALL_AREAS_VALUE = '__all_areas__'

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
  const date = new Date(value)
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

function displayValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`
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

function uniqueOccurrences(items, existing = []) {
  const knownIds = new Set(existing.map(occurrenceId).filter(Boolean))
  return [...existing, ...items.filter((item) => {
    const id = occurrenceId(item)
    if (!id || knownIds.has(id)) return false
    knownIds.add(id)
    return true
  })]
}

function HistoryRow({ row, onOccurrences, showArea }) {
  const performance = row?.performance ?? {}
  const definitive = performance.kind === 'definitive'
  const notApplicable = isNotApplicable(performance)
  const state = notApplicable ? 'No aplica' : (performance.state ?? '—')
  const updated = formatDateParts(performance.as_of)

  return (
    <tr>
      {showArea && <td className="go-performance-area">{areaLabel(row?.area)}</td>}
      <td className="go-performance-manager">{managerLabel(row?.responsibility)}</td>
      <td className="go-performance-period">{formatMonth(row?.period)}</td>
      <td><span className={`go-performance-state go-performance-state-${definitive ? 'definitive' : 'provisional'}`} aria-label={`${definitive ? 'Definitivo' : 'Provisional'} · ${state}`}><strong>{definitive ? 'Definitivo' : 'Provisional'}</strong><span aria-hidden="true"> · </span><span>{state}</span></span></td>
      <td className="go-performance-number">{notApplicable ? 'No aplica' : displayValue(performance.percentage, '%')}</td>
      <td className="go-performance-updated">{updated ? <><span>{updated.date}</span><span>{updated.time}</span></> : '—'}</td>
      <td><button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-row-action" onClick={() => onOccurrences(row)}>Ver evidencia de ocurrencias</button></td>
    </tr>
  )
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
  const [occurrencesLoading, setOccurrencesLoading] = useState(false)
  const [occurrencesLoadingMore, setOccurrencesLoadingMore] = useState(false)
  const [occurrencesError, setOccurrencesError] = useState('')
  const [occurrencesLoadMoreError, setOccurrencesLoadMoreError] = useState('')
  const [occurrenceDetail, setOccurrenceDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [issuedOccurrenceIds, setIssuedOccurrenceIds] = useState(() => new Set())
  const [gapModalOpen, setGapModalOpen] = useState(false)
  const [gaps, setGaps] = useState([])
  const [gapCursor, setGapCursor] = useState(null)
  const [gapsLoading, setGapsLoading] = useState(false)
  const [gapsError, setGapsError] = useState('')
  const latestRequest = useRef(0)
  const latestOccurrencesRequest = useRef(0)

  const allAreasSelected = areaId === ALL_AREAS_VALUE

  function resetRangePresentation() {
    latestOccurrencesRequest.current += 1
    setRows([])
    setNextCursor(null)
    setError('')
    setOccurrenceModal(null)
    resetOccurrences()
    setGapModalOpen(false)
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
    setDetailLoading(true)
    setDetailError('')
    try {
      setOccurrenceDetail(await getGOOccurrenceDetail(id))
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
          <div className="go-performance-table-wrap" tabIndex="0" aria-label="Resultados del historial de rendimiento de áreas">
            <table className="go-performance-table">
              <thead><tr>{allAreasSelected && <th className="go-performance-area">Área</th>}<th className="go-performance-manager">Gerente de Área</th><th className="go-performance-period">Período</th><th>Estado</th><th>Porcentaje</th><th className="go-performance-updated">Actualizado</th><th className="go-performance-evidence">Evidencia</th></tr></thead>
              <tbody>{rows.map((row, index) => <HistoryRow key={`${row?.area?.id ?? 'area'}-${row?.responsibility?.id ?? index}-${row?.period ?? 'period'}`} row={row} onOccurrences={openOccurrences} showArea={allAreasSelected} />)}</tbody>
            </table>
          </div>
        )}
        {nextCursor && <button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-load-more" onClick={() => loadRange({ cursor: nextCursor, append: true })} disabled={loadingMore}>{loadingMore ? 'Cargando más…' : 'Cargar más'}</button>}
      </EstadoCarga>
      {occurrenceModal && <Modal title="Evidencia de ocurrencias" subtitle="Consulta de solo lectura autorizada para el segmento seleccionado." icon="archivo" wide onClose={closeOccurrences} footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={closeOccurrences}>Cerrar</button>}>
        {occurrenceDetail ? <div className="go-evidence-detail">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setOccurrenceDetail(null); setDetailError('') }}>Volver a la lista</button>
          <header className="go-evidence-detail-header"><h3>{occurrenceDetail?.task?.title ?? 'Tarea sin título disponible'}</h3></header>
          <section className="go-evidence-detail-section" aria-labelledby="go-evidence-detail-metadata-title">
            <h4 id="go-evidence-detail-metadata-title">Información de la ocurrencia</h4>
            <dl className="go-evidence-detail-metadata"><dt>Fecha de origen</dt><dd>{formatDate(occurrenceDetail?.origin_date_local)}</dd><dt>Mes de atribución</dt><dd>{formatMonth(occurrenceDetail?.attribution_month)}</dd><dt>Peso congelado</dt><dd>{displayValue(occurrenceDetail?.frozen_weight)}</dd></dl>
          </section>
          <section className="go-evidence-detail-section" aria-labelledby="go-evidence-detail-latest-title">
            <h4 id="go-evidence-detail-latest-title">Última revisión</h4>
            <dl className="go-evidence-detail-latest"><dt>Estado</dt><dd>{occurrenceDetail?.latest_revision?.status ?? occurrenceDetail?.latest_status ?? '—'}</dd></dl>
          </section>
          <section className="go-evidence-detail-section" aria-labelledby="go-evidence-detail-history-title">
            <h4 id="go-evidence-detail-history-title">Historial de revisiones</h4>
            <ul className="go-evidence-revision-list">{(occurrenceDetail?.revisions ?? occurrenceDetail?.revision_history ?? []).map((revision, index) => <li key={`${revision?.created_at ?? 'revision'}-${index}`}><span>{revision?.status ?? 'Revisión registrada'}</span><span>{formatDate(revision?.created_at)}</span></li>)}</ul>
          </section>
        </div> : <EstadoCarga loading={occurrencesLoading || detailLoading} error={occurrencesError || detailError} onRetry={() => { if (detailError) setOccurrenceDetail(null); else openOccurrences(occurrenceModal) }} empty={!occurrencesLoading && !occurrencesError && occurrences.length === 0} emptyText="No hay ocurrencias autorizadas para este segmento.">
          <ul className="go-evidence-list">{occurrences.map((occurrence) => <li key={occurrenceId(occurrence)}><button type="button" className="tuvet-btn tuvet-btn-secondary go-evidence-record" onClick={() => void openOccurrenceDetail(occurrence)}><span className="go-evidence-record-title">{occurrence?.task?.title ?? 'Ocurrencia autorizada'}</span><span className="go-evidence-record-meta"><span>Fecha de origen</span><time className="go-evidence-record-date" dateTime={occurrence?.origin_date_local ?? undefined}>{formatDate(occurrence?.origin_date_local)}</time></span></button></li>)}</ul>
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
    </main>
  )
}
