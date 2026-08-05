import { apiRequest } from '../../../services/apiClient'

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  const first = Object.values(detail)[0]
  if (Array.isArray(first)) return first[0]
  return JSON.stringify(detail)
}

export async function getConfiguracion() {
  const res = await apiRequest('/api/configuracion/solicitudes/')
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cargar la configuracion')
  return data.configuracion
}

export async function updateConfiguracion(body) {
  const res = await apiRequest('/api/configuracion/solicitudes/', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al actualizar la configuracion')
  return data
}
