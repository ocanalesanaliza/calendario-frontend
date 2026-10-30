const STORAGE_KEY = 'calendar_organization_context'

function normalizeId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getOrganizationContext() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    const companyId = normalizeId(value?.company_id)
    const countryId = normalizeId(value?.country_id)
    if (!companyId || !countryId) return null
    return {
      company_id: companyId,
      country_id: countryId,
      company_name: String(value?.company_name || ''),
      country_name: String(value?.country_name || ''),
      modulo_calendario: value?.modulo_calendario === 'tuvet' ? 'tuvet' : 'tareas',
    }
  } catch {
    return null
  }
}

export function setOrganizationContext(value) {
  const companyId = normalizeId(value?.company_id)
  const countryId = normalizeId(value?.country_id)
  if (!companyId || !countryId) {
    throw new Error('La empresa y el pais son obligatorios.')
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    company_id: companyId,
    country_id: countryId,
    company_name: String(value?.company_name || ''),
    country_name: String(value?.country_name || ''),
    modulo_calendario: value?.modulo_calendario === 'tuvet' ? 'tuvet' : 'tareas',
  }))
}

export function clearOrganizationContext() {
  sessionStorage.removeItem(STORAGE_KEY)
}
