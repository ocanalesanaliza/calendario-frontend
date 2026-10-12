import { commandCalendarArea, getCalendarArea, postCalendarArea } from './calendarAreaApi'
import { normalizeMonthlyAreaOccurrencesResponse } from './monthlyAreaOccurrence'

export async function getMonthlyAreaOccurrences(month) {
  const response = await getCalendarArea(`/api/calendar/my-area/monthly-occurrences/?month=${encodeURIComponent(month)}`, 'No se pudo cargar el calendario del área.')
  return normalizeMonthlyAreaOccurrencesResponse(response)
}

export function getMonthlyAreaAbsences(month) {
  return getCalendarArea(`/api/calendar/my-area/monthly-absences/?month=${encodeURIComponent(month)}`, 'No se pudieron cargar las ausencias del área.')
}

export function getMonthlyAreaPerformance(month) {
  return getCalendarArea(`/api/calendar/my-area/monthly-performance/?month=${encodeURIComponent(month)}`, 'No se pudo cargar el rendimiento mensual del área.')
}

export function completeAreaOccurrence(occurrenceId, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/occurrences/${occurrenceId}/complete/`, undefined, 'No se pudo completar la tarea del área.', idempotencyKey)
}

export function rescheduleAreaOccurrence(occurrenceId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/occurrences/${occurrenceId}/reschedule/`, body, 'No se pudo reprogramar la tarea del área.', idempotencyKey)
}

export function closeMonthlyAreaPerformance(body) {
  return postCalendarArea('/api/calendar/area-performance/close/', body, 'No se pudo cerrar el rendimiento mensual del área.')
}

export function correctMonthlyAreaPerformance(body) {
  return postCalendarArea('/api/calendar/area-performance/correct/', body, 'No se pudo corregir el rendimiento mensual del área.')
}
