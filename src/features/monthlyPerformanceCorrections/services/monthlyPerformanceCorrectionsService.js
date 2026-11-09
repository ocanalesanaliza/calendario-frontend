import { apiRequest } from '../../../services/apiClient'

const CORRECTIONS_ENDPOINT = '/api/calendar/area-performance/corrections/'

async function parseResponse(response, fallback) {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  const error = new Error(fallback)
  error.status = response.status
  error.payload = data
  error.fields = data?.fields
  error.fieldErrors = data?.errors ?? data?.detail ?? null
  throw error
}

function jsonRequest(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function validateMonthlyPerformanceCorrection(payload) {
  return parseResponse(
    await apiRequest(`${CORRECTIONS_ENDPOINT}validate/`, jsonRequest('POST', payload)),
    'No fue posible validar la corrección solicitada.',
  )
}

export async function createMonthlyPerformanceCorrection(payload) {
  return parseResponse(
    await apiRequest(CORRECTIONS_ENDPOINT, jsonRequest('POST', payload)),
    'No fue posible registrar la corrección solicitada.',
  )
}

export async function getMonthlyPerformanceCorrectionAudit(snapshotId) {
  return parseResponse(
    await apiRequest(`/api/calendar/area-performance/snapshots/${encodeURIComponent(String(snapshotId))}/corrections/`, { method: 'GET' }),
    'No fue posible cargar el historial de correcciones.',
  )
}
