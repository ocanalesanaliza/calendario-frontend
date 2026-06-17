import { apiRequest } from '../../../services/apiClient'

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

export async function desactivarGerente(id) {
  const res = await apiRequest(`/api/gerentes-area/${id}/desactivar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar gerente')
  return data
}

export async function resetPasswordGerente(id) {
  const res = await apiRequest(`/api/gerentes-area/${id}/reset-password/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al resetear contraseña')
  return data
}
