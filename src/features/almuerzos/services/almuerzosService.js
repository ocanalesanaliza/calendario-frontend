import { apiRequest } from '../../../services/apiClient'

export async function getMiAlmuerzo(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/almuerzos/hoy/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar almuerzo')
  return data.almuerzo
}

export async function activarAlmuerzo() {
  const res = await apiRequest('/api/almuerzos/activar/', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al activar almuerzo')
  return data
}

export async function cerrarAlmuerzo(body = {}) {
  const res = await apiRequest('/api/almuerzos/cerrar/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cerrar almuerzo')
  return data
}

export async function getDashboardAlmuerzos(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/almuerzos/dashboard/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar dashboard de almuerzos')
  return data
}
