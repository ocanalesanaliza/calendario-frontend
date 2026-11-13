import { apiRequest } from '../../services/apiClient'

function message(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(message).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(message).filter(Boolean).join(' ')
  return ''
}

async function request(path, options, fallback) {
  const response = options ? await apiRequest(path, options) : await apiRequest(path)
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(message(data?.detail) || message(data) || fallback)
    error.status = response.status
    error.fields = data
    throw error
  }
  return data
}

function formData(values) {
  const body = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.append(key, value)
  })
  return body
}

export function previewInventory(file) {
  return request('/api/inventarios/preview/', { method: 'POST', body: formData({ file }) }, 'No se pudo previsualizar el inventario.')
}

export function discoverAreaBranches(areaOccurrenceId) {
  return request(`/api/inventarios/ga/ocurrencias/${areaOccurrenceId}/sucursales/`, undefined, 'No se pudieron cargar las sucursales autorizadas.')
}

export function submitInventoryBranch({ assignmentId, file, rows, comment, idempotencyKey }) {
  return request('/api/inventarios/gs/enviar/', {
    method: 'POST',
    body: formData({ sucursal_tarea_id: String(assignmentId), file, rows: JSON.stringify(rows), comment, idempotency_key: idempotencyKey }),
  }, 'No se pudo registrar el inventario.')
}

export function submitInventoryArea({ areaOccurrenceId, branchId, file, rows, comment, idempotencyKey }) {
  return request('/api/inventarios/ga/enviar/', {
    method: 'POST',
    body: formData({ area_occurrence_id: String(areaOccurrenceId), branch_id: String(branchId), file, rows: JSON.stringify(rows), comment, idempotency_key: idempotencyKey }),
  }, 'No se pudo registrar el inventario.')
}

export function correctInventory({ submissionId, inventoryType, file, rows, comment, reason, expectedVersion, idempotencyKey }) {
  const scope = inventoryType === 'inventory_area' ? 'ga' : 'gs'
  return request(`/api/inventarios/${scope}/envios/${submissionId}/correcciones/`, {
    method: 'POST',
    body: formData({ file, rows: JSON.stringify(rows), comment, correction_reason: reason, expected_version: String(expectedVersion), idempotency_key: idempotencyKey }),
  }, 'No se pudo registrar la corrección.')
}

export function listHistory() {
  return request('/api/inventarios/historial/', undefined, 'No se pudo cargar el historial de inventarios.')
}

export function getHistoryDetail(submissionId) {
  return request(`/api/inventarios/historial/${submissionId}/`, undefined, 'No se pudo cargar el detalle del inventario.')
}

export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
