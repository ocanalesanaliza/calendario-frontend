import { apiRequest } from '../../../services/apiClient'

export async function getRendimientoDiario(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/diario/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar rendimiento diario')
  return data.rendimiento
}

export async function getRendimientoMensual(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/mensual/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar rendimiento mensual')
  return data.resumen
}

export async function getAjustesRendimiento(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/rendimiento/ajustes/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar ajustes de rendimiento')
  return data
}

export async function reabrirRendimientoDiario(body) {
  const res = await apiRequest('/api/rendimiento/diario/reabrir/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al reabrir dia')
  return data
}

export async function cerrarRendimientoDiario(body) {
  const res = await apiRequest('/api/rendimiento/diario/cerrar/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cerrar dia')
  return data
}
