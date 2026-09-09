import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GerentesPage from './GerentesPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })

describe('GerentesPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true, activo: true, habilitado: true } })
  })

  it('assigns an eligible area and refreshes the manager list', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id_gerente_area: 8, nombre: 'Ana', email: 'ana@test.com', activo: true }] }))
      .mockResolvedValueOnce(response({ results: [{ id: 4, nombre: 'Ventas', codigo: 'VEN' }] }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ results: [{ id_gerente_area: 8, nombre: 'Ana', email: 'ana@test.com', activo: true }] }))

    render(<GerentesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Asignar área a Ana' }))
    expect(await screen.findByRole('option', { name: 'VEN — Ventas' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga/8/areas/', {
      method: 'POST', body: JSON.stringify({ area_id: 4 }),
    }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Área asignada correctamente.')).toBeInTheDocument()
  })

  it('keeps the assignment modal open when the manager already has an area', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id_gerente_area: 8, nombre: 'Ana', email: 'ana@test.com', activo: true }] }))
      .mockResolvedValueOnce(response([{ id: 4, nombre: 'Ventas', codigo: 'VEN' }]))
      .mockResolvedValueOnce(response({ code: 'area_manager_already_assigned' }, false))

    render(<GerentesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Asignar área a Ana' }))
    await screen.findByRole('option', { name: 'VEN — Ventas' })
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este gerente de área ya tiene un área asignada.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows only assignment actions to an authorized operations manager', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_operaciones', activo: true, habilitado: true } })
    apiRequest.mockResolvedValue(response({ results: [{ id_gerente_area: 8, nombre: 'Ana', email: 'ana@test.com', activo: true }] }))

    render(<GerentesPage />)
    await screen.findByText('Ana')
    expect(screen.getByRole('button', { name: 'Asignar área a Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo gerente' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument()
  })

  it('keeps the temporary password and delivery warning when refresh fails after creation', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ count: 0, results: [] }))
      .mockResolvedValueOnce(response({
        gerente_area: { nombre: 'Ana' },
        password_temporal: 'Temporal123',
        correo_enviado: false,
      }))
      .mockResolvedValueOnce(response({ detail: 'Refresh unavailable' }, false))

    render(<GerentesPage />)
    await screen.findByText('No hay gerentes registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo gerente' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Ana' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'ana@test.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear gerente' }))

    expect(await screen.findByText('Temporal123')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('no pudo confirmar el envío del correo')
  })
})
