import { apiRequest } from '../../../services/apiClient'

function formatError(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatError).filter(Boolean).join(' ')
  if (typeof detail === 'object') return Object.values(detail).map(formatError).filter(Boolean).join(' ')
  return String(detail)
}

async function parseResponse(response, fallbackMessage) {
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(formatError(data.detail) || formatError(data) || fallbackMessage)
    error.status = response.status
    error.fields = typeof data.detail === 'object' ? data.detail : data
    throw error
  }
  return data
}

export async function getAdminMasterAssignments() {
  const response = await apiRequest('/api/v1/admin-master-assignments/')
  return parseResponse(response, 'No se pudieron cargar las asignaciones de Admin Master.')
}

export async function createAdminMasterAssignment(body) {
  const response = await apiRequest('/api/v1/admin-master-assignments/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return parseResponse(response, 'No se pudo crear la asignación de Admin Master.')
}

export async function revokeAdminMasterAssignment(assignmentId, body) {
  const response = await apiRequest(`/api/v1/admin-master-assignments/${assignmentId}/revoke/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return parseResponse(response, 'No se pudo revocar la asignación de Admin Master.')
}
