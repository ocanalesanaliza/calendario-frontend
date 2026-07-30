import { apiRequest } from '../../../services/apiClient'

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  const first = Object.values(detail)[0]
  if (Array.isArray(first)) return first[0]
  return JSON.stringify(detail)
}

export async function getSolicitudesVacacion(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/solicitudes-vacacion/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cargar solicitudes de vacacion')
  return data
}

export async function crearSolicitudVacacion(body) {
  const res = await apiRequest('/api/solicitudes-vacacion/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al solicitar vacacion programada')
  return data
}

export async function aceptarSolicitudVacacion(id) {
  const res = await apiRequest(`/api/solicitudes-vacacion/${id}/aceptar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al aceptar vacacion programada')
  return data
}

export async function rechazarSolicitudVacacion(id, motivo = '') {
  const res = await apiRequest(`/api/solicitudes-vacacion/${id}/rechazar/`, {
    method: 'POST',
    body: JSON.stringify(motivo ? { motivo } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al rechazar vacacion programada')
  return data
}

export async function cancelarSolicitudVacacion(id) {
  const res = await apiRequest(`/api/solicitudes-vacacion/${id}/cancelar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cancelar vacacion programada')
  return data
}
