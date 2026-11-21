import { apiRequest } from '../../services/apiClient'

export async function getGOEvidence(reference) {
  const response = await apiRequest(`/api/calendar/performance/evidence/${encodeURIComponent(String(reference))}/`, { method: 'GET' })
  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const error = new Error('No fue posible cargar la evidencia solicitada.')
  error.status = response.status
  throw error
}
