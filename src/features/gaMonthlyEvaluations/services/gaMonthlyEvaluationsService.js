import { apiRequest } from '../../../services/apiClient'

const ENDPOINT = '/api/calendar/ga-monthly-evaluations/'

async function parseResponse(response, fallback) {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  const error = new Error(fallback)
  error.status = response.status
  error.payload = data
  error.fields = data?.fields ?? data?.errors ?? null
  throw error
}

function jsonRequest(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function getGAMonthlyEvaluations({ gaId, month }) {
  const params = new URLSearchParams()
  if (gaId !== undefined && gaId !== null && gaId !== '') params.set('ga_id', String(gaId))
  if (month) params.set('month', month)
  return parseResponse(await apiRequest(`${ENDPOINT}?${params.toString()}`, { method: 'GET' }), 'No fue posible cargar la evaluación mensual.')
}

export async function createGAMonthlyEvaluation(payload) {
  return parseResponse(await apiRequest(ENDPOINT, jsonRequest('POST', payload)), 'No fue posible emitir la evaluación mensual.')
}

export async function correctGAMonthlyEvaluation(evaluationId, payload) {
  return parseResponse(await apiRequest(`${ENDPOINT}${encodeURIComponent(String(evaluationId))}/correct/`, jsonRequest('POST', payload)), 'No fue posible corregir la evaluación mensual.')
}

export async function getGAMonthlyEvaluationHistory(evaluationId) {
  return parseResponse(await apiRequest(`${ENDPOINT}${encodeURIComponent(String(evaluationId))}/history/`, { method: 'GET' }), 'No fue posible cargar el historial de la evaluación.')
}
