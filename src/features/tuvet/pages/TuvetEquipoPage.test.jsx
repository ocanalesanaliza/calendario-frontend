import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TuvetEquipoPage from './TuvetEquipoPage'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../organizacion/services/organizacionService', () => ({ getCompanies: vi.fn().mockResolvedValue([]) }))

const service = vi.hoisted(() => ({
  getDepartamentos: vi.fn(),
  getEncargados: vi.fn(),
  getGerentesOperaciones: vi.fn(),
  getGerentesSucursal: vi.fn(),
  getGoEncargados: vi.fn(),
}))
vi.mock('../services/tuvetService', async (importOriginal) => ({ ...(await importOriginal()), ...service }))

const lista = (results) => ({ count: results.length, results })

describe('TuvetEquipoPage · buscador', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ perfil: { modulo_calendario: 'tuvet', es_admin_maestro: true, rol_organizacional: 'gp', activo: true, habilitado: true } })
    service.getDepartamentos.mockResolvedValue(lista([{ id: 4, nombre: 'Laboratorio', activo: true, empresa: { id: 2, nombre: 'Tuvet' } }]))
    service.getEncargados.mockResolvedValue(lista([{ id: 42, nombre_completo: 'Ana López', email: 'ana@tuvet.com', departamento: { id: 4, nombre: 'Laboratorio' } }]))
    service.getGerentesOperaciones.mockResolvedValue(lista([{ id: 12, nombre_completo: 'Luis Gómez', email: 'luis@tuvet.com' }]))
    service.getGerentesSucursal.mockResolvedValue(lista([
      { id: 31, nombre_completo: 'María Pérez', email: 'maria@tuvet.com' },
      { id: 32, nombre_completo: 'José Núñez', email: 'jose@tuvet.com' },
    ]))
    service.getGoEncargados.mockResolvedValue(lista([]))
  })

  it('cuenta coincidencias en todos los roles y ofrece saltar a la pestaña con resultados', async () => {
    render(<TuvetEquipoPage />)
    await screen.findByText('Laboratorio', { selector: 'td' })

    fireEvent.change(screen.getByLabelText('Buscar en la estructura'), { target: { value: 'nunez' } })

    const tabGs = screen.getByRole('tab', { name: /Gerentes de sucursal/ })
    expect(within(tabGs).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Sin resultados para “nunez”.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Gerentes de sucursal (1)' }))
    expect(await screen.findByText('José Núñez')).toBeInTheDocument()
    expect(screen.queryByText('María Pérez')).not.toBeInTheDocument()
  })

  it('busca encargados por su departamento', async () => {
    render(<TuvetEquipoPage />)
    await screen.findByText('Laboratorio', { selector: 'td' })

    fireEvent.click(screen.getByRole('tab', { name: /Encargados/ }))
    fireEvent.change(screen.getByLabelText('Buscar en la estructura'), { target: { value: 'labor' } })

    expect(await screen.findByText('Ana López')).toBeInTheDocument()
  })
})
