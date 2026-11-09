import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { setOrganizationContext } from './organizationContext'


describe('apiRequest organization context', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envía empresa y país seleccionados en cada solicitud autenticada', async () => {
    sessionStorage.setItem('access', 'token-local')
    setOrganizationContext({
      company_id: 7,
      country_id: 12,
      company_name: 'Analiza',
      country_name: 'Honduras',
      modulo_calendario: 'tareas',
    })

    await apiRequest('/api/tareas/')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer token-local',
      'X-Calendar-Company-ID': '7',
      'X-Calendar-Country-ID': '12',
    })
  })

  it('no inventa un contexto cuando todavía no se ha elegido empresa', async () => {
    await apiRequest('/api/calendar/companies/')

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'X-Calendar-Company-ID',
    )
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'X-Calendar-Country-ID',
    )
  })
})
