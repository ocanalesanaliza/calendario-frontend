import { apiRequest } from '../../../services/apiClient'

const AREAS_ENDPOINT = '/api/calendar/performance/areas/'
const HISTORY_ENDPOINT = '/api/calendar/performance/history/'
const ALL_AREAS_HISTORY_ENDPOINT = '/api/calendar/performance/history/all-areas/'
const OCCURRENCES_ENDPOINT = '/api/calendar/performance/occurrences/'

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

function normalizeGOOccurrenceDetail(response) {
  const occurrence = response?.occurrence
  return {
    task: { title: occurrence?.task_snapshot?.title },
    origin_date_local: occurrence?.origin_date_local,
    attribution_month: occurrence?.attribution_month,
    frozen_weight: occurrence?.frozen_weight,
    latest_revision: response?.latest_revision ?? null,
    revision_history: Array.isArray(response?.revision_history) ? response.revision_history : [],
  }
}

export async function getGOAuthorizedAreas({ businessDate, fromMonth, toMonth } = {}) {
  const query = makeQuery({ business_date: businessDate, from_month: fromMonth, to_month: toMonth }, ['business_date', 'from_month', 'to_month'])
  return parseResponse(await apiRequest(`${AREAS_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar las áreas autorizadas para el rango seleccionado.')
}

export async function getGOAreaPerformanceHistory({ areaId, businessDate, fromMonth, toMonth, cursor, limit } = {}) {
  const query = makeQuery({ area_id: areaId, business_date: businessDate, from_month: fromMonth, to_month: toMonth, cursor, limit }, ['area_id', 'business_date', 'from_month', 'to_month', 'cursor', 'limit'])
  return parseResponse(await apiRequest(`${HISTORY_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar el historial de rendimiento de áreas.')
}

export async function getGOAllAreasPerformanceHistory({ businessDate, fromMonth, toMonth, cursor, limit } = {}) {
  const query = makeQuery({ business_date: businessDate, from_month: fromMonth, to_month: toMonth, cursor, limit }, ['business_date', 'from_month', 'to_month', 'cursor', 'limit'])
  return parseResponse(await apiRequest(`${ALL_AREAS_HISTORY_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar el historial de rendimiento de áreas.')
}

export async function getGOOccurrences({ areaId, responsibilityId, businessDate, fromMonth, toMonth, cursor, limit } = {}) {
  const query = makeQuery(
    { area_id: areaId, responsibility_id: responsibilityId, business_date: businessDate, from_month: fromMonth, to_month: toMonth, cursor, limit },
    ['area_id', 'responsibility_id', 'business_date', 'from_month', 'to_month', 'cursor', 'limit'],
  )
  return parseResponse(await apiRequest(`${OCCURRENCES_ENDPOINT}${query}`, { method: 'GET' }), 'No fue posible cargar la evidencia de ocurrencias autorizadas.')
}

export async function getGOOccurrenceDetail(occurrenceId) {
  const response = await parseResponse(await apiRequest(`${OCCURRENCES_ENDPOINT}${encodeURIComponent(String(occurrenceId))}/`, { method: 'GET' }), 'No fue posible cargar el detalle de la ocurrencia autorizada.')
  return normalizeGOOccurrenceDetail(response)
}

export async function getGOResponsibilityGaps({ areaId, businessDate, fromDate, toDate, cursor, limit } = {}) {
  const query = makeQuery(
    { business_date: businessDate, from_date: fromDate, to_date: toDate, cursor, limit },
    ['business_date', 'from_date', 'to_date', 'cursor', 'limit'],
  )
  return parseResponse(await apiRequest(`/api/calendar/areas/${encodeURIComponent(String(areaId))}/responsibility-gaps/${query}`, { method: 'GET' }), 'No fue posible cargar las brechas de responsabilidad del Área.')
}
