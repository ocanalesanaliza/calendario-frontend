import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SucursalesPage from './SucursalesPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

function mockRequests({ sucursales = [], areas = [], createResponse = response({ sucursal: { id_sucursal: 15 } }, 201), templates = [], assignmentResponses = [] } = {}) {
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/api/sucursales/' && options.method === 'POST') return createResponse
    if (path === '/api/sucursales/15/' && options.method === 'PATCH') return response({ sucursal: { id_sucursal: 15 } })
    if (path === '/api/sucursales/') return response({ results: sucursales })
    if (path === '/api/sucursales/areas-elegibles/') return response({ count: areas.length, results: areas })
    if (path === '/api/gerentes-area/') return response({ results: [{ id_gerente_area: 2, nombre: 'GA Centro', activo: true }] })
    if (path === '/api/plantillas/') return response({ results: templates })
    if (path === '/api/plantillas/4/asignar-sucursales/' && options.method === 'POST') return assignmentResponses.shift() ?? response({})
    throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`)
  })
}

function llenarBasicos(dialog) {
  const textboxes = within(dialog).getAllByRole('textbox')
  fireEvent.change(textboxes[0], { target: { value: 'Sucursal Centro' } })
  fireEvent.change(textboxes[1], { target: { value: 'CENTRO-01' } })
}

describe('SucursalesPage: número de guardias', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReset()
    mockRequests({ areas: [{ id: 8, codigo: 'CENTRO', nombre: 'Centro', gerente_area: { id_gerente_area: 2, nombre: 'GA Centro', email: 'ga@example.com' } }] })
  })

  it('permite al administrador maestro configurar de 0 a 4 guardias al crear', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    const area = await within(dialog).findByLabelText(/Área/)
    expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/areas-elegibles/')
    expect(within(area).getByRole('option', { name: 'CENTRO — Centro' })).toHaveValue('8')
    fireEvent.change(area, { target: { value: '8' } })
    expect(within(dialog).getByText('Gerente de área asignado')).toBeInTheDocument()
    expect(within(dialog).getByText('GA Centro')).toBeInTheDocument()
    expect(within(dialog).getByText('ga@example.com')).toBeInTheDocument()
    const numeroGuardias = within(dialog).getByLabelText('Número de guardias')
    expect(numeroGuardias).toHaveAttribute('min', '0')
    expect(numeroGuardias).toHaveAttribute('max', '4')
    fireEvent.change(numeroGuardias, { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Sucursal Centro', codigo: 'CENTRO-01', calendar_area_id: 8, numero_guardias: 3 }),
    }))
  })

  it.each([
    ['GA', { type: 'gerente_area', es_admin_maestro: false }],
    ['valor textual', { es_admin_maestro: 'true' }],
  ])('oculta la configuración para %s y no envía numero_guardias', async (_nombre, perfil) => {
    useAuth.mockReturnValue({ perfil })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    expect(within(dialog).queryByLabelText('Número de guardias')).not.toBeInTheDocument()
    fireEvent.change(await within(dialog).findByLabelText(/Área/), { target: { value: '8' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Sucursal Centro', codigo: 'CENTRO-01', calendar_area_id: 8 }),
    }))
  })

  it('requiere un área válida antes de habilitar la creación', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })

    expect(await within(dialog).findByLabelText(/Área/)).toBeRequired()
    expect(within(dialog).getByRole('button', { name: 'Crear sucursal' })).toBeDisabled()
  })

  it('bloquea la creación e informa cuando no hay áreas elegibles', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    mockRequests({ areas: [] })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })

    expect(await within(dialog).findByText('No hay áreas elegibles disponibles para crear una sucursal.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crear sucursal' })).toBeDisabled()
  })

  it('muestra el error de calendar_area_id junto al campo Área', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
    mockRequests({
      areas: [{ id: 8, codigo: 'CENTRO', nombre: 'Centro', gerente_area: { nombre: 'GA Centro', email: 'ga@example.com' } }],
      createResponse: response({ detail: { calendar_area_id: 'El área ya no está disponible.' } }, 400),
    })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    fireEvent.change(await within(dialog).findByLabelText(/Área/), { target: { value: '8' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El área ya no está disponible.')
  })

  it('informa la asignación de plantilla fallida después de crear la sucursal y la reintenta sin crearla otra vez', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
    mockRequests({
      areas: [{ id: 8, codigo: 'CENTRO', nombre: 'Centro' }],
      templates: [{ id_plantilla: 4, nombre: 'Apertura', activa: true }],
      assignmentResponses: [response({ detail: 'No se pudo asignar.' }, 500), response({})],
    })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    fireEvent.change(await within(dialog).findByLabelText(/Área/), { target: { value: '8' } })
    fireEvent.change(within(dialog).getAllByRole('combobox')[1], { target: { value: '4' } })
    fireEvent.change(within(dialog).getByDisplayValue(''), { target: { value: '2026-10-15' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La sucursal fue creada, pero no se pudo asignar la plantilla.')
    const assignmentCall = ['/api/plantillas/4/asignar-sucursales/', { method: 'POST', body: JSON.stringify({ id_sucursal: 15, fecha_inicio: '2026-10-15' }) }]
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(...assignmentCall))
    expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/sucursales/' && options?.method === 'POST')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar asignación' }))
    await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path === '/api/plantillas/4/asignar-sucursales/')).toHaveLength(2))
    expect(apiRequest.mock.calls.filter(([path, options]) => path === '/api/sucursales/' && options?.method === 'POST')).toHaveLength(1)
    expect(apiRequest.mock.calls.filter(([path]) => path === '/api/plantillas/4/asignar-sucursales/')[1]).toEqual(assignmentCall)
  })

  it('ignora las áreas elegibles que se resuelven después de cerrar el modal de creación', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
    let resolveAreas
    const pendingAreas = new Promise((resolve) => { resolveAreas = resolve })
    mockRequests()
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === '/api/sucursales/') return response({ results: [] })
      if (path === '/api/sucursales/areas-elegibles/') return pendingAreas
      throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`)
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    await act(async () => { resolveAreas(response({ count: 1, results: [{ id: 8, codigo: 'CENTRO', nombre: 'Centro' }] })) })

    expect(screen.queryByRole('dialog', { name: 'Nueva sucursal' })).not.toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('muestra el valor recibido y lo envía mediante PATCH al editar', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    const sucursal = { id_sucursal: 15, nombre: 'Sucursal Centro', codigo: 'CENTRO-01', activa: true, numero_guardias: 2, gerente_area: { id_gerente_area: 2, nombre: 'GA Centro' } }
    mockRequests({ sucursales: [sucursal] })
    render(<SucursalesPage />)
    expect(await screen.findByRole('cell', { name: '2' })).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Editar'))
    const dialog = screen.getByRole('dialog', { name: 'Editar sucursal' })
    expect(within(dialog).getByLabelText('Número de guardias')).toHaveValue(2)
    fireEvent.change(within(dialog).getByLabelText('Número de guardias'), { target: { value: '4' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/15/', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Sucursal Centro', codigo: 'CENTRO-01', id_gerente_area: 2, numero_guardias: 4 }),
    }))
  })

  it('permite quitar el GS asignado sin desactivar su cuenta', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', es_admin_maestro: false } })
    let tieneTitular = true
    const sucursal = {
      id_sucursal: 15,
      nombre: 'Sucursal Centro',
      codigo: 'CENTRO-01',
      activa: true,
      gerente_area: { id_gerente_area: 2, nombre: 'GA Centro' },
      usuario_titular: { id_usuario: 12, nombre: 'GS Ana', habilitado: true },
    }
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === '/api/sucursales/15/quitar-gs/' && options.method === 'POST') {
        tieneTitular = false
        return response({ detail: 'GS retirado de la sucursal correctamente.' })
      }
      if (path === '/api/sucursales/') {
        return response({ results: [{ ...sucursal, usuario_titular: tieneTitular ? sucursal.usuario_titular : null }] })
      }
      throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${path}`)
    })

    render(<SucursalesPage />)
    expect(await screen.findByRole('cell', { name: /GS Ana/ })).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Quitar GS'))
    const dialog = screen.getByRole('dialog', { name: 'Quitar GS de la sucursal' })
    expect(within(dialog).getByText(/La cuenta del GS permanecerá activa/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quitar GS' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/15/quitar-gs/', { method: 'POST' }))
    expect(await screen.findByRole('cell', { name: 'Sin GS' })).toBeInTheDocument()
    expect(screen.queryByTitle('Quitar GS')).not.toBeInTheDocument()
  })
})
