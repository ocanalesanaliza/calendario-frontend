import { apiRequest } from '../../../services/apiClient'

export function formatError(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatError).filter(Boolean).join(' ')
  if (typeof detail === 'object') return Object.values(detail).map(formatError).filter(Boolean).join(' ')
  return String(detail)
}

export async function parseResponse(res, fallbackMessage) {
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(formatError(data.detail) || formatError(data) || fallbackMessage)
    error.status = res.status
    error.fields = typeof data.detail === 'object' ? data.detail : data
    throw error
  }
  return data
}

export async function getGerentesOperaciones() {
  const res = await apiRequest('/api/calendar/go/')
  return parseResponse(res, 'No se pudieron cargar los gerentes de operaciones.')
}

export async function createGerenteOperaciones(body) {
  const res = await apiRequest('/api/calendar/go/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return parseResponse(res, 'No se pudo crear el gerente de operaciones.')
}

export async function updateGerenteOperaciones(id, body) {
  const res = await apiRequest(`/api/calendar/go/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return parseResponse(res, 'No se pudo actualizar el gerente de operaciones.')
}

export async function assignArea(id, areaId) {
  const res = await apiRequest(`/api/calendar/go/${id}/areas/`, {
    method: 'POST',
    body: JSON.stringify({ area_id: areaId }),
  })
  return parseResponse(res, 'No se pudo asignar el área.')
}

export async function reassignArea(id, areaId) {
  const res = await apiRequest(`/api/calendar/go/${id}/areas/${areaId}/`, { method: 'PUT' })
  return parseResponse(res, 'No se pudo reasignar el área.')
}

export async function deactivateGerenteOperaciones(id) {
  const res = await apiRequest(`/api/calendar/go/${id}/deactivation/`, { method: 'POST' })
  return parseResponse(res, 'No se pudo desactivar el gerente de operaciones.')
}

export async function resetGerenteOperacionesPassword(id) {
  const res = await apiRequest(`/api/calendar/go/${id}/password-reset/`, { method: 'POST' })
  return parseResponse(res, 'No se pudo resetear la contraseña.')
}
