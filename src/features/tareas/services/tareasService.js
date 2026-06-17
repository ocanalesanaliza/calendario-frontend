import { apiRequest } from '../../../services/apiClient'

export async function getTareas() {
  const res = await apiRequest('/api/tareas/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar tareas')
  return data.results
}

export async function createTarea(body) {
  const res = await apiRequest('/api/tareas/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear tarea')
  return data
}

export async function updateTarea(id, body) {
  const res = await apiRequest(`/api/tareas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar tarea')
  return data
}

export async function desactivarTarea(id) {
  const res = await apiRequest(`/api/tareas/${id}/desactivar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar tarea')
  return data
}

export async function getTarea(id) {
  const res = await apiRequest(`/api/tareas/${id}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar tarea')
  return data.tarea
}

// Subtareas

export async function getSubtareas(idTarea, params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/tareas/${idTarea}/subtareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar subtareas')
  return data.results
}

export async function createSubtarea(idTarea, body) {
  const res = await apiRequest(`/api/tareas/${idTarea}/subtareas/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear subtarea')
  return data
}

export async function getSubtarea(idTarea, idSubtarea) {
  const res = await apiRequest(`/api/tareas/${idTarea}/subtareas/${idSubtarea}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar subtarea')
  return data.subtarea
}

export async function updateSubtarea(idTarea, idSubtarea, body) {
  const res = await apiRequest(`/api/tareas/${idTarea}/subtareas/${idSubtarea}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar subtarea')
  return data
}

export async function desactivarSubtarea(idTarea, idSubtarea) {
  const res = await apiRequest(`/api/tareas/${idTarea}/subtareas/${idSubtarea}/desactivar/`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar subtarea')
  return data
}
