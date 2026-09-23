import { apiRequest } from '../../../services/apiClient'

function formatError(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(formatError).filter(Boolean).join(' ')
  if (detail && typeof detail === 'object') return Object.values(detail).map(formatError).filter(Boolean).join(' ')
  return ''
}

async function parseResponse(response, fallbackMessage) {
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(formatError(data?.detail) || formatError(data) || fallbackMessage)
    error.status = response.status
    error.fields = data
    throw error
  }
  return data
}

function scopedPath(collection, parameter, id) {
  return `/api/calendar/${collection}/?${new URLSearchParams({ [parameter]: id })}`
}

export async function getCompanies() {
  return parseResponse(await apiRequest('/api/calendar/companies/'), 'No se pudieron cargar las compañías.')
}

export async function createCompany(body) {
  return parseResponse(await apiRequest('/api/calendar/companies/', {
    method: 'POST',
    body: JSON.stringify(body),
  }), 'No se pudo crear la compañía.')
}

export async function getRegions(companyId) {
  return parseResponse(await apiRequest(scopedPath('regions', 'company_id', companyId)), 'No se pudieron cargar las regiones.')
}

export async function createRegion(body) {
  return parseResponse(await apiRequest('/api/calendar/regions/', {
    method: 'POST',
    body: JSON.stringify(body),
  }), 'No se pudo crear la región.')
}

export async function getCountries(regionId) {
  return parseResponse(await apiRequest(scopedPath('countries', 'region_id', regionId)), 'No se pudieron cargar los países.')
}

export async function createCountry(body) {
  return parseResponse(await apiRequest('/api/calendar/countries/', {
    method: 'POST',
    body: JSON.stringify(body),
  }), 'No se pudo crear el país.')
}
