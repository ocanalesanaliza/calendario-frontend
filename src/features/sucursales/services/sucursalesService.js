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

export async function getSucursal(id) {
  const res = await apiRequest(`/api/sucursales/${id}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar sucursal')
  return data.sucursal
}

// Horarios

export async function getHorarios(idSucursal) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/horarios/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar horarios')
  return data.results
}

export async function saveHorarios(idSucursal, body) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/horarios/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al guardar horarios')
  return data
}

export async function getHorario(idSucursal, idHorario) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/horarios/${idHorario}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar horario')
  return data.horario
}

export async function updateHorario(idSucursal, idHorario, body) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/horarios/${idHorario}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar horario')
  return data
}

// Tareas por sucursal

export async function getTareasSucursal(idSucursal, params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/sucursales/${idSucursal}/tareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar tareas de sucursal')
  return data.results
}

export async function createTareaSucursal(idSucursal, body) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/tareas/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear tarea de sucursal')
  return data
}

export async function getTareaSucursal(idSucursal, idSucursalTarea) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar tarea de sucursal')
  return data.sucursal_tarea
}

export async function updateTareaSucursal(idSucursal, idSucursalTarea, body) {
  const res = await apiRequest(`/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar tarea de sucursal')
  return data
}

export async function desactivarTareaSucursal(idSucursal, idSucursalTarea) {
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/desactivar/`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar tarea de sucursal')
  return data
}

// Excepciones de recurrencia

export async function getExcepciones(idSucursal, idSucursalTarea, idRegla, params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/reglas/${idRegla}/excepciones/${query ? `?${query}` : ''}`
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar excepciones')
  return data.results
}

export async function createExcepcion(idSucursal, idSucursalTarea, idRegla, body) {
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/reglas/${idRegla}/excepciones/`,
    { method: 'POST', body: JSON.stringify(body) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear excepcion')
  return data
}

export async function getExcepcion(idSucursal, idSucursalTarea, idRegla, idExcepcion) {
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/reglas/${idRegla}/excepciones/${idExcepcion}/`
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar excepcion')
  return data.excepcion
}

export async function updateExcepcion(idSucursal, idSucursalTarea, idRegla, idExcepcion, body) {
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/reglas/${idRegla}/excepciones/${idExcepcion}/`,
    { method: 'PATCH', body: JSON.stringify(body) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar excepcion')
  return data
}

export async function eliminarExcepcion(idSucursal, idSucursalTarea, idRegla, idExcepcion) {
  const res = await apiRequest(
    `/api/sucursales/${idSucursal}/tareas/${idSucursalTarea}/reglas/${idRegla}/excepciones/${idExcepcion}/eliminar/`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al eliminar excepcion')
  return data
}
