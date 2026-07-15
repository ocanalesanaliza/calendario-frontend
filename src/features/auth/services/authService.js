import { apiRequest } from '../../../services/apiClient'

const BASE_URL = import.meta.env.VITE_API_URL

export function decodeToken(token) {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión')
  return data
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
