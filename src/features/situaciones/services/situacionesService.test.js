import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crearSituacion,
  crearTipoSituacion,
  desactivarSituacion,
  getSituaciones,
  getTiposSituaciones,
  getUsuariosSituaciones,
} from './situacionesService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

function respond(data, status = 200) {
  apiRequest.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('situacionesService: contrato de la API', () => {
  it('conserva el catálogo y puede_crear devueltos por GET /tipos/', async () => {
    const catalogo = {
      count: 1,
      results: [{ codigo: 'reunion_resultados', nombre: 'Reunión de resultados' }],
      puede_crear: false,
    }
    respond(catalogo)

    await expect(getTiposSituaciones()).resolves.toEqual(catalogo)
    expect(apiRequest).toHaveBeenCalledWith('/api/rendimiento/situaciones-especiales/tipos/')
  })

  it('crea un tipo enviando únicamente su nombre y conserva el código del backend', async () => {
    const tipo = { codigo: 'capacitacion', nombre: 'Capacitación' }
    respond(tipo, 201)

    await expect(crearTipoSituacion('Capacitación')).resolves.toEqual(tipo)
    expect(apiRequest).toHaveBeenCalledWith('/api/rendimiento/situaciones-especiales/tipos/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Capacitación' }),
    })
  })

  it.each([
    [{}, '/api/rendimiento/situaciones-especiales/usuarios/'],
    [{ id_gerente_area: 2 }, '/api/rendimiento/situaciones-especiales/usuarios/?id_gerente_area=2'],
  ])('consulta los GS elegibles con los parámetros %j', async (params, url) => {
    const usuarios = { count: 1, results: [{ id: 12, nombre: 'GS activo' }] }
    respond(usuarios)

    await expect(getUsuariosSituaciones(params)).resolves.toEqual(usuarios)
    expect(apiRequest).toHaveBeenCalledWith(url)
  })

  it('registra una situación con id_usuario, fecha, código del tipo y notas', async () => {
    const payload = {
      id_usuario: 12,
      fecha: '2026-09-08',
      tipo: 'reunion_resultados',
      notas: 'Reunión mensual',
    }
    const situacion = { id: 7, ...payload }
    respond(situacion, 201)

    await expect(crearSituacion(payload)).resolves.toEqual(situacion)
    expect(apiRequest).toHaveBeenCalledWith('/api/rendimiento/situaciones-especiales/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })

  it('permite enviar el código de un tipo nuevo sin traducirlo ni usar una lista fija', async () => {
    const payload = { id_usuario: 12, fecha: '2026-09-08', tipo: 'capacitacion', notas: '' }
    respond({ id: 8, ...payload }, 201)

    await crearSituacion(payload)
    expect(apiRequest).toHaveBeenCalledWith('/api/rendimiento/situaciones-especiales/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })

  it('mantiene los filtros al consultar situaciones', async () => {
    const situaciones = { count: 0, results: [] }
    respond(situaciones)

    await expect(getSituaciones({ id_usuario: 12, tipo: 'reunion_resultados' })).resolves.toEqual(situaciones)
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/rendimiento/situaciones-especiales/?id_usuario=12&tipo=reunion_resultados',
    )
  })

  it('desactiva la situación mediante POST a su endpoint', async () => {
    const situacion = { id: 7, activo: false }
    respond(situacion)

    await expect(desactivarSituacion(7)).resolves.toEqual(situacion)
    expect(apiRequest).toHaveBeenCalledWith('/api/rendimiento/situaciones-especiales/7/desactivar/', {
      method: 'POST',
    })
  })
})

describe('situacionesService: errores de validación y permisos', () => {
  it.each([
    { detail: 'Ya existe un tipo con ese nombre.' },
    { detail: { nombre: ['Ya existe un tipo con ese nombre.'] } },
    { detail: ['Ya existe un tipo con ese nombre.'] },
    { nombre: ['Ya existe un tipo con ese nombre.'] },
  ])('muestra un duplicado 400 como texto legible: %j', async (data) => {
    respond(data, 400)

    await expect(crearTipoSituacion('Capacitación')).rejects.toMatchObject({
      status: 400,
      message: 'Ya existe un tipo con ese nombre.',
    })
  })

  it('conserva el mensaje 403 del backend al intentar crear un tipo sin permiso', async () => {
    const message = 'Solo el administrador maestro puede crear tipos.'
    respond({ detail: message }, 403)

    await expect(crearTipoSituacion('Capacitación')).rejects.toMatchObject({ status: 403, message })
  })

  it('muestra los errores del registro, incluido id_usuario obligatorio', async () => {
    respond({
      detail: {
        id_usuario: ['Este campo es obligatorio.'],
        tipo: ['Seleccione un tipo válido.'],
      },
    }, 400)

    await expect(crearSituacion({ fecha: '2026-09-08', tipo: '' })).rejects.toMatchObject({
      status: 400,
      message: 'Este campo es obligatorio. Seleccione un tipo válido.',
    })
  })

  it.each([
    ['situaciones', () => getSituaciones()],
    ['tipos', () => getTiposSituaciones()],
    ['usuarios', () => getUsuariosSituaciones()],
    ['desactivar', () => desactivarSituacion(7)],
  ])('muestra errores anidados en %s', async (_endpoint, request) => {
    respond({ detail: { permisos: ['No tiene permiso para realizar esta acción.'] } }, 403)

    await expect(request()).rejects.toMatchObject({
      status: 403,
      message: 'No tiene permiso para realizar esta acción.',
    })
  })

  it('usa el mensaje de respaldo cuando el backend no proporciona texto', async () => {
    respond({ detail: [] }, 500)

    await expect(getTiposSituaciones()).rejects.toMatchObject({
      status: 500,
      message: 'Error al cargar tipos de situaciones especiales',
    })
  })
})
