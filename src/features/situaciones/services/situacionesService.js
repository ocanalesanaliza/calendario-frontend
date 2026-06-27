import { apiRequest } from '../../../services/apiClient'

export async function getSituaciones(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/situaciones-especiales/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar situaciones especiales')
  return data.results
}

export async function crearSituacion(body) {
  const res = await apiRequest('/api/rendimiento/situaciones-especiales/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear situación especial')
  return data
}

export async function desactivarSituacion(id) {
  const res = await apiRequest(`/api/rendimiento/situaciones-especiales/${id}/desactivar/`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar situación especial')
  return data
}
