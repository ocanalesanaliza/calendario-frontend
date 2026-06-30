import { apiRequest } from '../../../services/apiClient'

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  const first = Object.values(detail)[0]
  if (Array.isArray(first)) return first[0]
  return JSON.stringify(detail)
}

export async function getTrabajosCampo(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/trabajos-campo/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cargar trabajos de campo')
  return data
}

export async function createTrabajoCampo(body) {
  const res = await apiRequest('/api/trabajos-campo/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al crear solicitud de trabajo de campo')
  return data
}

export async function aceptarTrabajoCampo(id) {
  const res = await apiRequest(`/api/trabajos-campo/${id}/aceptar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al aceptar trabajo de campo')
  return data
}

export async function rechazarTrabajoCampo(id, motivo = '') {
  const res = await apiRequest(`/api/trabajos-campo/${id}/rechazar/`, {
    method: 'POST',
    body: JSON.stringify(motivo ? { motivo } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al rechazar trabajo de campo')
  return data
}

export async function cancelarTrabajoCampo(id) {
  const res = await apiRequest(`/api/trabajos-campo/${id}/cancelar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cancelar trabajo de campo')
  return data
}
