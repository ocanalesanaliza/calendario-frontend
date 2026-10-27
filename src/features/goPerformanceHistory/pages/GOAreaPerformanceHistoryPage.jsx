import { useEffect, useRef, useState } from 'react'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { getGOAreaPerformanceHistory, getGOAuthorizedAreas } from '../services/goPerformanceHistoryService'
import '../../tuvet/tuvet.css'
import './GOAreaPerformanceHistoryPage.css'

const PAGE_SIZE = 25

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

function HistoryRow({ row }) {
  const performance = row?.performance ?? {}
  const definitive = performance.kind === 'definitive'
  const notApplicable = isNotApplicable(performance)
  const responsibility = row?.responsibility?.nombre ?? row?.responsibility?.name ?? row?.responsibility ?? '—'
  const state = notApplicable ? 'No aplica' : (performance.state ?? '—')

  return (
    <tr>
      <td>{areaLabel(row?.area)}</td>
      <td>{responsibility}</td>
      <td>{formatMonth(row?.period)}</td>
      <td><span className={`go-performance-state go-performance-state-${definitive ? 'definitive' : 'provisional'}`}><strong>{definitive ? 'Definitivo' : 'Provisional'}</strong><span aria-hidden="true"> · </span>{state}</span></td>
      <td className="go-performance-number">{notApplicable ? '0' : displayValue(performance.expected_weight)}</td>
      <td className="go-performance-number">{notApplicable ? '0' : displayValue(performance.credited_weight)}</td>
      <td className="go-performance-number">{notApplicable ? 'No aplica' : displayValue(performance.percentage, '%')}</td>
      <td>{formatDate(performance.as_of)}</td>
      <td>{definitive && performance.version !== null && performance.version !== undefined ? `Versión ${performance.version}` : '—'}</td>
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
  const latestRequest = useRef(0)

  async function loadRange({ requestedAreaId = areaId, cursor, append = false, explicit = false } = {}) {
    const invalid = rangeMessage(fromMonth, toMonth)
    if (invalid) {
      setRangeError(invalid)
      return
    }
    setRangeError('')
    setError('')
    const requestId = ++latestRequest.current
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      let effectiveAreaId = requestedAreaId
      if (!append) {
        const areaData = await getGOAuthorizedAreas({ fromMonth, toMonth })
        const authorizedAreas = Array.isArray(areaData?.results) ? areaData.results : []
        if (requestId !== latestRequest.current) return
        setAreas(authorizedAreas)
        effectiveAreaId = authorizedAreas.some((area) => String(area.id) === String(requestedAreaId))
          ? String(requestedAreaId)
          : String(authorizedAreas[0]?.id ?? '')
        setAreaId(effectiveAreaId)
        if (!effectiveAreaId) {
          setRows([])
          setNextCursor(null)
          return
        }
      }
      const data = await getGOAreaPerformanceHistory({ areaId: effectiveAreaId, fromMonth, toMonth, cursor, limit: PAGE_SIZE })
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

  return (
    <main className="tema-analiza tuvet-page go-area-performance-history" data-responsive-breakpoints="375 768 1024 1440">
      <PageHeader title="Rendimiento de áreas" description="Consulta de solo lectura para Gerencia de Operaciones. El servidor conserva la autorización histórica para cada Área y rango." />
      <Aviso tipo="info">Los resultados se mantienen separados por Área, responsabilidad y período. Esta pantalla no permite cambios.</Aviso>

      <form className="go-performance-filters" onSubmit={submit} aria-label="Filtros del historial de rendimiento de áreas">
        <div className="go-performance-field">
          <label htmlFor="go-performance-area">Área</label>
          <select id="go-performance-area" value={areaId} onChange={(event) => setAreaId(event.target.value)} disabled={loading || areas.length === 0}>
            {areas.map((area) => <option key={area.id} value={area.id}>{areaLabel(area)}</option>)}
          </select>
          <small>La lista depende del rango seleccionado. Las áreas inactivas autorizadas conservan su historial.</small>
        </div>
        <div className="go-performance-field"><label htmlFor="go-performance-from">Desde</label><input id="go-performance-from" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></div>
        <div className="go-performance-field"><label htmlFor="go-performance-to">Hasta</label><input id="go-performance-to" type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} /></div>
        <button type="submit" className="tuvet-btn" disabled={loading}>Consultar historial</button>
      </form>
      {rangeError && <Aviso tipo="warning">{rangeError}</Aviso>}

      <EstadoCarga loading={loading} error={error} onRetry={retry} empty={!loading && !error && areas.length === 0} emptyText="No hay áreas autorizadas para el rango seleccionado.">
        {areas.length > 0 && rows.length === 0 && !loading ? <div className="go-performance-empty">No hay resultados para el Área y período seleccionados.</div> : (
          <div className="go-performance-table-wrap" tabIndex="0" aria-label="Resultados del historial de rendimiento de áreas">
            <table className="go-performance-table">
              <thead><tr><th>Área</th><th>Responsabilidad</th><th>Período</th><th>Estado</th><th>Peso esperado</th><th>Peso acreditado</th><th>Porcentaje</th><th>Actualizado</th><th>Versión</th></tr></thead>
              <tbody>{rows.map((row, index) => <HistoryRow key={`${row?.area?.id ?? 'area'}-${row?.responsibility?.id ?? index}-${row?.period ?? 'period'}`} row={row} />)}</tbody>
            </table>
          </div>
        )}
        {nextCursor && <button type="button" className="tuvet-btn tuvet-btn-secondary go-performance-load-more" onClick={() => loadRange({ cursor: nextCursor, append: true })} disabled={loadingMore}>{loadingMore ? 'Cargando más…' : 'Cargar más'}</button>}
      </EstadoCarga>
    </main>
  )
}
