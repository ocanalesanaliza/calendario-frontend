import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeRoute } from '../../../App'
import SelectorEmpresaPage from './SelectorEmpresaPage'

const { useAuth, getCompanies, getCountries, getRegions } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getCompanies: vi.fn(),
  getCountries: vi.fn(),
  getRegions: vi.fn(),
}))
vi.mock('../../auth/context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth }))
vi.mock('../../organizacion/services/organizacionService', () => ({
  getCompanies,
  getCountries,
  getRegions,
}))
vi.mock('../../calendar/pages/CalendarPage', () => ({ default: () => <p>Calendario Analiza</p> }))

const sistemas = { type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true, nombre: 'Oscar Canales' }
const refreshProfile = vi.fn()

function renderSelector() {
  render(<MemoryRouter><SelectorEmpresaPage /></MemoryRouter>)
}

describe('SelectorEmpresaPage', () => {
  beforeEach(() => {
    refreshProfile.mockReset().mockResolvedValue({ ...sistemas, modulo_calendario: 'tareas' })
    useAuth.mockReturnValue({ perfil: sistemas, logout: vi.fn(), refreshProfile })
    getCompanies.mockReset()
    getCountries.mockReset()
    getRegions.mockReset()
    sessionStorage.clear()
  })

  it('permite elegir módulo, organización y país, y guarda el contexto elegido', async () => {
    getCompanies.mockResolvedValue([
      { id: 1, name: 'Analiza', modulo_calendario: 'tareas' },
      { id: 2, name: 'Tuvet', modulo_calendario: 'tuvet' },
    ])
    getRegions.mockImplementation((companyId) => Promise.resolve(
      companyId === 1 ? [{ id: 11, name: 'Centroamérica' }] : [{ id: 22, name: 'Centroamérica' }],
    ))
    getCountries.mockImplementation((regionId) => Promise.resolve(
      regionId === 11 ? [{ id: 111, name: 'Honduras' }] : [{ id: 222, name: 'El Salvador' }],
    ))
    renderSelector()

    fireEvent.click(await screen.findByRole('button', { name: /Calendario de tareas/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Organización' }), { target: { value: '1' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar en Honduras' }))

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalledTimes(1)
      expect(JSON.parse(sessionStorage.getItem('calendar_organization_context'))).toEqual({
        company_id: 1,
        country_id: 111,
        company_name: 'Analiza',
        country_name: 'Honduras',
        modulo_calendario: 'tareas',
      })
    })
    expect(screen.getByRole('button', { name: /Calendario Tuvet/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hola, Oscar/ })).toBeInTheDocument()
  })

  it('descarta el contexto si el backend no confirma el módulo seleccionado', async () => {
    getCompanies.mockResolvedValue([{ id: 2, name: 'Tuvet', modulo_calendario: 'tuvet' }])
    getRegions.mockResolvedValue([{ id: 22, name: 'Centroamerica' }])
    getCountries.mockResolvedValue([{ id: 222, name: 'El Salvador' }])
    refreshProfile.mockResolvedValue({ ...sistemas, modulo_calendario: 'tareas' })
    renderSelector()

    fireEvent.click(await screen.findByRole('button', { name: /Calendario Tuvet/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Organización' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar en El Salvador' }))

    expect(await screen.findByText(/No se pudo activar el módulo/)).toBeInTheDocument()
    expect(sessionStorage.getItem('calendar_organization_context')).toBeNull()
  })

  it('no mezcla organizaciones ni países al cambiar de módulo', async () => {
    getCompanies.mockResolvedValue([
      { id: 1, name: 'Analiza', modulo_calendario: 'tareas' },
      { id: 2, name: 'Tuvet', modulo_calendario: 'tuvet' },
    ])
    getRegions.mockImplementation((companyId) => Promise.resolve(
      companyId === 1 ? [{ id: 11, name: 'Centroamérica' }] : [{ id: 22, name: 'Centroamérica' }],
    ))
    getCountries.mockImplementation((regionId) => Promise.resolve(
      regionId === 11 ? [{ id: 111, name: 'Guatemala' }] : [{ id: 222, name: 'El Salvador' }],
    ))
    renderSelector()

    fireEvent.click(await screen.findByRole('button', { name: /Calendario de tareas/ }))
    expect(screen.getByRole('option', { name: 'Analiza' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tuvet' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Calendario Tuvet/ }))
    expect(screen.getByRole('option', { name: 'Tuvet' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Analiza' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Organización' }), { target: { value: '2' } })
    expect(screen.getByRole('button', { name: 'Entrar en El Salvador' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar en Guatemala' })).not.toBeInTheDocument()
  })

  it('no inventa empresas ni permite entrar si una empresa no tiene país', async () => {
    getCompanies.mockResolvedValue([{ id: 1, name: 'Tuvet', modulo_calendario: 'tuvet' }])
    getRegions.mockResolvedValue([])
    renderSelector()

    fireEvent.click(await screen.findByRole('button', { name: /Calendario Tuvet/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Organización' }), { target: { value: '1' } })
    expect(screen.getByText('Configura al menos un país para entrar.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar en/ })).not.toBeInTheDocument()
  })

  it('no usa datos ficticios si la API falla', async () => {
    getCompanies.mockRejectedValue(new Error('sin red'))
    renderSelector()

    expect(await screen.findByText(/No se pudo cargar la jerarquía/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar en/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Administrar organización' })).toBeInTheDocument()
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
