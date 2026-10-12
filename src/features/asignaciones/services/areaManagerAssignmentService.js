import { apiRequest } from '../../../services/apiClient'
import { parseResponse } from '../../gerentes_operaciones/services/gerentesOperacionesService'

export async function getEligibleAreaManagers(areaId) {
  return parseResponse(
    await apiRequest(`/api/calendar/areas/${areaId}/eligible-area-managers/`),
    'No se pudieron cargar los gerentes de área elegibles.',
  )
}

export async function getEligibleAreas(gerenteAreaId) {
  return parseResponse(
    await apiRequest(`/api/calendar/ga/${gerenteAreaId}/eligible-areas/`),
    'No se pudieron cargar las áreas elegibles.',
  )
}

export async function assignAreaToManager(gerenteAreaId, areaId) {
  return parseResponse(
    await apiRequest(`/api/calendar/ga/${gerenteAreaId}/areas/`, {
      method: 'POST',
      body: JSON.stringify({ area_id: areaId }),
    }),
    'No se pudo asignar el área.',
  )
}

export async function reassignAreaToManager(gerenteAreaId, areaId) {
  return parseResponse(
    await apiRequest(`/api/calendar/ga/${gerenteAreaId}/areas/${areaId}/`, {
      method: 'PUT',
    }),
    'No se pudo reasignar el área.',
  )
}
