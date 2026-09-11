import { getCalendarArea, postCalendarArea } from './calendarAreaApi'

function assignmentsPath(areaId) {
  return `/api/calendar/areas/${areaId}/template-assignments/`
}

export function getAreaTemplateAssignment(areaId) {
  return getCalendarArea(`/api/calendar/areas/${areaId}/template-assignment/`, 'No se pudo cargar la asignación de plantilla.')
}

export function assignAreaTemplate(areaId, body) {
  return postCalendarArea(assignmentsPath(areaId), body, 'No se pudo asignar la plantilla al área.')
}

export function cancelAreaTemplateAssignment(areaId, assignmentId) {
  return postCalendarArea(`${assignmentsPath(areaId)}${assignmentId}/cancel/`, { confirm: true }, 'No se pudo cancelar la asignación de plantilla.')
}
