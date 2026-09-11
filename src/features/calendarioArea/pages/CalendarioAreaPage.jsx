import { useEffect, useRef, useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'

import { occurrencesToCalendarEvents } from '../adapters/calendarEvents'
import {
  completeAreaOccurrence,
  getMonthlyAreaOccurrences,
  rescheduleAreaOccurrence,
} from '../services/calendarioAreaService'
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

function OccurrenceDialog({ occurrence, onClose, onComplete, onReschedule }) {
  const closeButton = useRef(null)
  const [mode, setMode] = useState(null)
  const [targetDate, setTargetDate] = useState(occurrence.effective_date ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const titleId = 'occurrence-dialog-title'
  const descriptionId = 'occurrence-dialog-description'
  const pending = occurrence.status === 'pendiente'

  useEffect(() => {
    closeButton.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'complete') await onComplete(occurrence.occurrence_id)
      else await onReschedule(occurrence.occurrence_id, { target_date: targetDate, reason })
    } catch (requestError) {
      setError(errorMessage(requestError))
      setSubmitting(false)
    }
  }

  const coverage = occurrence.coverage_snapshot

  return (
    <div className="calendar-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
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
          <button type="button" onClick={() => setMode('complete')}>Completar</button>
          <button type="button" onClick={() => setMode('reschedule')}>Reprogramar</button>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!selected) triggerRef.current?.focus?.()
  }, [selected])

  async function loadMonth(keepError = false) {
    setLoading(true)
    if (!keepError) setError('')
    try {
      setOccurrences((await getMonthlyAreaOccurrences(month)).occurrences)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMonth() }, [month])

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
        return
      }
      throw requestError
    }
  }

  return (
    <section className="calendario-area-page">
      <div className="page-header"><h1>Calendario del área</h1></div>
      {error && <div role="alert">{error} <button type="button" onClick={() => loadMonth()}>Reintentar</button></div>}
      {loading ? <p>Cargando calendario...</p> : <>
        {occurrences.length === 0 && <p>No hay tareas programadas para este mes.</p>}
        <div className="calendario-area-calendar"><FullCalendar plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin, multiMonthPlugin]} headerToolbar={{ start: 'prev,today,next', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,multiMonthYear' }} views={{ listWeek: { buttonText: 'Lista semanal' }, multiMonthYear: { buttonText: 'Año' } }} initialView="dayGridMonth" locale="es" buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista', year: 'Año' }} events={occurrencesToCalendarEvents(occurrences)} eventClick={(info) => { triggerRef.current = info.el ?? info.jsEvent?.target; setSelected({ ...info.event.extendedProps, occurrence_id: info.event.extendedProps.occurrence_id, task: info.event.extendedProps.task }) }} datesSet={({ view }) => setMonth(monthFromDate(view.currentStart))} height="auto" /></div>
      </>}
      {selected && <OccurrenceDialog occurrence={selected} onClose={() => setSelected(null)} onComplete={(id) => runCommand(() => completeAreaOccurrence(id))} onReschedule={(id, body) => runCommand(() => rescheduleAreaOccurrence(id, body))} />}
    </section>
  )
}
