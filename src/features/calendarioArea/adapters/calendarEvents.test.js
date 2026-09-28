import { describe, expect, it } from 'vitest'
import { absenceToCalendarEvent, absencesToCalendarEvents, occurrenceToCalendarEvent, occurrencesToCalendarEvents, selectVisibleOccurrences } from './calendarEvents'

describe('calendar event adapter', () => {
  it('uses the effective ISO date as start and preserves the scheduled date', () => {
    const occurrence = {
      occurrence_id: 8,
      status: 'scheduled',
      template: { id: 7, name: 'Apertura' },
      template_version: { id: 9, number: 3 },
      coverage_snapshot: { jornada: 'morning', aplica_ambas_jornadas: false, known: true },
      area: 'Operaciones',
      task: 'Inventario',
      scheduled_date: '2026-09-12',
      effective_date: '2026-09-15',
      weight: 30,
      all_day: true,
    }

    expect(occurrenceToCalendarEvent(occurrence)).toEqual({
      id: '8',
      title: 'Inventario',
      start: '2026-09-15',
      allDay: true,
      editable: false,
      extendedProps: {
        area: 'Operaciones',
        occurrence_id: 8,
        status: 'scheduled',
        template: { id: 7, name: 'Apertura' },
        template_version: { id: 9, number: 3 },
        coverage_snapshot: { jornada: 'morning', aplica_ambas_jornadas: false, known: true },
        task: 'Inventario',
        scheduled_date: '2026-09-12',
        effective_date: '2026-09-15',
        weight: 30,
        all_day: true,
      },
    })
  })

  it('exposes the resolved occurrence ID when the payload only provides id', () => {
    const occurrence = { id: 12, task: 'Revisión', effective_date: '2026-09-01', all_day: false }

    expect(occurrenceToCalendarEvent(occurrence)).toMatchObject({
      id: '12',
      extendedProps: { occurrence_id: 12 },
    })
  })

  it('adapts every occurrence without mutating the input', () => {
    const occurrences = [{ id: 1, task: { nombre: 'Revisión' }, effective_date: '2026-09-01', scheduled_date: '2026-09-01', weight: 10, all_day: false }]

    expect(occurrencesToCalendarEvents(occurrences)).toHaveLength(1)
    expect(occurrences[0].effective_date).toBe('2026-09-01')
  })

  it('maps vacation absences as informational all-day events preserving date and slot', () => {
    const absence = { id: 3, source: 'vacation', type: 'approved', date: '2026-09-15', slot: 'morning' }

    expect(absenceToCalendarEvent(absence)).toMatchObject({
      id: 'absence-vacation-3', title: 'Vacaciones · Mañana', start: '2026-09-15', allDay: true,
      editable: false, startEditable: false, durationEditable: false, classNames: ['calendar-absence--vacation'],
      extendedProps: { calendar_event_type: 'absence', source: 'vacation', slot: 'morning', type: 'approved' },
    })
  })

  it('maps each active special situation independently with differentiated metadata', () => {
    const absences = [
      { id: 7, source: 'special_situation', type: 'capacitacion', date: '2026-09-15', slot: 'afternoon' },
      { id: 8, source: 'special_situation', type: 'capacitacion', date: '2026-09-15', slot: 'afternoon' },
    ]

    expect(absencesToCalendarEvents(absences)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'absence-special_situation-7', title: 'Situación especial activa · Capacitación · Tarde', start: '2026-09-15', classNames: ['calendar-absence--special_situation'], extendedProps: expect.objectContaining({ source: 'special_situation', slot: 'afternoon', type: 'capacitacion' }) }),
      expect.objectContaining({ id: 'absence-special_situation-8', start: '2026-09-15', extendedProps: expect.objectContaining({ source: 'special_situation', slot: 'afternoon' }) }),
    ]))
  })

  it.each([
    ['morning', { known: true, jornada: 'morning' }, { known: true, jornada: 'afternoon' }],
    ['afternoon', { known: true, jornada: 'afternoon' }, { known: true, jornada: 'morning' }],
  ])('hides only known %s occurrences on the same effective date', (slot, coveredCoverage, visibleCoverage) => {
    const covered = { id: 1, effective_date: '2026-09-15', coverage_snapshot: coveredCoverage }
    const visible = { id: 2, effective_date: '2026-09-15', coverage_snapshot: visibleCoverage }
    const otherDate = { id: 3, effective_date: '2026-09-16', coverage_snapshot: coveredCoverage }

    expect(selectVisibleOccurrences([covered, visible, otherDate], [{ source: 'vacation', date: '2026-09-15', slot }])).toEqual([visible, otherDate])
  })

  it('hides every known coverage with a full-day absence', () => {
    const morning = { id: 1, effective_date: '2026-09-15', coverage_snapshot: { known: true, jornada: 'morning' } }
    const afternoon = { id: 2, effective_date: '2026-09-15', coverage_snapshot: { known: true, jornada: 'afternoon' } }
    const fullDay = { id: 3, effective_date: '2026-09-15', coverage_snapshot: { known: true, jornada: 'morning', aplica_ambas_jornadas: true } }

    expect(selectVisibleOccurrences([morning, afternoon, fullDay], [{ source: 'vacation', date: '2026-09-15', slot: 'full_day' }])).toEqual([])
  })

  it('keeps full-day tasks visible for partial absences and unknown or legacy coverage', () => {
    const occurrences = [
      { id: 1, effective_date: '2026-09-15', coverage_snapshot: { known: true, jornada: 'morning', aplica_ambas_jornadas: true } },
      { id: 2, effective_date: '2026-09-15', coverage_snapshot: { known: false, jornada: 'morning' } },
      { id: 3, effective_date: '2026-09-15' },
    ]

    expect(selectVisibleOccurrences(occurrences, [{ source: 'vacation', date: '2026-09-15', slot: 'morning' }])).toEqual(occurrences)
  })

  it('hides occurrences when any active supported absence source covers their shift', () => {
    const occurrence = { id: 1, effective_date: '2026-09-15', coverage_snapshot: { known: true, jornada: 'tarde' } }

    expect(selectVisibleOccurrences([occurrence], [
      { source: 'other', date: '2026-09-15', slot: 'afternoon' },
      { source: 'vacation', date: '2026-09-14', slot: 'afternoon' },
      { source: 'special_situation', date: '2026-09-15', slot: 'afternoon' },
    ])).toEqual([])
  })
})
