import { apiRequest } from '../../../services/apiClient'

function parseDetail(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(parseDetail).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(parseDetail).filter(Boolean).join(' ')
  return ''
}

export async function getAnaliticaRevisionesGuardia(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/analitica/revisiones-guardia/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(parseDetail(data.detail) || 'Error al cargar la analítica de revisiones de guardia')
    error.status = res.status
    throw error
  }
  return data
}
