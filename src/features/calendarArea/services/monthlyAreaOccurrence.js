function pickOptional(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  return fields.reduce((result, field) => {
    if (value[field] !== undefined) result[field] = value[field]
    return result
  }, {})
}

function optionalObject(value, fields) {
  const object = pickOptional(value, fields)
  return object && Object.keys(object).length > 0 ? object : undefined
}

export function normalizeMonthlyAreaOccurrence(occurrence = {}) {
  const normalized = {}
  const fields = [
    'id',
    'occurrence_id',
    'status',
    'scheduled_date',
    'effective_date',
    'area',
    'task',
    'weight',
    'all_day',
  ]

  fields.forEach((field) => {
    if (occurrence[field] !== undefined) normalized[field] = occurrence[field]
  })

  const template = optionalObject(occurrence.template, ['id', 'name'])
  const templateVersion = optionalObject(occurrence.template_version, ['id', 'number'])
  const coverageSnapshot = optionalObject(occurrence.coverage_snapshot, ['jornada', 'aplica_ambas_jornadas', 'known'])

  if (template) normalized.template = template
  if (templateVersion) normalized.template_version = templateVersion
  if (coverageSnapshot) normalized.coverage_snapshot = coverageSnapshot

  return normalized
}

export function normalizeMonthlyAreaOccurrencesResponse(response = {}) {
  return {
    ...response,
    occurrences: Array.isArray(response.occurrences)
      ? response.occurrences.map(normalizeMonthlyAreaOccurrence)
      : [],
  }
}
