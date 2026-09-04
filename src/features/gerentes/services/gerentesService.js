import { apiRequest } from '../../../services/apiClient'

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(parseDetail).filter(Boolean).join(' ')
  if (typeof detail === 'object') {
    return Object.values(detail).map(parseDetail).filter(Boolean).join(' ')
  }
  return String(detail)
}

export async function getGerentes() {
  const res = await apiRequest('/api/gerentes-area/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar gerentes')
  return data.results
}

export async function createGerente(body) {
  const res = await apiRequest('/api/gerentes-area/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear gerente')
  return data
}

export async function getGerente(id) {
  const res = await apiRequest(`/api/gerentes-area/${id}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar gerente')
  return data.gerente_area
}

export async function updateGerente(id, body) {
  const res = await apiRequest(`/api/gerentes-area/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar gerente')
  return data
}

export async function desactivarGerente(id, idNuevoGerenteArea) {
  const res = await apiRequest(`/api/gerentes-area/${id}/desactivar/`, {
    method: 'POST',
    ...(idNuevoGerenteArea ? { body: JSON.stringify({ id_nuevo_gerente_area: idNuevoGerenteArea }) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al desactivar gerente')
  return data
}

export async function prepararDesactivacionGerente(id) {
  const res = await apiRequest(`/api/gerentes-area/${id}/desactivar/`)
  const data = await res.json()
  if (!res.ok) throw new Error(parseDetail(data.detail) || 'Error al preparar la desactivación del gerente')
  return data
}

export async function resetPasswordGerente(id) {
  const res = await apiRequest(`/api/gerentes-area/${id}/reset-password/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al resetear contraseña')
  return data
}
