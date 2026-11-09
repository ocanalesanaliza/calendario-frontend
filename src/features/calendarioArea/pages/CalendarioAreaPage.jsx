import { useCallback, useEffect, useRef, useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import { absencesToCalendarEvents, occurrencesToCalendarEvents, selectVisibleOccurrences } from '../adapters/calendarEvents'
import {
  completeAreaOccurrence,
  getMonthlyAreaAbsences,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  rescheduleAreaOccurrence,
} from '../services/calendarioAreaService'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import DepositReviewWorklistModal from '../components/DepositReviewWorklistModal'
import '../../tuvet/tuvet.css'
import './CalendarioAreaPage.css'

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  justificada: 'Justificada',
  diferida: 'Diferida',
}
const JORNADA_LABELS = { manana: 'Mañana', tarde: 'Tarde' }

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

function formatMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) return month || 'este mes'
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, value - 1, 1)))
}

function OccurrenceStatusMarker({ marker, label }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    pending: <><circle cx="8" cy="8" r="6" {...common} /><path d="M8 5v3l2 1" {...common} /></>,
    complete: <><circle cx="8" cy="8" r="6" {...common} /><path d="m5.25 8 1.75 1.75 3.75-3.75" {...common} /></>,
    overdue: <><path d="M8 2.25 14.25 13H1.75L8 2.25Z" {...common} /><path d="M8 6v3.25M8 11.25h.01" {...common} /></>,
    justified: <><path d="M4 1.75h5l3 3v9.5H4z" {...common} /><path d="M9 1.75v3h3M5.75 9l1.1 1.1L10.5 6.5" {...common} /></>,
    deferred: <><circle cx="8" cy="8" r="5.75" {...common} /><path d="M8 4.75V8l2.5 1.5M11.5 2.75v2.5H9" {...common} /></>,
  }

  return <svg className="calendario-area-event-chip__marker" data-calendar-status-marker={marker ?? 'pending'} viewBox="0 0 16 16" aria-hidden="true" focusable="false" title={label}>{paths[marker] ?? paths.pending}</svg>
}

function areaName(area) {
  if (typeof area === 'string') return area
  return area?.name ?? area?.nombre ?? 'Área sin identificar'
}

function performanceState(snapshot) {
  if (snapshot.not_applicable === true || snapshot.state === 'not_applicable' || snapshot.percentage === 'not_applicable') return { label: 'No aplica', tone: 'not-applicable' }
  if (snapshot.state === 'closed' || snapshot.state === 'definitive') return { label: 'Cierre definitivo disponible', tone: 'definitive' }
  if (snapshot.state === 'provisional') return { label: 'Datos provisionales', tone: 'provisional' }
  return { label: snapshot.state ? `Estado informado: ${snapshot.state}` : 'Estado informado por el servicio', tone: 'neutral' }
}

function weightValue(weights, name, fallback) {
  if (!weights || typeof weights !== 'object') return undefined
  return weights[name] ?? weights[fallback]
}

function MonthlyPerformancePanel({ loading, month, performance, error, onRetry }) {
  const notClosed = error?.status === 409
    && (error.detail === 'monthly_performance_not_closed' || error.message === 'monthly_performance_not_closed')
  const denied = error?.status === 403
  const performances = Array.isArray(performance?.performances)
    ? performance.performances.filter((snapshot) => snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot))
    : []

  return (
    <section className="monthly-performance" aria-labelledby="monthly-performance-title">
      <header className="monthly-performance__header">
        <div><h2 id="monthly-performance-title">Rendimiento mensual</h2><p>Periodo consultado: <strong>{formatMonth(performance?.month ?? month)}</strong></p></div>
        <p className="monthly-performance__authority">Información reportada por el calendario del área.</p>
      </header>
      {loading ? <div className="monthly-performance__loading" role="status" aria-busy="true"><span className="monthly-performance__skeleton" /><span className="monthly-performance__skeleton monthly-performance__skeleton--short" /><span className="sr-only">Cargando rendimiento mensual...</span></div>
        : notClosed ? <div className="monthly-performance__notice monthly-performance__notice--pending" role="status"><strong>Cierre mensual pendiente</strong><p>El rendimiento definitivo de este mes todavía no está disponible.</p></div>
          : denied ? <div className="monthly-performance__notice monthly-performance__notice--error" role="alert"><strong>Acceso no disponible</strong><p>Acceso denegado para consultar el rendimiento mensual.</p></div>
            : error ? <div className="monthly-performance__notice monthly-performance__notice--error" role="alert"><p>{errorMessage(error)}</p><button type="button" className="monthly-performance__retry" onClick={onRetry}>Reintentar</button></div>
              : performances.length === 0 ? <div className="monthly-performance__notice monthly-performance__notice--empty" role="status"><strong>Sin datos para este periodo</strong><p>No hay rendimiento mensual disponible para este mes.</p></div>
                : <div className="monthly-performance__segments">{performances.map((snapshot, index) => {
                  const headingId = `monthly-performance-${snapshot.responsibility_id ?? index}-${index}`
                  const state = performanceState(snapshot)
                  const expectedWeight = weightValue(snapshot.weights, 'expected', 'total')
                  const creditedWeight = weightValue(snapshot.weights, 'credited', 'completed')
                  const isNotApplicable = state.tone === 'not-applicable'

                  return <article className="monthly-performance__segment" key={`${snapshot.responsibility_id ?? 'performance'}-${snapshot.version ?? index}-${index}`} aria-labelledby={headingId}>
                    <header className="monthly-performance__segment-header"><div><h3 id={headingId}>Responsabilidad {snapshot.responsibility_id ?? 'sin identificar'}</h3><p>Área: {areaName(snapshot.area)}</p></div><span className={`monthly-performance__badge monthly-performance__badge--${state.tone}`}>{state.label}</span></header>
                    <dl className="monthly-performance-details">
                      <div><dt>Periodo</dt><dd>{formatMonth(snapshot.month ?? performance?.month ?? month)}</dd></div>
                      {expectedWeight !== undefined && <div><dt>Peso esperado</dt><dd>{expectedWeight}</dd></div>}
                      {creditedWeight !== undefined && <div><dt>Peso acreditado</dt><dd>{creditedWeight}</dd></div>}
                      {snapshot.percentage !== undefined && <div><dt>Rendimiento</dt><dd>{isNotApplicable ? 'No aplica' : `${snapshot.percentage}%`}</dd></div>}
                      {snapshot.closed_at && <div><dt>Cerrado el</dt><dd>{snapshot.closed_at}</dd></div>}
                      {snapshot.reason && <div><dt>Motivo</dt><dd>{snapshot.reason}</dd></div>}
                    </dl>
                  </article>
                })}</div>}
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
  const canComplete = occurrence.status === 'pendiente' || occurrence.status === 'diferida'
  const canReschedule = occurrence.status === 'pendiente'

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
        <header className="calendar-modal__header">
          <h2 id={titleId} className="calendar-modal__title">{occurrenceTitle(occurrence)}</h2>
          <button ref={closeButton} type="button" className="calendar-modal__close" onClick={onClose} aria-label="Cerrar detalle de la ocurrencia">×</button>
        </header>
        <p id={descriptionId} className="calendar-modal__description">Detalle de la ocurrencia programada.</p>
        <dl className="calendar-modal__details">
          <dt>Fecha</dt><dd>{occurrence.effective_date}</dd>
          <dt>Estado</dt><dd>{STATUS_LABELS[occurrence.status] ?? occurrence.status}</dd>
          {coverage?.jornada && <><dt>Jornada</dt><dd>{JORNADA_LABELS[coverage.jornada] ?? coverage.jornada}</dd></>}
          {coverage?.aplica_ambas_jornadas !== undefined && <><dt>Cobertura</dt><dd>{coverage.aplica_ambas_jornadas ? 'Ambas jornadas' : 'Una jornada'}</dd></>}
        </dl>
        {error && <p className="calendar-modal__error" role="alert">{error}</p>}
        {canComplete && !mode && <div className="calendar-modal__actions">
          <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('complete')}>Completar</button>
          {canReschedule && <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('reschedule')}>Reprogramar</button>}
        </div>}
        {canComplete && mode === 'complete' && <form className="calendar-modal__form" onSubmit={submit}>
          <p className="calendar-modal__confirmation">¿Confirmas que deseas completar esta ocurrencia?</p>
          <div className="calendar-modal__footer">
            <button type="button" className="calendar-modal__button calendar-modal__button--secondary" disabled={submitting} onClick={() => setMode(null)}>Cancelar</button>
            <button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting}>{submitting ? 'Completando...' : 'Confirmar completar'}</button>
          </div>
        </form>}
        {canReschedule && mode === 'reschedule' && <form className="calendar-modal__form" onSubmit={submit}>
          <div className="calendar-modal__field">
            <label className="calendar-modal__label" htmlFor="occurrence-target-date">Nueva fecha</label>
            <input className="calendar-modal__control" id="occurrence-target-date" type="date" required value={targetDate} disabled={submitting} onChange={(event) => setTargetDate(event.target.value)} />
          </div>
          <div className="calendar-modal__field">
            <label className="calendar-modal__label" htmlFor="occurrence-reason">Motivo</label>
            <textarea className="calendar-modal__control calendar-modal__control--textarea" id="occurrence-reason" required value={reason} disabled={submitting} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="calendar-modal__footer">
            <button type="button" className="calendar-modal__button calendar-modal__button--secondary" disabled={submitting} onClick={() => setMode(null)}>Cancelar</button>
            <button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting}>{submitting ? 'Reprogramando...' : 'Confirmar reprogramación'}</button>
          </div>
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
  const [depositTerminal, setDepositTerminal] = useState('')
  const triggerRef = useRef(null)
  const currentMonthRef = useRef(month)
  const monthRequestRef = useRef(0)
  const absenceRequestRef = useRef(0)
  const performanceRequestRef = useRef(0)
  useEffect(() => {
    if (!selected) triggerRef.current?.focus?.()
  }, [selected])

  async function loadMonth(keepError = false, requestedMonth = month) {
    const request = ++monthRequestRef.current
    const absenceRequest = ++absenceRequestRef.current
    setLoading(true)
    if (!keepError) setError('')
    setAbsenceError('')
    const [occurrenceResult, absenceResult] = await Promise.allSettled([
      getMonthlyAreaOccurrences(requestedMonth),
      getMonthlyAreaAbsences(requestedMonth),
    ])
    if (request !== monthRequestRef.current || requestedMonth !== currentMonthRef.current) return

    if (occurrenceResult.status === 'fulfilled') setOccurrences(occurrenceResult.value.occurrences)
    else setError(errorMessage(occurrenceResult.reason))

    if (absenceResult.status === 'fulfilled') setAbsences(absenceResult.value.absences ?? [])
    else {
      setAbsences([])
      setAbsenceError(errorMessage(absenceResult.reason))
    }

    if (absenceRequest === absenceRequestRef.current) setLoading(false)
  }

  // Carga inicial al entrar; los cambios de mes la repiten desde handleDatesSet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(loadMonth) }, [])

  const loadAbsences = useCallback(async (requestedMonth = month) => {
    const request = ++absenceRequestRef.current
    setAbsenceError('')
    try {
      const response = await getMonthlyAreaAbsences(requestedMonth)
      if (request === absenceRequestRef.current && requestedMonth === currentMonthRef.current) setAbsences(response.absences ?? [])
    } catch (requestError) {
      if (request === absenceRequestRef.current && requestedMonth === currentMonthRef.current) {
        setAbsences([])
        setAbsenceError(errorMessage(requestError))
      }
    }
  }, [month])

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

  // Carga inicial al entrar; los cambios de mes la repiten desde handleDatesSet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void Promise.resolve().then(loadPerformance) }, [])

  function handleDatesSet({ view }) {
    const requestedMonth = monthFromDate(view.currentStart)
    if (requestedMonth === month) return
    currentMonthRef.current = requestedMonth
    setMonth(requestedMonth)
    void loadMonth(false, requestedMonth)
    void loadPerformance(requestedMonth)
  }

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

  async function handleDepositTerminal(worklist) {
    setSelected(null)
    const state = worklist.state ?? worklist.terminal?.state
    setDepositTerminal(state === 'no_aplicable'
      ? 'No hubo casos aplicables para esta revisión de depósitos.'
      : state === 'completed' || state === 'completada'
        ? 'La revisión de depósitos quedó completada.'
        : 'La revisión de depósitos quedó resuelta.')
    await loadMonth()
  }

  return (
    <section className="tema-analiza tuvet-page calendario-area-page" data-responsive-breakpoints="375 768 1024 1440">
      <div className="page-header"><h1>Calendario del área</h1></div>
      <MonthlyPerformancePanel loading={performanceLoading} month={month} performance={performance} error={performanceError} onRetry={() => loadPerformance()} />
      {error && <div className="calendario-area-state calendario-area-state--error" role="alert"><p>{error}</p><button type="button" onClick={() => loadMonth()}>Reintentar</button></div>}
      {depositTerminal && <div className="calendario-area-state calendario-area-state--success" role="status"><p>{depositTerminal}</p></div>}
      {absenceError && <div className="calendario-area-state calendario-area-state--error" role="alert"><p>No se pudieron cargar las ausencias del área: {absenceError}</p><button type="button" onClick={() => loadAbsences()}>Reintentar ausencias</button></div>}
      {loading && <div className="calendario-area-state calendario-area-state--loading" role="status" aria-busy="true"><span className="calendario-area-skeleton" aria-hidden="true" /><span className="calendario-area-skeleton calendario-area-skeleton--short" aria-hidden="true" /><span className="sr-only">Cargando calendario...</span></div>}
      <>
        {!loading && occurrences.length === 0 && <div className="calendario-area-state calendario-area-state--empty" role="status"><strong>Mes sin tareas programadas</strong><p>No hay tareas programadas para este mes.</p></div>}
        <div className="calendario-area-calendar calendario-area-calendar__surface" aria-busy={loading}><div className="calendario-area-calendar__scroll"><FullCalendar plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin, multiMonthPlugin]} headerToolbar={{ start: 'prev,today,next', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear' }} views={{ listWeek: { buttonText: 'Lista semanal' }, multiMonthYear: { buttonText: 'Año' } }} initialView="dayGridMonth" locale="es" buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista', year: 'Año' }} events={[...occurrencesToCalendarEvents(selectVisibleOccurrences(occurrences, absences)), ...absencesToCalendarEvents(absences)]} eventClassNames={(info) => info.event.extendedProps.calendar_event_type === 'absence' ? 'calendario-area-event-chip calendario-area-event-chip--absence' : 'calendario-area-event-chip calendario-area-event-chip--occurrence'} eventContent={(info) => info.event.extendedProps.calendar_event_type === 'absence' ? info.event.title : <span className="calendario-area-event-chip__content"><span className="calendario-area-event-chip__title">{info.event.title}</span><OccurrenceStatusMarker marker={info.event.extendedProps.status_marker} label={info.event.extendedProps.status_label} /></span>} eventDidMount={(info) => { if (info.event.extendedProps.calendar_event_type !== 'absence') { info.el.setAttribute('aria-label', info.event.extendedProps.aria_label); info.el.setAttribute('title', info.event.extendedProps.aria_label) } }} eventClick={(info) => { if (info.event.extendedProps.calendar_event_type === 'absence') return; triggerRef.current = info.el ?? info.jsEvent?.target; setSelected({ ...info.event.extendedProps, id: info.event.id, occurrence_id: info.event.extendedProps.occurrence_id, task: info.event.extendedProps.task }) }} datesSet={handleDatesSet} height="auto" /></div></div>
      </>
      {selected?.task?.mode === 'deposit_review' ? <DepositReviewWorklistModal occurrenceVirtualId={selected.id} onClose={() => setSelected(null)} onTerminal={handleDepositTerminal} /> : selected && <OccurrenceDialog occurrence={selected} onClose={() => setSelected(null)} onComplete={(id, key) => runCommand(() => completeAreaOccurrence(id, key))} onReschedule={(id, body, key) => runCommand(() => rescheduleAreaOccurrence(id, body, key))} />}
    </section>
  )
}
