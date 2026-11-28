import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/depositos/ga/historial/'

async function request(path, options = { method: 'GET' }, fallback = 'No fue posible cargar el historial de depósitos.') {
  const response = await apiRequest(path, options)
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const error = new Error(fallback)
  error.status = response.status
  throw error
}

function rangeQuery({ from, to, area_id: areaId } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (areaId) params.set('area_id', areaId)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function getDepositHistory(range) {
  return request(`${BASE}${rangeQuery(range)}`)
}

export function getDepositHistoryBranch(branchId, range) {
  return request(`${BASE}sucursales/${branchId}/${rangeQuery(range)}`)
}

export function getDepositHistoryClosure(closureId, params = {}) {
  return request(`${BASE}cierres/${closureId}/${rangeQuery(params)}`)
}

export function getDepositHistoryCompliance() {
  return request('/api/depositos/cumplimiento/')
}

export function openSubmittedOverdueDepositReport(obligationId) {
  return request(`/api/depositos/obligaciones/${obligationId}/reporte/`, { method: 'POST' }, 'No fue posible cargar el reporte vencido enviado.')
}
