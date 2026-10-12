import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import AdminMasterAssignmentsPage from './AdminMasterAssignmentsPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: vi.fn().mockResolvedValue(data) })

function RouteHarness() {
  const navigate = useNavigate()
  return <>
    <button type="button" onClick={() => navigate('/elsewhere')}>Leave page</button>
    <button type="button" onClick={() => navigate('/admin-master-asignaciones')}>Return page</button>
    <Routes>
      <Route path="/admin-master-asignaciones" element={<AdminMasterAssignmentsPage />} />
      <Route path="/elsewhere" element={<p>Elsewhere</p>} />
    </Routes>
  </>
}

describe('AdminMasterAssignmentsPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
  })

  it('loads once, defaults to active assignments, and can show all states', async () => {
    apiRequest.mockResolvedValueOnce(response({ results: [
      { id: 1, profile: { username: 'ana', email: 'ana@example.com' }, country: { name: 'México' }, effective_on: '2026-10-01', lifecycle_state: 'active' },
      { id: 2, profile: { username: 'luis', email: 'luis@example.com' }, country: { name: 'Chile' }, effective_on: '2026-09-01', lifecycle_state: 'expired' },
    ] }))
    render(<AdminMasterAssignmentsPage />)
    expect(await screen.findByText('ana')).toBeInTheDocument()
    expect(screen.queryByText('luis')).not.toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
    expect(screen.getByText('luis')).toBeInTheDocument()
    expect(screen.getByText('expired')).toBeInTheDocument()
  })

  it('renders an error and retries the GET request', async () => {
    apiRequest.mockResolvedValueOnce(response({ detail: 'No disponible' }, false, 500)).mockResolvedValueOnce(response({ results: [] }))
    render(<AdminMasterAssignmentsPage />)
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay asignaciones para mostrar.')).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('posts the exact existing-profile shape without an optional effective date and shows an ephemeral password', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    apiRequest.mockResolvedValueOnce(response(catalog)).mockResolvedValueOnce(response({ password_temporal: 'only-once' })).mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/admin-master-assignments/', { method: 'POST', body: JSON.stringify({ mode: 'existing', profile_id: 7, country_id: 3 }) }))
    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).not.toHaveProperty('reason')
    expect(await screen.findByText('only-once')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cerrar', { selector: 'button' }))
    expect(screen.queryByText('only-once')).not.toBeInTheDocument()
  })

  it('excludes user-nested active profiles and blocks a stale selected profile locally', async () => {
    const catalog = {
      results: [{ id: 1, user: { id: 7, username: 'ana' }, lifecycle_state: 'active' }],
      eligible_profiles: [{ id: 7, username: 'ana' }, { id: 8, username: 'luis' }],
      countries: [{ id: 3, name: 'México' }],
    }
    apiRequest.mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('ana')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))

    const profileSelect = screen.getByLabelText('Perfil existente')
    expect(screen.queryByRole('option', { name: 'ana' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'luis' })).toBeInTheDocument()

    profileSelect.append(new Option('ana', '7'))
    fireEvent.change(profileSelect, { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))

    const error = await screen.findByText('Este perfil ya tiene una asignación activa y no puede asignarse a otro país.')
    expect(error).toHaveAttribute('role', 'alert')
    expect(profileSelect).toHaveAttribute('aria-describedby', error.id)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('excludes profile-nested active profiles and blocks a stale selected profile locally', async () => {
    const catalog = {
      results: [{ id: 1, profile: { id: 7, username: 'ana' }, lifecycle_state: 'active' }],
      eligible_profiles: [{ id: 7, username: 'ana' }, { id: 8, username: 'luis' }],
      countries: [{ id: 3, name: 'México' }],
    }
    apiRequest.mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('ana')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))

    const profileSelect = screen.getByLabelText('Perfil existente')
    expect(screen.queryByRole('option', { name: 'ana' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'luis' })).toBeInTheDocument()

    profileSelect.append(new Option('ana', '7'))
    fireEvent.change(profileSelect, { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))

    const error = await screen.findByText('Este perfil ya tiene una asignación activa y no puede asignarse a otro país.')
    expect(error).toHaveAttribute('role', 'alert')
    expect(profileSelect).toHaveAttribute('aria-describedby', error.id)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('keeps the password modal after a failed refresh and retries with GET only', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    apiRequest.mockResolvedValueOnce(response(catalog)).mockResolvedValueOnce(response({ password_temporal: 'only-once' })).mockResolvedValueOnce(response({ detail: 'Actualización no disponible' }, false, 500)).mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))

    expect(await screen.findByText('only-once')).toBeInTheDocument()
    expect(await screen.findByRole('alert', { name: 'Error de actualización' })).toHaveTextContent('Actualización no disponible')
    expect(screen.queryByRole('dialog', { name: 'Nueva asignación de Admin Master' })).not.toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar actualización' }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(4))
    expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/admin-master-assignments/')
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  })

  it('confirms a successful local password copy without exposing it in feedback', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    navigator.clipboard.writeText.mockResolvedValueOnce()
    apiRequest.mockResolvedValueOnce(response(catalog)).mockResolvedValueOnce(response({ password_temporal: 'temporary-password' })).mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    const copyButton = await screen.findByRole('button', { name: 'Copiar contraseña' })
    expect(copyButton).toHaveFocus()
    fireEvent.click(copyButton)
    expect(await screen.findByText('Contraseña copiada.')).toBeInTheDocument()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('temporary-password')
  })

  it('traps focus and returns it to the assignment invoker after Escape', async () => {
    apiRequest.mockResolvedValueOnce(response({ results: [], eligible_profiles: [], countries: [] }))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    const trigger = screen.getByRole('button', { name: 'Nueva asignación' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Nueva asignación de Admin Master' })
    const existingMode = screen.getByLabelText('Existente')
    expect(existingMode).toHaveFocus()
    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    closeButton.focus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Crear asignación' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Nueva asignación de Admin Master' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('disables the pending assignment form, prevents reentry, and allows closing it while the request is pending', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    let resolveRequest
    const pendingRequest = new Promise((resolve) => { resolveRequest = resolve })
    apiRequest.mockResolvedValueOnce(response(catalog)).mockReturnValueOnce(pendingRequest).mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva asignación de Admin Master' })
    expect(screen.getByLabelText('Existente')).toBeDisabled()
    expect(screen.getByLabelText('Nuevo')).toBeDisabled()
    expect(screen.getByLabelText('Perfil existente')).toBeDisabled()
    expect(screen.getByLabelText('País')).toBeDisabled()
    expect(screen.getByLabelText('Fecha efectiva (opcional)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled()
    fireEvent.submit(dialog.querySelector('form'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardando...' }))
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Nueva asignación de Admin Master' })).not.toBeInTheDocument()
    await act(async () => {
      resolveRequest(response({ password_temporal: 'only-once' }))
      await pendingRequest
    })
    expect(await screen.findByText('only-once')).toBeInTheDocument()
  })

  it('latches same-turn submissions and permits a deliberate retry after the POST fails', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    let rejectRequest
    const pendingRequest = new Promise((resolve, reject) => { rejectRequest = reject })
    apiRequest.mockResolvedValueOnce(response(catalog)).mockReturnValueOnce(pendingRequest)
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    const form = screen.getByRole('dialog', { name: 'Nueva asignación de Admin Master' }).querySelector('form')

    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)

    await act(async () => {
      rejectRequest(new Error('No disponible'))
      await pendingRequest.catch(() => {})
    })
    expect(await screen.findByText('No disponible')).toBeInTheDocument()

    let resolveRetry
    const retryRequest = new Promise((resolve) => { resolveRetry = resolve })
    apiRequest.mockReturnValueOnce(retryRequest).mockResolvedValueOnce(response(catalog))
    fireEvent.submit(form)
    await waitFor(() => expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2))
    await act(async () => {
      resolveRetry(response({ password_temporal: 'retry-password' }))
      await retryRequest
    })
    expect(await screen.findByText('retry-password')).toBeInTheDocument()
  })

  it('keeps the POST latch after closing and reopening a pending assignment modal', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    let resolveRequest
    const pendingRequest = new Promise((resolve) => { resolveRequest = resolve })
    apiRequest.mockResolvedValueOnce(response(catalog)).mockReturnValueOnce(pendingRequest).mockResolvedValueOnce(response(catalog))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Nueva asignación de Admin Master' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)

    resolveRequest(response({ password_temporal: 'only-once' }))
    expect(await screen.findByText('only-once')).toBeInTheDocument()
  })

  it('keeps the POST latch while navigating away and back during a pending create', async () => {
    const catalog = { results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] }
    let resolveRequest
    const pendingRequest = new Promise((resolve) => { resolveRequest = resolve })
    apiRequest.mockResolvedValueOnce(response(catalog)).mockReturnValueOnce(pendingRequest).mockResolvedValueOnce(response(catalog)).mockResolvedValueOnce(response(catalog))
    render(<MemoryRouter initialEntries={['/admin-master-asignaciones']}><RouteHarness /></MemoryRouter>)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Leave page' }))
    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return page' }))
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)

    await act(async () => {
      resolveRequest(response({}))
      await pendingRequest
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('posts the exact new-profile shape and keeps the modal open with field errors', async () => {
    apiRequest.mockResolvedValueOnce(response({ results: [], eligible_profiles: [], countries: [{ id: 3, name: 'México' }] })).mockResolvedValueOnce(response({ detail: { email: ['Ya está asignado.'] } }, false, 409))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.click(screen.getByLabelText('Nuevo'))
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'marta' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'marta@example.com' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Marta' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'García' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Fecha efectiva (opcional)'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))
    await waitFor(() => expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/admin-master-assignments/', { method: 'POST', body: JSON.stringify({ mode: 'new', username: 'marta', email: 'marta@example.com', first_name: 'Marta', last_name: 'García', country_id: 3, effective_on: '2026-10-01' }) }))
    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).not.toHaveProperty('reason')
    expect(await screen.findByText('Ya está asignado.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nueva asignación de Admin Master' })).toBeInTheDocument()
    expect(screen.getByLabelText('Existente')).toBeEnabled()
    expect(screen.getByLabelText('Nuevo')).toBeEnabled()
    expect(screen.getByLabelText('Nombre de usuario')).toBeEnabled()
    expect(screen.getByLabelText('Email')).toBeEnabled()
    expect(screen.getByLabelText('Nombre')).toBeEnabled()
    expect(screen.getByLabelText('Apellido')).toBeEnabled()
    expect(screen.getByLabelText('País')).toBeEnabled()
    expect(screen.getByLabelText('Fecha efectiva (opcional)')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Crear asignación' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled()
  })

  it('associates non-conflict field errors with their controls', async () => {
    apiRequest.mockResolvedValueOnce(response({ results: [], eligible_profiles: [], countries: [{ id: 3, name: 'México' }] })).mockResolvedValueOnce(response({ detail: { email: ['Formato inválido.'] } }, false, 400))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.click(screen.getByLabelText('Nuevo'))
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'marta' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'marta@example.com' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Marta' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'García' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))

    const error = await screen.findByText('Formato inválido.', { selector: '#ama-email-error' })
    expect(error).toHaveAttribute('role', 'alert')
    expect(error).toHaveTextContent('Formato inválido.')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', error.id)
  })

  it('renders an unknown structured backend error as a form-level alert', async () => {
    apiRequest.mockResolvedValueOnce(response({ results: [], eligible_profiles: [{ id: 7, username: 'ana' }], countries: [{ id: 3, name: 'México' }] })).mockResolvedValueOnce(response({ detail: { non_field_errors: ['No se puede crear esta asignación.'] } }, false, 400))
    render(<AdminMasterAssignmentsPage />)
    await screen.findByText('No hay asignaciones para mostrar.')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva asignación' }))
    fireEvent.change(screen.getByLabelText('Perfil existente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear asignación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede crear esta asignación.')
  })
})
