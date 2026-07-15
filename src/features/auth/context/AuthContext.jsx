import { createContext, useContext, useMemo, useState } from 'react'
import { decodeToken } from '../services/authService'
import { clearTokens, getAccessToken, setTokens } from '../../../services/tokenStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    localStorage.removeItem('perfil')
    return getAccessToken()
  })

  const perfil = useMemo(() => {
    if (!accessToken) return null
    try {
      return decodeToken(accessToken).perfil
    } catch {
      return null
    }
  }, [accessToken])

  function setAuthData(access, refresh, remember) {
    setTokens(access, refresh, remember)
    setAccessToken(access)
  }

  function logout() {
    clearTokens()
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
