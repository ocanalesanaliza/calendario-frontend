import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeMonthlyAreaPerformance,
  completeAreaOccurrence,
  correctMonthlyAreaPerformance,
  createAdHocActivity,
  createManualCatalogEntry,
  cancelAdHocActivity,
  cancelManualCatalogEntry,
  completeAdHocActivity,
  completeManualCatalogEntry,
  getManualPlanningContext,
  getMonthlyAreaAbsences,
  getMonthlyAreaOccurrences,
  getMonthlyAreaPerformance,
  rescheduleAreaOccurrence,
  rescheduleManualCatalogEntry,
  updateAdHocActivity,
  updateManualCatalogEntry,
} from './monthlyAreaCalendarService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

describe('monthlyAreaCalendarService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses the monthly occurrence, absence, and performance command contracts', async () => {
    const performance = { area_id: 8, month: '2026-09', reason: 'Cierre mensual' }
    await getMonthlyAreaOccurrences('2026-09')
    await getMonthlyAreaAbsences('2026-09')
    await getMonthlyAreaPerformance('2026-09')
    await completeAreaOccurrence(14, 'complete-key')
    await rescheduleAreaOccurrence(14, { target_date: '2026-09-15', reason: 'Cobertura' }, 'reschedule-key')
    await closeMonthlyAreaPerformance(performance)
    await correctMonthlyAreaPerformance(performance)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/my-area/monthly-occurrences/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/my-area/monthly-absences/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/my-area/monthly-performance/?month=2026-09')
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/my-area/occurrences/14/complete/', {
      method: 'POST', headers: { 'Idempotency-Key': 'complete-key' },
    })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/my-area/occurrences/14/reschedule/', {
      method: 'POST', headers: { 'Idempotency-Key': 'reschedule-key' }, body: JSON.stringify({ target_date: '2026-09-15', reason: 'Cobertura' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/area-performance/close/', { method: 'POST', body: JSON.stringify(performance) })
    expect(apiRequest).toHaveBeenNthCalledWith(7, '/api/calendar/area-performance/correct/', { method: 'POST', body: JSON.stringify(performance) })
  })

  it('loads manual planning context in parallel and sends manual commands with idempotency keys', async () => {
    const areas = { results: [{ id: 8, nombre: 'Operaciones' }] }
    const branches = { results: [{ id_sucursal: 11, nombre: 'Centro' }] }
    apiRequest.mockResolvedValueOnce(response(areas)).mockResolvedValueOnce(response(branches))

    await expect(getManualPlanningContext()).resolves.toEqual({ areas: areas.results, branches: branches.results })
    expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/areas-elegibles/')
    expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/')

    await createManualCatalogEntry({ area_id: 8, task_id: 5, scheduled_date: '2026-10-10', branch_id: 11, planning_note: 'Visita' }, 'catalog-key')
    await createAdHocActivity({ area_id: 8, name: 'Reunión', description: 'Seguimiento', scheduled_date: '2026-10-10' }, 'ad-hoc-key')

    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/my-area/manual-catalog-entries/', {
      method: 'POST', headers: { 'Idempotency-Key': 'catalog-key' }, body: JSON.stringify({ area_id: 8, task_id: 5, scheduled_date: '2026-10-10', branch_id: 11, planning_note: 'Visita' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/my-area/ad-hoc-activities/', {
      method: 'POST', headers: { 'Idempotency-Key': 'ad-hoc-key' }, body: JSON.stringify({ area_id: 8, name: 'Reunión', description: 'Seguimiento', scheduled_date: '2026-10-10' }),
    })
  })

  it('uses the manual entry update and action contracts with one idempotency key per command', async () => {
    await updateManualCatalogEntry(4, { planning_note: 'Nueva nota', branch_id: 11 }, 'catalog-update')
    await completeManualCatalogEntry(4, {}, 'catalog-complete')
    await rescheduleManualCatalogEntry(4, { target_date: '2026-10-11' }, 'catalog-reschedule')
    await cancelManualCatalogEntry(4, { reason: 'Ya no aplica' }, 'catalog-cancel')
    await updateAdHocActivity(9, { name: 'Reunión actualizada', description: 'Detalle' }, 'ad-hoc-update')
    await completeAdHocActivity(9, { reason: '' }, 'ad-hoc-complete')
    await cancelAdHocActivity(9, { reason: 'Cancelada' }, 'ad-hoc-cancel')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/my-area/manual-catalog-entries/4/', { method: 'PATCH', headers: { 'Idempotency-Key': 'catalog-update' }, body: JSON.stringify({ planning_note: 'Nueva nota', branch_id: 11 }) })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/my-area/manual-catalog-entries/4/complete/', { method: 'POST', headers: { 'Idempotency-Key': 'catalog-complete' }, body: JSON.stringify({}) })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/my-area/manual-catalog-entries/4/reschedule/', { method: 'POST', headers: { 'Idempotency-Key': 'catalog-reschedule' }, body: JSON.stringify({ target_date: '2026-10-11' }) })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/my-area/manual-catalog-entries/4/cancel/', { method: 'POST', headers: { 'Idempotency-Key': 'catalog-cancel' }, body: JSON.stringify({ reason: 'Ya no aplica' }) })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/my-area/ad-hoc-activities/9/', { method: 'PATCH', headers: { 'Idempotency-Key': 'ad-hoc-update' }, body: JSON.stringify({ name: 'Reunión actualizada', description: 'Detalle' }) })
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/my-area/ad-hoc-activities/9/complete/', { method: 'POST', headers: { 'Idempotency-Key': 'ad-hoc-complete' }, body: JSON.stringify({ reason: '' }) })
    expect(apiRequest).toHaveBeenNthCalledWith(7, '/api/calendar/my-area/ad-hoc-activities/9/cancel/', { method: 'POST', headers: { 'Idempotency-Key': 'ad-hoc-cancel' }, body: JSON.stringify({ reason: 'Cancelada' }) })
  })
})
