import { apiRequest } from '../../../services/apiClient'

const BASE_URL = import.meta.env.VITE_API_URL

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

export async function getMe() {
  const res = await apiRequest('/api/auth/me/')
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Error al obtener perfil')
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
