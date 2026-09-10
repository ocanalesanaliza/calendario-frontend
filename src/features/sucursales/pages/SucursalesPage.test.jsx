import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SucursalesPage from './SucursalesPage'

const { apiRequest, useAuth } = vi.hoisted(() => ({ apiRequest: vi.fn(), useAuth: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

function mockRequests(sucursales = []) {
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/api/sucursales/' && options.method === 'POST') return response({ sucursal: { id_sucursal: 15 } }, 201)
    if (path === '/api/sucursales/15/' && options.method === 'PATCH') return response({ sucursal: { id_sucursal: 15 } })
    if (path === '/api/sucursales/') return response({ results: sucursales })
    if (path === '/api/gerentes-area/') return response({ results: [{ id_gerente_area: 2, nombre: 'GA Centro', activo: true }] })
    if (path === '/api/plantillas/') return response({ results: [] })
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
    mockRequests()
  })

  it('permite al administrador maestro configurar de 0 a 4 guardias al crear', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    render(<SucursalesPage />)
    await screen.findByText('No hay sucursales registradas.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: '2' } })
    const numeroGuardias = within(dialog).getByLabelText('Número de guardias')
    expect(numeroGuardias).toHaveAttribute('min', '0')
    expect(numeroGuardias).toHaveAttribute('max', '4')
    fireEvent.change(numeroGuardias, { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Sucursal Centro', codigo: 'CENTRO-01', id_gerente_area: 2, numero_guardias: 3 }),
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
    const dialog = screen.getByRole('dialog', { name: 'Nueva sucursal' })
    llenarBasicos(dialog)
    expect(within(dialog).queryByLabelText('Número de guardias')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear sucursal' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/sucursales/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Sucursal Centro', codigo: 'CENTRO-01' }),
    }))
  })

  it('muestra el valor recibido y lo envía mediante PATCH al editar', async () => {
    useAuth.mockReturnValue({ perfil: { es_admin_maestro: true } })
    const sucursal = { id_sucursal: 15, nombre: 'Sucursal Centro', codigo: 'CENTRO-01', activa: true, numero_guardias: 2, gerente_area: { id_gerente_area: 2, nombre: 'GA Centro' } }
    mockRequests([sucursal])
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
