function taskTitle(task, id) {
  if (typeof task === 'string') return task
  return task?.nombre ?? task?.titulo ?? task?.name ?? `Tarea ${id}`
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
      occurrence_id: occurrence.occurrence_id,
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
