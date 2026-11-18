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

const MANUAL_ENTRY_STATUS_TRANSLATIONS = {
  pending: 'pendiente',
  completed: 'completada',
  overdue: 'vencida',
  justified: 'justificada',
  cancelled: 'cancelada',
  rescheduled: 'reprogramada',
}

function normalizeManualEntryStatus(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry

  const status = entry.status
  if (typeof status !== 'string' || !Object.hasOwn(MANUAL_ENTRY_STATUS_TRANSLATIONS, status)) return entry

  return { ...entry, status: MANUAL_ENTRY_STATUS_TRANSLATIONS[status] }
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
    'weight',
    'all_day',
  ]

  fields.forEach((field) => {
    if (occurrence[field] !== undefined) normalized[field] = occurrence[field]
  })

  const template = optionalObject(occurrence.template, ['id', 'name'])
  const templateVersion = optionalObject(occurrence.template_version, ['id', 'number'])
  const coverageSnapshot = optionalObject(occurrence.coverage_snapshot, ['jornada', 'aplica_ambas_jornadas', 'known'])
  const task = typeof occurrence.task === 'string'
    ? occurrence.task
    : optionalObject(occurrence.task, ['id', 'name', 'mode'])

  if (template) normalized.template = template
  if (templateVersion) normalized.template_version = templateVersion
  if (coverageSnapshot) normalized.coverage_snapshot = coverageSnapshot
  if (task !== undefined) normalized.task = task

  return normalized
}

export function normalizeMonthlyAreaOccurrencesResponse(response = {}) {
  return {
    ...response,
    occurrences: Array.isArray(response.occurrences)
      ? response.occurrences.map(normalizeMonthlyAreaOccurrence)
      : [],
    ...(Array.isArray(response.manual_catalog_entries) ? { manual_catalog_entries: response.manual_catalog_entries.map(normalizeManualEntryStatus) } : {}),
    ...(Array.isArray(response.ad_hoc_activities) ? { ad_hoc_activities: response.ad_hoc_activities.map(normalizeManualEntryStatus) } : {}),
  }
}
