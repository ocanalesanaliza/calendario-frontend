import { getCalendarArea, postCalendarArea } from './calendarAreaApi'

export function getDepositReviewWorklist(occurrenceVirtualId) {
  return getCalendarArea(`/api/depositos/ga/bandejas/${occurrenceVirtualId}/`, 'No se pudo cargar la bandeja de revisión de depósitos.')
}

export function recordDepositReviewDecision(occurrenceVirtualId, caseId, body) {
  return postCalendarArea(`/api/depositos/ga/bandejas/${occurrenceVirtualId}/casos/${caseId}/decisiones/`, body, 'No se pudo guardar la decisión de revisión.')
}
