import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import LoginPage from './LoginPage'

const { login, getRememberedEmail, forgetRememberedEmail, getCurrentProfile } = vi.hoisted(() => ({
  login: vi.fn(),
  getRememberedEmail: vi.fn(),
  forgetRememberedEmail: vi.fn(),
  getCurrentProfile: vi.fn(),
}))

vi.mock('../services/authService', async (importOriginal) => ({
  ...await importOriginal(),
  login,
  getRememberedEmail,
  forgetRememberedEmail,
  getCurrentProfile,
}))

const access = `header.${btoa(JSON.stringify({ perfil: { type: 'gerente_area' } }))}.signature`

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Sesión iniciada</p>} />
          <Route path="/cambiar-password" element={<p>Cambiar contraseña</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password-example' } })
}

describe('LoginPage: Recordarme', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.resetAllMocks()
    login.mockResolvedValue({ access, refresh: 'refresh-token' })
    getRememberedEmail.mockResolvedValue('')
    forgetRememberedEmail.mockResolvedValue(undefined)
    getCurrentProfile.mockResolvedValue({ type: 'gerente_area' })
  })

  it('recovers the saved email when returning to login and leaves the password empty', async () => {
    getRememberedEmail.mockResolvedValue('ana@example.com')
    renderLogin()

    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com'))
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Recordarme' })).toBeChecked()
  })

  it('does not replace an email that the user has already entered with a delayed response', async () => {
    let resolveEmail
    getRememberedEmail.mockReturnValue(new Promise((resolve) => { resolveEmail = resolve }))
    renderLogin()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'otro@example.com' } })

    await act(async () => resolveEmail('ana@example.com'))

    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('otro@example.com')
  })

  it('does not restore a delayed saved email after Recordarme is unchecked', async () => {
    let resolveEmail
    getRememberedEmail.mockReturnValue(new Promise((resolve) => { resolveEmail = resolve }))
    renderLogin()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordarme' }))

    await act(async () => resolveEmail('ana@example.com'))

    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Recordarme' })).not.toBeChecked()
    expect(forgetRememberedEmail).toHaveBeenCalledTimes(1)
  })

  it('sends the preference and persists tokens when Recordarme is checked', async () => {
    renderLogin()
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Sesión iniciada')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('ana@example.com', 'password-example', true)
    expect(localStorage.getItem('access')).toBe(access)
    expect(localStorage.getItem('refresh')).toBe('refresh-token')
    expect(sessionStorage.getItem('access')).toBeNull()
    expect(sessionStorage.getItem('refresh')).toBeNull()
  })

  it('forgets the email and keeps tokens in the tab when Recordarme is unchecked', async () => {
    renderLogin()
    fillCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordarme' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Sesión iniciada')).toBeInTheDocument()
    expect(forgetRememberedEmail).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith('ana@example.com', 'password-example', false)
    expect(sessionStorage.getItem('access')).toBe(access)
    expect(sessionStorage.getItem('refresh')).toBe('refresh-token')
    expect(localStorage.getItem('access')).toBeNull()
    expect(localStorage.getItem('refresh')).toBeNull()
  })

  it('keeps login usable if the saved email cannot be loaded', async () => {
    getRememberedEmail.mockRejectedValue(new Error('Network error'))
    renderLogin()
    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Sesión iniciada')).toBeInTheDocument()
  })

  it('waits for email deletion before allowing a new remembered login', async () => {
    let resolveDeletion
    forgetRememberedEmail.mockReturnValue(new Promise((resolve) => { resolveDeletion = resolve }))
    renderLogin()
    fillCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordarme' }))

    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Recordarme' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: 'Iniciar sesión' }).closest('form'))
    expect(login).not.toHaveBeenCalled()

    await act(async () => resolveDeletion())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordarme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Sesión iniciada')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('ana@example.com', 'password-example', true)
  })

  it('reports a failed deletion and still allows login to send remember_email=false', async () => {
    forgetRememberedEmail.mockRejectedValue(new Error('No se pudo olvidar el correo guardado.'))
    renderLogin()
    fillCredentials()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recordarme' }))

    expect(await screen.findByText('No se pudo olvidar el correo guardado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Sesión iniciada')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('ana@example.com', 'password-example', false)
  })

  it('aborts the saved email lookup when leaving the login page', () => {
    getRememberedEmail.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderLogin()
    const { signal } = getRememberedEmail.mock.calls[0][0]

    unmount()

    expect(signal.aborted).toBe(true)
  })
})
