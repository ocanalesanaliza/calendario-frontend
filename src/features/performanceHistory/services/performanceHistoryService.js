import { apiRequest } from '../../../services/apiClient'
const HISTORY_ENDPOINT = '/api/calendar/performance/history/'

async function parseHistoryResponse(response) {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  const error = new Error('No fue posible cargar el historial de rendimiento mensual.')
  error.status = response.status
  throw error
}

export async function getPerformanceHistory({ areaId, businessDate, fromMonth, toMonth, cursor, limit } = {}) {
  const params = new URLSearchParams()
  if (areaId !== undefined && areaId !== null && areaId !== '') params.set('area_id', String(areaId))
  if (businessDate) params.set('business_date', businessDate)
  if (fromMonth) params.set('from_month', fromMonth)
  if (toMonth) params.set('to_month', toMonth)
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  const query = params.toString()
  return parseHistoryResponse(await apiRequest(`${HISTORY_ENDPOINT}${query ? `?${query}` : ''}`, { method: 'GET' }))
}
