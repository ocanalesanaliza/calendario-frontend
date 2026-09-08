function taskTitle(task, id) {
  if (typeof task === 'string') return task
  return task?.nombre ?? task?.titulo ?? task?.name ?? `Tarea ${id}`
}

export function occurrenceToCalendarEvent(occurrence) {
  return {
    id: String(occurrence.id),
    title: taskTitle(occurrence.task, occurrence.id),
    start: occurrence.effective_date,
    allDay: occurrence.all_day,
    editable: false,
    extendedProps: {
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
