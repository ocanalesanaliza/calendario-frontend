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

function mockApi({ permisoTipos = { puede_crear: false }, errorCrearTipo, errorCrearSituacion } = {}) {
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
      if (errorCrearSituacion) return response(errorCrearSituacion.body, errorCrearSituacion.status)
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
  it('muestra el selector de jornada y envía jornada completa por defecto', async () => {
    mockApi()
    await abrirNuevaSituacion()
    expect(screen.getByLabelText('Tipo')).toHaveValue('permiso_autorizado')
    expect(screen.getByRole('option', { name: 'Permiso con autorización (100%)' })).toHaveProperty('selected', true)
    expect(screen.getByLabelText('Jornada')).toHaveValue('full_day')
    const fecha = llenarSituacion()

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: 'permiso_autorizado', notas: 'Reunión mensual', slot: 'full_day' }),
    }))
    expect(await screen.findByRole('cell', { name: 'Permiso con autorización (100%)' })).toBeInTheDocument()
  })

  it.each([
    ['Mañana', 'morning'],
    ['Tarde', 'afternoon'],
  ])('envía %s como %s', async (_label, slot) => {
    mockApi()
    await abrirNuevaSituacion()
    const fecha = llenarSituacion()
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: slot } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: 'permiso_autorizado', notas: 'Reunión mensual', slot }),
    }))
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
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: codigo, notas: 'Reunión mensual', slot: 'full_day' }),
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
      body: JSON.stringify({ id_usuario: 12, fecha, tipo: 'capacitacion', notas: 'Reunión mensual', slot: 'full_day' }),
    }))
    expect(await screen.findByRole('cell', { name: 'Capacitación (100%)' })).toBeInTheDocument()
  })

  it('muestra mañana y tarde activas de un mismo GS y fecha por separado', async () => {
    const fecha = fechaReciente()
    const situaciones = [
      { id_situacion_especial: 7, id_usuario: 12, fecha, tipo: 'permiso_autorizado', notas: '', slot: 'morning', usuario: USUARIO, activa: true },
      { id_situacion_especial: 8, id_usuario: 12, fecha, tipo: 'reunion_resultados', notas: '', slot: 'afternoon', usuario: USUARIO, activa: true },
    ]
    mockApi()
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path.startsWith(`${BASE}?`) && !options.method) return response({ count: situaciones.length, results: situaciones, total_pages: 1 })
      if (path === `${BASE}tipos/`) return response({ count: TIPOS.length, results: TIPOS, puede_crear: false })
      throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`)
    })

    render(<SituacionesPage />)

    expect(await screen.findByRole('cell', { name: 'Mañana' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Tarde' })).toBeInTheDocument()
    expect(screen.getAllByText('GS Ana')).toHaveLength(2)
  })

  it('muestra Jornada completa cuando una situación existente no incluye jornada', async () => {
    const fecha = fechaReciente()
    const situaciones = [{ id_situacion_especial: 7, id_usuario: 12, fecha, tipo: 'permiso_autorizado', notas: '', usuario: USUARIO, activa: true }]
    mockApi()
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path.startsWith(`${BASE}?`) && !options.method) return response({ count: 1, results: situaciones, total_pages: 1 })
      if (path === `${BASE}tipos/`) return response({ count: TIPOS.length, results: TIPOS, puede_crear: false })
      throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`)
    })

    render(<SituacionesPage />)

    expect(await screen.findByRole('cell', { name: 'Jornada completa' })).toBeInTheDocument()
  })

  it('muestra el detalle de conflicto 409 devuelto por el backend', async () => {
    mockApi({ errorCrearSituacion: { status: 409, body: { detail: 'Ya existe una situación para la jornada de mañana.' } } })
    await abrirNuevaSituacion()
    llenarSituacion()
    fireEvent.change(screen.getByLabelText('Jornada'), { target: { value: 'morning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una situación para la jornada de mañana.')
  })

  it('recarga el listado después de crear jornada completa para reflejar parciales inactivas', async () => {
    const fecha = fechaReciente()
    let situaciones = [{
      id_situacion_especial: 7,
      id_usuario: 12,
      fecha,
      tipo: 'permiso_autorizado',
      notas: '',
      slot: 'morning',
      usuario: USUARIO,
      activa: true,
    }]
    mockApi()
    apiRequest.mockImplementation(async (path, options = {}) => {
      const method = options.method ?? 'GET'
      if (path === `${BASE}tipos/`) return response({ count: TIPOS.length, results: TIPOS, puede_crear: false })
      if (path === `${BASE}usuarios/`) return response({ count: 1, results: [USUARIO] })
      if (path === BASE && method === 'POST') {
        situaciones = [
          { ...situaciones[0], activa: false },
          { id_situacion_especial: 8, ...JSON.parse(options.body), usuario: USUARIO, activa: true },
        ]
        return response(situaciones[1], 201)
      }
      if (path.startsWith(`${BASE}?`) && method === 'GET') return response({ count: situaciones.length, results: situaciones, total_pages: 1 })
      throw new Error(`Unexpected request: ${method} ${path}`)
    })

    render(<SituacionesPage />)
    await screen.findByRole('cell', { name: 'Mañana' })
    fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
    await screen.findByRole('option', { name: USUARIO.nombre })
    llenarSituacion(fecha)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))

    await waitFor(() => expect(screen.getAllByText('Inactiva')).toHaveLength(1))
    expect(screen.getByRole('cell', { name: 'Jornada completa' })).toBeInTheDocument()
    expect(apiRequest.mock.calls.filter(([path, options]) => path.startsWith(`${BASE}?`) && !options?.method)).toHaveLength(2)
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
