import { apiRequest } from '../../../services/apiClient'

function createRequestError(data, fallback, status) {
  const message = (value) => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(message).filter(Boolean).join(' ')
    if (value && typeof value === 'object') return Object.values(value).map(message).filter(Boolean).join(' ')
    return ''
  }
  const error = new Error(message(data?.detail) || message(data) || fallback)
  error.status = status
  error.fields = data
  return error
}

export async function getMisTareas(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/mis-tareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al cargar tareas', res.status)
  return data
}

export async function getRegistrosTareas(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/registros-tareas/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al cargar registros', res.status)
  return data
}

export async function registrarTarea(body) {
  const res = await apiRequest('/api/registros-tareas/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al registrar tarea', res.status)
  return data
}

export async function registrarTareasLote(body) {
  const res = await apiRequest('/api/registros-tareas/lote/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al registrar tareas', res.status)
  return data
}

export async function registrarTareaManual(body) {
  const res = await apiRequest('/api/registros-tareas/manual/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al registrar tarea manual', res.status)
  return data
}

export async function updateRegistroManual(idRegistro, body) {
  const res = await apiRequest(`/api/registros-tareas/${idRegistro}/manual/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al editar registro', res.status)
  return data
}

export async function eliminarRegistroManual(idRegistro, body) {
  const res = await apiRequest(`/api/registros-tareas/${idRegistro}/eliminar-manual/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw createRequestError(data, 'Error al eliminar registro', res.status)
  return data
}
