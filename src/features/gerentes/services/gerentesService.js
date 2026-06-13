import { apiRequest } from '../../../services/apiClient'

export async function getGerentes() {
  const res = await apiRequest('/api/gerentes-area/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar gerentes')
  return data.results
}

export async function createGerente(body) {
  const res = await apiRequest('/api/gerentes-area/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear gerente')
  return data
}
