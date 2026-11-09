import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/tuvet'

export const TUVET_NO_DISPONIBLE = 'tuvet_no_disponible'

const MENSAJES_DETALLE = {
  not_found: 'El registro no existe o está fuera de tu ámbito.',
  conflicto_de_integridad: 'Otro usuario modificó estos datos al mismo tiempo. Actualiza e inténtalo de nuevo.',
}

export function formatError(value) {
  if (typeof value === 'string') return MENSAJES_DETALLE[value] ?? value
  if (Array.isArray(value)) return value.map(formatError).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([campo, mensaje]) => {
        if (campo === 'campos_desconocidos') return `Campos no admitidos: ${formatError(mensaje)}.`
        return formatError(mensaje)
      })
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function parseResponse(response, fallbackMessage) {
  const data = await readJson(response)
  if (response.ok) return data

  const detail = data?.detail
  const error = new Error(formatError(detail) || formatError(data) || fallbackMessage)
  error.status = response.status
  error.fields = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : data
  if (response.status === 404 && detail !== 'not_found') {
    error.code = TUVET_NO_DISPONIBLE
    error.message = 'El Calendario Tuvet no está disponible en este momento.'
  }
  throw error
}

// Los serializers rechazan campos desconocidos: nunca enviar propiedades undefined.
export function cleanBody(body) {
  return Object.fromEntries(Object.entries(body ?? {}).filter(([, value]) => value !== undefined))
}

function get(path, fallback) {
  return apiRequest(`${BASE}${path}`).then((res) => parseResponse(res, fallback))
}

function send(method, path, body, fallback) {
  const options = { method }
  if (body !== undefined) options.body = JSON.stringify(cleanBody(body))
  return apiRequest(`${BASE}${path}`, options).then((res) => parseResponse(res, fallback))
}

function query(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}` : ''
}

export function listItems(data) {
  if (Array.isArray(data)) return data
  return Array.isArray(data?.results) ? data.results : []
}

// ── Departamentos ──
export const getDepartamentos = () => get('/departamentos/', 'No se pudieron cargar los departamentos.')
export const createDepartamento = (body) => send('POST', '/departamentos/', body, 'No se pudo crear el departamento.')
export const updateDepartamento = (id, cambios) => send('PATCH', `/departamentos/${id}/`, cambios, 'No se pudo actualizar el departamento.')
export const desactivarDepartamento = (id) => send('DELETE', `/departamentos/${id}/`, undefined, 'No se pudo desactivar el departamento.')

// ── Encargados ──
export const getEncargados = () => get('/encargados/', 'No se pudieron cargar los encargados.')
export const createEncargado = (body) => send('POST', '/encargados/', body, 'No se pudo crear el encargado.')
export const desactivarEncargado = (id) => send('DELETE', `/encargados/${id}/`, undefined, 'No se pudo desactivar el encargado.')
export const cambiarDepartamentoEncargado = (id, departamentoId) => send('PUT', `/encargados/${id}/departamento/`, { departamento_id: departamentoId }, 'No se pudo cambiar el departamento.')
export const resetPasswordEncargado = (id) => send('POST', `/encargados/${id}/reset-password/`, undefined, 'No se pudo restablecer la contraseña.')

// ── Gerentes de operaciones ──
export const getGerentesOperaciones = () => get('/gerentes-operaciones/', 'No se pudieron cargar los gerentes de operaciones.')
export const createGerenteOperaciones = (body) => send('POST', '/gerentes-operaciones/', body, 'No se pudo crear el gerente de operaciones.')
export const resetPasswordGerenteOperaciones = (id) => send('POST', `/gerentes-operaciones/${id}/reset-password/`, undefined, 'No se pudo restablecer la contraseña.')

// ── Gerentes de sucursal ──
export const getGerentesSucursal = () => get('/gerentes-sucursal/', 'No se pudieron cargar los gerentes de sucursal.')
export const getGerentesSucursalDisponibles = () => get('/gerentes-sucursal/disponibles/', 'No se pudieron cargar los gerentes de sucursal.')
export const createGerenteSucursal = (body) => send('POST', '/gerentes-sucursal/', body, 'No se pudo crear el gerente de sucursal.')
export const resetPasswordGerenteSucursal = (id) => send('POST', `/gerentes-sucursal/${id}/reset-password/`, undefined, 'No se pudo restablecer la contraseña.')

// ── GS ↔ encargados (N:M) ──
export const getEncargadosDeGerenteSucursal = (gsId) => get(`/gs/${gsId}/encargados/`, 'No se pudieron cargar los encargados del gerente de sucursal.')
export const agregarEncargadoAGerenteSucursal = (gsId, encargadoId) => send('POST', `/gs/${gsId}/encargados/`, { encargado_id: encargadoId }, 'No se pudo agregar el encargado.')
export const retirarEncargadoDeGerenteSucursal = (gsId, encargadoId) => send('DELETE', `/gs/${gsId}/encargados/`, { encargado_id: encargadoId }, 'No se pudo retirar el encargado.')

// ── GO ↔ encargado ──
export const getGoEncargados = () => get('/go-encargados/', 'No se pudieron cargar las relaciones.')
export const vincularGoEncargado = (goId, encargadoId) => send('POST', '/go-encargados/', { gerente_operaciones_id: goId, encargado_id: encargadoId }, 'No se pudo vincular.')
export const desvincularGoEncargado = (goId, encargadoId) => send('DELETE', '/go-encargados/', { gerente_operaciones_id: goId, encargado_id: encargadoId }, 'No se pudo desvincular.')

// ── Tareas del encargado ──
export const getTareas = () => get('/tareas/', 'No se pudieron cargar las tareas.')
export const getTarea = (id) => get(`/tareas/${id}/`, 'No se pudo cargar la tarea.')
export const createTarea = (body) => send('POST', '/tareas/', body, 'No se pudo crear la tarea.')
export const updateTarea = (id, cambios) => send('PATCH', `/tareas/${id}/`, cambios, 'No se pudo actualizar la tarea.')
export const desactivarTarea = (id) => send('DELETE', `/tareas/${id}/`, undefined, 'No se pudo desactivar la tarea.')

// ── Plantillas y asignaciones ──
export const getPlantillas = () => get('/plantillas/', 'No se pudieron cargar las plantillas.')
export const getPlantilla = (id) => get(`/plantillas/${id}/`, 'No se pudo cargar la plantilla.')
export const createPlantilla = (body) => send('POST', '/plantillas/', body, 'No se pudo crear la plantilla.')
export const updatePlantilla = (id, cambios) => send('PATCH', `/plantillas/${id}/`, cambios, 'No se pudo actualizar la plantilla.')
export const desactivarPlantilla = (id) => send('DELETE', `/plantillas/${id}/`, undefined, 'No se pudo desactivar la plantilla.')
export const getAsignacionesPlantilla = (id) => get(`/plantillas/${id}/asignaciones/`, 'No se pudieron cargar las asignaciones.')
export const asignarPlantilla = (id, gerentesSucursal) => send('POST', `/plantillas/${id}/asignaciones/`, { gerentes_sucursal: gerentesSucursal }, 'No se pudo asignar la plantilla.')
export const desasignar = (asignacionId) => send('DELETE', `/asignaciones/${asignacionId}/`, undefined, 'No se pudo quitar la asignación.')

// ── Ejecución y revisión ──
export const getMisTareas = (year, month) => get(`/mis-tareas/${query({ year, month })}`, 'No se pudieron cargar tus tareas.')
export const getRevisiones = (year, month, estado) => get(`/revisiones/${query({ year, month, estado })}`, 'No se pudieron cargar las revisiones.')
export const marcarOcurrencia = (id, documento) => send('POST', `/ocurrencias/${id}/marcar/`, documento ? { documento } : {}, 'No se pudo marcar la tarea.')
export const aprobarOcurrencia = (id) => send('POST', `/ocurrencias/${id}/aprobar/`, undefined, 'No se pudo aprobar la tarea.')
export const rechazarOcurrencia = (id, comentario) => send('POST', `/ocurrencias/${id}/rechazar/`, { comentario }, 'No se pudo rechazar la tarea.')

export async function descargarDocumento(ocurrenciaId, documento) {
  const res = await apiRequest(`${BASE}/ocurrencias/${ocurrenciaId}/documentos/${documento.id}/`)
  if (!res.ok) await parseResponse(res, 'No fue posible descargar el documento.')

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = documento.nombre
  link.click()
  URL.revokeObjectURL(objectUrl)
}

// ── Rendimiento ──
export const getRendimiento = ({ year, month, gerenteSucursal, departamento }) => get(
  `/rendimiento/${query({ year, month, gerente_sucursal: gerenteSucursal, departamento })}`,
  'No se pudo cargar el rendimiento.',
)
