import { describe, expect, it, vi } from 'vitest'
import { getDepositReviewWorklist, recordDepositReviewDecision } from './depositReviewWorklistService'

const { getCalendarArea, postCalendarArea } = vi.hoisted(() => ({ getCalendarArea: vi.fn(), postCalendarArea: vi.fn() }))
vi.mock('./calendarAreaApi', () => ({ getCalendarArea, postCalendarArea }))

describe('deposit review worklist service', () => {
  it('uses opaque occurrence and case IDs with the T6.1 endpoints and exact decision body', async () => {
    getCalendarArea.mockResolvedValue({ id: 'occurrence-signed-opaque' })
    postCalendarArea.mockResolvedValue({ worklist: { id: 'occurrence-signed-opaque' } })

    await expect(getDepositReviewWorklist('occurrence-signed-opaque')).resolves.toEqual({ id: 'occurrence-signed-opaque' })
    await recordDepositReviewDecision('occurrence-signed-opaque', 'case-signed-opaque', {
      decision: 'con_observacion', comment: 'La referencia requiere seguimiento.', idempotency_key: 'decision-key',
    })

    expect(getCalendarArea).toHaveBeenCalledWith('/api/depositos/ga/bandejas/occurrence-signed-opaque/', expect.any(String))
    expect(postCalendarArea).toHaveBeenCalledWith('/api/depositos/ga/bandejas/occurrence-signed-opaque/casos/case-signed-opaque/decisiones/', {
      decision: 'con_observacion', comment: 'La referencia requiere seguimiento.', idempotency_key: 'decision-key',
    }, expect.any(String))
  })
})
