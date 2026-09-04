import { apiRequest } from '../../../services/apiClient'
import { parseResponse } from '../../gerentes_operaciones/services/gerentesOperacionesService'

export async function getAreas() {
  return parseResponse(await apiRequest('/api/calendar/areas/'), 'No se pudieron cargar las áreas.')
}

export async function getArea(id) {
  return parseResponse(await apiRequest(`/api/calendar/areas/${id}/`), 'No se pudo cargar el área.')
}

export async function createArea(body) {
  const response = await apiRequest('/api/calendar/areas/', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return parseResponse(response, 'No se pudo crear el área.')
}

export async function updateArea(id, body) {
  const response = await apiRequest(`/api/calendar/areas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return parseResponse(response, 'No se pudo actualizar el área.')
}

export async function deactivateArea(id) {
  const response = await apiRequest(`/api/calendar/areas/${id}/deactivation/`, { method: 'POST' })

  return parseResponse(response, 'No se pudo desactivar el área.')
}
