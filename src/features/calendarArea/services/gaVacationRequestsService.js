import { commandCalendarArea, getCalendarArea } from './calendarAreaApi'

const basePath = '/api/calendar/ga-vacation-requests/'

export function getGAVacationRequests() {
  return getCalendarArea(basePath, 'No se pudieron cargar las solicitudes de vacaciones.')
}

export function getGAVacationRequest(requestId) {
  return getCalendarArea(`${basePath}${requestId}/`, 'No se pudo cargar la solicitud de vacaciones.')
}

export function createGAVacationRequest(body, idempotencyKey) {
  return commandCalendarArea(basePath, body, 'No se pudo crear la solicitud de vacaciones.', idempotencyKey)
}

export function actOnGAVacationRequest(requestId, action, body, idempotencyKey) {
  return commandCalendarArea(`${basePath}${requestId}/${action}/`, body, 'No se pudo actualizar la solicitud de vacaciones.', idempotencyKey)
}
