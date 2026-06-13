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
