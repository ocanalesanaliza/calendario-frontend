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

export function occurrenceToCalendarEvent(occurrence) {
  const occurrenceId = occurrence.occurrence_id ?? occurrence.id

  return {
    id: String(occurrenceId),
    title: taskTitle(occurrence.task, occurrenceId),
    start: occurrence.effective_date,
    allDay: occurrence.all_day,
    editable: false,
    extendedProps: {
      occurrence_id: occurrenceId,
      status: occurrence.status,
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
