function taskTitle(task, id) {
  if (typeof task === 'string') return task
  return task?.nombre ?? task?.titulo ?? task?.name ?? `Tarea ${id}`
}

const SLOT_LABELS = {
  morning: 'Mañana',
  manana: 'Mañana',
  afternoon: 'Tarde',
  tarde: 'Tarde',
  full_day: 'Jornada completa',
}

const TYPE_LABELS = {
  capacitacion: 'Capacitación',
}

const OCCURRENCE_STATUS_PRESENTATIONS = {
  pendiente: { className: 'calendar-occurrence--pendiente', label: 'Pendiente', marker: 'pending' },
  completada: { className: 'calendar-occurrence--completada', label: 'Completada', marker: 'complete' },
  vencida: { className: 'calendar-occurrence--vencida', label: 'Vencida', marker: 'overdue' },
  justificada: { className: 'calendar-occurrence--justificada', label: 'Justificada', marker: 'justified' },
  diferida: { className: 'calendar-occurrence--diferida', label: 'Diferida', marker: 'deferred' },
}

const MONTHLY_PERFORMANCE_STATES = new Set(['provisional', 'closed', 'corrected', 'not_applicable'])

function safeUnknownStatusLabel(status) {
  if (typeof status !== 'string') return null
  const label = status.trim()
  return /^[\p{L}\p{N}][\p{L}\p{N} -]{0,38}$/u.test(label) ? label : null
}

export function occurrenceStatusPresentation(status) {
  if (OCCURRENCE_STATUS_PRESENTATIONS[status]) return OCCURRENCE_STATUS_PRESENTATIONS[status]
  const safeLabel = MONTHLY_PERFORMANCE_STATES.has(status) ? null : safeUnknownStatusLabel(status)
  return { className: 'calendar-occurrence--pendiente', label: safeLabel ?? 'Pendiente', marker: 'pending' }
}

function absenceDate(absence) {
  return absence.date ?? absence.fecha ?? absence.effective_date
}

function absenceId(absence, index) {
  return absence.id ?? absence.absence_id ?? `${absence.source ?? 'absence'}-${absenceDate(absence)}-${absence.slot ?? 'full_day'}-${index}`
}

function absenceTitle(absence) {
  const slot = SLOT_LABELS[absence.slot] ?? absence.slot
  const source = absence.source === 'vacation' ? 'Vacaciones' : 'Situación especial activa'
  const type = absence.type_label ?? absence.typeLabel ?? TYPE_LABELS[absence.type ?? absence.tipo] ?? absence.type ?? absence.tipo
  return [source, source === 'Vacaciones' ? null : type, slot].filter(Boolean).join(' · ')
}

export function absenceToCalendarEvent(absence, index = 0) {
  const source = absence.source ?? 'special_situation'
  const type = absence.type ?? absence.tipo
  const slot = absence.slot ?? absence.jornada

  return {
    id: `absence-${source}-${absenceId({ ...absence, source, slot }, index)}`,
    title: absenceTitle({ ...absence, source, type, slot }),
    start: absenceDate(absence),
    allDay: true,
    editable: false,
    startEditable: false,
    durationEditable: false,
    classNames: [`calendar-absence--${source}`],
    backgroundColor: source === 'vacation' ? '#2563eb' : '#b45309',
    borderColor: source === 'vacation' ? '#1d4ed8' : '#92400e',
    extendedProps: {
      ...absence,
      calendar_event_type: 'absence',
      source,
      slot,
      type,
    },
  }
}

export function absencesToCalendarEvents(absences = []) {
  return absences.map(absenceToCalendarEvent)
}

const SHIFT_ALIASES = {
  morning: 'morning',
  manana: 'morning',
  afternoon: 'afternoon',
  tarde: 'afternoon',
  full_day: 'full_day',
}

function normalizedShift(shift) {
  return SHIFT_ALIASES[shift]
}

function occurrenceShift(occurrence) {
  const coverage = occurrence.coverage_snapshot
  if (!coverage?.known) return undefined
  if (coverage.aplica_ambas_jornadas) return 'full_day'
  return normalizedShift(coverage.jornada)
}

function absenceCoversOccurrence(absence, occurrence) {
  if (!['vacation', 'special_situation'].includes(absence.source) || absence.active === false) return false
  if (absenceDate(absence) !== occurrence.effective_date) return false

  const shift = occurrenceShift(occurrence)
  const absenceShift = normalizedShift(absence.slot ?? absence.jornada)
  return shift !== undefined && (absenceShift === 'full_day' || absenceShift === shift)
}

export function selectVisibleOccurrences(occurrences = [], absences = []) {
  return occurrences.filter((occurrence) => !absences.some((absence) => absenceCoversOccurrence(absence, occurrence)))
}

export function occurrenceToCalendarEvent(occurrence) {
  const internalOccurrenceId = occurrence.occurrence_id ?? occurrence.id
  const calendarEventId = occurrence.id ?? internalOccurrenceId
  const statusPresentation = occurrenceStatusPresentation(occurrence.status)
  const title = taskTitle(occurrence.task, internalOccurrenceId)

  return {
    id: String(calendarEventId),
    title,
    start: occurrence.effective_date,
    allDay: occurrence.all_day,
    editable: false,
    classNames: [statusPresentation.className],
    extendedProps: {
      occurrence_id: internalOccurrenceId,
      status: occurrence.status,
      status_class: statusPresentation.className,
      status_label: statusPresentation.label,
      status_marker: statusPresentation.marker,
      aria_label: `${title} · ${statusPresentation.label}`,
      template: occurrence.template,
      template_version: occurrence.template_version,
      coverage_snapshot: occurrence.coverage_snapshot,
      area: occurrence.area,
      task: occurrence.task,
      scheduled_date: occurrence.scheduled_date,
      effective_date: occurrence.effective_date,
      weight: occurrence.weight,
      all_day: occurrence.all_day,
    },
  }
}

export function occurrencesToCalendarEvents(occurrences = []) {
  return occurrences.map(occurrenceToCalendarEvent)
}
