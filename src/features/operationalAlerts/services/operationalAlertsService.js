import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/calendar/operational-alerts/'

async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const error = new Error(data?.detail || data?.message || fallbackMessage)
  error.status = response.status
  throw error
}

function query(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}` : ''
}

export function getOperationalAlerts({ scope = 'active', cursor, limit } = {}) {
  return apiRequest(`${BASE}${query({ scope, cursor, limit })}`, { method: 'GET' })
    .then((response) => parseResponse(response, 'Unable to load operational alerts.'))
}

export function getOperationalAlertsCount() {
  return apiRequest(`${BASE}count/`, { method: 'GET' })
    .then((response) => parseResponse(response, 'Unable to load the operational-alert count.'))
}
