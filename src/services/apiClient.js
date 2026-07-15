import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './tokenStorage'

const BASE_URL = import.meta.env.VITE_API_URL

let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

function logout() {
  clearTokens()
  window.location.href = '/Login'
}

async function doRefresh() {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('No refresh token')

  const res = await fetch(`${BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })

  if (!res.ok) throw new Error('Refresh failed')

  const data = await res.json()
  setAccessToken(data.access)
  return data.access
}

export async function apiRequest(path, options = {}) {
  const access = getAccessToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...options.headers,
  }

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status !== 401) return res

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).then((newToken) => {
      return fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      })
    })
  }

  isRefreshing = true

  try {
    const newToken = await doRefresh()
    processQueue(null, newToken)
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    })
    return res
  } catch (err) {
    processQueue(err)
    logout()
    throw err
  } finally {
    isRefreshing = false
  }
}
