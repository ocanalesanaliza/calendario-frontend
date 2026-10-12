import { apiRequest } from '../../../services/apiClient'

function parseErrorMessages(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(parseErrorMessages).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    return Object.values(value).map(parseErrorMessages).filter(Boolean).join(' ')
  }
  return ''
}

function requestError(data, fallback, status) {
  const error = new Error(parseErrorMessages(data?.detail) || parseErrorMessages(data) || fallback)
  error.status = status
  return error
}

export async function getSituaciones(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/situaciones-especiales/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al cargar situaciones especiales', res.status)
  return data
}

export async function getTiposSituaciones() {
  const res = await apiRequest('/api/rendimiento/situaciones-especiales/tipos/')
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al cargar tipos de situaciones especiales', res.status)
  return data
}

export async function crearTipoSituacion(nombre) {
  const res = await apiRequest('/api/rendimiento/situaciones-especiales/tipos/', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  })
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al crear tipo de situación especial', res.status)
  return data
}

export async function getUsuariosSituaciones(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/situaciones-especiales/usuarios/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al cargar usuarios', res.status)
  return data
}

export async function crearSituacion(body) {
  const res = await apiRequest('/api/rendimiento/situaciones-especiales/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al crear situación especial', res.status)
  return data
}

export async function desactivarSituacion(id) {
  const res = await apiRequest(`/api/rendimiento/situaciones-especiales/${id}/desactivar/`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al desactivar situación especial', res.status)
  return data
}
