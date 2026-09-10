import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAnaliticaRevisionesGuardia } from './revisionesGuardiaAnaliticaService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

describe('revisionesGuardiaAnaliticaService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('envía todos los filtros admitidos con paginación', async () => {
    apiRequest.mockResolvedValue(response({ count: 0, results: [] }))
    const params = { fecha: '2026-09-09', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-09', id_sucursal: 15, id_gerente_area: 2, id_usuario: 12, buscar: 'Ana', page: 2, page_size: 50 }
    await getAnaliticaRevisionesGuardia(params)
    expect(apiRequest).toHaveBeenCalledWith('/api/analitica/revisiones-guardia/?fecha=2026-09-09&fecha_inicio=2026-09-01&fecha_fin=2026-09-09&id_sucursal=15&id_gerente_area=2&id_usuario=12&buscar=Ana&page=2&page_size=50')
  })

  it.each([403, 400])('muestra el error HTTP %i del backend', async (status) => {
    apiRequest.mockResolvedValue(response({ detail: 'No autorizado.' }, status))
    await expect(getAnaliticaRevisionesGuardia()).rejects.toMatchObject({ status, message: 'No autorizado.' })
  })
})
