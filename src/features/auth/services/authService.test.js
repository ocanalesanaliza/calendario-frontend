import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetRememberedEmail,
  getCurrentProfile,
  getRememberedEmail,
  login,
  normalizeCurrentProfile,
} from './authService'

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))

vi.mock('../../../services/apiClient', () => ({ apiRequest }))

describe('public authentication requests', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    apiRequest.mockReset()
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([true, false])('sends remember_email=%s and accepts the login cookie', async (remember) => {
    const session = { access: 'access-token', refresh: 'refresh-token' }
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(session) })

    await expect(login('ana@example.com', 'password', remember)).resolves.toEqual(session)

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/login\/$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'ana@example.com', password: 'password', remember_email: remember }),
    })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('defaults to leaving the email unremembered', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })

    await login('ana@example.com', 'password')

    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(options.body).remember_email).toBe(false)
  })

  it('restores the email using the cookie before an authenticated session exists', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ email: 'ana@example.com' }) })

    await expect(getRememberedEmail({ signal: controller.signal })).resolves.toBe('ana@example.com')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/remembered-email\/$/), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it.each([{ email: null }, {}, { email: 7 }])('returns an empty value when no valid email is remembered: %j', async (response) => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(response) })

    await expect(getRememberedEmail()).resolves.toBe('')
  })

  it('rejects an unsuccessful remembered-email lookup', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ detail: 'Servicio no disponible' }),
    })

    await expect(getRememberedEmail()).rejects.toBeInstanceOf(Error)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('clears the remembered cookie and accepts an empty 204 response', async () => {
    const json = vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'))
    fetchMock.mockResolvedValue({ ok: true, status: 204, json })

    await expect(forgetRememberedEmail()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/remembered-email\/$/), {
      method: 'DELETE',
      credentials: 'include',
    })
    expect(json).not.toHaveBeenCalled()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('rejects an unsuccessful attempt to forget the email', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ detail: 'Servicio no disponible' }),
    })

    await expect(forgetRememberedEmail()).rejects.toBeInstanceOf(Error)
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('getCurrentProfile', () => {
  beforeEach(() => apiRequest.mockReset())

  it('unwraps the HTTP profile envelope before returning it to AuthContext', async () => {
    const profile = { id: 7, nombre: 'Ana', type: 'gerente_area', can_access_my_tasks: true }
    apiRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ perfil: profile }) })

    await expect(getCurrentProfile()).resolves.toEqual(profile)
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/me/')
  })

  it('accepts the temporary flat response contract', () => {
    const profile = { id: 7, nombre: 'Ana', type: 'gerente_area' }

    expect(normalizeCurrentProfile(profile)).toBe(profile)
  })
})
