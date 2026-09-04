import { apiRequest } from '../../../services/apiClient'

function formatError(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatError).filter(Boolean).join(' ')
  if (typeof detail === 'object') return Object.values(detail).map(formatError).filter(Boolean).join(' ')
  return String(detail)
}

async function parseResponse(res, fallbackMessage) {
  const data = await res.json()
  if (!res.ok) throw new Error(formatError(data.detail) || fallbackMessage)
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
