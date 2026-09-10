import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRevisionGuardia, guardarRevisionGuardia } from './revisionesGuardiaService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

describe('revisionesGuardiaService', () => {
  beforeEach(() => apiRequest.mockReset())

  it('consulta el formulario por tarea de sucursal y fecha', async () => {
    const formulario = { fecha: '2026-09-09', numero_guardias: 2, guardias_requeridos: [1, 2], puede_guardar: true }
    apiRequest.mockResolvedValue(response({ formulario }))
    await expect(getRevisionGuardia(15, '2026-09-09')).resolves.toEqual(formulario)
    expect(apiRequest).toHaveBeenCalledWith('/api/revisiones-guardia/?id_sucursal_tarea=15&fecha=2026-09-09')
  })

  it('guarda exclusivamente en el endpoint de revisiones', async () => {
    const body = { id_sucursal_tarea: 15, fecha: '2026-09-09', guardias: [{ numero_guardia: 1 }] }
    apiRequest.mockResolvedValue(response({ revision: { id: 1 } }, 201))
    await guardarRevisionGuardia(body)
    expect(apiRequest).toHaveBeenCalledWith('/api/revisiones-guardia/', { method: 'POST', body: JSON.stringify(body) })
  })

  it('preserva el estado y los mensajes de validación del backend', async () => {
    apiRequest.mockResolvedValue(response({ detail: { guardias: ['Debe enviar exactamente dos guardias.'] } }, 400))
    await expect(guardarRevisionGuardia({})).rejects.toMatchObject({ status: 400, message: 'Debe enviar exactamente dos guardias.' })
  })
})
