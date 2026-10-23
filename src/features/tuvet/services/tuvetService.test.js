import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TUVET_NO_DISPONIBLE,
  agregarEncargadoAGerenteSucursal,
  aprobarOcurrencia,
  asignarPlantilla,
  createEncargado,
  createGerenteSucursal,
  getEncargadosDeGerenteSucursal,
  retirarEncargadoDeGerenteSucursal,
  desactivarTarea,
  desvincularGoEncargado,
  formatError,
  getMisTareas,
  getRendimiento,
  getRevisiones,
  marcarOcurrencia,
  rechazarOcurrencia,
  updateTarea,
} from './tuvetService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
})

describe('tuvetService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response({ count: 0, results: [] })))

  it('envía los query params obligatorios de los listados mensuales', async () => {
    await getMisTareas(2026, 10)
    await getRevisiones(2026, 10, 'en_revision')
    await getRendimiento({ year: 2026, month: 10, gerenteSucursal: 31, departamento: undefined })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/tuvet/mis-tareas/?year=2026&month=10')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/tuvet/revisiones/?year=2026&month=10&estado=en_revision')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/tuvet/rendimiento/?year=2026&month=10&gerente_sucursal=31')
  })

  it('no envía body en DELETE ni en aprobar', async () => {
    await desactivarTarea(81)
    await aprobarOcurrencia(501)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/tuvet/tareas/81/', { method: 'DELETE' })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/tuvet/ocurrencias/501/aprobar/', { method: 'POST' })
  })

  it('elimina propiedades undefined antes de enviar', async () => {
    await createEncargado({ nombre: 'Ana', apellido: undefined, email: 'ana@tuvet.com', departamento_id: 4, empresa_id: undefined })
    await updateTarea(81, { nombre: 'Nuevo', descripcion: undefined })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/tuvet/encargados/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Ana', email: 'ana@tuvet.com', departamento_id: 4 }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/tuvet/tareas/81/', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Nuevo' }),
    })
  })

  it('usa los cuerpos del contrato para marcar, rechazar, asignar y desvincular', async () => {
    const documento = { nombre: 'resultado.pdf', content_type: 'application/pdf', base64: 'JVBERi0=' }
    await marcarOcurrencia(501)
    await marcarOcurrencia(502, documento)
    await rechazarOcurrencia(503, 'Incompleto')
    await asignarPlantilla(15, [31, 44])
    await desvincularGoEncargado(12, 42)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/tuvet/ocurrencias/501/marcar/', { method: 'POST', body: '{}' })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/tuvet/ocurrencias/502/marcar/', { method: 'POST', body: JSON.stringify({ documento }) })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/tuvet/ocurrencias/503/rechazar/', { method: 'POST', body: JSON.stringify({ comentario: 'Incompleto' }) })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/tuvet/plantillas/15/asignaciones/', { method: 'POST', body: JSON.stringify({ gerentes_sucursal: [31, 44] }) })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/tuvet/go-encargados/', {
      method: 'DELETE',
      body: JSON.stringify({ gerente_operaciones_id: 12, encargado_id: 42 }),
    })
  })

  it('gestiona la relación N:M entre GS y encargados', async () => {
    await createGerenteSucursal({ nombre: 'Marta', email: 'marta@tuvet.com', empresa_id: 2, encargado_ids: [42, 57] })
    await getEncargadosDeGerenteSucursal(31)
    await agregarEncargadoAGerenteSucursal(31, 42)
    await retirarEncargadoDeGerenteSucursal(31, 57)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/tuvet/gerentes-sucursal/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Marta', email: 'marta@tuvet.com', empresa_id: 2, encargado_ids: [42, 57] }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/tuvet/gs/31/encargados/')
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/tuvet/gs/31/encargados/', { method: 'POST', body: JSON.stringify({ encargado_id: 42 }) })
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/tuvet/gs/31/encargados/', { method: 'DELETE', body: JSON.stringify({ encargado_id: 57 }) })
  })

  it('muestra errores de dominio anidados en detail', async () => {
    apiRequest.mockResolvedValue(response({ detail: { documento: ['La evidencia es obligatoria.'] } }, 400))

    await expect(marcarOcurrencia(501)).rejects.toMatchObject({
      status: 400,
      message: 'La evidencia es obligatoria.',
      fields: { documento: ['La evidencia es obligatoria.'] },
    })
  })

  it('distingue un registro fuera de ámbito del módulo deshabilitado', async () => {
    apiRequest.mockResolvedValueOnce(response({ detail: 'not_found' }, 404))
    await expect(aprobarOcurrencia(1)).rejects.toMatchObject({ message: 'El registro no existe o está fuera de tu ámbito.' })

    apiRequest.mockResolvedValueOnce({ ok: false, status: 404, json: vi.fn().mockRejectedValue(new Error('no json')) })
    await expect(getMisTareas(2026, 10)).rejects.toMatchObject({ code: TUVET_NO_DISPONIBLE })
  })

  it('formatea campos desconocidos y conflictos', () => {
    expect(formatError({ campos_desconocidos: ['campo_extra'] })).toBe('Campos no admitidos: campo_extra.')
    expect(formatError('conflicto_de_integridad')).toMatch(/al mismo tiempo/)
    expect(formatError({ email: ['Correo inválido.'] })).toBe('Correo inválido.')
  })
})
