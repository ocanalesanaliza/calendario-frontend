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
      task: { id: 8, name: 'Inventario' },
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
      task: { id: 8, name: 'Inventario' },
      weight: 30,
      all_day: true,
    })
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
