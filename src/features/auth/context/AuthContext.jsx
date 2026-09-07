import { createContext, useContext, useMemo, useState } from 'react'
import { decodeToken } from '../services/authService'
import { clearTokens, getAccessToken, setTokens } from '../../../services/tokenStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    localStorage.removeItem('perfil')
    return getAccessToken()
  })
  const [perfilOverride, setPerfilOverride] = useState(null)

  const tokenPerfil = useMemo(() => {
    if (!accessToken) return null
    try {
      return decodeToken(accessToken).perfil
    } catch {
      return null
    }
  }, [accessToken])
  const perfil = perfilOverride ?? tokenPerfil

  function setAuthData(access, refresh, remember) {
    setTokens(access, refresh, remember)
    setPerfilOverride(null)
    setAccessToken(access)
  }

  function revokeMyTasksAccess() {
    setPerfilOverride((currentPerfil) => ({
      ...(currentPerfil ?? tokenPerfil),
      can_access_my_tasks: false,
    }))
  }

  function logout() {
    clearTokens()
    setPerfilOverride(null)
    setAccessToken(null)
  }

  return (
    <AuthContext.Provider value={{ perfil, setAuthData, revokeMyTasksAccess, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
