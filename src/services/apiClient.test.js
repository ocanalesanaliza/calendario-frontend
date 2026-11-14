import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { setOrganizationContext } from './organizationContext'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

describe('apiRequest organization context', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('sessionStorage', createStorage())
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

  it('keeps JSON content type for JSON request bodies', async () => {
    await apiRequest('/api/tareas/', { method: 'POST', body: JSON.stringify({ status: 'open' }) })

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'Content-Type': 'application/json',
    })
  })

  it('omits content type for multipart bodies while retaining authorization and organization headers', async () => {
    sessionStorage.setItem('access', 'token-local')
    setOrganizationContext({ company_id: 7, country_id: 12 })
    const body = new FormData()
    body.append('file', new File(['xlsx-bytes'], 'inventory.xlsx'))

    await apiRequest('/api/inventarios/preview/', { method: 'POST', body })

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer token-local',
      'X-Calendar-Company-ID': '7',
      'X-Calendar-Country-ID': '12',
    })
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type')
  })

  it('keeps multipart headers correct after refreshing an expired access token', async () => {
    sessionStorage.setItem('access', 'expired-token')
    sessionStorage.setItem('refresh', 'refresh-token')
    setOrganizationContext({ company_id: 7, country_id: 12 })
    const body = new FormData()
    body.append('file', new File(['xlsx-bytes'], 'inventory.xlsx'))
    fetchMock
      .mockResolvedValueOnce({ status: 401, json: vi.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ access: 'fresh-token' }) })
      .mockResolvedValueOnce({ status: 200, json: vi.fn().mockResolvedValue({ rows: [] }) })

    await apiRequest('/api/inventarios/preview/', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    expect(fetchMock.mock.calls[2][1].headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
      'X-Calendar-Company-ID': '7',
      'X-Calendar-Country-ID': '12',
    })
    expect(fetchMock.mock.calls[2][1].headers).not.toHaveProperty('Content-Type')
  })
})
