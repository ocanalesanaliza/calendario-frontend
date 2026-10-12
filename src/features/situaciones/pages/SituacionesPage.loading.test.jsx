import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SituacionesPage from './SituacionesPage'

const { apiRequest, auth } = vi.hoisted(() => ({ apiRequest: vi.fn(), auth: { perfil: {} } }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth: () => auth }))

const base = '/api/rendimiento/situaciones-especiales/'
const tipo = { codigo: 'reunion_resultados', nombre: 'Reunión de resultados' }
const usuario = { id_usuario: 12, nombre: 'Ana' }
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

function defaultRequest(path) {
  if (path === `${base}tipos/`) return response({ count: 1, results: [tipo], puede_crear: true })
  if (path === `${base}usuarios/`) return response({ count: 1, results: [usuario] })
  if (path === '/api/gerentes-area/') return response({ results: [
    { id_gerente_area: 2, nombre: 'Gerente 2', activo: true },
    { id_gerente_area: 3, nombre: 'Gerente 3', activo: true },
  ] })
  if (path.startsWith(`${base}?`)) return response({ results: [], total_pages: 0 })
  throw new Error(`Unexpected request: ${path}`)
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function fecha(dias = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dias)
  return date.toISOString().slice(0, 10)
}

async function abrirModal() {
  render(<SituacionesPage />)
  await screen.findByText('No hay situaciones especiales registradas.')
  fireEvent.click(screen.getByRole('button', { name: 'Nueva situación' }))
}

function completarSituacion() {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '12' } })
  fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: fecha() } })
}

describe('SituacionesPage: cargas y recuperación', () => {
  beforeEach(() => {
    auth.perfil = { es_admin_maestro: false }
    apiRequest.mockReset().mockImplementation(async (path) => defaultRequest(path))
  })

  it('bloquea el registro mientras carga el catálogo y permite reintentar si falla', async () => {
    const carga = deferred()
    let reintento = false
    apiRequest.mockImplementation(async (path) => path === `${base}tipos/` && !reintento
      ? carga.promise : defaultRequest(path))
    await abrirModal()
    await screen.findByRole('option', { name: 'Ana' })
    expect(screen.getByLabelText('Tipo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aplicar situación' })).toBeDisabled()

    await act(async () => carga.resolve(response({ detail: 'Catálogo no disponible' }, 503)))
    expect(await screen.findByRole('alert')).toHaveTextContent('Catálogo no disponible')
    reintento = true
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar catálogo' }))
    await screen.findByRole('option', { name: `${tipo.nombre} (100%)` })
    expect(screen.getByLabelText('Tipo')).toHaveValue(tipo.codigo)
    expect(screen.getByRole('button', { name: 'Aplicar situación' })).toBeEnabled()
  })

  it('muestra el error al cargar usuarios y recupera el selector al reintentar', async () => {
    let falla = true
    apiRequest.mockImplementation(async (path) => path === `${base}usuarios/` && falla
      ? response({ detail: 'No se pudieron cargar los GS' }, 503) : defaultRequest(path))
    await abrirModal()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los GS')
    expect(screen.getByLabelText('Usuario')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aplicar situación' })).toBeDisabled()
    falla = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar usuarios' }))
    await screen.findByRole('option', { name: 'Ana' })
    expect(screen.getByLabelText('Usuario')).toBeEnabled()
  })

  it('indica que no hay GS activos y evita enviar una situación sin destinatario', async () => {
    apiRequest.mockImplementation(async (path) => path === `${base}usuarios/`
      ? response({ count: 0, results: [] }) : defaultRequest(path))
    await abrirModal()
    expect(await screen.findByText('No hay GS activos disponibles.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar situación' })).toBeDisabled()
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  })

  it('limpia el GS al filtrar por gerente e ignora respuestas de filtros anteriores', async () => {
    auth.perfil = { es_admin_maestro: true }
    const gerente2 = deferred()
    apiRequest.mockImplementation(async (path) => {
      if (path === `${base}usuarios/?id_gerente_area=2`) return gerente2.promise
      if (path === `${base}usuarios/?id_gerente_area=3`) return response({ count: 1, results: [{ id_usuario: 34, nombre: 'Beto' }] })
      return defaultRequest(path)
    })
    await abrirModal()
    await screen.findByRole('option', { name: 'Ana' })
    await screen.findByRole('option', { name: 'Gerente 2' })
    completarSituacion()
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '2' } })
    expect(screen.getByLabelText('Usuario')).toHaveValue('')
    expect(screen.getByLabelText('Usuario')).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '3' } })
    await screen.findByRole('option', { name: 'Beto' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: '34' } })

    await act(async () => gerente2.resolve(response({ count: 1, results: [{ id_usuario: 56, nombre: 'Otro GS' }] })))
    expect(screen.getByLabelText('Usuario')).toHaveValue('34')
    expect(screen.queryByRole('option', { name: 'Otro GS' })).not.toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith(`${base}usuarios/?id_gerente_area=2`)
    expect(apiRequest).toHaveBeenCalledWith(`${base}usuarios/?id_gerente_area=3`)
  })

  it('permite recuperar el listado de gerentes sin ocultar el error', async () => {
    auth.perfil = { es_admin_maestro: true }
    let falla = true
    apiRequest.mockImplementation(async (path) => path === '/api/gerentes-area/' && falla
      ? response({ detail: 'Gerentes no disponibles' }, 503) : defaultRequest(path))
    await abrirModal()
    expect(await screen.findByRole('alert')).toHaveTextContent('Gerentes no disponibles')
    falla = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar gerentes' }))
    await screen.findByRole('option', { name: 'Gerente 2' })
    expect(screen.queryByText('Gerentes no disponibles')).not.toBeInTheDocument()
  })

  it('conserva el tipo creado si falla la recarga y reintenta solo el GET', async () => {
    const nuevo = { codigo: 'capacitacion', nombre: 'Capacitación' }
    let creado = false
    let fallaRecarga = true
    apiRequest.mockImplementation(async (path, options) => {
      if (path === `${base}tipos/` && options?.method === 'POST') {
        creado = true
        return response(nuevo, 201)
      }
      if (path === `${base}tipos/` && creado) return fallaRecarga
        ? response({ detail: 'No se pudo actualizar el catálogo' }, 503)
        : response({ count: 2, results: [tipo, nuevo], puede_crear: true })
      return defaultRequest(path)
    })
    await abrirModal()
    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tipo' }))
    fireEvent.change(screen.getByLabelText('Nombre del tipo'), { target: { value: nuevo.nombre } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tipo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el catálogo')
    expect(screen.getByLabelText('Tipo')).toHaveValue(nuevo.codigo)
    expect(screen.getByRole('button', { name: 'Aplicar situación' })).toBeDisabled()
    fallaRecarga = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar catálogo' }))
    await waitFor(() => expect(screen.getByLabelText('Tipo')).toBeEnabled())
    expect(screen.getByLabelText('Tipo')).toHaveValue(nuevo.codigo)
    expect(apiRequest.mock.calls.filter(([path, options]) => path === `${base}tipos/` && options?.method === 'POST')).toHaveLength(1)
  })

  it('mantiene abierto el rango hasta completarlo y reintenta desde el día que falló', async () => {
    const fechasEnviadas = []
    let falla = true
    apiRequest.mockImplementation(async (path, options) => {
      if (path === base && options?.method === 'POST') {
        const body = JSON.parse(options.body)
        fechasEnviadas.push(body.fecha)
        if (body.fecha === fecha(-1) && falla) return response({ detail: 'No se pudo registrar este día' }, 400)
        return response(body, 201)
      }
      return defaultRequest(path)
    })
    await abrirModal()
    await screen.findByRole('option', { name: 'Ana' })
    completarSituacion()
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: fecha(-2) } })
    fireEvent.change(screen.getByLabelText(/Fecha fin/), { target: { value: fecha() } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar este día')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha inicio')).toHaveValue(fecha(-1))
    expect(fechasEnviadas).toEqual([fecha(-2), fecha(-1)])

    falla = false
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar situación' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fechasEnviadas).toEqual([fecha(-2), fecha(-1), fecha(-1), fecha()])
  })

  it('muestra el error del listado en vez de presentarlo como una lista vacía', async () => {
    let falla = true
    apiRequest.mockImplementation(async (path) => path.startsWith(`${base}?`) && falla
      ? response({ detail: 'Situaciones no disponibles' }, 503) : defaultRequest(path))
    render(<SituacionesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Situaciones no disponibles')
    expect(screen.queryByText('No hay situaciones especiales registradas.')).not.toBeInTheDocument()
    falla = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar situaciones' }))
    await screen.findByText('No hay situaciones especiales registradas.')
  })
})
