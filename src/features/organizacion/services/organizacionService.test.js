import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCompany,
  createCountry,
  createRegion,
  getCompanies,
  getCountries,
  getRegions,
} from './organizacionService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../services/apiClient', () => ({ apiRequest }))

const response = (data = {}) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) })

describe('organizacionService', () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(response()))

  it('uses only the confirmed company, region, and country collection contracts', async () => {
    const company = { name: 'Northwind' }
    const region = { company_id: 7, name: 'Andes' }
    const country = { region_id: 11, name: 'Chile' }

    await getCompanies()
    await createCompany(company)
    await getRegions(7)
    await createRegion(region)
    await getCountries(11)
    await createCountry(country)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/calendar/companies/')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/calendar/companies/', {
      method: 'POST', body: JSON.stringify(company),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/calendar/regions/?company_id=7')
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/api/calendar/regions/', {
      method: 'POST', body: JSON.stringify(region),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(5, '/api/calendar/countries/?region_id=11')
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/api/calendar/countries/', {
      method: 'POST', body: JSON.stringify(country),
    })
  })
})
