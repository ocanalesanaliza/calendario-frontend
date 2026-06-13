import { apiRequest } from '../../../services/apiClient'

export async function getUsuarios() {
  const res = await apiRequest('/api/usuarios/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar usuarios')
  return data.results
}

export async function createUsuario(body) {
  const res = await apiRequest('/api/usuarios/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear usuario')
  return data
}

export async function updateUsuario(id, body) {
  const res = await apiRequest(`/api/usuarios/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar usuario')
  return data
}

export async function cambiarSucursal(id, body) {
  const res = await apiRequest(`/api/usuarios/${id}/cambiar-sucursal/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cambiar sucursal')
  return data
}

export async function desactivarUsuario(id) {
  const res = await apiRequest(`/api/usuarios/${id}/desactivar/`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar usuario')
  return data
}
