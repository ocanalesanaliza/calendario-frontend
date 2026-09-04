import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GerentesOperacionesPage from './GerentesOperacionesPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })

const listResponse = {
  count: 1,
  results: [{ id: 12, nombre: 'Ana', email: 'ana@empresa.com', activo: true, debe_cambiar_password: true, areas: [{ id: 5, codigo: 'VENTAS', nombre: 'Ventas' }] }],
  areas_disponibles: [{ id: 5, codigo: 'VENTAS', nombre: 'Ventas' }],
}

describe('GerentesOperacionesPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    navigator.clipboard = { writeText: vi.fn().mockResolvedValue() }
  })

  it('lists operation managers and their current areas', async () => {
    apiRequest.mockResolvedValue(response(listResponse))
    render(<GerentesOperacionesPage />)
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('VENTAS')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
    expect(screen.getByTitle('Editar')).toBeEnabled()
    expect(screen.getByTitle('Resetear contraseña')).toBeEnabled()
    expect(screen.getByTitle('Desactivar')).toBeEnabled()
  })

  it('shows visual-only actions for every manager', async () => {
    apiRequest.mockResolvedValue(response({
      ...listResponse,
      count: 2,
      results: [...listResponse.results, { id: 14, nombre: 'Beto', email: 'beto@empresa.com', activo: false, debe_cambiar_password: false, areas: [] }],
    }))
    render(<GerentesOperacionesPage />)
    await screen.findByText('Beto')
    expect(screen.getAllByTitle('Editar')).toHaveLength(2)
    expect(screen.getAllByTitle('Resetear contraseña')).toHaveLength(2)
    expect(screen.getAllByTitle('Desactivar')).toHaveLength(2)
  })

  it('shows a loading state', () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    render(<GerentesOperacionesPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando gerentes de operaciones')
  })

  it('shows an empty state', async () => {
    apiRequest.mockResolvedValue(response({ count: 0, results: [] }))
    render(<GerentesOperacionesPage />)
    expect(await screen.findByText('No hay gerentes de operaciones registrados.')).toBeInTheDocument()
  })

  it('keeps an error visible and retries the GET request', async () => {
    apiRequest.mockResolvedValueOnce(response({ detail: { email: ['Servicio no disponible'] } }, false)).mockResolvedValueOnce(response({ count: 0, results: [] }))
    render(<GerentesOperacionesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
  })

  it('creates a manager, refreshes the list, and reveals the temporary password once', async () => {
    apiRequest.mockResolvedValueOnce(response(listResponse)).mockResolvedValueOnce(response({ id: 13, nombre: 'Beto', email: 'beto@empresa.com', areas: [], password_temporal: 'Temporal123', debe_cambiar_password: true, notification_delivery_status: 'notification_delivered' })).mockResolvedValueOnce(response({ count: 2, results: [] }))
    render(<GerentesOperacionesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo gerente' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Beto' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'beto@empresa.com' } })
    fireEvent.click(screen.getByLabelText('VENTAS — Ventas'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear gerente' }))
    expect(await screen.findByText('Temporal123')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/go/', { method: 'POST', body: JSON.stringify({ nombre: 'Beto', email: 'beto@empresa.com', area_ids: [5] }) })
    expect(screen.getByText('La persona deberá cambiar esta contraseña en su primer acceso.')).toBeInTheDocument()
  })

  it('warns when notification delivery needs a retry', async () => {
    apiRequest.mockResolvedValueOnce(response({ count: 0, results: [] })).mockResolvedValueOnce(response({ id: 13, nombre: 'Beto', email: 'beto@empresa.com', areas: [], password_temporal: 'Temporal123', debe_cambiar_password: true, notification_delivery_status: 'notification_delivery_pending_retry' })).mockResolvedValueOnce(response({ count: 1, results: [] }))
    render(<GerentesOperacionesPage />)
    await screen.findByText('No hay gerentes de operaciones registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo gerente' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Beto' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'beto@empresa.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear gerente' }))
    expect(await screen.findByText(/La cuenta fue creada, pero el correo no se entregó correctamente/)).toBeInTheDocument()
    expect(screen.getByText('Temporal123')).toBeInTheDocument()
  })
})
