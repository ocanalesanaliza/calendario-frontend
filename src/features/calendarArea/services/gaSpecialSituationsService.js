import { commandCalendarArea, getCalendarArea } from './calendarAreaApi'

const basePath = '/api/calendar/ga-special-situations/'

export function getGASpecialSituations() {
  return getCalendarArea(basePath, 'No se pudieron cargar las situaciones especiales.')
}

export function getCatalog(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return getCalendarArea(`${basePath}catalog/${query}`, 'No se pudo cargar el catálogo de situaciones especiales.')
}

export function getGASpecialSituation(situationId) {
  return getCalendarArea(`${basePath}${situationId}/`, 'No se pudo cargar la situación especial.')
}

export function createGASpecialSituation(body, idempotencyKey) {
  return commandCalendarArea(basePath, body, 'No se pudo crear la situación especial.', idempotencyKey)
}

export function deactivateGASpecialSituation(situationId, idempotencyKey) {
  return commandCalendarArea(`${basePath}${situationId}/deactivate/`, undefined, 'No se pudo desactivar la situación especial.', idempotencyKey)
}
