import { apiRequest } from '../../../services/apiClient'

export async function getDashboardOperativo(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await apiRequest(`/api/dashboard-operativo/usuarios/${query ? `?${query}` : ''}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar dashboard operativo')
  return data
}
