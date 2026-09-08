import { describe, expect, it } from 'vitest'
import { occurrenceToCalendarEvent, occurrencesToCalendarEvents } from './calendarEvents'

describe('calendar event adapter', () => {
  it('uses the effective ISO date as start and preserves the scheduled date', () => {
    const occurrence = {
      id: 8,
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
        task: 'Inventario',
        scheduled_date: '2026-09-12',
        effective_date: '2026-09-15',
        weight: 30,
        all_day: true,
      },
    })
  })

  it('adapts every occurrence without mutating the input', () => {
    const occurrences = [{ id: 1, task: { nombre: 'Revisión' }, effective_date: '2026-09-01', scheduled_date: '2026-09-01', weight: 10, all_day: false }]

    expect(occurrencesToCalendarEvents(occurrences)).toHaveLength(1)
    expect(occurrences[0].effective_date).toBe('2026-09-01')
  })
})
