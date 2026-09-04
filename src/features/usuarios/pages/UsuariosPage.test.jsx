import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UsuariosPage from './UsuariosPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })

describe('UsuariosPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('keeps the temporary password and delivery warning when refresh fails after creation', async () => {
    apiRequest
      .mockResolvedValueOnce(response({ count: 0, results: [] }))
      .mockResolvedValueOnce(response({ count: 1, results: [{ id_sucursal: 1, nombre: 'Centro' }] }))
      .mockResolvedValueOnce(response({
        usuario: { nombre: 'Ana' },
        password_temporal: 'Temporal123',
        correo_enviado: false,
      }))
      .mockResolvedValueOnce(response({ detail: 'Refresh unavailable' }, false))
      .mockResolvedValueOnce(response({ count: 1, results: [{ id_sucursal: 1, nombre: 'Centro' }] }))

    render(<UsuariosPage />)
    await screen.findByText('No hay usuarios registrados.')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Ana' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'ana@test.com' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(await screen.findByText('Temporal123')).toBeInTheDocument()
    expect(screen.getByText(/no pudo confirmar el envío del correo/)).toBeInTheDocument()
  })

  it('requests inactive users only when that filter is selected and retains it after a mutation', async () => {
    apiRequest.mockResolvedValue(response({ count: 0, results: [] }))
    render(<UsuariosPage />)
    await screen.findByText('No hay usuarios registrados.')
    expect(apiRequest).toHaveBeenCalledWith('/api/usuarios/')
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'inactive' } })
    await screen.findByText('No hay usuarios registrados.')
    expect(apiRequest).toHaveBeenCalledWith('/api/usuarios/?habilitado=false')
  })
})
