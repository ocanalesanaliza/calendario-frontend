import { useCallback, useEffect, useRef, useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import { absencesToCalendarEvents, occurrencesToCalendarEvents } from '../adapters/calendarEvents'
import {
  completeAreaOccurrence,
  getMonthlyAreaAbsences,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  rescheduleAreaOccurrence,
} from '../services/calendarioAreaService'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import './CalendarioAreaPage.css'

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  justificada: 'Justificada',
  diferida: 'Diferida',
}

function monthFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function occurrenceTitle(occurrence) {
  return typeof occurrence.task === 'string'
    ? occurrence.task
    : occurrence.task?.nombre ?? occurrence.task?.titulo ?? occurrence.task?.name ?? ''
}

function errorMessage(error) {
  if (error.status === 400) return `Error de validación: ${error.message}`
  if (error.status === 403) return 'Acceso denegado para esta acción.'
  return error.message
}

const PERFORMANCE_FIELDS = [
  ['area', 'Área'],
  ['responsibility_id', 'Responsabilidad'],
  ['month', 'Mes'],
  ['version', 'Versión'],
  ['state', 'Estado'],
  ['weights', 'Pesos'],
  ['percentage', 'Porcentaje'],
  ['counts', 'Conteos'],
  ['closed_at', 'Cerrado el'],
  ['reason', 'Motivo'],
]

const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([type="hidden"]), select, textarea, button, iframe, object, embed, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    const style = window.getComputedStyle(element)
    return !element.disabled
      && !element.closest('[hidden], [aria-hidden="true"]')
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && element.tabIndex >= 0
  })
}

function performanceValue(value) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
}

function MonthlyPerformancePanel({ loading, performance, error, onRetry }) {
  const notClosed = error?.status === 409
    && (error.detail === 'monthly_performance_not_closed' || error.message === 'monthly_performance_not_closed')
  const denied = error?.status === 403
  const performances = Array.isArray(performance?.performances)
    ? performance.performances.filter((snapshot) => snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot))
    : []

  return (
    <section className="monthly-performance" aria-labelledby="monthly-performance-title">
      <h2 id="monthly-performance-title">Rendimiento mensual</h2>
      {loading ? <p role="status">Cargando rendimiento mensual...</p>
        : notClosed ? <p role="status">El rendimiento mensual aún no está cerrado.</p>
            : denied ? <p role="alert">Acceso denegado para consultar el rendimiento mensual.</p>
              : error ? <div role="alert">{errorMessage(error)} <button type="button" onClick={onRetry}>Reintentar</button></div>
              : performances.length === 0 ? <p>No hay rendimiento mensual disponible para este mes.</p>
                : performances.map((snapshot, index) => {
                  const fields = PERFORMANCE_FIELDS.filter(([name]) => snapshot[name] !== undefined)
                  const headingId = `monthly-performance-${snapshot.responsibility_id ?? index}-${index}`

                  return <section key={`${snapshot.responsibility_id ?? 'performance'}-${snapshot.version ?? index}-${index}`} aria-labelledby={headingId}>
                    <h3 id={headingId}>Responsabilidad {snapshot.responsibility_id ?? 'sin identificar'}</h3>
                    <dl className="monthly-performance-details">
                      {fields.map(([name, label]) => <div key={name}><dt>{label}</dt><dd>{performanceValue(snapshot[name])}</dd></div>)}
                    </dl>
                  </section>
                })}
    </section>
  )
}

function OccurrenceDialog({ occurrence, onClose, onComplete, onReschedule }) {
  const dialogRef = useRef(null)
  const closeButton = useRef(null)
  const [mode, setMode] = useState(null)
  const [targetDate, setTargetDate] = useState(occurrence.effective_date ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const commandKeyRef = useRef(null)
  const titleId = 'occurrence-dialog-title'
  const descriptionId = 'occurrence-dialog-description'
  const pending = occurrence.status === 'pendiente'

  useEffect(() => {
    closeButton.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements(dialogRef.current)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements.at(-1)
      const activeElement = document.activeElement
      if (!dialogRef.current.contains(activeElement) || (event.shiftKey ? activeElement === first : activeElement === last)) {
        event.preventDefault()
        const focusTarget = event.shiftKey ? last : first
        focusTarget.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    commandKeyRef.current ??= createIdempotencyKey()
    try {
      if (mode === 'complete') await onComplete(occurrence.occurrence_id, commandKeyRef.current)
      else await onReschedule(occurrence.occurrence_id, { target_date: targetDate, reason }, commandKeyRef.current)
      commandKeyRef.current = null
    } catch (requestError) {
      if ([400, 403, 409].includes(requestError.status)) commandKeyRef.current = null
      setError(errorMessage(requestError))
      setSubmitting(false)
    }
  }

  function selectMode(nextMode) {
    commandKeyRef.current = createIdempotencyKey()
    setMode(nextMode)
  }

  const coverage = occurrence.coverage_snapshot

  return (
    <div className="calendar-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <button ref={closeButton} type="button" className="calendar-modal-close" onClick={onClose} aria-label="Cerrar detalle de la ocurrencia">×</button>
        <h2 id={titleId}>{occurrenceTitle(occurrence)}</h2>
        <p id={descriptionId}>Detalle de la ocurrencia programada.</p>
        <dl className="occurrence-details">
          <dt>Fecha</dt><dd>{occurrence.effective_date}</dd>
          <dt>Estado</dt><dd>{STATUS_LABELS[occurrence.status] ?? occurrence.status}</dd>
          {coverage?.jornada && <><dt>Jornada</dt><dd>{coverage.jornada}</dd></>}
          {coverage?.aplica_ambas_jornadas !== undefined && <><dt>Cobertura</dt><dd>{coverage.aplica_ambas_jornadas ? 'Ambas jornadas' : 'Una jornada'}</dd></>}
          {occurrence.weight !== undefined && <><dt>Peso</dt><dd>{occurrence.weight}</dd></>}
          {occurrence.template?.name && <><dt>Plantilla</dt><dd>{occurrence.template.name}</dd></>}
          {occurrence.template_version?.number !== undefined && <><dt>Versión</dt><dd>{occurrence.template_version.number}</dd></>}
        </dl>
        {error && <p role="alert">{error}</p>}
        {pending && !mode && <div className="occurrence-actions">
          <button type="button" onClick={() => selectMode('complete')}>Completar</button>
          <button type="button" onClick={() => selectMode('reschedule')}>Reprogramar</button>
        </div>}
        {pending && mode === 'complete' && <form onSubmit={submit}>
          <p>¿Confirmas que deseas completar esta ocurrencia?</p>
          <button type="button" disabled={submitting} onClick={() => setMode(null)}>Cancelar</button>
          <button type="submit" disabled={submitting}>{submitting ? 'Completando...' : 'Confirmar completar'}</button>
        </form>}
        {pending && mode === 'reschedule' && <form onSubmit={submit}>
          <label htmlFor="occurrence-target-date">Nueva fecha</label>
          <input id="occurrence-target-date" type="date" required value={targetDate} disabled={submitting} onChange={(event) => setTargetDate(event.target.value)} />
          <label htmlFor="occurrence-reason">Motivo</label>
          <textarea id="occurrence-reason" required value={reason} disabled={submitting} onChange={(event) => setReason(event.target.value)} />
          <button type="button" disabled={submitting} onClick={() => setMode(null)}>Cancelar</button>
          <button type="submit" disabled={submitting}>{submitting ? 'Reprogramando...' : 'Confirmar reprogramación'}</button>
        </form>}
      </section>
    </div>
  )
}

export default function CalendarioAreaPage() {
  const [month, setMonth] = useState(() => monthFromDate(new Date()))
  const [occurrences, setOccurrences] = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [absenceError, setAbsenceError] = useState('')
  const [performance, setPerformance] = useState(null)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [performanceError, setPerformanceError] = useState(null)
  const [selected, setSelected] = useState(null)
  const triggerRef = useRef(null)
  const currentMonthRef = useRef(month)
  const occurrenceRequestRef = useRef(0)
  const absenceRequestRef = useRef(0)
  const performanceRequestRef = useRef(0)
  currentMonthRef.current = month

  useEffect(() => {
    if (!selected) triggerRef.current?.focus?.()
  }, [selected])

  async function loadMonth(keepError = false, requestedMonth = month) {
    const request = ++occurrenceRequestRef.current
    setLoading(true)
    if (!keepError) setError('')
    try {
      const response = await getMonthlyAreaOccurrences(requestedMonth)
      if (request === occurrenceRequestRef.current && requestedMonth === currentMonthRef.current) setOccurrences(response.occurrences)
    } catch (requestError) {
      if (request === occurrenceRequestRef.current && requestedMonth === currentMonthRef.current) setError(errorMessage(requestError))
    } finally {
      if (request === occurrenceRequestRef.current && requestedMonth === currentMonthRef.current) setLoading(false)
    }
  }

  useEffect(() => { loadMonth() }, [month])

  const loadAbsences = useCallback(async (requestedMonth = month) => {
    const request = ++absenceRequestRef.current
    setAbsenceError('')
    try {
      const response = await getMonthlyAreaAbsences(requestedMonth)
      if (request === absenceRequestRef.current && requestedMonth === currentMonthRef.current) setAbsences(response.absences ?? [])
    } catch (requestError) {
      if (request === absenceRequestRef.current && requestedMonth === currentMonthRef.current) setAbsenceError(errorMessage(requestError))
    }
  }, [month])

  useEffect(() => { void Promise.resolve().then(loadAbsences) }, [loadAbsences])

  async function loadPerformance(requestedMonth = month) {
    const request = ++performanceRequestRef.current
    setPerformanceLoading(true)
    setPerformanceError(null)
    try {
      const response = await getMonthlyAreaPerformance(requestedMonth)
      if (request === performanceRequestRef.current && requestedMonth === currentMonthRef.current) setPerformance(response)
    } catch (requestError) {
      if (request === performanceRequestRef.current && requestedMonth === currentMonthRef.current) {
        setPerformance(null)
        setPerformanceError(requestError)
      }
    } finally {
      if (request === performanceRequestRef.current && requestedMonth === currentMonthRef.current) setPerformanceLoading(false)
    }
  }

  useEffect(() => { loadPerformance() }, [month])

  async function runCommand(command) {
    try {
      await command()
      setSelected(null)
      await loadMonth()
    } catch (requestError) {
      if (requestError.status === 409) {
        setError('El estado de la ocurrencia cambió. Se recargó el mes.')
        setSelected(null)
        await loadMonth(true)
        throw requestError
      }
      throw requestError
    }
  }

  return (
    <section className="calendario-area-page">
      <div className="page-header"><h1>Calendario del área</h1></div>
      <MonthlyPerformancePanel loading={performanceLoading} performance={performance} error={performanceError} onRetry={() => loadPerformance()} />
      {error && <div role="alert">{error} <button type="button" onClick={() => loadMonth()}>Reintentar</button></div>}
      {absenceError && <div role="alert">No se pudieron cargar las ausencias del área: {absenceError} <button type="button" onClick={() => loadAbsences()}>Reintentar ausencias</button></div>}
      {loading && <p role="status">Cargando calendario...</p>}
      <>
        {!loading && occurrences.length === 0 && <p>No hay tareas programadas para este mes.</p>}
        <div className="calendario-area-calendar"><FullCalendar plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin, multiMonthPlugin]} headerToolbar={{ start: 'prev,today,next', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear' }} views={{ listWeek: { buttonText: 'Lista semanal' }, multiMonthYear: { buttonText: 'Año' } }} initialView="dayGridMonth" locale="es" buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista', year: 'Año' }} events={[...occurrencesToCalendarEvents(occurrences), ...absencesToCalendarEvents(absences)]} eventClick={(info) => { if (info.event.extendedProps.calendar_event_type === 'absence') return; triggerRef.current = info.el ?? info.jsEvent?.target; setSelected({ ...info.event.extendedProps, occurrence_id: info.event.extendedProps.occurrence_id, task: info.event.extendedProps.task }) }} datesSet={({ view }) => setMonth(monthFromDate(view.currentStart))} height="auto" /></div>
      </>
      {selected && <OccurrenceDialog occurrence={selected} onClose={() => setSelected(null)} onComplete={(id, key) => runCommand(() => completeAreaOccurrence(id, key))} onReschedule={(id, body, key) => runCommand(() => rescheduleAreaOccurrence(id, body, key))} />}
    </section>
  )
}
