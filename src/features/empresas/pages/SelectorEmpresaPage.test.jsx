import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeRoute } from '../../../App'
import SelectorEmpresaPage from './SelectorEmpresaPage'

const { useAuth, getCompanies } = vi.hoisted(() => ({ useAuth: vi.fn(), getCompanies: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth }))
vi.mock('../../organizacion/services/organizacionService', () => ({ getCompanies }))
vi.mock('../../calendar/pages/CalendarPage', () => ({ default: () => <p>Calendario Analiza</p> }))

const sistemas = { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true, nombre: 'Oscar Canales' }

function renderSelector() {
  render(<MemoryRouter><SelectorEmpresaPage /></MemoryRouter>)
}

describe('SelectorEmpresaPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ perfil: sistemas, logout: vi.fn() })
    getCompanies.mockReset()
  })

  it('muestra una tarjeta por empresa con el destino de su calendario', async () => {
    getCompanies.mockResolvedValue([
      { id: 1, name: 'Analiza', modulo_calendario: 'tareas' },
      { id: 2, name: 'Tuvet', modulo_calendario: 'tuvet' },
    ])
    renderSelector()

    expect(await screen.findByRole('link', { name: 'Entrar a Analiza: Calendario de tareas' })).toHaveAttribute('href', '/calendario')
    expect(screen.getByRole('link', { name: 'Entrar a Tuvet: Calendario Tuvet' })).toHaveAttribute('href', '/tuvet')
    expect(screen.getByRole('heading', { name: /Hola, Oscar/ })).toBeInTheDocument()
  })

  it('ofrece Analiza aunque solo exista la empresa Tuvet registrada', async () => {
    getCompanies.mockResolvedValue([{ id: 1, name: 'Tuvet', modulo_calendario: 'tuvet' }])
    renderSelector()

    const tarjetas = await screen.findAllByRole('link', { name: /Entrar a/ })
    expect(tarjetas.map((tarjeta) => tarjeta.getAttribute('aria-label'))).toEqual([
      'Entrar a Analiza: Calendario de tareas',
      'Entrar a Tuvet: Calendario Tuvet',
    ])
  })

  it('ofrece los dos calendarios conocidos si la API falla', async () => {
    getCompanies.mockRejectedValue(new Error('sin red'))
    renderSelector()

    expect(await screen.findByRole('link', { name: /Entrar a Analiza/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Entrar a Tuvet/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo cargar la lista de empresas')
  })
})

describe('HomeRoute', () => {
  function renderInicio() {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/empresas" element={<p>Selector de empresa</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('lleva a la cuenta de Sistemas al selector de empresa', async () => {
    useAuth.mockReturnValue({ perfil: sistemas })
    renderInicio()
    expect(await screen.findByText('Selector de empresa')).toBeInTheDocument()
  })

  it('mantiene el calendario de tareas para el resto de perfiles', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', activo: true, habilitado: true } })
    renderInicio()
    expect(screen.getByText('Calendario Analiza')).toBeInTheDocument()
  })
})
