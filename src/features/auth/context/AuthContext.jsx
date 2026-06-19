import { createContext, useContext, useMemo, useState } from 'react'
import { decodeToken } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    localStorage.removeItem('perfil')
    return localStorage.getItem('access')
  })

  const perfil = useMemo(() => {
    if (!accessToken) return null
    try {
      return decodeToken(accessToken).perfil
    } catch {
      return null
    }
  }, [accessToken])

  function setAuthData(access, refresh) {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
    setAccessToken(access)
  }

  function logout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setAccessToken(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, setAuthData, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
