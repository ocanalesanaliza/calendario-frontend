import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../services/apiClient', () => ({ apiRequest }))

import {
  discoverAreaBranches,
  listHistory,
  previewInventory,
  submitInventoryArea,
  submitInventoryBranch,
} from './inventoryService'

function response(body, ok = true, status = 200) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) }
}

describe('inventoryService', () => {
  const file = new File(['xlsx-bytes'], 'inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const rows = [{ code: 'A-1', physical_stock: 4, expiration_date: '2026-12-31' }]

  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue(response({ rows: [], errors: [] }))
  })

  it('previews with the original XLSX FormData body and parses the JSON response', async () => {
    apiRequest.mockResolvedValueOnce(response({ rows: [{ code: 'A-1' }], errors: [] }))

    await expect(previewInventory(file)).resolves.toEqual({ rows: [{ code: 'A-1' }], errors: [] })

    const [, options] = apiRequest.mock.calls[0]
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
  })

  it.each([
    ['GS', () => submitInventoryBranch({ assignmentId: 12, file, rows, comment: 'Nota', idempotencyKey: 'stable-gs' })],
    ['GA', () => submitInventoryArea({ areaOccurrenceId: 42, branchId: 7, file, rows, comment: 'Hallazgo', idempotencyKey: 'stable-ga' })],
  ])('envía %s en multipart con el archivo original y sin expected_version inicial', async (_role, send) => {
    await send()

    const [, options] = apiRequest.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('rows')).toBe(JSON.stringify(rows))
    expect(options.body.get('expected_version')).toBeNull()
  })

  it('requiere descubrir sucursales autorizadas de GA antes de seleccionar una', async () => {
    apiRequest.mockResolvedValueOnce(response({ area_occurrence_id: 42, branches: [{ id: 7, code: 'INV-001', name: 'Sucursal Centro' }] }))

    await expect(discoverAreaBranches(42)).resolves.toEqual({ area_occurrence_id: 42, branches: [{ id: 7, code: 'INV-001', name: 'Sucursal Centro' }] })
    expect(apiRequest).toHaveBeenCalledWith('/api/inventarios/ga/ocurrencias/42/sucursales/')
  })

  it('sends only the recognized history scope query parameter', async () => {
    await listHistory({ branchId: 7 })
    expect(apiRequest).toHaveBeenLastCalledWith('/api/inventarios/historial/?branch_id=7')

    await listHistory({ areaId: 3 })
    expect(apiRequest).toHaveBeenLastCalledWith('/api/inventarios/historial/?area_id=3')

    await listHistory({ branchId: 7, areaId: 3 })
    expect(apiRequest).toHaveBeenLastCalledWith('/api/inventarios/historial/?branch_id=7')
  })
})
