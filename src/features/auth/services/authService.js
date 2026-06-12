const BASE_URL = import.meta.env.VITE_API_URL

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.detail || 'Error al iniciar sesión')
  }

  return data
}
