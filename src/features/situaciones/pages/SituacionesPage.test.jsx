import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SituacionesPage from './SituacionesPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const BASE = '/api/rendimiento/situaciones-especiales/'
const TIPOS = [
  { codigo: 'permiso_autorizado', nombre: 'Permiso con autorización' },
  { codigo: 'reunion_resultados', nombre: 'Reunión de resultados' },
  { codigo: 'encuentro_regional_2026', nombre: 'Encuentro regional' },
  { codigo: 'no_aprobada_ga', nombre: 'No aprobada por GA' },
]
const USUARIO = { id_usuario: 12, nombre: 'GS Ana' }
const TIPO_NUEVO = { codigo: 'capacitacion', nombre: 'Capacitación' }

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(data) }
}

function fechaReciente() {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - 1)
  return fecha.toISOString().slice(0, 10)
}

function mockApi({ permisoTipos = { puede_crear: false }, errorCrearTipo } = {}) {
  let tipos = [...TIPOS]
  let situaciones = []
  apiRequest.mockImplementation(async (path, options = {}) => {
    const method = options.method ?? 'GET'
    if (path === `${BASE}tipos/`) {
      if (method === 'POST') {
        if (errorCrearTipo) return response(errorCrearTipo.body, errorCrearTipo.status)
        tipos = [...tipos, TIPO_NUEVO]
        return response(TIPO_NUEVO, 201)
      }
      return response({ count: tipos.length, results: tipos, ...permisoTipos })
    }
    if (path === `${BASE}usuarios/`) {
      return response({ count: 1, results: [USUARIO] })
    }
    if (path === '/api/gerentes-area/') {
      return response({ count: 1, results: [{ id_gerente_area: 2, nombre: 'GA Centro', activo: true }] })
    }
    if (path === BASE && method === 'POST') {
      const situacion = {
        id_situacion_especial: 7,
        ...JSON.parse(options.body),
        usuario: USUARIO,
        activa: true,
      }
      situaciones = [...situaciones, situacion]
      return response(situacion, 201)
    }
    if (path === `${BASE}7/desactivar/` && method === 'POST') {
      situaciones = situaciones.filter((situacion) => situacion.id_situacion_especial !== 7)
      return response({ detail: 'Situación desactivada.' })
    }
    if (path.startsWith(`${BASE}?`) && method === 'GET') {
      return response({ count: situaciones.length, results: situaciones, total_pages: 1 })
    }
    throw new Error(`Unexpected request: ${method} ${path}`)
  })
}

async function abrirNuevaSituacion() {
  render(<SituacionesPage />)
  await screen.findByText('No hay situaciones especiales registradas.')
  fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
  await screen.findByRole('option', { name: USUARIO.nombre })
  await waitFor(() => expect(screen.getByLabelText('Tipo')).toBeEnabled())
  return screen.getByRole('dialog', { name: 'Nueva situación especial' })
}

function llenarSituacion(fecha = fechaReciente()) {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: fecha } })
  fireEvent.change(screen.getByLabelText(/^Notas/), { target: { value: 'Reunión mensual' } })
  return fecha
}

beforeEach(() => {
  apiRequest.mockReset()
  useAuth.mockReturnValue({ perfil: { rol: 'GA', es_admin_maestro: false } })
})

describe('SituacionesPage: catálogo y registro', () => {
  it('envía el código del primer tipo visible aunque el usuario no cambie el selector', async () => {
    mockApi()
    await abrirNuevaSituacion()
    expect(screen.getByLabelText('Tipo')).toHaveValue('permiso_autorizado')
    expect(screen.getByRole('option', { name: 'Permiso con autorización (100%)' })).toHaveProperty('selected', true)
    const fecha = llenarSituacion()

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: 'permiso_autorizado', notas: 'Reunión mensual' }),
    }))
    expect(await screen.findByRole('cell', { name: 'Permiso con autorización (100%)' })).toBeInTheDocument()
  })

  it.each(TIPOS.slice(1))('muestra $nombre y envía su código $codigo', async ({ codigo, nombre }) => {
    mockApi()
    await abrirNuevaSituacion()
    const porcentaje = codigo === 'no_aprobada_ga' ? 0 : 100
    const nombreConPorcentaje = `${nombre} (${porcentaje}%)`
    expect(screen.getByRole('option', { name: nombreConPorcentaje })).toHaveValue(codigo)
    const fecha = llenarSituacion()
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: codigo } })

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: codigo, notas: 'Reunión mensual' }),
    }))
    expect(await screen.findByRole('cell', { name: nombreConPorcentaje })).toBeInTheDocument()
  })

  it('exige id_usuario y evita el POST incluso si se fuerza un submit sin elegir GS', async () => {
    mockApi()
    await abrirNuevaSituacion()
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: fechaReciente() } })

    expect(screen.getByLabelText('Usuario')).toBeRequired()
    expect(screen.getByLabelText('Usuario')).toBeInvalid()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))
    expect(apiRequest.mock.calls.some(([path, options]) => path === BASE && options?.method === 'POST')).toBe(false)

    fireEvent.submit(screen.getByLabelText('Usuario').closest('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Debes seleccionar un usuario.')
    expect(apiRequest.mock.calls.some(([path, options]) => path === BASE && options?.method === 'POST')).toBe(false)
    expect(apiRequest).toHaveBeenCalledWith(`${BASE}usuarios/`)
    expect(apiRequest).not.toHaveBeenCalledWith('/api/usuarios/')
  })

  it('permite al GA registrar y desactivar situaciones sin permiso para crear tipos', async () => {
    mockApi()
    await abrirNuevaSituacion()
    expect(screen.queryByRole('button', { name: 'Agregar tipo' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Gerente de área')).not.toBeInTheDocument()
    llenarSituacion()
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'reunion_resultados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))
    await screen.findByRole('cell', { name: 'Reunión de resultados (100%)' })

    fireEvent.click(screen.getByTitle('Desactivar'))
    const dialog = screen.getByRole('dialog', { name: 'Desactivar situación especial' })
    expect(within(dialog).getByText('Reunión de resultados (100%)')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))

    await screen.findByText('No hay situaciones especiales registradas.')
    expect(apiRequest).toHaveBeenCalledWith(`${BASE}7/desactivar/`, { method: 'POST' })
    expect(apiRequest.mock.calls.some(([path, options]) => path === `${BASE}tipos/` && options?.method === 'POST')).toBe(false)
  })
})

describe('SituacionesPage: creación de tipos', () => {
  it.each([
    ['false', { puede_crear: false }],
    ['ausente', {}],
    ['texto true', { puede_crear: 'true' }],
  ])('oculta Agregar tipo cuando puede_crear es %s, incluso al maestro', async (_label, permisoTipos) => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    mockApi({ permisoTipos })

    await abrirNuevaSituacion()

    expect(screen.queryByRole('button', { name: 'Agregar tipo' })).not.toBeInTheDocument()
  })

  it('el maestro crea el tipo por nombre, recarga el catálogo y aplica su código seleccionado automáticamente', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    mockApi({ permisoTipos: { puede_crear: true } })
    await abrirNuevaSituacion()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))

    fireEvent.change(screen.getByLabelText('Nombre del tipo'), { target: { value: '  Capacitación  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tipo' }))

    await screen.findByRole('dialog', { name: 'Nueva situación especial' })
    await waitFor(() => expect(screen.getByLabelText('Tipo')).toBeEnabled())
    expect(apiRequest).toHaveBeenCalledWith(`${BASE}tipos/`, {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Capacitación' }),
    })
    expect(apiRequest.mock.calls.filter(([path, options]) => path === `${BASE}tipos/` && !options?.method)).toHaveLength(2)
    expect(screen.getByLabelText('Tipo')).toHaveValue('capacitacion')
    expect(screen.getAllByRole('option', { name: 'Capacitación (100%)' })).toHaveLength(1)
    expect(apiRequest.mock.calls.some(([path, options]) => path === BASE && options?.method === 'POST')).toBe(false)

    const fecha = llenarSituacion()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: 'capacitacion', notas: 'Reunión mensual' }),
    }))
    expect(await screen.findByRole('cell', { name: 'Capacitación (100%)' })).toBeInTheDocument()
  })

  it.each([
    [400, { nombre: ['Ya existe un tipo con ese nombre.'] }, 'Ya existe un tipo con ese nombre.'],
    [403, { detail: 'Solo el administrador maestro puede crear tipos.' }, 'Solo el administrador maestro puede crear tipos.'],
  ])('muestra el error %i del backend al crear tipo y permite corregirlo', async (status, body, mensaje) => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    mockApi({ permisoTipos: { puede_crear: true }, errorCrearTipo: { status, body } })
    await abrirNuevaSituacion()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))
    fireEvent.change(screen.getByLabelText('Nombre del tipo'), { target: { value: 'Capacitación' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tipo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje)
    expect(screen.getByRole('dialog', { name: 'Agregar tipo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del tipo')).toHaveValue('Capacitación')
    expect(screen.getByRole('button', { name: 'Guardar tipo' })).toBeEnabled()
    expect(apiRequest.mock.calls.filter(([path, options]) => path === `${BASE}tipos/` && !options?.method)).toHaveLength(1)
    expect(apiRequest.mock.calls.some(([path, options]) => path === BASE && options?.method === 'POST')).toBe(false)
  })
})
