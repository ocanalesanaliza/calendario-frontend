import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDepositReceipt,
  allocateDepositReceipt,
  captureDepositClosure,
  declareNoDepositado,
  getDepositCompliance,
  getDepositReport,
  getOverdueDepositObligation,
  openDepositReport,
  openOverdueDepositReport,
  submitDepositReport,
} from './depositService'

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest: api.apiRequest }))

const response = (data, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

describe('depositService', () => {
  beforeEach(() => api.apiRequest.mockReset())

  it('opens a GS report with only the selected branch task id', async () => {
    api.apiRequest.mockResolvedValue(response({ report: { id: 'opaque-report-id' } }, true, 201))

    await expect(openDepositReport({ sucursal_tarea_id: 44 })).resolves.toEqual({ report: { id: 'opaque-report-id' } })
    expect(api.apiRequest).toHaveBeenCalledWith('/api/depositos/gs/abrir/', {
      method: 'POST',
      body: JSON.stringify({ sucursal_tarea_id: 44 }),
    })
  })

  it('uses opaque server identities and the current optimistic version for every report action', async () => {
    api.apiRequest.mockResolvedValue(response({ report: { id: 'opaque-report-id', optimistic_version: 2 } }))

    await getDepositReport('opaque-report-id')
    await captureDepositClosure('opaque-report-id', 71, { total_sales: '100.00', cash_sales: '80.00', card_sales: '20.00', expected_version: 1, idempotency_key: 'capture-key' })
    await addDepositReceipt('opaque-report-id', { deposited_amount: '80.00', reference: 'REF-1', deposited_on: '2026-11-02', expected_version: 2, idempotency_key: 'receipt-key' })
    await allocateDepositReceipt('opaque-report-id', 81, { closure_entry_id: 71, allocated_amount: '80.00', expected_version: 3, idempotency_key: 'allocation-key' })
    await declareNoDepositado('opaque-report-id', 72, { reason: 'Bank service unavailable', expected_version: 4, idempotency_key: 'no-deposit-key' })
    await submitDepositReport('opaque-report-id', { expected_version: 5, idempotency_key: 'submit-key' })

    expect(api.apiRequest.mock.calls).toEqual([
      ['/api/depositos/gs/reportes/opaque-report-id/', { method: 'GET' }],
      ['/api/depositos/gs/reportes/opaque-report-id/cierres/71/capturar/', { method: 'POST', body: JSON.stringify({ total_sales: '100.00', cash_sales: '80.00', card_sales: '20.00', expected_version: 1, idempotency_key: 'capture-key' }) }],
      ['/api/depositos/gs/reportes/opaque-report-id/comprobantes/', { method: 'POST', body: JSON.stringify({ deposited_amount: '80.00', reference: 'REF-1', deposited_on: '2026-11-02', expected_version: 2, idempotency_key: 'receipt-key' }) }],
      ['/api/depositos/gs/reportes/opaque-report-id/comprobantes/81/asignaciones/', { method: 'POST', body: JSON.stringify({ closure_entry_id: 71, allocated_amount: '80.00', expected_version: 3, idempotency_key: 'allocation-key' }) }],
      ['/api/depositos/gs/reportes/opaque-report-id/cierres/72/no-depositado/', { method: 'POST', body: JSON.stringify({ reason: 'Bank service unavailable', expected_version: 4, idempotency_key: 'no-deposit-key' }) }],
      ['/api/depositos/gs/reportes/opaque-report-id/enviar/', { method: 'POST', body: JSON.stringify({ expected_version: 5, idempotency_key: 'submit-key' }) }],
    ])
  })

  it('preserves typed conflicts and validation failures for a recoverable UI', async () => {
    api.apiRequest.mockResolvedValue(response({ detail: 'deposit_api_disabled' }, false, 409))

    await expect(openDepositReport({ sucursal_tarea_id: 44 })).rejects.toMatchObject({ status: 409, detail: 'deposit_api_disabled' })
  })

  it('uses the overdue-obligation T4/T5 endpoints without changing opaque IDs or payloads', async () => {
    const obligationId = 'obligation:opaque/GS-001'
    const bridgePayload = {
      report: { id: 'report:opaque/001', occurrence_id: 'occurrence:opaque/001', receipt_ids: ['receipt:opaque/001'] },
      access: { can_read: true, can_prepare: true, can_submit: false },
    }
    api.apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: obligationId }] }))
      .mockResolvedValueOnce(response({ id: obligationId, historical_closure_id: 'closure:opaque/001' }))
      .mockResolvedValueOnce(response(bridgePayload, true, 201))

    await expect(getDepositCompliance()).resolves.toEqual({ results: [{ id: obligationId }] })
    await expect(getOverdueDepositObligation(obligationId)).resolves.toEqual({ id: obligationId, historical_closure_id: 'closure:opaque/001' })
    await expect(openOverdueDepositReport(obligationId)).resolves.toEqual(bridgePayload)

    expect(api.apiRequest.mock.calls).toEqual([
      ['/api/depositos/cumplimiento/', { method: 'GET' }],
      [`/api/depositos/obligaciones/${obligationId}/`, { method: 'GET' }],
      [`/api/depositos/obligaciones/${obligationId}/reporte/`, { method: 'POST' }],
    ])
  })

  it('preserves overdue-obligation API error status and detail for a recoverable UI', async () => {
    api.apiRequest.mockResolvedValue(response({ detail: 'overdue_obligation_forbidden' }, false, 403))

    await expect(getOverdueDepositObligation('opaque-obligation-id')).rejects.toMatchObject({
      status: 403,
      detail: 'overdue_obligation_forbidden',
    })
  })

  it('forwards punctuation-bearing opaque IDs and preserves bridge errors', async () => {
    const obligationId = 'obligation:segment/GS-001?raw=%26+space'
    api.apiRequest
      .mockResolvedValueOnce(response({ id: obligationId }))
      .mockResolvedValueOnce(response({ detail: 'already_submitted' }, false, 409))

    await expect(getOverdueDepositObligation(obligationId)).resolves.toEqual({ id: obligationId })
    await expect(openOverdueDepositReport(obligationId)).rejects.toMatchObject({
      message: 'already_submitted',
      status: 409,
      detail: 'already_submitted',
    })

    expect(api.apiRequest.mock.calls).toEqual([
      [`/api/depositos/obligaciones/${obligationId}/`, { method: 'GET' }],
      [`/api/depositos/obligaciones/${obligationId}/reporte/`, { method: 'POST' }],
    ])
  })
})
