import { apiRequest } from '../../../services/apiClient'

export async function getSucursales() {
  const res = await apiRequest('/api/sucursales/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar sucursales')
  return data.results
}

export async function createSucursal(body) {
  const res = await apiRequest('/api/sucursales/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear sucursal')
  return data
}

export async function updateSucursal(id, body) {
  const res = await apiRequest(`/api/sucursales/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar sucursal')
  return data
}

export async function desactivarSucursal(id) {
  const res = await apiRequest(`/api/sucursales/${id}/desactivar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar sucursal')
  return data
}
