import { apiRequest } from '../../../services/apiClient'

const BASE = '/api/v1/organization/branding/'

function query(params) {
  const search = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()
  return search ? `?${search}` : ''
}

// Los errores 400 llegan por campo ({ color_primario: ['...'] }); se conservan en `fields`.
async function parse(res, fallback) {
  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (res.ok) return data
  const fields = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const detail = fields.detail
  const message = (Array.isArray(detail) ? detail.join(' ') : detail)
    || Object.values(fields).flat().filter((value) => typeof value === 'string').join(' ')
    || fallback
  const error = new Error(message)
  error.status = res.status
  error.fields = fields
  throw error
}

export async function getAparienciaActual(params) {
  return parse(await apiRequest(`${BASE}current/${query(params)}`), 'No se pudo cargar la apariencia.')
}

export async function getDestinosApariencia() {
  return parse(await apiRequest(`${BASE}targets/`), 'No se pudieron cargar las empresas y países.')
}

export async function getApariencia(companyId, countryId) {
  return parse(
    await apiRequest(`${BASE}${query({ company_id: companyId, country_id: countryId })}`),
    'No se pudo cargar la apariencia de esta empresa y país.',
  )
}

export async function guardarApariencia(companyId, countryId, valores) {
  return parse(
    await apiRequest(BASE, {
      method: 'PUT',
      body: JSON.stringify({ ...valores, company_id: companyId, country_id: countryId }),
    }),
    'No se pudo guardar la apariencia.',
  )
}

export async function restablecerApariencia(companyId, countryId) {
  return parse(
    await apiRequest(`${BASE}${query({ company_id: companyId, country_id: countryId })}`, { method: 'DELETE' }),
    'No se pudo restablecer la apariencia.',
  )
}

export async function getRecomendaciones(color) {
  return parse(await apiRequest(`${BASE}recommendations/${query({ color })}`), 'No se pudieron generar recomendaciones.')
}
