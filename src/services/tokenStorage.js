const ACCESS_KEY = 'access'
const REFRESH_KEY = 'refresh'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY)
}

export function setTokens(access, refresh, remember) {
  const useLocal = remember !== undefined ? remember : Boolean(localStorage.getItem(REFRESH_KEY))
  const storage = useLocal ? localStorage : sessionStorage
  const other = useLocal ? sessionStorage : localStorage

  storage.setItem(ACCESS_KEY, access)
  storage.setItem(REFRESH_KEY, refresh)
  other.removeItem(ACCESS_KEY)
  other.removeItem(REFRESH_KEY)
}

export function setAccessToken(access) {
  const storage = localStorage.getItem(REFRESH_KEY) ? localStorage : sessionStorage
  storage.setItem(ACCESS_KEY, access)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}
