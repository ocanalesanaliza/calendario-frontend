import { apiRequest } from '../../../services/apiClient'

export async function getMisTareas(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/mis-tareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar tareas')
  return data
}

export async function getRegistrosTareas(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/registros-tareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar registros')
  return data
}

export async function registrarTarea(body) {
  const res = await apiRequest('/api/registros-tareas/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al registrar tarea')
  return data
}

export async function registrarTareasLote(body) {
  const res = await apiRequest('/api/registros-tareas/lote/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al registrar tareas')
  return data
}

export async function registrarTareaManual(body) {
  const res = await apiRequest('/api/registros-tareas/manual/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al registrar tarea manual')
  return data
}

export async function updateRegistroManual(idRegistro, body) {
  const res = await apiRequest(`/api/registros-tareas/${idRegistro}/manual/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al editar registro')
  return data
}

export async function eliminarRegistroManual(idRegistro, body) {
  const res = await apiRequest(`/api/registros-tareas/${idRegistro}/eliminar-manual/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al eliminar registro')
  return data
}
