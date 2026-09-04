import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GerentesPage from './GerentesPage'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data, ok = true) => ({ ok, json: vi.fn().mockResolvedValue(data) })

describe('GerentesPage', () => {
  beforeEach(() => {
    apiRequest.mockReset()
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
