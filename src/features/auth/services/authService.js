import { apiRequest } from '../../../services/apiClient'

const BASE_URL = import.meta.env.VITE_API_URL

export function decodeToken(token) {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export function normalizeCurrentProfile(payload) {
  if (payload?.perfil && typeof payload.perfil === 'object' && !Array.isArray(payload.perfil)) {
    return payload.perfil
  }

  return payload
}

export async function getCurrentProfile() {
  const res = await apiRequest('/api/auth/me/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'No se pudo obtener el perfil actual.')
  return normalizeCurrentProfile(data)
}

export async function login(email, password, remember = false) {
  const res = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, remember_email: remember }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión')
  return data
}

export async function getRememberedEmail({ signal } = {}) {
  const res = await fetch(`${BASE_URL}/api/auth/remembered-email/`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  })

  if (!res.ok) throw new Error('No se pudo recuperar el correo guardado.')
  const data = await res.json()
  return typeof data?.email === 'string' ? data.email : ''
}

export async function forgetRememberedEmail() {
  const res = await fetch(`${BASE_URL}/api/auth/remembered-email/`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) throw new Error('No se pudo olvidar el correo guardado. Inténtalo de nuevo.')
}

export async function forgotPassword(email) {
  const res = await fetch(`${BASE_URL}/api/auth/forgot-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al solicitar recuperacion de contraseña')
  return data
}

export async function changePassword(current_password, new_password) {
  const res = await apiRequest('/api/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al cambiar contraseña')
  return data
}
