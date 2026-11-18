import { describe, expect, it } from 'vitest'
import { normalizeMonthlyAreaOccurrence, normalizeMonthlyAreaOccurrencesResponse } from './monthlyAreaOccurrence'

describe('monthly area occurrence contract', () => {
  it('keeps only the supported optional occurrence fields', () => {
    const occurrence = {
      occurrence_id: 14,
      status: 'scheduled',
      template: { id: 7, name: 'Apertura', ignored: 'value' },
      template_version: { id: 9, number: 3, ignored: 'value' },
      coverage_snapshot: { jornada: 'morning', aplica_ambas_jornadas: false, known: true, ignored: 'value' },
      scheduled_date: '2026-09-12',
      effective_date: '2026-09-15',
      area: { id: 4, name: 'Operaciones' },
      task: { id: 8, name: 'Inventario', mode: 'deposit_review', ignored: 'value' },
      weight: 30,
      all_day: true,
      justification: 'must not become part of the contract',
    }

    expect(normalizeMonthlyAreaOccurrence(occurrence)).toEqual({
      occurrence_id: 14,
      status: 'scheduled',
      template: { id: 7, name: 'Apertura' },
      template_version: { id: 9, number: 3 },
      coverage_snapshot: { jornada: 'morning', aplica_ambas_jornadas: false, known: true },
      scheduled_date: '2026-09-12',
      effective_date: '2026-09-15',
      area: { id: 4, name: 'Operaciones' },
      task: { id: 8, name: 'Inventario', mode: 'deposit_review' },
      weight: 30,
      all_day: true,
    })
  })

  it('translates every manual catalog entry status from the backend contract', () => {
    const entries = ['pending', 'completed', 'overdue', 'justified', 'cancelled', 'rescheduled']
      .map((status, index) => ({ id: index + 1, status, task: { name: `Tarea ${index + 1}` } }))

    const normalized = normalizeMonthlyAreaOccurrencesResponse({ occurrences: [], manual_catalog_entries: entries })

    expect(normalized.manual_catalog_entries.map((entry) => entry.status)).toEqual([
      'pendiente', 'completada', 'vencida', 'justificada', 'cancelada', 'reprogramada',
    ])
  })

  it('translates every ad hoc activity status from the backend contract', () => {
    const activities = ['pending', 'completed', 'cancelled'].map((status, index) => ({ id: index + 1, status, name: `Actividad ${index + 1}` }))

    const normalized = normalizeMonthlyAreaOccurrencesResponse({ occurrences: [], ad_hoc_activities: activities })

    expect(normalized.ad_hoc_activities.map((activity) => activity.status)).toEqual(['pendiente', 'completada', 'cancelada'])
  })

  it('leaves unknown or non-string manual statuses untouched', () => {
    const response = normalizeMonthlyAreaOccurrencesResponse({
      occurrences: [],
      manual_catalog_entries: [{ id: 1, status: 'en espera' }, { id: 2, status: null }, { id: 3 }],
      ad_hoc_activities: [{ id: 4, status: 42 }, { id: 5, status: 'PENDING' }],
    })

    expect(response.manual_catalog_entries).toEqual([{ id: 1, status: 'en espera' }, { id: 2, status: null }, { id: 3 }])
    expect(response.ad_hoc_activities).toEqual([{ id: 4, status: 42 }, { id: 5, status: 'PENDING' }])
  })

  it('keeps the translation idempotent and preserves every other manual entry field', () => {
    const response = {
      occurrences: [],
      manual_catalog_entries: [{ id: 7, status: 'completed', effective_date: '2026-09-20', classification: 'qualitative', planning_note: 'Nota' }],
      ad_hoc_activities: [{ id: 8, status: 'pendiente', effective_date: '2026-09-21', name: 'Actividad' }],
    }

    const once = normalizeMonthlyAreaOccurrencesResponse(response)
    const twice = normalizeMonthlyAreaOccurrencesResponse(once)

    expect(once.manual_catalog_entries).toEqual([{ id: 7, status: 'completada', effective_date: '2026-09-20', classification: 'qualitative', planning_note: 'Nota' }])
    expect(twice).toEqual(once)
    expect(response.manual_catalog_entries[0].status).toBe('completed')
  })

  it('normalizes occurrences without discarding other monthly response metadata', () => {
    const response = { month: '2026-09', timezone: 'America/Tegucigalpa', occurrences: [{ occurrence_id: 14, status: 'scheduled' }] }

    expect(normalizeMonthlyAreaOccurrencesResponse(response)).toEqual({
      month: '2026-09',
      timezone: 'America/Tegucigalpa',
      occurrences: [{ occurrence_id: 14, status: 'scheduled' }],
    })
  })
})
