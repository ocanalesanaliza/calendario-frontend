import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreasPage from './AreasPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

const response = (data, ok = true, status = ok ? 200 : 400) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(data),
})

describe('AreasPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true, activo: true, habilitado: true } })
  })

  it('assigns an eligible manager, closes the modal, reloads, and shows a toast', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response({ results: [{ id_gerente_area: 7, nombre: 'Ana' }, { id_gerente_area: 1, nombre: 'Sistemas', es_cuenta_sistemas: true }] }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Asignar gerente de área a Ventas' }))
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Sistemas' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/ga/7/areas/', {
      method: 'POST', body: JSON.stringify({ area_id: 3 }),
    }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Gerente de área asignado correctamente.')).toBeInTheDocument()
  })

  it('keeps the assignment modal open for an occupied area conflict', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response([{ id_gerente_area: 7, nombre: 'Ana' }]))
      .mockResolvedValueOnce(response({ code: 'area_already_assigned' }, false, 409))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Asignar gerente de área a Ventas' }))
    await screen.findByRole('option', { name: 'Ana' })
    fireEvent.change(screen.getByLabelText('Gerente de área'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Asignar gerente de área a Ventas' })
    expect(within(dialog).getByText('Esta área ya está asignada. ¿Deseas programar la reasignación desde mañana?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Reasignar desde mañana' })).toBeEnabled()
  })

  it('shows only the assignment action to an authorized operations manager', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_operaciones', activo: true, habilitado: true } })
    apiRequest.mockResolvedValue(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    expect(screen.getByRole('button', { name: 'Asignar gerente de área a Ventas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva área/ })).not.toBeInTheDocument()
  })

  it('maps a nested field error on creation', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ detail: { codigo: ['Ya existe'] } }, false))

    render(<AreasPage />)
    await screen.findByText('No hay áreas registradas.')
    fireEvent.click(screen.getByRole('button', { name: /Nueva área/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ventas' } })
    fireEvent.change(screen.getByLabelText('Codigo'), { target: { value: 'VEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Ya existe')).toBeInTheDocument()
  })

  it('creates an area and reloads the list', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ id: 4, nombre: 'Ventas', codigo: 'VEN' }))
      .mockResolvedValueOnce(response({ results: [{ id: 4, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))

    render(<AreasPage />)
    await screen.findByText('No hay áreas registradas.')
    fireEvent.click(screen.getByRole('button', { name: /Nueva área/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ventas' } })
    fireEvent.change(screen.getByLabelText('Codigo'), { target: { value: 'VEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/areas/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Ventas', codigo: 'VEN' }),
    }))
    expect(await screen.findByText('Ventas')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(3)
  })

  it('edits an area and reloads the list', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response({ id: 3, nombre: 'Ventas', codigo: 'VEN' }))
      .mockResolvedValueOnce(response({ id: 3, nombre: 'Comercial', codigo: 'VEN' }))
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Comercial', codigo: 'VEN', activa: true }] }))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByRole('dialog', { name: 'Editar área' })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Comercial' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/areas/3/', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Comercial' }),
    }))
    expect(await screen.findByText('Comercial')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(4)
  })

  it('explains deactivation conflict', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response({ detail: 'Conflict' }, false, 409))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('asignaciones GO actuales o futuras')
  })

  it('deactivates an area and reloads the list', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ results: [] }))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/areas/3/deactivation/', { method: 'POST' }))
    expect(await screen.findByText('No hay áreas registradas.')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(3)
  })

  it('explains when the area no longer exists while loading its detail', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ results: [{ id: 3, nombre: 'Ventas', codigo: 'VEN', activa: true }] }))
      .mockResolvedValueOnce(response({ detail: 'Not found' }, false, 404))

    render(<AreasPage />)
    await screen.findByText('Ventas')
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El área solicitada ya no existe.')
  })

  it('retries a failed list request', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ detail: 'Unavailable' }, false, 403))
      .mockResolvedValueOnce(response({ results: [] }))

    render(<AreasPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
  })

  it('keeps focus inside the dialog and restores it after Escape', async () => {
    apiRequest.mockResolvedValue(response({ results: [] }))

    render(<AreasPage />)
    const trigger = await screen.findByRole('button', { name: /Nueva área/ })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Nueva área' })
    const nameInput = screen.getByLabelText('Nombre')
    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    const saveButton = screen.getByRole('button', { name: 'Guardar' })
    expect(nameInput).toHaveFocus()

    closeButton.focus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(saveButton).toHaveFocus()
    fireEvent.keyDown(saveButton, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
