import { getCalendarArea, postCalendarArea } from './calendarAreaApi'

const basePath = '/api/calendar/area-templates/'

export function getAreaTemplates() {
  return getCalendarArea(basePath, 'No se pudieron cargar las plantillas del área.')
}

export function createAreaTemplate(body) {
  return postCalendarArea(basePath, body, 'No se pudo crear la plantilla del área.')
}

export function getAreaTemplate(templateId) {
  return getCalendarArea(`${basePath}${templateId}/`, 'No se pudo cargar la plantilla del área.')
}

export function getAreaTemplateVersions(templateId) {
  return getCalendarArea(`${basePath}${templateId}/versions/`, 'No se pudieron cargar las versiones de la plantilla.')
}

export function createAreaTemplateVersion(templateId, body) {
  return postCalendarArea(`${basePath}${templateId}/versions/`, body, 'No se pudo publicar la versión de la plantilla.')
}

export function archiveAreaTemplate(templateId) {
  return postCalendarArea(`${basePath}${templateId}/archive/`, undefined, 'No se pudo archivar la plantilla del área.')
}
