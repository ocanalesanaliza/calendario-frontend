import { apiRequest } from '../../../services/apiClient'

function formatError(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatError).filter(Boolean).join(' ')
  if (detail && typeof detail === 'object') return Object.values(detail).map(formatError).filter(Boolean).join(' ')
  return ''
}

export async function parseCalendarAreaResponse(response, fallbackMessage) {
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(formatError(data?.detail) || formatError(data) || fallbackMessage)
    error.status = response.status
    error.detail = data?.detail
    error.fields = data
    throw error
  }
  return data
}

export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `calendar-area-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function getCalendarArea(path, fallbackMessage) {
  return parseCalendarAreaResponse(await apiRequest(path), fallbackMessage)
}

export async function commandCalendarArea(path, body, fallbackMessage, idempotencyKey) {
  const key = idempotencyKey ?? createIdempotencyKey()
  return parseCalendarAreaResponse(await apiRequest(path, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), fallbackMessage)
}

export async function postCalendarArea(path, body, fallbackMessage) {
  return parseCalendarAreaResponse(await apiRequest(path, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), fallbackMessage)
}
