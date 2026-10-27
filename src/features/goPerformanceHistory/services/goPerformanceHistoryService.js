import { apiRequest } from '../../../services/apiClient'

const AREAS_ENDPOINT = '/api/calendar/performance/areas/'
const HISTORY_ENDPOINT = '/api/calendar/performance/history/'

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const error = new Error(fallbackMessage)
  error.status = response.status
  throw error
}

function makeQuery(values, allowedKeys) {
  const params = new URLSearchParams()
  allowedKeys.forEach((key) => {
    const value = values?.[key]
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getGOAuthorizedAreas({ businessDate, fromMonth, toMonth } = {}) {
  const query = makeQuery({ business_date: businessDate, from_month: fromMonth, to_month: toMonth }, ['business_date', 'from_month', 'to_month'])
  return parseResponse(await apiRequest(`${AREAS_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar las áreas autorizadas para el rango seleccionado.')
}

export async function getGOAreaPerformanceHistory({ areaId, businessDate, fromMonth, toMonth, cursor, limit } = {}) {
  const query = makeQuery({ area_id: areaId, business_date: businessDate, from_month: fromMonth, to_month: toMonth, cursor, limit }, ['area_id', 'business_date', 'from_month', 'to_month', 'cursor', 'limit'])
  return parseResponse(await apiRequest(`${HISTORY_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar el historial de rendimiento de áreas.')
}
