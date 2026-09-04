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
