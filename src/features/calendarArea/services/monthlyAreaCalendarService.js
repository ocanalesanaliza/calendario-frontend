import { commandCalendarArea, getCalendarArea, patchCalendarArea, postCalendarArea } from './calendarAreaApi'
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

export async function getManualPlanningContext() {
  const [areas, branches] = await Promise.all([
    getCalendarArea('/api/sucursales/areas-elegibles/', 'No se pudieron cargar las áreas disponibles.'),
    getCalendarArea('/api/sucursales/', 'No se pudieron cargar las sucursales disponibles.'),
  ])
  return {
    areas: Array.isArray(areas?.results) ? areas.results : [],
    branches: Array.isArray(branches?.results) ? branches.results : [],
  }
}

export function createManualCatalogEntry(body, idempotencyKey) {
  return commandCalendarArea('/api/calendar/my-area/manual-catalog-entries/', body, 'No se pudo crear la tarea manual de catálogo.', idempotencyKey)
}

export function createAdHocActivity(body, idempotencyKey) {
  return commandCalendarArea('/api/calendar/my-area/ad-hoc-activities/', body, 'No se pudo crear la actividad personal.', idempotencyKey)
}

export function updateManualCatalogEntry(entryId, body, idempotencyKey) {
  return patchCalendarArea(`/api/calendar/my-area/manual-catalog-entries/${entryId}/`, body, 'No se pudo actualizar la tarea manual de catálogo.', idempotencyKey)
}

export function completeManualCatalogEntry(entryId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/manual-catalog-entries/${entryId}/complete/`, body, 'No se pudo completar la tarea manual de catálogo.', idempotencyKey)
}

export function rescheduleManualCatalogEntry(entryId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/manual-catalog-entries/${entryId}/reschedule/`, body, 'No se pudo reprogramar la tarea manual de catálogo.', idempotencyKey)
}

export function cancelManualCatalogEntry(entryId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/manual-catalog-entries/${entryId}/cancel/`, body, 'No se pudo cancelar la tarea manual de catálogo.', idempotencyKey)
}

export function justifyManualCatalogEntryScopeLoss(entryId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/manual-catalog-entries/${entryId}/justify-scope-loss/`, body, 'No se pudo justificar la pérdida de alcance.', idempotencyKey)
}

export function updateAdHocActivity(activityId, body, idempotencyKey) {
  return patchCalendarArea(`/api/calendar/my-area/ad-hoc-activities/${activityId}/`, body, 'No se pudo actualizar la actividad personal.', idempotencyKey)
}

export function completeAdHocActivity(activityId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/ad-hoc-activities/${activityId}/complete/`, body, 'No se pudo completar la actividad personal.', idempotencyKey)
}

export function cancelAdHocActivity(activityId, body, idempotencyKey) {
  return commandCalendarArea(`/api/calendar/my-area/ad-hoc-activities/${activityId}/cancel/`, body, 'No se pudo cancelar la actividad personal.', idempotencyKey)
}

export function closeMonthlyAreaPerformance(body) {
  return postCalendarArea('/api/calendar/area-performance/close/', body, 'No se pudo cerrar el rendimiento mensual del área.')
}

export function correctMonthlyAreaPerformance(body) {
  return postCalendarArea('/api/calendar/area-performance/correct/', body, 'No se pudo corregir el rendimiento mensual del área.')
}
