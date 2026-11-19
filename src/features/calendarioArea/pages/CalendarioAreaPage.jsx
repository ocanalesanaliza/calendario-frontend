import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import { absencesToCalendarEvents, adHocActivitiesToCalendarEvents, manualCatalogEntriesToCalendarEvents, occurrencesToCalendarEvents, selectVisibleOccurrences } from '../adapters/calendarEvents'
import {
  cancelAdHocActivity,
  cancelManualCatalogEntry,
  completeAdHocActivity,
  completeAreaOccurrence,
  completeManualCatalogEntry,
  createAdHocActivity,
  createManualCatalogEntry,
  getManualPlanningContext,
  getMonthlyAreaAbsences,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  justifyManualCatalogEntryScopeLoss,
  rescheduleManualCatalogEntry,
  rescheduleAreaOccurrence,
  updateAdHocActivity,
  updateManualCatalogEntry,
} from '../services/calendarioAreaService'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { getTareas } from '../../tareas/services/tareasService'
import DepositReviewWorklistModal from '../components/DepositReviewWorklistModal'
import '../../tuvet/tuvet.css'
import './CalendarioAreaPage.css'

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  justificada: 'Justificada',
  diferida: 'Diferida',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
}
const JORNADA_LABELS = { manana: 'Mañana', tarde: 'Tarde' }
const CLASSIFICATION_LABELS = { qualitative: 'Cualitativa', quantitative: 'Cuantitativa' }
const ABSENCE_CONFLICT_MESSAGE = 'Ese día tenés una ausencia registrada. No se puede planificar en esa fecha.'
const PAST_CATALOG_MESSAGE = 'Las tareas de catálogo solo admiten hoy o fechas futuras.'

function monthFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function localIsoDate(date = new Date()) {
  return `${monthFromDate(date)}-${String(date.getDate()).padStart(2, '0')}`
}

function parseIsoDate(value) {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function occurrenceTitle(occurrence) {
  return typeof occurrence.task === 'string'
    ? occurrence.task
    : occurrence.task?.nombre ?? occurrence.task?.titulo ?? occurrence.task?.name ?? ''
}

function errorMessage(error) {
  if (error.status === 400) return `Error de validación: ${error.message}`
  if (error.status === 403) return 'Acceso denegado para esta acción.'
  if (error.detail === 'manual_creation_blocked_by_absence') return ABSENCE_CONFLICT_MESSAGE
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
    cancelled: <><circle cx="8" cy="8" r="6" {...common} /><path d="m5.75 5.75 4.5 4.5M10.25 5.75l-4.5 4.5" {...common} /></>,
    rescheduled: <><path d="M13.5 8a5.5 5.5 0 1 1-2.1-4.33" {...common} /><path d="M13.75 2.5v3.25h-3.25" {...common} /></>,
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

function ManualPlanningDialog({ onClose, onCreated, initialDate = '', absenceDates = [] }) {
  const [context, setContext] = useState({ areas: [], branches: [], tasks: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: 'catalog', areaId: '', taskId: '', date: initialDate, branchId: '', note: '', startsCompleted: false, name: '', description: '' })
  const today = localIsoDate()

  useEffect(() => {
    let active = true
    Promise.all([getManualPlanningContext(), getTareas()]).then(([manualContext, tasks]) => {
      if (!active) return
      const areas = manualContext.areas ?? []
      setContext({ areas, branches: manualContext.branches ?? [], tasks: Array.isArray(tasks) ? tasks.filter((task) => task.manual_planning_enabled) : [] })
      setForm((current) => ({ ...current, areaId: areas.length === 1 ? String(areas[0].id) : current.areaId }))
    }).catch((requestError) => {
      if (active) setError(errorMessage(requestError))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selectedTask = context.tasks.find((task) => {
    const taskId = task.id_tarea ?? task.id
    return String(taskId) === form.taskId
  })
  const classification = selectedTask?.manual_planning_kind
  const startsCompletedAvailable = classification === 'qualitative' && form.date === today
  const pastCatalogDate = form.type === 'catalog' && form.date !== '' && form.date < today
  const absentDate = form.date !== '' && absenceDates.includes(form.date)
  const update = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (submitting || !form.areaId) return
    setSubmitting(true)
    setError('')
    try {
      const key = createIdempotencyKey()
      if (form.type === 'catalog') {
        const taskId = selectedTask?.id_tarea ?? selectedTask?.id
        const body = { area_id: Number(form.areaId), task_id: Number(taskId), scheduled_date: form.date }
        if (form.branchId) body.branch_id = Number(form.branchId)
        if (form.note) body.planning_note = form.note
        if (startsCompletedAvailable && form.startsCompleted) body.starts_completed = true
        await createManualCatalogEntry(body, key)
      } else {
        await createAdHocActivity({ area_id: Number(form.areaId), name: form.name, description: form.description, scheduled_date: form.date }, key)
      }
      await onCreated(form.date)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setSubmitting(false)
    }
  }

  return <div className="calendar-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="manual-planning-title">
      <header className="calendar-modal__header"><h2 id="manual-planning-title" className="calendar-modal__title">Planificar tarea manual</h2><button type="button" className="calendar-modal__close" onClick={onClose} aria-label="Cerrar planificación manual">×</button></header>
      {loading ? <p className="calendar-modal__description" role="status">Cargando opciones de planificación...</p> : error && !context.areas.length ? <p className="calendar-modal__error" role="alert">{error}</p> : context.areas.length === 0 ? <p className="calendar-modal__description" role="status">No hay áreas disponibles para planificar en este momento.</p> : <form className="calendar-modal__form" onSubmit={submit}>
        {error && <p className="calendar-modal__error" role="alert">{error}</p>}
        <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-area">Área</label><select className="calendar-modal__control" id="manual-area" aria-label="Área" value={form.areaId} onChange={update('areaId')} required disabled={submitting || context.areas.length === 1}><option value="">Seleccionar área</option>{context.areas.map((area) => <option key={area.id} value={area.id}>{area.nombre ?? area.name}</option>)}</select></div>
        <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-type">Tipo de entrada</label><select className="calendar-modal__control" id="manual-type" aria-label="Tipo de entrada" value={form.type} onChange={update('type')} disabled={submitting}><option value="catalog">Tarea de catálogo</option><option value="ad_hoc">Actividad ad hoc</option></select></div>
        {form.type === 'catalog' ? <>
          <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-task">Tarea de catálogo</label><select className="calendar-modal__control" id="manual-task" aria-label="Tarea de catálogo" value={form.taskId} onChange={update('taskId')} required disabled={submitting}><option value="">Seleccionar tarea</option>{context.tasks.map((task) => { const taskId = task.id_tarea ?? task.id; return <option key={taskId} value={taskId}>{task.nombre ?? task.name}</option> })}</select></div>
          {classification === 'quantitative' && <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-branch">Sucursal</label><select className="calendar-modal__control" id="manual-branch" aria-label="Sucursal" value={form.branchId} onChange={update('branchId')} disabled={submitting}><option value="">Sin sucursal específica</option>{context.branches.map((branch) => <option key={branch.id_sucursal ?? branch.id} value={branch.id_sucursal ?? branch.id}>{branch.nombre ?? branch.name}</option>)}</select></div>}
          <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-note">Nota de planificación</label><textarea className="calendar-modal__control calendar-modal__control--textarea" id="manual-note" aria-label="Nota de planificación" maxLength={classification === 'qualitative' ? 200 : undefined} value={form.note} onChange={update('note')} disabled={submitting} /></div>
          {startsCompletedAvailable && <label className="calendar-modal__checkbox"><input type="checkbox" checked={form.startsCompleted} onChange={update('startsCompleted')} disabled={submitting} /> Crear como completada</label>}
        </> : <><div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-name">Nombre</label><input className="calendar-modal__control" id="manual-name" aria-label="Nombre" maxLength="100" value={form.name} onChange={update('name')} required disabled={submitting} /></div><div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-description">Descripción</label><textarea className="calendar-modal__control calendar-modal__control--textarea" id="manual-description" aria-label="Descripción" maxLength="200" value={form.description} onChange={update('description')} disabled={submitting} /></div></>}
        <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-date">Fecha programada</label><input className="calendar-modal__control" id="manual-date" aria-label="Fecha programada" type="date" value={form.date} onChange={update('date')} min={form.type === 'catalog' ? today : undefined} required disabled={submitting} /></div>
        {pastCatalogDate && <p className="calendar-modal__warning" role="status">{PAST_CATALOG_MESSAGE}</p>}
        {absentDate && <p className="calendar-modal__warning" role="status">{ABSENCE_CONFLICT_MESSAGE}</p>}
        <div className="calendar-modal__footer"><button type="button" className="calendar-modal__button calendar-modal__button--secondary" onClick={onClose} disabled={submitting}>Cancelar</button><button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting || pastCatalogDate}>{submitting ? 'Creando...' : 'Crear entrada'}</button></div>
      </form>}
    </section>
  </div>
}

function OccurrenceDialog({ occurrence, onClose, onComplete, onReschedule, onManualCommand }) {
  const dialogRef = useRef(null)
  const closeButton = useRef(null)
  const [mode, setMode] = useState(null)
  const [targetDate, setTargetDate] = useState(occurrence.effective_date ?? '')
  const [reason, setReason] = useState('')
  const [planningNote, setPlanningNote] = useState(occurrence.planning_note ?? '')
  const [branchId, setBranchId] = useState(occurrence.branch_id ? String(occurrence.branch_id) : '')
  const [name, setName] = useState(occurrence.name ?? occurrenceTitle(occurrence))
  const [description, setDescription] = useState(occurrence.description ?? '')
  const [manualBranches, setManualBranches] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const commandKeyRef = useRef(null)
  const titleId = 'occurrence-dialog-title'
  const descriptionId = 'occurrence-dialog-description'
  const isAutomatic = !occurrence.provenance
  const isManualCatalog = occurrence.provenance === 'manual_catalog'
  const isAdHoc = occurrence.provenance === 'ad_hoc'
  const isPendingManual = (isManualCatalog || isAdHoc) && occurrence.status === 'pendiente'
  const canComplete = isAutomatic && (occurrence.status === 'pendiente' || occurrence.status === 'diferida')
  const canReschedule = isAutomatic && occurrence.status === 'pendiente'
  const canManualReschedule = isPendingManual && isManualCatalog && occurrence.classification === 'quantitative'
  const canManualCancel = isPendingManual && (isAdHoc || occurrence.classification === 'qualitative')
  const canScopeLoss = isPendingManual && isManualCatalog && occurrence.scope_loss_justification_available === true

  useEffect(() => {
    if (mode !== 'update' || !isManualCatalog) return undefined
    let active = true
    getManualPlanningContext().then((context) => {
      if (active) setManualBranches(context.branches ?? [])
    }).catch((requestError) => {
      if (active) setError(errorMessage(requestError))
    })
    return () => { active = false }
  }, [isManualCatalog, mode])

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
      if (isAutomatic) {
        if (mode === 'complete') await onComplete(occurrence.occurrence_id, commandKeyRef.current)
        else await onReschedule(occurrence.occurrence_id, { target_date: targetDate, reason }, commandKeyRef.current)
      } else {
        const body = mode === 'update'
          ? isManualCatalog
            ? { planning_note: planningNote, ...(branchId ? { branch_id: Number(branchId) } : {}) }
            : { name, description }
          : mode === 'reschedule' ? { target_date: targetDate }
            : mode === 'scope-loss' ? { comment: reason }
              : { reason }
        await onManualCommand(mode, occurrence.manual_id, body, commandKeyRef.current)
      }
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
          {occurrence.provenance_label && <><dt>Procedencia</dt><dd>{occurrence.provenance_label}</dd></>}
          {occurrence.provenance === 'manual_catalog' && <>
            <dt>Clasificación</dt><dd>{CLASSIFICATION_LABELS[occurrence.classification] ?? occurrence.classification}</dd>
            {occurrence.planning_note ? <><dt>Nota de planificación</dt><dd>{occurrence.planning_note}</dd></> : null}
          </>}
          {occurrence.provenance === 'ad_hoc' && occurrence.description && <><dt>Descripción</dt><dd>{occurrence.description}</dd></>}
          {coverage?.jornada && <><dt>Jornada</dt><dd>{JORNADA_LABELS[coverage.jornada] ?? coverage.jornada}</dd></>}
          {coverage?.aplica_ambas_jornadas !== undefined && <><dt>Cobertura</dt><dd>{coverage.aplica_ambas_jornadas ? 'Ambas jornadas' : 'Una jornada'}</dd></>}
        </dl>
        {error && <p className="calendar-modal__error" role="alert">{error}</p>}
        {canComplete && !mode && <div className="calendar-modal__actions">
          <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('complete')}>Completar</button>
          {canReschedule && <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('reschedule')}>Reprogramar</button>}
        </div>}
        {isPendingManual && !mode && <div className="calendar-modal__actions">
          <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('update')}>Actualizar</button>
          <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('complete')}>Completar</button>
          {canManualReschedule && <button type="button" className="calendar-modal__button calendar-modal__button--primary" onClick={() => selectMode('reschedule')}>Reprogramar</button>}
          {canManualCancel && <button type="button" className="calendar-modal__button calendar-modal__button--secondary" onClick={() => selectMode('cancel')}>Cancelar entrada</button>}
          {canScopeLoss && <button type="button" className="calendar-modal__button calendar-modal__button--secondary" onClick={() => selectMode('scope-loss')}>Justificar pérdida de alcance</button>}
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
        {isPendingManual && mode === 'update' && <form className="calendar-modal__form" onSubmit={submit}>
          {isManualCatalog ? <>
            <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-update-note">Nota de planificación</label><textarea className="calendar-modal__control calendar-modal__control--textarea" id="manual-update-note" aria-label="Nota de planificación" value={planningNote} maxLength="200" disabled={submitting} onChange={(event) => setPlanningNote(event.target.value)} /></div>
            <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-update-branch">Sucursal</label><select className="calendar-modal__control" id="manual-update-branch" aria-label="Sucursal" value={branchId} disabled={submitting} onChange={(event) => setBranchId(event.target.value)}><option value="">Sin cambio de sucursal</option>{manualBranches.map((branch) => <option key={branch.id_sucursal ?? branch.id} value={branch.id_sucursal ?? branch.id}>{branch.nombre ?? branch.name}</option>)}</select></div>
          </> : <>
            <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-update-name">Nombre</label><input className="calendar-modal__control" id="manual-update-name" aria-label="Nombre" value={name} maxLength="100" required disabled={submitting} onChange={(event) => setName(event.target.value)} /></div>
            <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-update-description">Descripción</label><textarea className="calendar-modal__control calendar-modal__control--textarea" id="manual-update-description" aria-label="Descripción" value={description} maxLength="200" disabled={submitting} onChange={(event) => setDescription(event.target.value)} /></div>
          </>}
          <div className="calendar-modal__footer"><button type="button" className="calendar-modal__button calendar-modal__button--secondary" disabled={submitting} onClick={() => setMode(null)}>Volver</button><button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting}>{submitting ? 'Actualizando...' : 'Guardar cambios'}</button></div>
        </form>}
        {isPendingManual && mode === 'reschedule' && <form className="calendar-modal__form" onSubmit={submit}>
          <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-target-date">Nueva fecha</label><input className="calendar-modal__control" id="manual-target-date" aria-label="Nueva fecha" type="date" required value={targetDate} disabled={submitting} onChange={(event) => setTargetDate(event.target.value)} /></div>
          <div className="calendar-modal__footer"><button type="button" className="calendar-modal__button calendar-modal__button--secondary" disabled={submitting} onClick={() => setMode(null)}>Volver</button><button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting}>{submitting ? 'Reprogramando...' : 'Confirmar reprogramación'}</button></div>
        </form>}
        {isPendingManual && ['complete', 'cancel', 'scope-loss'].includes(mode) && <form className="calendar-modal__form" onSubmit={submit}>
          <div className="calendar-modal__field"><label className="calendar-modal__label" htmlFor="manual-command-reason">{mode === 'scope-loss' ? 'Justificación' : 'Motivo'}</label><textarea className="calendar-modal__control calendar-modal__control--textarea" id="manual-command-reason" aria-label={mode === 'scope-loss' ? 'Justificación' : 'Motivo'} value={reason} maxLength={mode === 'scope-loss' ? 100 : 500} disabled={submitting} onChange={(event) => setReason(event.target.value)} /></div>
          <div className="calendar-modal__footer"><button type="button" className="calendar-modal__button calendar-modal__button--secondary" disabled={submitting} onClick={() => setMode(null)}>Volver</button><button type="submit" className="calendar-modal__button calendar-modal__button--primary" disabled={submitting}>{submitting ? 'Guardando...' : mode === 'complete' ? 'Confirmar completar' : mode === 'cancel' ? 'Confirmar cancelación' : 'Confirmar justificación'}</button></div>
        </form>}
      </section>
    </div>
  )
}

export default function CalendarioAreaPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => monthFromDate(new Date()))
  const [occurrences, setOccurrences] = useState([])
  const [manualCatalogEntries, setManualCatalogEntries] = useState([])
  const [adHocActivities, setAdHocActivities] = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [absenceError, setAbsenceError] = useState('')
  const [performance, setPerformance] = useState(null)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [performanceError, setPerformanceError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [manualPlanningDraft, setManualPlanningDraft] = useState(null)
  const [depositTerminal, setDepositTerminal] = useState('')
  const triggerRef = useRef(null)
  const calendarRef = useRef(null)
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

    if (occurrenceResult.status === 'fulfilled') {
      setOccurrences(occurrenceResult.value.occurrences)
      setManualCatalogEntries(occurrenceResult.value.manual_catalog_entries ?? [])
      setAdHocActivities(occurrenceResult.value.ad_hoc_activities ?? [])
    }
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

  function runManualCommand(action, entryId, body, key) {
    const commands = {
      update: (id, payload, commandKey) => selected?.provenance === 'manual_catalog'
        ? updateManualCatalogEntry(id, payload, commandKey)
        : updateAdHocActivity(id, payload, commandKey),
      complete: (id, payload, commandKey) => selected?.provenance === 'manual_catalog'
        ? completeManualCatalogEntry(id, payload, commandKey)
        : completeAdHocActivity(id, payload, commandKey),
      reschedule: rescheduleManualCatalogEntry,
      cancel: (id, payload, commandKey) => selected?.provenance === 'manual_catalog'
        ? cancelManualCatalogEntry(id, payload, commandKey)
        : cancelAdHocActivity(id, payload, commandKey),
      'scope-loss': justifyManualCatalogEntryScopeLoss,
    }
    return runCommand(() => commands[action](entryId, body, key))
  }

  async function handleManualPlanningCreated(createdDate) {
    setManualPlanningDraft(null)
    const created = parseIsoDate(createdDate)
    if (created && monthFromDate(created) !== month) {
      calendarRef.current?.getApi?.().gotoDate(created)
      return
    }
    await loadMonth()
  }

  const absenceDates = absences
    .filter((absence) => absence && absence.active !== false)
    .map((absence) => absence.date ?? absence.fecha ?? absence.effective_date)
    .filter(Boolean)

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
      <div className="page-header"><h1>Calendario del área</h1><button type="button" className="calendar-modal__button calendar-modal__button--secondary" onClick={() => setManualPlanningDraft({ date: localIsoDate() })}>Planificar tarea manual</button></div>
      <MonthlyPerformancePanel loading={performanceLoading} month={month} performance={performance} error={performanceError} onRetry={() => loadPerformance()} />
      {error && <div className="calendario-area-state calendario-area-state--error" role="alert"><p>{error}</p><button type="button" onClick={() => loadMonth()}>Reintentar</button></div>}
      {depositTerminal && <div className="calendario-area-state calendario-area-state--success" role="status"><p>{depositTerminal}</p></div>}
      {absenceError && <div className="calendario-area-state calendario-area-state--error" role="alert"><p>No se pudieron cargar las ausencias del área: {absenceError}</p><button type="button" onClick={() => loadAbsences()}>Reintentar ausencias</button></div>}
      {loading && <div className="calendario-area-state calendario-area-state--loading" role="status" aria-busy="true"><span className="calendario-area-skeleton" aria-hidden="true" /><span className="calendario-area-skeleton calendario-area-skeleton--short" aria-hidden="true" /><span className="sr-only">Cargando calendario...</span></div>}
      <>
        {!loading && occurrences.length + manualCatalogEntries.length + adHocActivities.length === 0 && <div className="calendario-area-state calendario-area-state--empty" role="status"><strong>Mes sin tareas programadas</strong><p>No hay tareas programadas para este mes.</p></div>}
        <div className="calendario-area-calendar calendario-area-calendar__surface" aria-busy={loading}><div className="calendario-area-calendar__scroll"><FullCalendar ref={calendarRef} plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin, multiMonthPlugin]} headerToolbar={{ start: 'prev,today,next', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear' }} views={{ listWeek: { buttonText: 'Lista semanal' }, multiMonthYear: { buttonText: 'Año' } }} initialView="dayGridMonth" locale="es" buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista', year: 'Año' }} events={[...occurrencesToCalendarEvents(selectVisibleOccurrences(occurrences, absences)), ...manualCatalogEntriesToCalendarEvents(manualCatalogEntries), ...adHocActivitiesToCalendarEvents(adHocActivities), ...absencesToCalendarEvents(absences)]} eventClassNames={(info) => info.event.extendedProps.calendar_event_type === 'absence' ? 'calendario-area-event-chip calendario-area-event-chip--absence' : 'calendario-area-event-chip calendario-area-event-chip--occurrence'} eventContent={(info) => info.event.extendedProps.calendar_event_type === 'absence' ? info.event.title : <span className="calendario-area-event-chip__content"><span className="calendario-area-event-chip__title">{info.event.title}</span><OccurrenceStatusMarker marker={info.event.extendedProps.status_marker} label={info.event.extendedProps.status_label} /></span>} eventDidMount={(info) => { if (info.event.extendedProps.calendar_event_type !== 'absence') { info.el.setAttribute('aria-label', info.event.extendedProps.aria_label); info.el.setAttribute('title', info.event.extendedProps.aria_label) } }} eventClick={(info) => { if (info.event.extendedProps.calendar_event_type === 'absence') return; const occurrence = { ...info.event.extendedProps, id: info.event.id, occurrence_id: info.event.extendedProps.occurrence_id, task: info.event.extendedProps.task }; const date = encodeURIComponent(occurrence.effective_date ?? occurrence.scheduled_date ?? ''); if (occurrence.provenance === 'manual_catalog' && occurrence.execution_kind === 'inventory_area') { navigate(`/calendario-area/inventario/manual/${encodeURIComponent(occurrence.manual_id ?? occurrence.occurrence_id)}?fecha=${date}`); return } if (occurrence.task?.mode === 'inventory_area') { navigate(`/calendario-area/inventario/${encodeURIComponent(occurrence.occurrence_id ?? occurrence.id)}?fecha=${date}`); return } triggerRef.current = info.el ?? info.jsEvent?.target; setSelected(occurrence) }} datesSet={handleDatesSet} dateClick={(arg) => { if (!arg?.allDay || selected || manualPlanningDraft) return; setManualPlanningDraft({ date: arg.dateStr.slice(0, 10) }) }} height="auto" /></div></div>
      </>
      {selected?.task?.mode === 'deposit_review' ? <DepositReviewWorklistModal occurrenceVirtualId={selected.id} onClose={() => setSelected(null)} onTerminal={handleDepositTerminal} /> : selected && <OccurrenceDialog occurrence={selected} onClose={() => setSelected(null)} onComplete={(id, key) => runCommand(() => completeAreaOccurrence(id, key))} onReschedule={(id, body, key) => runCommand(() => rescheduleAreaOccurrence(id, body, key))} onManualCommand={runManualCommand} />}
      {manualPlanningDraft && <ManualPlanningDialog initialDate={manualPlanningDraft.date} absenceDates={absenceDates} onClose={() => setManualPlanningDraft(null)} onCreated={handleManualPlanningCreated} />}
    </section>
  )
}
