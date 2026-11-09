import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/depositos/gs/'

function errorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) return data.detail.join(' ')
  if (data?.detail && typeof data.detail === 'object') return Object.values(data.detail).flat().join(' ')
  return fallback
}

async function request(path, options, fallback) {
  const response = await apiRequest(path, options)
  const data = await response.json()
  if (response.ok) return data

  const error = new Error(errorMessage(data, fallback))
  error.status = response.status
  error.detail = data?.detail
  error.fields = data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail) ? data.detail : undefined
  throw error
}

function post(path, body, fallback) {
  return request(path, { method: 'POST', body: JSON.stringify(body) }, fallback)
}

export function openDepositReport(body) {
  return post(`${BASE}abrir/`, body, 'No fue posible abrir el reporte de depósito.')
}

export function getDepositReport(reportId) {
  return request(`${BASE}reportes/${reportId}/`, { method: 'GET' }, 'No fue posible actualizar el reporte de depósito.')
}

export function captureDepositClosure(reportId, entryId, body) {
  return post(`${BASE}reportes/${reportId}/cierres/${entryId}/capturar/`, body, 'No fue posible capturar las ventas del cierre.')
}

export function addDepositReceipt(reportId, body) {
  return post(`${BASE}reportes/${reportId}/comprobantes/`, body, 'No fue posible agregar el comprobante de depósito.')
}

export function allocateDepositReceipt(reportId, receiptId, body) {
  return post(`${BASE}reportes/${reportId}/comprobantes/${receiptId}/asignaciones/`, body, 'No fue posible asignar el comprobante.')
}

export function declareNoDepositado(reportId, entryId, body) {
  return post(`${BASE}reportes/${reportId}/cierres/${entryId}/no-depositado/`, body, 'No fue posible registrar la declaración.')
}

export function submitDepositReport(reportId, body) {
  return post(`${BASE}reportes/${reportId}/enviar/`, body, 'No fue posible enviar el reporte de depósito.')
}
