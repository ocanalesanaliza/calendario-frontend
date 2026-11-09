import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/depositos/ga/historial/'

async function request(path) {
  const response = await apiRequest(path, { method: 'GET' })
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const error = new Error('No fue posible cargar el historial de depósitos.')
  error.status = response.status
  throw error
}

function rangeQuery({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function getDepositHistory(range) {
  return request(`${BASE}${rangeQuery(range)}`)
}

export function getDepositHistoryBranch(branchId, range) {
  return request(`${BASE}sucursales/${branchId}/${rangeQuery(range)}`)
}

export function getDepositHistoryClosure(closureId) {
  return request(`${BASE}cierres/${closureId}/`)
}
