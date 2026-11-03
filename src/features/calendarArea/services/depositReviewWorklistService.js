import { getCalendarArea, postCalendarArea } from './calendarAreaApi'

export async function getDepositReviewWorklist(occurrenceVirtualId) {
  const response = await getCalendarArea(`/api/depositos/ga/bandejas/${occurrenceVirtualId}/`, 'No se pudo cargar la bandeja de revisión de depósitos.')
  return response.worklist
}

export function getDepositReviewDetail(occurrenceVirtualId, caseId) {
  return getCalendarArea(`/api/depositos/ga/bandejas/${occurrenceVirtualId}/casos/${caseId}/detalle/`, 'No se pudo cargar el detalle del depósito.')
}

export function recordDepositReviewDecision(occurrenceVirtualId, caseId, body) {
  return postCalendarArea(`/api/depositos/ga/bandejas/${occurrenceVirtualId}/casos/${caseId}/decisiones/`, body, 'No se pudo guardar la decisión de revisión.')
}
