import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizacionPage from './OrganizacionPage'

const service = vi.hoisted(() => ({
  createCompany: vi.fn(), createCountry: vi.fn(), createRegion: vi.fn(),
  getCompanies: vi.fn(), getCountries: vi.fn(), getRegions: vi.fn(),
}))

vi.mock('../services/organizacionService', () => service)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('OrganizacionPage', () => {
  beforeEach(() => {
    Object.values(service).forEach((mock) => mock.mockReset())
    service.getCompanies.mockResolvedValue([{ id: 1, name: 'Analiza' }])
    service.getRegions.mockResolvedValue([{ id: 2, name: 'Centroamérica' }])
    service.getCountries.mockResolvedValue([{ id: 3, name: 'Honduras' }])
    service.createCompany.mockResolvedValue({ id: 4, name: 'Nueva compañía' })
    service.createRegion.mockResolvedValue({ id: 5, company_id: 1, name: 'Nueva región' })
    service.createCountry.mockResolvedValue({ id: 6, region_id: 2, name: 'Nuevo país' })
  })

  it('loads and selects the hierarchy in order', async () => {
    render(<OrganizacionPage />)
    const company = await screen.findByLabelText('Compañía')
    fireEvent.change(company, { target: { value: '1' } })
    await waitFor(() => expect(service.getRegions).toHaveBeenCalledWith('1'))
    const region = await screen.findByLabelText('Región')
    fireEvent.change(region, { target: { value: '2' } })
    await waitFor(() => expect(service.getCountries).toHaveBeenCalledWith('2'))
    expect(await screen.findByText('Honduras')).toBeInTheDocument()
  })

  it('creates each level with the confirmed POST bodies', async () => {
    render(<OrganizacionPage />)
    await screen.findByLabelText('Compañía')
    fireEvent.change(screen.getByLabelText('Nueva compañía'), { target: { value: 'Nueva compañía' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear compañía' }))
    await waitFor(() => expect(service.createCompany).toHaveBeenCalledWith({ name: 'Nueva compañía' }))

    fireEvent.change(screen.getByLabelText('Compañía'), { target: { value: '1' } })
    const region = await screen.findByLabelText('Región')
    fireEvent.change(screen.getByLabelText('Nueva región'), { target: { value: 'Nueva región' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear región' }))
    await waitFor(() => expect(service.createRegion).toHaveBeenCalledWith({ company_id: 1, name: 'Nueva región' }))

    fireEvent.change(region, { target: { value: '2' } })
    await screen.findByText('Honduras')
    fireEvent.change(screen.getByLabelText('Nuevo país'), { target: { value: 'Nuevo país' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear país' }))
    await waitFor(() => expect(service.createCountry).toHaveBeenCalledWith({ region_id: 2, name: 'Nuevo país' }))
  })

  it('shows explicit conflict and unavailable-parent errors', async () => {
    service.createCompany.mockRejectedValue({ status: 409 })
    render(<OrganizacionPage />)
    await screen.findByLabelText('Compañía')
    fireEvent.change(screen.getByLabelText('Nueva compañía'), { target: { value: 'Analiza' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear compañía' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una compañía con ese nombre.')
  })

  it('shows a 403 error and recovers when retrying companies', async () => {
    service.getCompanies.mockRejectedValueOnce({ status: 403 })
    render(<OrganizacionPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para administrar la organización.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Compañía')).toBeInTheDocument()
    expect(service.getCompanies).toHaveBeenCalledTimes(2)
  })

  it('handles a 404 parent response and recovers when retrying regions', async () => {
    service.getRegions.mockRejectedValueOnce({ status: 404 })
    render(<OrganizacionPage />)
    fireEvent.change(await screen.findByLabelText('Compañía'), { target: { value: '1' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('La compañía seleccionado ya no está disponible. Actualiza la selección e inténtalo de nuevo.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Región')).toBeInTheDocument()
    expect(service.getRegions).toHaveBeenCalledTimes(2)
  })

  it('does not request dependent collections without their parent selection', async () => {
    render(<OrganizacionPage />)
    await screen.findByLabelText('Compañía')

    expect(service.getRegions).not.toHaveBeenCalled()
    expect(service.getCountries).not.toHaveBeenCalled()
  })

  it('ignores out-of-order region and country responses', async () => {
    const firstRegions = deferred()
    const secondRegions = deferred()
    const firstCountries = deferred()
    const secondCountries = deferred()
    service.getCompanies.mockResolvedValue([{ id: 1, name: 'Analiza' }, { id: 2, name: 'Global' }])
    service.getRegions
      .mockImplementationOnce(() => firstRegions.promise)
      .mockImplementationOnce(() => secondRegions.promise)
      .mockResolvedValueOnce([{ id: 12, name: 'Sur' }, { id: 13, name: 'Norte' }])
    service.getCountries
      .mockImplementationOnce(() => firstCountries.promise)
      .mockImplementationOnce(() => secondCountries.promise)
    render(<OrganizacionPage />)

    const company = await screen.findByLabelText('Compañía')
    fireEvent.change(company, { target: { value: '1' } })
    fireEvent.change(company, { target: { value: '2' } })
    await act(async () => {
      secondRegions.resolve([{ id: 12, name: 'Sur' }, { id: 13, name: 'Norte' }])
    })
    const region = await screen.findByLabelText('Región')
    expect(screen.getByText('Sur')).toBeInTheDocument()
    await act(async () => { firstRegions.resolve([{ id: 2, name: 'Centroamérica' }]) })
    expect(screen.queryByText('Centroamérica')).not.toBeInTheDocument()

    fireEvent.change(region, { target: { value: '12' } })
    fireEvent.change(region, { target: { value: '13' } })
    await act(async () => { secondCountries.resolve([{ id: 23, name: 'México' }]) })
    expect(await screen.findByText('México')).toBeInTheDocument()
    await act(async () => { firstCountries.resolve([{ id: 22, name: 'Honduras' }]) })
    expect(screen.queryByText('Honduras')).not.toBeInTheDocument()
  })
})
