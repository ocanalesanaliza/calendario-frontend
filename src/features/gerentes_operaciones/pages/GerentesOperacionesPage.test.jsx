import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GerentesOperacionesRoute } from '../../../App'
import GerentesOperacionesPage from './GerentesOperacionesPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))
vi.mock('../../auth/context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth,
}))

const response = (data, ok = true, status = ok ? 200 : 400) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(data),
})

const list = {
  results: [{
    id: 12,
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@test.com',
    activo: true,
    debe_cambiar_password: true,
    areas: [{ codigo: 'VENTAS' }],
  }],
  areas_disponibles: [{ id: 5, codigo: 'VENTAS', nombre: 'Ventas' }],
}

describe('GerentesOperacionesPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true, activo: true, habilitado: true } })
    navigator.clipboard = { writeText: vi.fn().mockResolvedValue() }
  })

  it('guards the route against an active non-Systems account', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_operaciones', activo: true, habilitado: true } })

    render(
      <MemoryRouter initialEntries={['/gerentes-operaciones']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><p>Administración GO</p></GerentesOperacionesRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Administración GO')).not.toBeInTheDocument()
  })

  it.each([
    ['/gerentes-operaciones', 'Administración GO'],
    ['/areas', 'Administración Áreas'],
  ])('allows %s when Systems status claims are absent', (path, content) => {
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true } })

    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><p>Administración GO</p></GerentesOperacionesRoute>} />
          <Route path="/areas" element={<GerentesOperacionesRoute><p>Administración Áreas</p></GerentesOperacionesRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it.each([
    ['/gerentes-operaciones', 'Administración GO', 'inactive Systems account', { es_cuenta_sistemas: true, activo: false }],
    ['/areas', 'Administración Áreas', 'inactive Systems account', { es_cuenta_sistemas: true, activo: false }],
    ['/gerentes-operaciones', 'Administración GO', 'disabled Systems account', { es_cuenta_sistemas: true, habilitado: false }],
    ['/areas', 'Administración Áreas', 'disabled Systems account', { es_cuenta_sistemas: true, habilitado: false }],
  ])('blocks %s for a %s', async (path, content, _, perfil) => {
    useAuth.mockReturnValue({ perfil })

    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><p>Administración GO</p></GerentesOperacionesRoute>} />
          <Route path="/areas" element={<GerentesOperacionesRoute><p>Administración Áreas</p></GerentesOperacionesRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it('allows an active and enabled Systems account', () => {
    render(
      <MemoryRouter initialEntries={['/gerentes-operaciones']}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><p>Administración GO</p></GerentesOperacionesRoute>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Administración GO')).toBeInTheDocument()
  })

  it('creates with apellido and optional selected area IDs', async () => {
    apiRequest
      .mockResolvedValueOnce(response(list))
      .mockResolvedValueOnce(response({ gerente_operaciones: { nombre: 'Beto' }, password_temporal: 'Temporal123' }))
      .mockResolvedValueOnce(response(list))

    render(<GerentesOperacionesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo gerente de operaciones' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Beto' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Ruiz' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'beto@test.com' } })
    fireEvent.click(screen.getByLabelText('VENTAS — Ventas'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear gerente' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/go/', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Beto', apellido: 'Ruiz', email: 'beto@test.com', area_ids: [5] }),
    }))
    expect(await screen.findByText(/Contraseña temporal para Beto/)).toBeInTheDocument()
  })

  it('sends only changed identity fields and maps a 400 error to its field', async () => {
    apiRequest
      .mockResolvedValueOnce(response(list))
      .mockResolvedValueOnce(response({ detail: { email: ['Ya existe'] } }, false))

    render(<GerentesOperacionesPage />)
    await screen.findByText('Pérez')
    fireEvent.click(screen.getByTitle('Editar'))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'duplicado@test.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/go/12/', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'duplicado@test.com' }),
    }))
    expect(await screen.findByText('Ya existe')).toBeInTheDocument()
  })

  it('uses separate assignment operations and contextualizes reassignment conflicts', async () => {
    apiRequest
      .mockResolvedValueOnce(response(list))
      .mockResolvedValueOnce(response({ detail: 'temporal_conflict' }, false, 409))

    render(<GerentesOperacionesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByTitle('Gestionar áreas'))
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reasignar área ocupada' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/go/12/areas/5/', {
      method: 'PUT',
    }))
    expect(await screen.findByText(/conflicto actual o futuro/i)).toBeInTheDocument()
  })

  it('uses the nested manager name, copies the temporary password, and removes it when the modal closes', async () => {
    apiRequest
      .mockResolvedValueOnce(response(list))
      .mockResolvedValueOnce(response({ gerente_operaciones: { nombre: 'Ana' }, password_temporal: 'Temporal123', notification_delivery_status: 'notification_delivery_pending_retry' }))
      .mockResolvedValueOnce(response(list))

    render(<GerentesOperacionesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByTitle('Resetear contraseña'))
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }))
    expect(await screen.findByText(/Contraseña temporal para Ana/)).toBeInTheDocument()
    expect(screen.getByText(/se entregará en un reintento/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar contraseña' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Temporal123')
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByText('Temporal123')).not.toBeInTheDocument()
  })

  it('deactivates a manager and reloads the list', async () => {
    apiRequest
      .mockResolvedValueOnce(response(list))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ results: [], areas_disponibles: [] }))

    render(<GerentesOperacionesPage />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByTitle('Desactivar'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/go/12/deactivation/', { method: 'POST' }))
    expect(await screen.findByText('No hay gerentes de operaciones registrados.')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(3)
  })
})
