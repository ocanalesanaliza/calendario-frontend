import { apiRequest } from '../../../services/apiClient'

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  const first = Object.values(detail)[0]
  if (Array.isArray(first)) return first[0]
  return JSON.stringify(detail)
}

export async function getCoberturas(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/coberturas-temporales/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cargar coberturas')
  return data
}

export async function createCobertura(body) {
  const res = await apiRequest('/api/coberturas-temporales/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al crear cobertura')
  return data
}

export async function getCobertura(id) {
  const res = await apiRequest(`/api/coberturas-temporales/${id}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cargar cobertura')
  return data.cobertura
}

export async function updateCobertura(id, body) {
  const res = await apiRequest(`/api/coberturas-temporales/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al actualizar cobertura')
  return data
}

export async function activarCobertura(id) {
  const res = await apiRequest(`/api/coberturas-temporales/${id}/activar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al activar cobertura')
  return data
}

export async function cancelarCobertura(id) {
  const res = await apiRequest(`/api/coberturas-temporales/${id}/cancelar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al cancelar cobertura')
  return data
}

export async function completarCobertura(id) {
  const res = await apiRequest(`/api/coberturas-temporales/${id}/completar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al completar cobertura')
  return data
}
