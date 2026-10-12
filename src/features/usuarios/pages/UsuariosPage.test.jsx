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

  describe('when the branch already has an assigned GS', () => {
    const assignmentError = 'La sucursal ya tiene un GS asignado.'
    const sucursales = [
      { id_sucursal: 1, nombre: 'Centro' },
      { id_sucursal: 2, nombre: 'Norte' },
    ]
    const usuario = {
      id_usuario: 12,
      nombre: 'Ana',
      email: 'ana@test.com',
      habilitado: true,
      sucursal_actual: sucursales[0],
    }

    function mockAssignmentConflict(usuarios = []) {
      apiRequest.mockImplementation(async (path, options) => {
        if (options?.method) {
          return {
            ...response({ detail: { id_sucursal: [assignmentError] } }, false),
            status: 400,
          }
        }
        if (path === '/api/sucursales/') {
          return response({ count: sucursales.length, results: sucursales })
        }
        if (path === '/api/usuarios/' || path === '/api/usuarios/?habilitado=false') {
          const habilitado = path === '/api/usuarios/'
          const results = usuarios.filter((user) => user.habilitado === habilitado)
          return response({ count: results.length, results })
        }
        throw new Error(`Unexpected request: ${path}`)
      })
    }

    it('shows the nested branch error and preserves entered data when creating a GS', async () => {
      mockAssignmentConflict()
      render(<UsuariosPage />)
      await screen.findByText('No hay usuarios registrados.')

      fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
      fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Ana' } })
      fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'ana@test.com' } })
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

      expect(await screen.findByText(assignmentError)).toBeInTheDocument()
      expect(apiRequest).toHaveBeenCalledWith('/api/usuarios/', {
        method: 'POST',
        body: JSON.stringify({ nombre: 'Ana', email: 'ana@test.com', id_sucursal: 2 }),
      })
      expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
      expect(screen.getByDisplayValue('ana@test.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Norte')).toHaveValue('2')
      expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeEnabled()
    })

    it('shows the nested branch error and keeps the existing assignment when transferring a GS', async () => {
      mockAssignmentConflict([usuario])
      render(<UsuariosPage />)
      await screen.findByText('Ana')

      fireEvent.click(screen.getByTitle('Cambiar sucursal'))
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '2' } })
      fireEvent.click(screen.getByText('Cambiar sucursal', { selector: 'button' }))

      expect(await screen.findByText(assignmentError)).toBeInTheDocument()
      expect(apiRequest).toHaveBeenCalledWith('/api/usuarios/12/cambiar-sucursal/', {
        method: 'POST',
        body: JSON.stringify({ id_sucursal: 2 }),
      })
      expect(screen.getByRole('cell', { name: 'Centro' })).toBeInTheDocument()
      expect(screen.getByDisplayValue('Norte')).toHaveValue('2')
      expect(screen.getByText('Cambiar sucursal', { selector: 'button' })).toBeEnabled()
    })

    it('shows the nested branch error and leaves the GS inactive when reactivation is rejected', async () => {
      mockAssignmentConflict([{ ...usuario, habilitado: false }])
      render(<UsuariosPage />)
      await screen.findByText('No hay usuarios registrados.')
      fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'inactive' } })
      await screen.findByText('Ana')

      fireEvent.click(screen.getByTitle('Editar'))
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

      expect(await screen.findByText(assignmentError)).toBeInTheDocument()
      expect(apiRequest).toHaveBeenCalledWith('/api/usuarios/12/', {
        method: 'PATCH',
        body: JSON.stringify({ nombre: 'Ana', email: 'ana@test.com', habilitado: true }),
      })
      expect(screen.getByRole('cell', { name: 'Inactivo' })).toBeInTheDocument()
      expect(screen.getByLabelText('Mostrar')).toHaveValue('inactive')
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    })
  })
})
