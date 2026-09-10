import { apiRequest } from '../../../services/apiClient'

function parseDetail(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(parseDetail).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(parseDetail).filter(Boolean).join(' ')
  return ''
}

function requestError(data, fallback, status) {
  const error = new Error(parseDetail(data?.detail) || parseDetail(data) || fallback)
  error.status = status
  return error
}

export async function getRevisionGuardia(idSucursalTarea, fecha) {
  const query = new URLSearchParams({ id_sucursal_tarea: idSucursalTarea, fecha }).toString()
  const res = await apiRequest(`/api/revisiones-guardia/?${query}`)
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al cargar la revisión de guardia', res.status)
  return data.formulario
}

export async function guardarRevisionGuardia(body) {
  const res = await apiRequest('/api/revisiones-guardia/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw requestError(data, 'Error al guardar la revisión de guardia', res.status)
  return data
}
