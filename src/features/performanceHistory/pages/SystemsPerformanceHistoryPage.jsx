import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, EstadoCarga, PageHeader } from '../../tuvet/components/TuvetUi'
import { getAreas } from '../../areas/services/areasService'
import { getPerformanceHistory } from '../services/performanceHistoryService'
import '../../tuvet/tuvet.css'
import './SystemsPerformanceHistoryPage.css'

const PAGE_SIZE = 25

function monthToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(start, end) {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  return (endYear - startYear) * 12 + (endMonth - startMonth)
}

function getAreaId(area) {
  return area?.id ?? area?.id_area
}

function areaLabel(area) {
  const name = [area?.codigo, area?.nombre].filter(Boolean).join(' · ') || 'Área sin nombre'
  return area?.activo === false ? `${name} · Inactiva` : name
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

function valueOrNA(value, suffix = '') {
  if (value === null || value === undefined || value === '' || value === 'not_applicable') return 'No aplica'
  return `${value}${suffix}`
}

function normalizeError(error) {
  if (error?.status === 403) return 'No tienes autorización para consultar este historial. El servidor mantiene la autorización.'
  return 'No fue posible cargar el historial de rendimiento mensual.'
}

function HistoryRow({ row, onSelectTarget }) {
  const performance = row?.performance ?? {}
  const definitive = performance.kind === 'definitive'
  const responsibility = row?.responsibility?.nombre ?? row?.responsibility?.name ?? row?.responsibility ?? '—'
  const area = row?.area ? areaLabel(row.area) : '—'
  const state = performance.state === 'not_applicable' ? 'No aplica' : (performance.state ?? '—')
  const canCorrect = definitive && Object.prototype.hasOwnProperty.call(performance, 'snapshot_id') && performance.snapshot_id !== null && performance.snapshot_id !== undefined
  const safeTarget = canCorrect ? {
    snapshotId: performance.snapshot_id,
    summary: { area, responsibility, period: formatMonth(row?.period), state, version: performance.version, expected_weight: performance.expected_weight, credited_weight: performance.credited_weight, percentage: performance.percentage },
  } : null

  return (
    <tr>
      <td>{area}</td>
      <td>{responsibility}</td>
      <td>{formatMonth(row?.period)}</td>
      <td><span className={`sph-state sph-state-${performance.kind ?? 'unknown'}`}><strong>{definitive ? 'Definitivo' : 'Provisional'}</strong><span aria-hidden="true"> · </span><span>{state}</span></span></td>
      <td>{definitive && performance.version !== null && performance.version !== undefined ? `Versión ${performance.version}` : '—'}</td>
      <td className="sph-number">{valueOrNA(performance.expected_weight)}</td>
      <td className="sph-number">{valueOrNA(performance.credited_weight)}</td>
      <td className="sph-number">{valueOrNA(performance.percentage, performance.percentage === null || performance.percentage === undefined ? '' : '%')}</td>
      <td>
        <span>{formatDate(performance.as_of)}</span>
        <small>{definitive ? 'Cierre definitivo' : 'Proyección generada'}</small>
      </td>
      {onSelectTarget && <td>{canCorrect && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => onSelectTarget(safeTarget)}>Corregir rendimiento</button>}</td>}
    </tr>
  )
}

export default function SystemsPerformanceHistoryPage({ selectionMode = false, onSelectTarget }) {
  const navigate = useNavigate()
  const [initialMonth] = useState(() => monthToday())
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState('')
  const [fromMonth, setFromMonth] = useState(initialMonth)
  const [toMonth, setToMonth] = useState(initialMonth)
  const [rows, setRows] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [areasAttempt, setAreasAttempt] = useState(0)
  const [areasLoadError, setAreasLoadError] = useState(false)
  const searchButtonRef = useRef(null)

  useEffect(() => {
    let active = true
    getAreas()
      .then((data) => {
        const items = Array.isArray(data) ? data : (data?.results ?? [])
        if (!active) return
        setAreas(items)
        setAreaId(String(getAreaId(items[0]) ?? ''))
        setAreasLoadError(false)
      })
      .catch(() => {
        if (active) {
          setAreasLoadError(true)
          setError('No fue posible cargar las áreas disponibles.')
        }
      })
      .finally(() => { if (active) setLoadingAreas(false) })
    return () => { active = false }
  }, [areasAttempt])

  const request = async ({ cursor, append = false } = {}) => {
    if (!areaId || !fromMonth || !toMonth) return
    const invalidRange = fromMonth > toMonth || monthsBetween(fromMonth, toMonth) >= 24
    if (invalidRange) {
      setRangeError('El rango debe ser menor de 24 meses y la fecha inicial no puede ser posterior a la final.')
      return
    }
    setRangeError('')
    setError('')
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const data = await getPerformanceHistory({ areaId, fromMonth, toMonth, cursor, limit: PAGE_SIZE })
      setRows((previous) => append ? [...previous, ...(data?.results ?? [])] : (data?.results ?? []))
      setNextCursor(data?.next_cursor ?? null)
    } catch (requestError) {
      setError(normalizeError(requestError))
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    if (!loadingAreas && areaId) {
      const timer = window.setTimeout(() => { request() }, 0)
      return () => window.clearTimeout(timer)
    }
  // Loading the first selected Area is intentional; later requests are explicit user actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAreas, areaId])

  function submit(event) {
    event.preventDefault()
    request()
  }

  function retry() {
    if (areasLoadError) {
      setLoadingAreas(true)
      setError('')
      setAreasAttempt((attempt) => attempt + 1)
      return
    }
    request()
  }

  return (
    <main className="tema-analiza tuvet-page systems-performance-history" data-responsive-breakpoints="375 768 1024 1440">
      <PageHeader title={selectionMode ? 'Seleccionar rendimiento definitivo' : 'Historial de rendimiento mensual'} description={selectionMode ? 'Selecciona un cierre definitivo con evidencia para continuar.' : 'Consulta de solo lectura para Sistemas. El servidor conserva la autorización de los datos.'} />
      <Aviso tipo="info">Los resultados definitivos indican la fecha de cierre; los provisionales, cuándo se generó la proyección.</Aviso>

      <form className="sph-filters" onSubmit={submit} aria-label="Filtros del historial mensual">
        <div className="sph-field">
          <label htmlFor="sph-area">Área</label>
          <select id="sph-area" value={areaId} onChange={(event) => setAreaId(event.target.value)} disabled={loadingAreas}>
            {areas.map((area) => <option key={getAreaId(area)} value={getAreaId(area)}>{areaLabel(area)}</option>)}
          </select>
          <small>Las áreas inactivas se mantienen disponibles porque sus resultados históricos siguen siendo consultables.</small>
        </div>
        <div className="sph-field"><label htmlFor="sph-from">Desde</label><input id="sph-from" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></div>
        <div className="sph-field"><label htmlFor="sph-to">Hasta</label><input id="sph-to" type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} /></div>
        <button ref={searchButtonRef} type="submit" className="tuvet-btn" disabled={loadingAreas || loading}>Consultar historial</button>
      </form>
      {rangeError && <Aviso tipo="warning">{rangeError}</Aviso>}

      <EstadoCarga loading={loadingAreas || loading} error={error} onRetry={retry} empty={!loadingAreas && !loading && !error && rows.length === 0} emptyText="No hay resultados para el área y el periodo seleccionados.">
        <div className="sph-table-wrap" tabIndex="0" aria-label="Resultados del historial de rendimiento mensual">
          <table className="sph-table">
            <thead><tr><th>Área</th><th>Responsabilidad</th><th>Mes</th><th>Estado</th><th>Versión</th><th>Peso esperado</th><th>Peso acreditado</th><th>Porcentaje</th><th>Actualizado</th>{(selectionMode || !selectionMode) && <th>{selectionMode ? 'Seleccionar' : 'Corrección'}</th>}</tr></thead>
            <tbody>{rows.map((row, index) => <HistoryRow key={`${row?.period ?? 'period'}-${index}`} row={row} onSelectTarget={selectionMode ? onSelectTarget : (target) => navigate('/correcciones-rendimiento-mensual', { state: { target } })} />)}</tbody>
          </table>
        </div>
        {nextCursor && <button type="button" className="tuvet-btn tuvet-btn-secondary sph-load-more" onClick={() => request({ cursor: nextCursor, append: true })} disabled={loadingMore}>{loadingMore ? 'Cargando más…' : 'Cargar más'}</button>}
      </EstadoCarga>
    </main>
  )
}
