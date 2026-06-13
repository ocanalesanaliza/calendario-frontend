import { apiRequest } from '../../../services/apiClient'

export async function getPlantillas() {
  const res = await apiRequest('/api/plantillas/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar plantillas')
  return data.results
}

export async function createPlantilla(body) {
  const res = await apiRequest('/api/plantillas/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al crear plantilla')
  return data
}

export async function getPlantilla(id) {
  const res = await apiRequest(`/api/plantillas/${id}/`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cargar plantilla')
  return data.plantilla
}

export async function updatePlantilla(id, body) {
  const res = await apiRequest(`/api/plantillas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar plantilla')
  return data
}

export async function desactivarPlantilla(id) {
  const res = await apiRequest(`/api/plantillas/${id}/desactivar/`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar plantilla')
  return data
}

export async function addTarea(idPlantilla, body) {
  const res = await apiRequest(`/api/plantillas/${idPlantilla}/tareas/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al agregar tarea')
  return data
}

export async function updateTarea(idPlantilla, idPlantillaTarea, body) {
  const res = await apiRequest(`/api/plantillas/${idPlantilla}/tareas/${idPlantillaTarea}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al actualizar tarea')
  return data
}

export async function desactivarTarea(idPlantilla, idPlantillaTarea) {
  const res = await apiRequest(`/api/plantillas/${idPlantilla}/tareas/${idPlantillaTarea}/desactivar/`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al desactivar tarea')
  return data
}

export async function asignarSucursales(idPlantilla, body) {
  const res = await apiRequest(`/api/plantillas/${idPlantilla}/asignar-sucursales/`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al asignar sucursales')
  return data
}
